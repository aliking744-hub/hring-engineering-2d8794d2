from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.identity.account_security_models import (
    LoginAttempt,
    MfaFactor,
    MfaRecoveryCode,
)
from hring_api.domains.identity.models import User, UserSession


async def get_user_by_email_for_update(session: AsyncSession, email: str) -> User | None:
    result = await session.execute(select(User).where(User.email == email).with_for_update())
    return result.scalar_one_or_none()


async def lock_user_for_account_security(session: AsyncSession, user_id: UUID) -> None:
    await session.execute(select(User.id).where(User.id == user_id).with_for_update())


async def get_mfa_factor(
    session: AsyncSession,
    user_id: UUID,
    *,
    for_update: bool = False,
) -> MfaFactor | None:
    statement = select(MfaFactor).where(
        MfaFactor.user_id == user_id,
        MfaFactor.factor_type == "totp",
    )
    if for_update:
        statement = statement.with_for_update()
    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def save_pending_mfa_factor(
    session: AsyncSession,
    *,
    user_id: UUID,
    secret_ciphertext: str,
) -> MfaFactor:
    factor = await get_mfa_factor(session, user_id, for_update=True)
    if factor is None:
        factor = MfaFactor(
            user_id=user_id,
            factor_type="totp",
            status="pending",
            secret_ciphertext=secret_ciphertext,
        )
        session.add(factor)
    else:
        factor.status = "pending"
        factor.secret_ciphertext = secret_ciphertext
        factor.last_used_step = None
        factor.verified_at = None
    await session.flush()
    return factor


async def replace_recovery_codes(
    session: AsyncSession,
    *,
    user_id: UUID,
    code_hashes: list[str],
) -> None:
    await session.execute(delete(MfaRecoveryCode).where(MfaRecoveryCode.user_id == user_id))
    session.add_all(
        MfaRecoveryCode(user_id=user_id, code_hash=code_hash) for code_hash in code_hashes
    )
    await session.flush()


async def consume_recovery_code(
    session: AsyncSession,
    *,
    user_id: UUID,
    code_hash: str,
) -> bool:
    result = await session.execute(
        select(MfaRecoveryCode)
        .where(
            MfaRecoveryCode.user_id == user_id,
            MfaRecoveryCode.code_hash == code_hash,
            MfaRecoveryCode.consumed_at.is_(None),
        )
        .with_for_update()
    )
    row = result.scalar_one_or_none()
    if row is None:
        return False
    row.consumed_at = datetime.now(UTC)
    await session.flush()
    return True


async def count_available_recovery_codes(session: AsyncSession, user_id: UUID) -> int:
    value = await session.scalar(
        select(func.count(MfaRecoveryCode.id)).where(
            MfaRecoveryCode.user_id == user_id,
            MfaRecoveryCode.consumed_at.is_(None),
        )
    )
    return int(value or 0)


async def delete_mfa_credentials(session: AsyncSession, *, user_id: UUID) -> None:
    await session.execute(delete(MfaRecoveryCode).where(MfaRecoveryCode.user_id == user_id))
    await session.execute(delete(MfaFactor).where(MfaFactor.user_id == user_id))
    await session.flush()


async def mark_session_mfa_verified(
    session: AsyncSession,
    *,
    session_id: UUID,
    method: str,
) -> UserSession | None:
    user_session = await session.get(UserSession, session_id, with_for_update=True)
    if user_session is None or user_session.revoked_at is not None:
        return None
    user_session.mfa_verified_at = datetime.now(UTC)
    user_session.mfa_method = method
    await session.flush()
    return user_session


async def clear_session_mfa_state(session: AsyncSession, *, user_id: UUID) -> None:
    result = await session.execute(select(UserSession).where(UserSession.user_id == user_id))
    for user_session in result.scalars():
        user_session.mfa_verified_at = None
        user_session.mfa_method = None
    await session.flush()


async def add_login_attempt(
    session: AsyncSession,
    *,
    user_id: UUID | None,
    email_hash: str,
    outcome: str,
    ip_address: str | None,
    user_agent: str | None,
) -> LoginAttempt:
    row = LoginAttempt(
        user_id=user_id,
        email_hash=email_hash,
        outcome=outcome,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    session.add(row)
    await session.flush()
    return row


async def prune_login_attempts_before(
    session: AsyncSession,
    *,
    cutoff: datetime,
) -> None:
    await session.execute(delete(LoginAttempt).where(LoginAttempt.created_at < cutoff))
