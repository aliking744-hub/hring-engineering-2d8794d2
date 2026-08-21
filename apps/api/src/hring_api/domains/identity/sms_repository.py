from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.identity.sms_models import PhoneIdentity, SmsOtpChallenge


async def get_phone_identity_by_phone(
    session: AsyncSession, phone_e164: str
) -> PhoneIdentity | None:
    result = await session.execute(
        select(PhoneIdentity).where(PhoneIdentity.phone_e164 == phone_e164)
    )
    return result.scalar_one_or_none()


async def get_phone_identity_by_user(
    session: AsyncSession, user_id: UUID
) -> PhoneIdentity | None:
    result = await session.execute(select(PhoneIdentity).where(PhoneIdentity.user_id == user_id))
    return result.scalar_one_or_none()


async def create_sms_challenge(
    session: AsyncSession,
    challenge: SmsOtpChallenge,
) -> SmsOtpChallenge:
    session.add(challenge)
    await session.flush()
    return challenge


async def get_sms_challenge(
    session: AsyncSession, challenge_id: UUID
) -> SmsOtpChallenge | None:
    return await session.get(SmsOtpChallenge, challenge_id)


async def has_recent_sms_challenge(
    session: AsyncSession,
    *,
    phone_e164: str,
    cooldown_seconds: int,
) -> bool:
    threshold = datetime.now(UTC) - timedelta(seconds=cooldown_seconds)
    result = await session.execute(
        select(SmsOtpChallenge.id)
        .where(
            SmsOtpChallenge.phone_e164 == phone_e164,
            SmsOtpChallenge.created_at >= threshold,
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None
