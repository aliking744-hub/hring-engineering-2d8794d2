from typing import Protocol


class EmailDeliveryError(RuntimeError):
    """Raised when an email provider cannot accept a message."""


class EmailProvider(Protocol):
    async def send_password_reset(
        self,
        *,
        email: str,
        reset_url: str,
        ttl_minutes: int,
    ) -> None:
        """Deliver a password-reset link without owning reset logic."""

    async def send_email_verification(
        self,
        *,
        email: str,
        verification_url: str,
        ttl_hours: int,
    ) -> None:
        """Deliver an email-verification link without owning verification logic."""

    async def send_html_email(
        self,
        *,
        to_email: str,
        subject: str,
        html: str,
    ) -> str | None:
        """Deliver application-owned HTML and return the provider message id when available."""
