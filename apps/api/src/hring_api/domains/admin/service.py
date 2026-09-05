import json
import re
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.access.repository import (
    count_super_admins,
    list_platform_roles,
    replace_platform_roles,
)
from hring_api.domains.admin.models import SiteSetting
from hring_api.domains.admin.repository import (
    add_audit_log,
    get_company_for_admin,
    get_user_for_admin,
    upsert_site_setting,
)
from hring_api.domains.billing.credit_service import replace_available_credits_for_plan
from hring_api.domains.identity.models import Company, CompanyMember, Profile, User
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


async def create_managed_user(
    session: AsyncSession,
    *,
    actor_user_id: UUID,
    email: str,
    password: str,
    full_name: str,
    company_id: UUID | None,
    company_role: str,
    ip_address: str | None,
) -> User:
    normalized_email = normalize_email(email)
    if await get_user_by_email(session, normalized_email) is not None:
        raise AdminConflictError("این ایمیل قبلاً ثبت شده است")

    company: Company | None = None
    if company_id is not None:
        company = await get_company_for_admin(session, company_id)
        if company is None:
            raise AdminNotFoundError("Company not found")
        if company.status == "suspended":
            raise AdminConflictError("Company is suspended")
        active_members = await session.scalar(
            select(func.count(CompanyMember.id)).where(
                CompanyMember.company_id == company.id,
                CompanyMember.is_active.is_(True),
            )
        )
        if int(active_members or 0) >= company.max_members:
            raise AdminConflictError("ظرفیت اعضای شرکت تکمیل شده است")

    user = await create_user(
        session,
        email=normalized_email,
        password_hash=hash_password(password),
        full_name=full_name.strip(),
    )
    user.email_verified_at = datetime.now(UTC)
    profile = await session.get(Profile, user.id)
    if profile is not None and company is not None:
        profile.user_type = "corporate"
        profile.subscription_tier = company.subscription_tier
    if company is not None:
        session.add(
            CompanyMember(
                company_id=company.id,
                user_id=user.id,
                role=company_role,
                can_invite=False,
                is_active=True,
                invited_by=actor_user_id,
            )
        )
    await add_audit_log(
        session,
        actor_user_id=actor_user_id,
        company_id=company.id if company is not None else None,
        action="platform.user.create",
        resource_type="user",
        resource_id=str(user.id),
        metadata_json={
            "company_id": str(company.id) if company is not None else None,
            "company_role": company_role if company is not None else None,
        },
        ip_address=ip_address,
    )
    await session.flush()
    return user


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
) -> tuple[Company, User]:
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
    owner.email_verified_at = datetime.now(UTC)

    company = Company(
        name=name.strip(),
        domain=normalized_domain,
        status=status,
        subscription_tier=subscription_tier,
        monthly_credits=monthly_credits,
        credit_pool=monthly_credits,
        max_members=max_members,
        created_by=actor_user_id,
    )
    session.add(company)
    await session.flush()

    session.add(
        CompanyMember(
            company_id=company.id,
            user_id=owner.id,
            role="ceo",
            can_invite=True,
            is_active=True,
            invited_by=actor_user_id,
        )
    )

    profile = await session.get(Profile, owner.id)
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
    request_id: str | None,
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

    if "name" in values and isinstance(values["name"], str):
        company.name = values["name"].strip()
    if "status" in values and isinstance(values["status"], str):
        company.status = values["status"]
    if "subscription_tier" in values and isinstance(values["subscription_tier"], str):
        company.subscription_tier = values["subscription_tier"]
    if "monthly_credits" in values and isinstance(values["monthly_credits"], int):
        target_credits = values["monthly_credits"]
        if target_credits != company.monthly_credits:
            await replace_available_credits_for_plan(
                session,
                owner_type="company",
                owner_id=company.id,
                target_credits=target_credits,
                operation_key=f"platform-company-allocation:{company.id}:{uuid4()}",
                actor_user_id=actor_user_id,
                request_id=request_id,
                grant_reason="Platform company credit allocation",
                source="platform_company_update",
            )
            company.monthly_credits = target_credits
            company.used_credits = 0
            company.credit_pool = target_credits
    if "max_members" in values and isinstance(values["max_members"], int):
        company.max_members = values["max_members"]

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
) -> User:
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
