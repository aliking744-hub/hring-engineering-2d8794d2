import json
import re
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.access.repository import (
    count_super_admins,
    list_platform_roles,
    replace_platform_roles,
)
from hring_api.domains.admin.models import SiteSetting
from hring_api.domains.admin.repository import add_audit_log, get_company_for_admin, get_user_for_admin, upsert_site_setting
from hring_api.domains.identity.models import Company, CompanyMember
from hring_api.domains.identity.repository import create_user, get_user_by_email
from hring_api.domains.identity.security import hash_password
from hring_api.domains.identity.session_repository import revoke_all_user_sessions
from hring_api.domains.identity.service import normalize_email


class AdminError(Exception):
    """Base control-center domain error."""


class AdminNotFoundError(AdminError):
    pass


class AdminConflictError(AdminError):
    pass


class AdminSafetyError(AdminError):
    pass


class SensitiveSettingKeyError(AdminError):
    pass


async def create_managed_company(
    session: AsyncSession,
    *,
    actor_user_id: UUID,
    name: str,
    domain: str | None,
    status: str,
    subscription_tier: str,
    monthly_credits: int,
    max_members: int,
    owner_email: str,
    owner_password: str,
    owner_full_name: str,
    ip_address: str | None,
) -> tuple[Company, object]:
    normalized_email = normalize_email(owner_email)
    if await get_user_by_email(session, normalized_email) is not None:
        raise AdminConflictError("Owner email is already registered")

    normalized_domain = domain.strip().lower() if domain else None
    if normalized_domain:
        existing_domain = await session.scalar(
            select(Company.id).where(Company.domain == normalized_domain)
        )
        if existing_domain is not None:
            raise AdminConflictError("Company domain is already registered")

    owner = await create_user(
        session,
        email=normalized_email,
        password_hash=hash_password(owner_password),
        full_name=owner_full_name.strip(),
    )
    from datetime import UTC, datetime

    owner.email_verified_at = datetime.now(UTC)

    company = Company(
        name=name.strip(),
        domain=normalized_domain,
        status=status,
        subscription_tier=subscription_tier,
        monthly_credits=monthly_credits,
        max_members=max_members,
        created_by=actor_user_id,
    )
    session.add(company)
    await session.flush()

    membership = CompanyMember(
        company_id=company.id,
        user_id=owner.id,
        role="ceo",
        can_invite=True,
        is_active=True,
        invited_by=actor_user_id,
    )
    session.add(membership)

    profile = await session.get(__import__("hring_api.domains.identity.models", fromlist=["Profile"]).Profile, owner.id)
    if profile is not None:
        profile.user_type = "corporate"
        profile.subscription_tier = subscription_tier

    await add_audit_log(
        session,
        actor_user_id=actor_user_id,
        company_id=company.id,
        action="platform.company.create",
        resource_type="company",
        resource_id=str(company.id),
        metadata_json={"owner_user_id": str(owner.id), "status": status},
        ip_address=ip_address,
    )
    await session.flush()
    return company, owner


async def update_managed_company(
    session: AsyncSession,
    *,
    actor_user_id: UUID,
    company_id: UUID,
    values: dict[str, object],
    ip_address: str | None,
) -> Company:
    company = await get_company_for_admin(session, company_id)
    if company is None:
        raise AdminNotFoundError("Company not found")

    if "domain" in values:
        raw_domain = values["domain"]
        normalized_domain = str(raw_domain).strip().lower() if raw_domain else None
        if normalized_domain:
            existing_domain = await session.scalar(
                select(Company.id).where(
                    Company.domain == normalized_domain,
                    Company.id != company.id,
                )
            )
            if existing_domain is not None:
                raise AdminConflictError("Company domain is already registered")
        company.domain = normalized_domain

    for field in ("name", "status", "subscription_tier", "monthly_credits", "max_members"):
        if field in values and values[field] is not None:
            setattr(company, field, values[field])

    await add_audit_log(
        session,
        actor_user_id=actor_user_id,
        company_id=company.id,
        action="platform.company.update",
        resource_type="company",
        resource_id=str(company.id),
        metadata_json={"changed_fields": sorted(values.keys())},
        ip_address=ip_address,
    )
    await session.flush()
    return company


