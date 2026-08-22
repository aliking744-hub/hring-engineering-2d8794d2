import logging
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings
from hring_api.domains.identity.models import User, UserSession
from hring_api.domains.identity.recovery_repository import (
    consume_security_token,
    create_security_token,
    get_active_security_token,
    invalidate_security_tokens,
    mark_email_verified,
    set_password_hash,
)
from hring_api.domains.identity.recovery_security import (
    generate_security_token,
    hash_security_token,
)
from hring_api.domains.identity.repository import get_user_by_email, get_user_by_id, revoke_user_session
from hring_api.domains.identity.security import hash_password, verify_password
from hring_api.domains.identity.service import normalize_email
from hring_api.domains.identity.session_repository import (
    get_owned_session,
    list_user_sessions,
    revoke_all_user_sessions,
)
from hring_api.integrations.email.base import EmailDeliveryError, EmailProvider
from hring_api.integrations.email.providers import DisabledEmailProvider, get_email_provider


logger = logging.getLogger(__name__)


class RecoveryError(Exception):
    """Base recovery-domain error."""


class RecoveryUnavailableError(RecoveryError):
    pass


class InvalidSecurityTokenError(RecoveryError):
    pass


class CurrentPasswordInvalidError(RecoveryError):
    pass


class SessionNotFoundError(RecoveryError):
    pass


async def request_password_reset(
    session: AsyncSession,
    *,
    email: str,
    settings: Settings,
) -> None:
    provider = await _configured_email_provider(session, settings)
    user = await get_user_by_email(session, normalize_email(email))
    if user is None or not user.is_active:
        return

    await invalidate_security_tokens(session, user_id=user.id, purpose="password_reset")
    raw_token = generate_security_token()
    await create_security_token(
        session,
        user_id=user.id,
        purpose="password_reset",
        token_hash=hash_security_token(raw_token, settings),
        expires_at=datetime.now(UTC) + timedelta(minutes=settings.auth_password_reset_ttl_minutes),
    )
    reset_url = _build_app_url(settings, mode="reset-password", token=raw_token)
    try:
        await provider.send_password_reset(
            email=user.email,
            reset_url=reset_url,
            ttl_minutes=settings.auth_password_reset_ttl_minutes,
        )
    except EmailDeliveryError:
        # Password-reset requests must not reveal whether an account exists.
        logger.exception("Password reset delivery failed")


async def reset_password_with_token(
    session: AsyncSession,
    *,
    raw_token: str,
    new_password: str,
    settings: Settings,
) -> None:
    token = await get_active_security_token(
        session,
        token_hash=hash_security_token(raw_token, settings),
        purpose="password_reset",
    )
    if token is None:
        raise InvalidSecurityTokenError("Invalid or expired security token")

    user = await get_user_by_id(session, token.user_id)
    if user is None or not user.is_active:
        raise InvalidSecurityTokenError("Invalid or expired security token")

    await set_password_hash(session, user=user, password_hash=hash_password(new_password))
    await consume_security_token(session, token)
    await revoke_all_user_sessions(session, user_id=user.id)


async def change_password(
    session: AsyncSession,
    *,
    user: User,
    current_password: str,
    new_password: str,
) -> None:
    if user.password_hash is None or not verify_password(current_password, user.password_hash):
        raise CurrentPasswordInvalidError("Current password is incorrect")
    await set_password_hash(session, user=user, password_hash=hash_password(new_password))
    await revoke_all_user_sessions(session, user_id=user.id)


async def request_email_verification(
    session: AsyncSession,
    *,
    user: User,
    settings: Settings,
) -> None:
    if user.email_verified_at is not None:
        return
    provider = await _configured_email_provider(session, settings)
    await invalidate_security_tokens(session, user_id=user.id, purpose="email_verify")
    raw_token = generate_security_token()
    await create_security_token(
        session,
        user_id=user.id,
        purpose="email_verify",
        token_hash=hash_security_token(raw_token, settings),
        expires_at=datetime.now(UTC) + timedelta(hours=settings.auth_email_verify_ttl_hours),
    )
    verification_url = _build_app_url(settings, mode="verify-email", token=raw_token)
    try:
        await provider.send_email_verification(
            email=user.email,
            verification_url=verification_url,
            ttl_hours=settings.auth_email_verify_ttl_hours,
        )
    except EmailDeliveryError as exc:
        raise RecoveryUnavailableError("Email delivery is temporarily unavailable") from exc


async def confirm_email_verification(
    session: AsyncSession,
    *,
    raw_token: str,
    settings: Settings,
) -> None:
    token = await get_active_security_token(
        session,
        token_hash=hash_security_token(raw_token, settings),
        purpose="email_verify",
    )
    if token is None:
        raise InvalidSecurityTokenError("Invalid or expired security token")

    user = await get_user_by_id(session, token.user_id)
    if user is None or not user.is_active:
        raise InvalidSecurityTokenError("Invalid or expired security token")

    await mark_email_verified(session, user=user)
    await consume_security_token(session, token)


async def get_sessions(session: AsyncSession, *, user_id: UUID) -> list[UserSession]:
    return await list_user_sessions(session, user_id)


async def revoke_owned_session(
    session: AsyncSession,
    *,
    user_id: UUID,
    session_id: UUID,
) -> None:
    owned = await get_owned_session(session, user_id=user_id, session_id=session_id)
    if owned is None:
        raise SessionNotFoundError("Session not found")
    await revoke_user_session(session, owned)


async def logout_all_sessions(session: AsyncSession, *, user_id: UUID) -> None:
    await revoke_all_user_sessions(session, user_id=user_id)


async def _configured_email_provider(
    session: AsyncSession,
    settings: Settings,
) -> EmailProvider:
    try:
        provider = await get_email_provider(session, settings)
    except EmailDeliveryError as exc:
        raise RecoveryUnavailableError("Email delivery is not configured") from exc
    if isinstance(provider, DisabledEmailProvider):
        raise RecoveryUnavailableError("Email delivery is not configured")
    return provider


def _build_app_url(settings: Settings, *, mode: str, token: str) -> str:
    base = settings.public_app_url.rstrip("/")
    return f"{base}/auth?{urlencode({'mode': mode, 'token': token})}"
