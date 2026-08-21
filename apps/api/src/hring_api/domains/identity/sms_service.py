from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings
from hring_api.domains.identity.repository import get_user_by_id
from hring_api.domains.identity.service import AuthResult, create_authenticated_session
from hring_api.domains.identity.sms_models import SmsOtpChallenge
from hring_api.domains.identity.sms_repository import (
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
    if settings.sms_provider.strip().lower() in {"", "disabled"}:
        raise SmsUnavailableError("SMS login is not configured")

    phone_e164 = normalize_phone_e164(phone)
    if await has_recent_sms_challenge(
        session,
        phone_e164=phone_e164,
        cooldown_seconds=settings.sms_otp_resend_cooldown_seconds,
    ):
        raise SmsRateLimitedError("Please wait before requesting another code")

    phone_identity = await get_phone_identity_by_phone(session, phone_e164)
    user_id = phone_identity.user_id if phone_identity is not None else None
    now = datetime.now(UTC)
    expires_at = now + timedelta(seconds=settings.sms_otp_ttl_seconds)
    challenge_id = uuid4()
    code = generate_otp_code()
    challenge = SmsOtpChallenge(
        id=challenge_id,
        phone_e164=phone_e164,
        user_id=user_id,
        purpose="login",
        code_hash=hash_otp_code(
            challenge_id=str(challenge_id),
            code=code,
            settings=settings,
        ),
        expires_at=expires_at,
    )
    await create_sms_challenge(session, challenge)

    if phone_identity is not None:
        try:
            await get_sms_provider(settings).send_otp(
                phone_e164=phone_e164,
                code=code,
                ttl_seconds=settings.sms_otp_ttl_seconds,
            )
        except SmsDeliveryError as exc:
            raise SmsUnavailableError("SMS delivery is temporarily unavailable") from exc

    return SmsChallengeResult(challenge_id=challenge_id, expires_at=expires_at)


async def verify_login_otp(
    session: AsyncSession,
    *,
    challenge_id: UUID,
    code: str,
    settings: Settings,
    user_agent: str | None,
    ip_address: str | None,
) -> AuthResult:
    challenge = await get_sms_challenge(session, challenge_id)
    now = datetime.now(UTC)
    if (
        challenge is None
        or challenge.purpose != "login"
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

    if challenge.user_id is None:
        challenge.consumed_at = now
        await session.flush()
        raise InvalidSmsChallengeError("Invalid or expired SMS challenge")

    user = await get_user_by_id(session, challenge.user_id)
    if user is None or not user.is_active:
        challenge.consumed_at = now
        await session.flush()
        raise InvalidSmsChallengeError("Invalid or expired SMS challenge")

    challenge.consumed_at = now
    await session.flush()
    return await create_authenticated_session(
        session,
        user=user,
        settings=settings,
        user_agent=user_agent,
        ip_address=ip_address,
    )