async def set_user_active_state(
    session: AsyncSession,
    *,
    actor_user_id: UUID,
    target_user_id: UUID,
    is_active: bool,
    ip_address: str | None,
) -> object:
    if actor_user_id == target_user_id and not is_active:
        raise AdminSafetyError("You cannot deactivate your own account")
    user = await get_user_for_admin(session, target_user_id)
    if user is None:
        raise AdminNotFoundError("User not found")
    user.is_active = is_active
    if not is_active:
        await revoke_all_user_sessions(session, user_id=target_user_id)
    await add_audit_log(
        session,
        actor_user_id=actor_user_id,
        company_id=None,
        action="platform.user.activate" if is_active else "platform.user.deactivate",
        resource_type="user",
        resource_id=str(target_user_id),
        ip_address=ip_address,
    )
    await session.flush()
    return user


async def set_user_platform_roles(
    session: AsyncSession,
    *,
    actor_user_id: UUID,
    target_user_id: UUID,
    roles: list[str],
    ip_address: str | None,
) -> None:
    user = await get_user_for_admin(session, target_user_id)
    if user is None:
        raise AdminNotFoundError("User not found")

    current_roles = await list_platform_roles(session, target_user_id)
    removing_super_admin = "super_admin" in current_roles and "super_admin" not in roles
    if removing_super_admin and await count_super_admins(session) <= 1:
        raise AdminSafetyError("The last super admin cannot be removed")

    await replace_platform_roles(
        session,
        user_id=target_user_id,
        roles=roles,
        actor_user_id=actor_user_id,
    )
    await add_audit_log(
        session,
        actor_user_id=actor_user_id,
        company_id=None,
        action="platform.user.roles.update",
        resource_type="user",
        resource_id=str(target_user_id),
        metadata_json={"roles": roles},
        ip_address=ip_address,
    )


_SETTING_KEY_RE = re.compile(r"^[a-z0-9][a-z0-9_.:-]{0,159}$")
_SENSITIVE_KEY_FRAGMENTS = {
    "secret",
    "password",
    "passwd",
    "token",
    "api_key",
    "apikey",
    "merchant_id",
    "private_key",
    "service_role",
}


def _validate_setting(key: str, value: str | None, value_type: str) -> str:
    normalized_key = key.strip().lower()
    if not _SETTING_KEY_RE.fullmatch(normalized_key):
        raise AdminConflictError("Invalid setting key")
    if any(fragment in normalized_key for fragment in _SENSITIVE_KEY_FRAGMENTS):
        raise SensitiveSettingKeyError("Secrets must use the secret store, not site settings")

    if value is None:
        return normalized_key
    if value_type == "boolean" and value.lower() not in {"true", "false"}:
        raise AdminConflictError("Boolean settings must be true or false")
    if value_type == "number":
        try:
            float(value)
        except ValueError as exc:
            raise AdminConflictError("Number setting is invalid") from exc
    if value_type == "json":
        try:
            json.loads(value)
        except json.JSONDecodeError as exc:
            raise AdminConflictError("JSON setting is invalid") from exc
    if value_type == "url":
        lowered = value.strip().lower()
        if lowered.startswith("javascript:") or lowered.startswith("data:text/html"):
            raise AdminConflictError("Unsafe URL setting")
        if not (
            lowered.startswith("https://")
            or lowered.startswith("http://localhost")
            or lowered.startswith("/")
        ):
            raise AdminConflictError("URL settings must use HTTPS or an internal relative path")
    return normalized_key


async def save_site_setting(
    session: AsyncSession,
    *,
    actor_user_id: UUID,
    key: str,
    value: str | None,
    label: str | None,
    category: str,
    value_type: str,
    is_public: bool,
    ip_address: str | None,
) -> SiteSetting:
    normalized_key = _validate_setting(key, value, value_type)
    row = await upsert_site_setting(
        session,
        key=normalized_key,
        value=value,
        label=label,
        category=category.strip().lower(),
        value_type=value_type,
        is_public=is_public,
        updated_by=actor_user_id,
    )
    await add_audit_log(
        session,
        actor_user_id=actor_user_id,
        company_id=None,
        action="product.setting.update",
        resource_type="site_setting",
        resource_id=normalized_key,
        metadata_json={"category": row.category, "is_public": row.is_public},
        ip_address=ip_address,
    )
    return row
