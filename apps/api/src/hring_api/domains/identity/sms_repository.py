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


async def bind_verified_phone(
    session: AsyncSession,
    *,
    user_id: UUID,
    phone_e164: str,
    verified_at: datetime,
) -> PhoneIdentity:
    existing_phone = await get_phone_identity_by_phone(session, phone_e164)
    if existing_phone is not None and existing_phone.user_id != user_id:
        raise ValueError("Phone number is already bound to another account")

    identity = await get_phone_identity_by_user(session, user_id)
    if identity is None:
        identity = PhoneIdentity(
            user_id=user_id,
            phone_e164=phone_e164,
            verified_at=verified_at,
        )
        session.add(identity)
    else:
        identity.phone_e164 = phone_e164
        identity.verified_at = verified_at
    await session.flush()
    return identity


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
