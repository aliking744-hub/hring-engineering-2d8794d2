from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.identity.models import User
from hring_api.domains.identity.security_models import UserSecurityToken


async def create_security_token(
    session: AsyncSession,
    *,
    user_id: UUID,
    purpose: str,
    token_hash: str,
    expires_at: datetime,
) -> UserSecurityToken:
    token = UserSecurityToken(
        user_id=user_id,
        purpose=purpose,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    session.add(token)
    await session.flush()
    return token


async def invalidate_security_tokens(
    session: AsyncSession,
    *,
    user_id: UUID,
    purpose: str,
) -> None:
    await session.execute(
        update(UserSecurityToken)
        .where(
            UserSecurityToken.user_id == user_id,
            UserSecurityToken.purpose == purpose,
            UserSecurityToken.consumed_at.is_(None),
        )
        .values(consumed_at=datetime.now(UTC))
    )


async def get_active_security_token(
    session: AsyncSession,
    *,
    token_hash: str,
    purpose: str,
) -> UserSecurityToken | None:
    result = await session.execute(
        select(UserSecurityToken).where(
            UserSecurityToken.token_hash == token_hash,
            UserSecurityToken.purpose == purpose,
            UserSecurityToken.consumed_at.is_(None),
            UserSecurityToken.expires_at > datetime.now(UTC),
        )
    )
    return result.scalar_one_or_none()


async def consume_security_token(
    session: AsyncSession,
    token: UserSecurityToken,
) -> None:
    token.consumed_at = datetime.now(UTC)
    await session.flush()


async def set_password_hash(
    session: AsyncSession,
    *,
    user: User,
    password_hash: str,
) -> None:
    user.password_hash = password_hash
    user.updated_at = datetime.now(UTC)
    await session.flush()


async def mark_email_verified(session: AsyncSession, *, user: User) -> None:
    if user.email_verified_at is None:
        user.email_verified_at = datetime.now(UTC)
        user.updated_at = datetime.now(UTC)
        await session.flush()
