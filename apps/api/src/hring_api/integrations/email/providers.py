import logging

from hring_api.config import Settings
from hring_api.integrations.email.base import EmailDeliveryError, EmailProvider


logger = logging.getLogger(__name__)


class DisabledEmailProvider:
    async def send_password_reset(
        self, *, email: str, reset_url: str, ttl_minutes: int
    ) -> None:
        raise EmailDeliveryError("Email provider is not configured")

    async def send_email_verification(
        self, *, email: str, verification_url: str, ttl_hours: int
    ) -> None:
        raise EmailDeliveryError("Email provider is not configured")


class DevelopmentEmailProvider:
    async def send_password_reset(
        self, *, email: str, reset_url: str, ttl_minutes: int
    ) -> None:
        logger.warning(
            "Development password reset for %s: %s (expires in %sm)",
            email,
            reset_url,
            ttl_minutes,
        )

    async def send_email_verification(
        self, *, email: str, verification_url: str, ttl_hours: int
    ) -> None:
        logger.warning(
            "Development email verification for %s: %s (expires in %sh)",
            email,
            verification_url,
            ttl_hours,
        )


def get_email_provider(settings: Settings) -> EmailProvider:
    provider = settings.email_provider.strip().lower()
    if provider == "development":
        if settings.environment.lower() == "production":
            raise EmailDeliveryError("Development email provider is forbidden in production")
        return DevelopmentEmailProvider()
    if provider in {"", "disabled"}:
        return DisabledEmailProvider()
    raise EmailDeliveryError(f"Unsupported email provider: {provider}")
