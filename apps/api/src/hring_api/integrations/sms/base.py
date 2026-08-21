from typing import Protocol


class SmsDeliveryError(RuntimeError):
    """Raised when an SMS provider cannot accept or deliver a message."""


class SmsProvider(Protocol):
    async def send_otp(self, *, phone_e164: str, code: str, ttl_seconds: int) -> None:
        """Send a one-time login code without owning authentication logic."""
