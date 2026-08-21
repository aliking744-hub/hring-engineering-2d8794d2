from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings
from hring_api.domains.identity.models import User
from hring_api.domains.identity.repository import (
    create_user,
    create_user_session,
    get_session_by_refresh_hash,
    get_user_by_email,
    get_user_by_id,
    revoke_user_session,
    rotate_user_session,
)
from hring_api.domains.identity.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)


class IdentityError(Exception):
    """Base identity-domain error."""


class EmailAlreadyExistsError(IdentityError):
    pass


class InvalidCredentialsError(IdentityError):
    pass


class InvalidRefreshTokenError(IdentityError):
    pass


@dataclass(frozen=True)
class AuthTokens:
    access_token: str
    refresh_token: str
    access_expires_at: datetime
    refresh_expires_at: datetime


@dataclass(frozen=True)
class AuthResult:
    user: User
    tokens: AuthTokens


def normalize_email(email: str) -> str:
    return email.strip().lower()


async def register(
    session: AsyncSession,
    *,
    email: str,
    password: str,
    full_name: str | None,
    settings: Settings,
    user_agent: str | None,
    ip_address: str | None,
) -> AuthResult:
    normalized_email = normalize_email(email)
    if await get_user_by_email(session, normalized_email) is not None:
        raise EmailAlreadyExistsError("Email is already registered")

    user = await create_user(
        session,
        email=normalized_email,
        password_hash=hash_password(password),
        full_name=full_name.strip() if full_name else None,
    )
    return await create_authenticated_session(
        session,
        user=user,
        settings=settings,
        user_agent=user_agent,
        ip_address=ip_address,
    )


async def login(
    session: AsyncSession,
    *,
    email: str,
    password: str,
    settings: Settings,
    user_agent: str | None,
    ip_address: str | None,
) -> AuthResult:
    user = await get_user_by_email(session, normalize_email(email))
    if (
        user is None
        or not user.is_active
        or user.password_hash is None
        or not verify_password(password, user.password_hash)
    ):
        raise InvalidCredentialsError("Invalid email or password")

    return await create_authenticated_session(
        session,
        user=user,
        settings=settings,
        user_agent=user_agent,
        ip_address=ip_address,
    )


async def refresh(
    session: AsyncSession,
    *,
    refresh_token: str,
    settings: Settings,
) -> AuthResult:
    current_hash = hash_refresh_token(refresh_token)
    user_session = await get_session_by_refresh_hash(session, current_hash)
    now = datetime.now(UTC)
    if (
        user_session is None
        or user_session.revoked_at is not None
        or user_session.expires_at <= now
    ):
        raise InvalidRefreshTokenError("Refresh token is invalid or expired")

    user = await get_user_by_id(session, user_session.user_id)
    if user is None or not user.is_active:
        raise InvalidRefreshTokenError("Refresh token is invalid or expired")

    next_refresh_token = generate_refresh_token()
    refresh_expires_at = now + timedelta(days=settings.auth_refresh_token_days)
    await rotate_user_session(
        session,
        user_session,
        refresh_token_hash=hash_refresh_token(next_refresh_token),
        expires_at=refresh_expires_at,
    )
    access_token, access_expires_at = create_access_token(
        user_id=user.id,
        session_id=user_session.id,
        settings=settings,
        now=now,
    )
    return AuthResult(
        user=user,
        tokens=AuthTokens(
            access_token=access_token,
            refresh_token=next_refresh_token,
            access_expires_at=access_expires_at,
            refresh_expires_at=refresh_expires_at,
        ),
    )


async def logout(session: AsyncSession, *, refresh_token: str) -> None:
    user_session = await get_session_by_refresh_hash(session, hash_refresh_token(refresh_token))
    if user_session is not None:
        await revoke_user_session(session, user_session)


async def create_authenticated_session(
    session: AsyncSession,
    *,
    user: User,
    settings: Settings,
    user_agent: str | None,
    ip_address: str | None,
) -> AuthResult:
    now = datetime.now(UTC)
    refresh_token = generate_refresh_token()
    refresh_expires_at = now + timedelta(days=settings.auth_refresh_token_days)
    user_session = await create_user_session(
        session,
        user_id=user.id,
        refresh_token_hash=hash_refresh_token(refresh_token),
        expires_at=refresh_expires_at,
        user_agent=user_agent,
        ip_address=ip_address,
    )
    access_token, access_expires_at = create_access_token(
        user_id=user.id,
        session_id=user_session.id,
        settings=settings,
        now=now,
    )
    return AuthResult(
        user=user,
        tokens=AuthTokens(
            access_token=access_token,
            refresh_token=refresh_token,
            access_expires_at=access_expires_at,
            refresh_expires_at=refresh_expires_at,
        ),
    )
