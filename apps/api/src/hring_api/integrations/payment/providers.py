from __future__ import annotations

from urllib.parse import urlsplit
from uuid import UUID

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings
from hring_api.domains.integrations.runtime import (
    RuntimeProviderConfigurationError,
    resolve_runtime_provider,
)
from hring_api.integrations.payment.base import (
    PaymentProvider,
    PaymentProviderError,
    PaymentRequestResult,
    PaymentVerifyResult,
)


ZARINPAL_API_BASE_URL = "https://api.zarinpal.com/pg/v4/payment"
ZARINPAL_START_URL = "https://www.zarinpal.com/pg/StartPay"
ZARINPAL_SANDBOX_BASE_URL = "https://sandbox.zarinpal.com/pg/v4/payment"
ZARINPAL_SANDBOX_START_URL = "https://sandbox.zarinpal.com/pg/StartPay"


class DisabledPaymentProvider:
    name = "disabled"

    async def request_payment(
        self,
        *,
        amount_rial: int,
        description: str,
        callback_url: str,
        email: str,
        plan_type: str,
    ) -> PaymentRequestResult:
        raise PaymentProviderError("Payment provider is not configured")

    async def verify_payment(
        self,
        *,
        amount_rial: int,
        authority: str,
    ) -> PaymentVerifyResult:
        raise PaymentProviderError("Payment provider is not configured")


def _zarinpal_urls(base_url: str | None) -> tuple[str, str]:
    normalized = (base_url or ZARINPAL_API_BASE_URL).rstrip("/")
    parsed = urlsplit(normalized)
    if parsed.scheme != "https" or parsed.hostname is None:
        raise PaymentProviderError("Zarinpal URL must use HTTPS")
    host = parsed.hostname.lower()
    if host == "sandbox.zarinpal.com":
        if parsed.path.rstrip("/") != "/pg/v4/payment":
            raise PaymentProviderError("Zarinpal sandbox URL path is invalid")
        return normalized, ZARINPAL_SANDBOX_START_URL
    if host not in {"api.zarinpal.com", "payment.zarinpal.com"}:
        raise PaymentProviderError("Zarinpal URL must use an official Zarinpal host")
    if parsed.path.rstrip("/") != "/pg/v4/payment":
        raise PaymentProviderError("Zarinpal API URL path is invalid")
    return normalized, ZARINPAL_START_URL


def _validate_merchant_id(value: str) -> str:
    merchant = value.strip()
    try:
        UUID(merchant)
    except ValueError as exc:
        raise PaymentProviderError("Zarinpal merchant id must be a 36-character UUID") from exc
    if len(merchant) != 36:
        raise PaymentProviderError("Zarinpal merchant id must be a 36-character UUID")
    return merchant


class ZarinpalPaymentProvider:
    name = "zarinpal"

    def __init__(
        self,
        *,
        merchant_id: str,
        base_url: str | None = None,
        timeout_seconds: float = 20.0,
    ) -> None:
        self.merchant_id = _validate_merchant_id(merchant_id)
        self.base_url, self.start_url = _zarinpal_urls(base_url)
        self.timeout_seconds = timeout_seconds

    @property
    def request_url(self) -> str:
        return f"{self.base_url}/request.json"

    @property
    def verify_url(self) -> str:
        return f"{self.base_url}/verify.json"

    async def request_payment(
        self,
        *,
        amount_rial: int,
        description: str,
        callback_url: str,
        email: str,
        plan_type: str,
    ) -> PaymentRequestResult:
        if amount_rial <= 0:
            raise PaymentProviderError("Payment amount must be positive")
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(
                    self.request_url,
                    json={
                        "merchant_id": self.merchant_id,
                        "amount": amount_rial,
                        "currency": "IRR",
                        "description": description,
                        "callback_url": callback_url,
                        "metadata": {"email": email, "order_id": plan_type},
                    },
                )
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError):
            raise PaymentProviderError("Zarinpal payment request failed") from None

        data = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(data, dict) or data.get("code") != 100:
            raise PaymentProviderError("Zarinpal rejected the payment request")
        authority = data.get("authority")
        if not isinstance(authority, str) or not authority:
            raise PaymentProviderError("Zarinpal returned an invalid authority")
        return PaymentRequestResult(
            authority=authority,
            payment_url=f"{self.start_url}/{authority}",
        )

    async def verify_payment(
        self,
        *,
        amount_rial: int,
        authority: str,
    ) -> PaymentVerifyResult:
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(
                    self.verify_url,
                    json={
                        "merchant_id": self.merchant_id,
                        "amount": amount_rial,
                        "authority": authority,
                    },
                )
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError):
            raise PaymentProviderError("Zarinpal verification request failed") from None

        data = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(data, dict):
            raise PaymentProviderError("Zarinpal returned an invalid verification response")
        code = data.get("code")
        if code not in {100, 101}:
            return PaymentVerifyResult(verified=False, ref_id=None)
        ref_id = data.get("ref_id")
        return PaymentVerifyResult(
            verified=True,
            ref_id=str(ref_id) if ref_id is not None else None,
            already_verified=code == 101,
        )


async def get_payment_provider(
    session: AsyncSession,
    settings: Settings,
) -> PaymentProvider:
    try:
        runtime = await resolve_runtime_provider(
            session,
            provider_type="payment",
            adapters=frozenset({"zarinpal"}),
            settings=settings,
        )
    except RuntimeProviderConfigurationError as exc:
        raise PaymentProviderError("Payment provider secret is unavailable") from exc
    if runtime is not None:
        if runtime.secret is None:
            raise PaymentProviderError("Zarinpal merchant id is not configured")
        return ZarinpalPaymentProvider(
            merchant_id=runtime.secret,
            base_url=runtime.base_url,
            timeout_seconds=float(runtime.timeout_seconds),
        )

    provider = settings.payment_provider.strip().lower()
    if provider in {"", "disabled"}:
        return DisabledPaymentProvider()
    if provider == "zarinpal":
        if settings.zarinpal_merchant_id is None:
            raise PaymentProviderError("Zarinpal merchant id is not configured")
        return ZarinpalPaymentProvider(
            merchant_id=settings.zarinpal_merchant_id.get_secret_value()
        )
    raise PaymentProviderError(f"Unsupported payment provider: {provider}")
