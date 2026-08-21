from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings
from hring_api.domains.identity.repository import get_user_by_id
from hring_api.domains.identity.service import AuthResult, create_authenticated_session
from hring_api.domains.identity.sms_models import SmsOtpChallenge
from hring_api.domains.identity.sms_repository import (
    bind_verified_phone,
    create_sms_challenge,
    get_phone_identity_by_phone,
    get_sms_challenge,
    has_recent_sms_challenge,
)
from hring_api.domains.identity.sms_security import (
    generate_otp_code,
    hash_otp_code,
    normalize_phone_e164,
    verify_otp_code,
)
from hring_api.integrations.sms.base import SmsDeliveryError
from hring_api.integrations.sms.providers import get_sms_provider


class SmsAuthError(Exception):
    """Base SMS authentication error."""


class SmsUnavailableError(SmsAuthError):
    pass


class SmsRateLimitedError(SmsAuthError):
    pass


class InvalidSmsChallengeError(SmsAuthError):
    pass


class PhoneUnavailableError(SmsAuthError):
    pass


@dataclass(frozen=True)
class SmsChallengeResult:
    challenge_id: UUID
    expires_at: datetime


async def request_login_otp(
    session: AsyncSession,
    *,
    phone: str,
    settings: Settings,
) -> SmsChallengeResult:
    _ensure_sms_configured(settings)
    phone_e164 = normalize_phone_e164(phone)
    await _ensure_not_rate_limited(session, phone_e164=phone_e164, settings=settings)

    phone_identity = await get_phone_identity_by_phone(session, phone_e164)
    user_id = phone_identity.user_id if phone_identity is not None else None
    challenge, code = await _create_challenge(
        session,
        phone_e164=phone_e164,
        user_id=user_id,
        purpose="login",
        settings=settings,
    )

    if phone_identity is not None:
        await _deliver_code(phone_e164=phone_e164, code=code, settings=settings)

    return SmsChallengeResult(challenge_id=challenge.id, expires_at=challenge.expires_at)


async def verify_login_otp(
    session: AsyncSession,
    *,
    challenge_id: UUID,
    code: str,
    settings: Settings,
    user_agent: str | None,
    ip_address: str | None,
) -> AuthResult:
    challenge = await _validate_challenge(
        session,
        challenge_id=challenge_id,
        code=code,
        purpose="login",
        settings=settings,
    )
    if challenge.user_id is None:
        challenge.consumed_at = datetime.now(UTC)
        await session.flush()
        raise InvalidSmsChallengeError("Invalid or expired SMS challenge")

    user = await get_user_by_id(session, challenge.user_id)
    if user is None or not user.is_active:
        challenge.consumed_at = datetime.now(UTC)
        await session.flush()
        raise InvalidSmsChallengeError("Invalid or expired SMS challenge")

    challenge.consumed_at = datetime.now(UTC)
    await session.flush()
    return await create_authenticated_session(
        session,
        user=user,
        settings=settings,
        user_agent=user_agent,
        ip_address=ip_address,
    )


async def request_phone_verification_otp(
    session: AsyncSession,
    *,
    user_id: UUID,
    phone: str,
    settings: Settings,
) -> SmsChallengeResult:
    _ensure_sms_configured(settings)
    phone_e164 = normalize_phone_e164(phone)
    existing = await get_phone_identity_by_phone(session, phone_e164)
    if existing is not None and existing.user_id != user_id:
        raise PhoneUnavailableError("Phone number cannot be used for this account")
    await _ensure_not_rate_limited(session, phone_e164=phone_e164, settings=settings)

    challenge, code = await _create_challenge(
        session,
        phone_e164=phone_e164,
        user_id=user_id,
        purpose="verify_phone",
        settings=settings,
    )
    await _deliver_code(phone_e164=phone_e164, code=code, settings=settings)
    return SmsChallengeResult(challenge_id=challenge.id, expires_at=challenge.expires_at)


async def verify_phone_otp(
    session: AsyncSession,
    *,
    user_id: UUID,
    challenge_id: UUID,
    code: str,
    settings: Settings,
) -> str:
    challenge = await _validate_challenge(
        session,
        challenge_id=challenge_id,
        code=code,
        purpose="verify_phone",
        settings=settings,
    )
    if challenge.user_id != user_id:
        raise InvalidSmsChallengeError("Invalid or expired SMS challenge")

    now = datetime.now(UTC)
    try:
        await bind_verified_phone(
            session,
            user_id=user_id,
            phone_e164=challenge.phone_e164,
            verified_at=now,
        )
    except ValueError as exc:
        raise PhoneUnavailableError("Phone number cannot be used for this account") from exc

    challenge.consumed_at = now
    await session.flush()
    return challenge.phone_e164


def _ensure_sms_configured(settings: Settings) -> None:
    if settings.sms_provider.strip().lower() in {"", "disabled"}:
        raise SmsUnavailableError("SMS login is not configured")


async def _ensure_not_rate_limited(
    session: AsyncSession,
    *,
    phone_e164: str,
    settings: Settings,
) -> None:
    if await has_recent_sms_challenge(
        session,
        phone_e164=phone_e164,
        cooldown_seconds=settings.sms_otp_resend_cooldown_seconds,
    ):
        raise SmsRateLimitedError("Please wait before requesting another code")


async def _create_challenge(
    session: AsyncSession,
    *,
    phone_e164: str,
    user_id: UUID | None,
    purpose: str,
    settings: Settings,
) -> tuple[SmsOtpChallenge, str]:
    now = datetime.now(UTC)
    expires_at = now + timedelta(seconds=settings.sms_otp_ttl_seconds)
    challenge_id = uuid4()
    code = generate_otp_code()
    challenge = SmsOtpChallenge(
        id=challenge_id,
        phone_e164=phone_e164,
        user_id=user_id,
        purpose=purpose,
        code_hash=hash_otp_code(
            challenge_id=str(challenge_id),
            code=code,
            settings=settings,
        ),
        expires_at=expires_at,
    )
    await create_sms_challenge(session, challenge)
    return challenge, code


async def _deliver_code(*, phone_e164: str, code: str, settings: Settings) -> None:
    try:
        await get_sms_provider(settings).send_otp(
            phone_e164=phone_e164,
            code=code,
            ttl_seconds=settings.sms_otp_ttl_seconds,
        )
    except SmsDeliveryError as exc:
        raise SmsUnavailableError("SMS delivery is temporarily unavailable") from exc


async def _validate_challenge(
    session: AsyncSession,
    *,
    challenge_id: UUID,
    code: str,
    purpose: str,
    settings: Settings,
) -> SmsOtpChallenge:
    challenge = await get_sms_challenge(session, challenge_id)
    now = datetime.now(UTC)
    if (
        challenge is None
        or challenge.purpose != purpose
        or challenge.consumed_at is not None
        or challenge.expires_at <= now
        or challenge.attempts >= settings.sms_otp_max_attempts
    ):
        raise InvalidSmsChallengeError("Invalid or expired SMS challenge")

    challenge.attempts += 1
    if not verify_otp_code(
        challenge_id=str(challenge.id),
        code=code,
        expected_hash=challenge.code_hash,
        settings=settings,
    ):
        await session.flush()
        raise InvalidSmsChallengeError("Invalid or expired SMS challenge")

    return challenge
