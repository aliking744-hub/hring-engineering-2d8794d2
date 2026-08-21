from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.identity.models import (
    Company,
    CompanyInvite,
    CompanyMember,
    Profile,
    User,
)


async def get_company(
    session: AsyncSession,
    company_id: UUID,
    *,
    for_update: bool = False,
) -> Company | None:
    statement = select(Company).where(Company.id == company_id)
    if for_update:
        statement = statement.with_for_update()
    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def get_membership(
    session: AsyncSession,
    *,
    company_id: UUID,
    user_id: UUID,
    active_only: bool = False,
) -> CompanyMember | None:
    statement = select(CompanyMember).where(
        CompanyMember.company_id == company_id,
        CompanyMember.user_id == user_id,
    )
    if active_only:
        statement = statement.where(CompanyMember.is_active.is_(True))
    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def get_member_by_id(
    session: AsyncSession,
    *,
    company_id: UUID,
    member_id: UUID,
) -> CompanyMember | None:
    result = await session.execute(
        select(CompanyMember).where(
            CompanyMember.company_id == company_id,
            CompanyMember.id == member_id,
        )
    )
    return result.scalar_one_or_none()


async def get_member_by_user(
    session: AsyncSession,
    *,
    company_id: UUID,
    user_id: UUID,
) -> CompanyMember | None:
    return await get_membership(
        session,
        company_id=company_id,
        user_id=user_id,
        active_only=False,
    )


async def count_active_members(session: AsyncSession, company_id: UUID) -> int:
    result = await session.execute(
        select(func.count(CompanyMember.id)).where(
            CompanyMember.company_id == company_id,
            CompanyMember.is_active.is_(True),
        )
    )
    return int(result.scalar_one())


async def list_members_with_profiles(
    session: AsyncSession,
    company_id: UUID,
) -> list[tuple[CompanyMember, Profile | None]]:
    result = await session.execute(
        select(CompanyMember, Profile)
        .outerjoin(Profile, Profile.id == CompanyMember.user_id)
        .where(
            CompanyMember.company_id == company_id,
            CompanyMember.is_active.is_(True),
        )
        .order_by(CompanyMember.joined_at.asc())
    )
    return [(member, profile) for member, profile in result.all()]


async def list_active_invites(
    session: AsyncSession,
    company_id: UUID,
) -> list[CompanyInvite]:
    result = await session.execute(
        select(CompanyInvite)
        .where(
            CompanyInvite.company_id == company_id,
            CompanyInvite.is_active.is_(True),
        )
        .order_by(CompanyInvite.created_at.desc())
    )
    return list(result.scalars().all())


async def get_invite_by_id(
    session: AsyncSession,
    *,
    company_id: UUID,
    invite_id: UUID,
) -> CompanyInvite | None:
    result = await session.execute(
        select(CompanyInvite).where(
            CompanyInvite.company_id == company_id,
            CompanyInvite.id == invite_id,
        )
    )
    return result.scalar_one_or_none()


async def get_invite_by_code(
    session: AsyncSession,
    invite_code: str,
    *,
    for_update: bool = False,
) -> CompanyInvite | None:
    statement = select(CompanyInvite).where(CompanyInvite.invite_code == invite_code)
    if for_update:
        statement = statement.with_for_update()
    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def get_user(session: AsyncSession, user_id: UUID) -> User | None:
    return await session.get(User, user_id)


async def get_profile(session: AsyncSession, user_id: UUID) -> Profile | None:
    return await session.get(Profile, user_id)
