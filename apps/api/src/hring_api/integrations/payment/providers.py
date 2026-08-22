from __future__ import annotations

import httpx

from hring_api.config import Settings
from hring_api.integrations.payment.base import (
    PaymentProvider,
    PaymentProviderError,
    PaymentRequestResult,
    PaymentVerifyResult,
)


class DisabledPaymentProvider:
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


class ZarinpalPaymentProvider:
    request_url = "https://payment.zarinpal.com/pg/v4/payment/request.json"
    verify_url = "https://payment.zarinpal.com/pg/v4/payment/verify.json"
    start_url = "https://payment.zarinpal.com/pg/StartPay"

    def __init__(self, *, merchant_id: str) -> None:
        merchant = merchant_id.strip()
        if not merchant:
            raise PaymentProviderError("Zarinpal merchant id is not configured")
        self.merchant_id = merchant

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
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.post(
                    self.request_url,
                    json={
                        "merchant_id": self.merchant_id,
                        "amount": amount_rial,
                        "description": description,
                        "callback_url": callback_url,
                        "metadata": {"email": email, "plan_type": plan_type},
                    },
                )
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise PaymentProviderError("Zarinpal payment request failed") from exc

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
            async with httpx.AsyncClient(timeout=20.0) as client:
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
        except (httpx.HTTPError, ValueError) as exc:
            raise PaymentProviderError("Zarinpal verification request failed") from exc

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


def get_payment_provider(settings: Settings) -> PaymentProvider:
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
