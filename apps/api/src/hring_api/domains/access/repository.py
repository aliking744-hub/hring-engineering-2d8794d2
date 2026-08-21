from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.access.models import CompanyRolePermission, PlatformRoleAssignment


async def list_platform_roles(session: AsyncSession, user_id: UUID) -> list[str]:
    result = await session.execute(
        select(PlatformRoleAssignment.role).where(PlatformRoleAssignment.user_id == user_id)
    )
    return list(result.scalars().all())


async def list_company_permission_overrides(
    session: AsyncSession,
    *,
    company_id: UUID,
    role: str | None = None,
) -> list[CompanyRolePermission]:
    statement = select(CompanyRolePermission).where(CompanyRolePermission.company_id == company_id)
    if role is not None:
        statement = statement.where(CompanyRolePermission.role == role)
    result = await session.execute(statement.order_by(CompanyRolePermission.role, CompanyRolePermission.permission_key))
    return list(result.scalars().all())


async def get_company_permission_override(
    session: AsyncSession,
    *,
    company_id: UUID,
    role: str,
    permission_key: str,
) -> CompanyRolePermission | None:
    result = await session.execute(
        select(CompanyRolePermission).where(
            CompanyRolePermission.company_id == company_id,
            CompanyRolePermission.role == role,
            CompanyRolePermission.permission_key == permission_key,
        )
    )
    return result.scalar_one_or_none()


async def set_company_permission_override(
    session: AsyncSession,
    *,
    company_id: UUID,
    role: str,
    permission_key: str,
    allowed: bool,
    updated_by: UUID,
) -> CompanyRolePermission:
    row = await get_company_permission_override(
        session,
        company_id=company_id,
        role=role,
        permission_key=permission_key,
    )
    if row is None:
        row = CompanyRolePermission(
            company_id=company_id,
            role=role,
            permission_key=permission_key,
            allowed=allowed,
            updated_by=updated_by,
        )
        session.add(row)
    else:
        row.allowed = allowed
        row.updated_by = updated_by
    await session.flush()
    return row


async def replace_platform_roles(
    session: AsyncSession,
    *,
    user_id: UUID,
    roles: list[str],
    actor_user_id: UUID,
) -> None:
    await session.execute(
        delete(PlatformRoleAssignment).where(PlatformRoleAssignment.user_id == user_id)
    )
    session.add_all(
        [
            PlatformRoleAssignment(
                user_id=user_id,
                role=role,
                created_by=actor_user_id,
            )
            for role in roles
        ]
    )
    await session.flush()


async def count_super_admins(session: AsyncSession) -> int:
    result = await session.execute(
        select(PlatformRoleAssignment.id).where(PlatformRoleAssignment.role == "super_admin")
    )
    return len(result.scalars().all())
