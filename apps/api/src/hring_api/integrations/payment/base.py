from dataclasses import dataclass
from typing import Protocol


class PaymentProviderError(RuntimeError):
    """Raised when a payment provider cannot create or verify a payment."""


@dataclass(frozen=True)
class PaymentRequestResult:
    authority: str
    payment_url: str


@dataclass(frozen=True)
class PaymentVerifyResult:
    verified: bool
    ref_id: str | None
    already_verified: bool = False


class PaymentProvider(Protocol):
    name: str

    async def request_payment(
        self,
        *,
        amount_rial: int,
        description: str,
        callback_url: str,
        email: str,
        plan_type: str,
    ) -> PaymentRequestResult:
        """Create a provider payment request."""

    async def verify_payment(
        self,
        *,
        amount_rial: int,
        authority: str,
    ) -> PaymentVerifyResult:
        """Verify a previously issued authority."""
