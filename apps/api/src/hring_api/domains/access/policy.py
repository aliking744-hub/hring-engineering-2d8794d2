from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.db.session import get_db_session
from hring_api.domains.access.repository import (
    get_company_permission_override,
    list_platform_roles,
)
from hring_api.domains.identity.dependencies import Principal, get_current_principal
from hring_api.domains.identity.models import CompanyMember


PLATFORM_ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    "super_admin": frozenset({"*"}),
    "platform_admin": frozenset(
        {
            "platform.dashboard.read",
            "platform.users.read",
            "platform.users.manage",
            "platform.companies.read",
            "platform.companies.manage",
            "platform.feature_access.manage",
            "platform.audit.read",
            "platform.ai_usage.read",
            "platform.ai_rates.manage",
            "platform.billing.read",
            "platform.billing.manage",
        }
    ),
    "content_admin": frozenset(
        {
            "product.settings.read",
            "product.settings.manage",
            "product.seo.manage",
            "product.content.manage",
        }
    ),
    "support_admin": frozenset(
        {
            "platform.dashboard.read",
            "platform.users.read",
            "platform.companies.read",
            "platform.audit.read",
            "platform.billing.read",
        }
    ),
}

# Legacy independent-foundation `admin` remains recognized during migration.
LEGACY_APP_ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    "admin": PLATFORM_ROLE_PERMISSIONS["platform_admin"],
}

COMPANY_PERMISSION_CATALOG: dict[str, str] = {
    "company.profile.read": "مشاهده اطلاعات شرکت",
    "company.members.read": "مشاهده کاربران شرکت",
    "company.members.manage": "مدیریت کاربران، نقش و رمز عبور",
    "company.invites.read": "مشاهده دعوت‌نامه‌ها",
    "company.invites.manage": "ایجاد و لغو دعوت‌نامه‌ها",
    "company.settings.read": "مشاهده تنظیمات شرکت",
    "company.settings.manage": "ویرایش تنظیمات شرکت",
    "company.features.read": "مشاهده دسترسی ماژول‌ها",
    "company.features.manage": "مدیریت دسترسی ماژول‌ها",
    "company.billing.read": "مشاهده پلن، اعتبار و مصرف",
}

DEFAULT_COMPANY_ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    "ceo": frozenset(COMPANY_PERMISSION_CATALOG.keys()),
    "deputy": frozenset(
        {
            "company.profile.read",
            "company.members.read",
            "company.invites.read",
            "company.invites.manage",
            "company.settings.read",
            "company.features.read",
            "company.billing.read",
        }
    ),
    "manager": frozenset(
        {
            "company.profile.read",
            "company.members.read",
            "company.settings.read",
            "company.features.read",
            "company.billing.read",
        }
    ),
    "employee": frozenset(
        {
            "company.profile.read",
            "company.features.read",
        }
    ),
}


@dataclass(frozen=True)
class PlatformPrincipal:
    principal: Principal
    platform_roles: tuple[str, ...]

    @property
    def user_id(self) -> UUID:
        return self.principal.user_id


PlatformPermissionDependency = Callable[..., Awaitable[PlatformPrincipal]]


def _platform_permissions_for_roles(
    platform_roles: list[str],
    legacy_app_roles: list[str],
) -> set[str]:
    permissions: set[str] = set()
    for role in platform_roles:
        permissions.update(PLATFORM_ROLE_PERMISSIONS.get(role, frozenset()))
    for role in legacy_app_roles:
        permissions.update(LEGACY_APP_ROLE_PERMISSIONS.get(role, frozenset()))
    return permissions


def require_platform_permission(permission_key: str) -> PlatformPermissionDependency:
    async def dependency(
        principal: Principal = Depends(get_current_principal),
        db: AsyncSession = Depends(get_db_session),
    ) -> PlatformPrincipal:
        roles = await list_platform_roles(db, principal.user_id)
        permissions = _platform_permissions_for_roles(roles, principal.app_roles)
        if "*" not in permissions and permission_key not in permissions:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return PlatformPrincipal(principal=principal, platform_roles=tuple(roles))

    return dependency


async def is_company_permission_allowed(
    session: AsyncSession,
    *,
    membership: CompanyMember,
    permission_key: str,
) -> bool:
    if permission_key not in COMPANY_PERMISSION_CATALOG:
        return False
    if membership.role == "ceo":
        return True

    override = await get_company_permission_override(
        session,
        company_id=membership.company_id,
        role=membership.role,
        permission_key=permission_key,
    )
    if override is not None:
        return override.allowed

    if permission_key == "company.invites.manage" and membership.can_invite:
        return True

    return permission_key in DEFAULT_COMPANY_ROLE_PERMISSIONS.get(membership.role, frozenset())


async def require_company_permission(
    session: AsyncSession,
    *,
    membership: CompanyMember,
    permission_key: str,
) -> None:
    if not await is_company_permission_allowed(
        session,
        membership=membership,
        permission_key=permission_key,
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
