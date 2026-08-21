from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.identity.models import UserSession


async def list_user_sessions(session: AsyncSession, user_id: UUID) -> list[UserSession]:
    result = await session.execute(
        select(UserSession)
        .where(UserSession.user_id == user_id)
        .order_by(UserSession.created_at.desc())
    )
    return list(result.scalars().all())


async def get_owned_session(
    session: AsyncSession,
    *,
    user_id: UUID,
    session_id: UUID,
) -> UserSession | None:
    result = await session.execute(
        select(UserSession).where(
            UserSession.id == session_id,
            UserSession.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def revoke_all_user_sessions(
    session: AsyncSession,
    *,
    user_id: UUID,
    except_session_id: UUID | None = None,
) -> int:
    statement = (
        update(UserSession)
        .where(
            UserSession.user_id == user_id,
            UserSession.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(UTC))
    )
    if except_session_id is not None:
        statement = statement.where(UserSession.id != except_session_id)
    result = await session.execute(statement)
    return int(result.rowcount or 0)
