from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.identity.models import CompanyMember, Profile, User, UserRole, UserSession


async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
    result = await session.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_id(session: AsyncSession, user_id: UUID) -> User | None:
    return await session.get(User, user_id)


async def create_user(
    session: AsyncSession,
    *,
    email: str,
    password_hash: str,
    full_name: str | None,
) -> User:
    user = User(email=email, password_hash=password_hash)
    session.add(user)
    await session.flush()

    profile = Profile(id=user.id, email=email, full_name=full_name)
    session.add(profile)
    await session.flush()
    return user


async def create_user_session(
    session: AsyncSession,
    *,
    user_id: UUID,
    refresh_token_hash: str,
    expires_at: datetime,
    user_agent: str | None,
    ip_address: str | None,
) -> UserSession:
    user_session = UserSession(
        user_id=user_id,
        refresh_token_hash=refresh_token_hash,
        expires_at=expires_at,
        user_agent=user_agent,
        ip_address=ip_address,
    )
    session.add(user_session)
    await session.flush()
    return user_session


async def get_session_by_refresh_hash(
    session: AsyncSession, refresh_token_hash: str
) -> UserSession | None:
    result = await session.execute(
        select(UserSession).where(UserSession.refresh_token_hash == refresh_token_hash)
    )
    return result.scalar_one_or_none()


async def get_session_by_id(session: AsyncSession, session_id: UUID) -> UserSession | None:
    return await session.get(UserSession, session_id)


async def rotate_user_session(
    session: AsyncSession,
    user_session: UserSession,
    *,
    refresh_token_hash: str,
    expires_at: datetime,
) -> None:
    user_session.refresh_token_hash = refresh_token_hash
    user_session.expires_at = expires_at
    user_session.last_seen_at = datetime.now(UTC)
    await session.flush()


async def revoke_user_session(session: AsyncSession, user_session: UserSession) -> None:
    if user_session.revoked_at is None:
        user_session.revoked_at = datetime.now(UTC)
        await session.flush()


async def list_user_roles(session: AsyncSession, user_id: UUID) -> list[str]:
    result = await session.execute(select(UserRole.role).where(UserRole.user_id == user_id))
    return list(result.scalars().all())


async def list_company_memberships(session: AsyncSession, user_id: UUID) -> list[CompanyMember]:
    result = await session.execute(
        select(CompanyMember).where(
            CompanyMember.user_id == user_id,
            CompanyMember.is_active.is_(True),
        )
    )
    return list(result.scalars().all())
