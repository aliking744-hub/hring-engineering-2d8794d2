import logging

from hring_api.config import Settings
from hring_api.integrations.sms.base import SmsDeliveryError, SmsProvider


logger = logging.getLogger(__name__)


class DisabledSmsProvider:
    async def send_otp(self, *, phone_e164: str, code: str, ttl_seconds: int) -> None:
        raise SmsDeliveryError("SMS provider is not configured")


class DevelopmentSmsProvider:
    async def send_otp(self, *, phone_e164: str, code: str, ttl_seconds: int) -> None:
        logger.warning(
            "Development SMS OTP for %s: %s (expires in %ss)",
            phone_e164,
            code,
            ttl_seconds,
        )


def get_sms_provider(settings: Settings) -> SmsProvider:
    provider = settings.sms_provider.strip().lower()
    if provider == "development":
        if settings.environment.lower() == "production":
            raise SmsDeliveryError("Development SMS provider is forbidden in production")
        return DevelopmentSmsProvider()
    if provider in {"", "disabled"}:
        return DisabledSmsProvider()
    raise SmsDeliveryError(f"Unsupported SMS provider: {provider}")
