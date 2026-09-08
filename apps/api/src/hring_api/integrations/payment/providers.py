from __future__ import annotations

from urllib.parse import quote, urlsplit
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
SEP_TOKEN_URL = "https://sep.shaparak.ir/onlinepg/onlinepg"
SEP_START_URL = "https://sep.shaparak.ir/OnlinePG/SendToken"
SEP_VERIFY_URL = (
    "https://sep.shaparak.ir/verifyTxnRandomSessionkey/ipg/VerifyTransaction"
)


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
        order_id: str | None = None,
    ) -> PaymentRequestResult:
        raise PaymentProviderError("Payment provider is not configured")

    async def verify_payment(
        self,
        *,
        amount_rial: int,
        authority: str,
        reference_number: str | None = None,
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
        order_id: str | None = None,
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
                        "metadata": {"email": email, "order_id": order_id or plan_type},
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
        reference_number: str | None = None,
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


def _validate_sep_terminal_id(value: str) -> str:
    terminal_id = value.strip()
    if not terminal_id.isascii() or not terminal_id.isdigit():
        raise PaymentProviderError("SEP terminal id must contain digits only")
    if not 1 <= len(terminal_id) <= 32:
        raise PaymentProviderError("SEP terminal id length is invalid")
    return terminal_id


def _mapping_with_trimmed_keys(value: object) -> dict[str, object]:
    if not isinstance(value, dict):
        return {}
    return {
        key.strip(): item
        for key, item in value.items()
        if isinstance(key, str)
    }


def _integer(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        try:
            return int(value.strip())
        except ValueError:
            return None
    return None


class SepPaymentProvider:
    """Saman Electronic Payment (SEP) Internet Payment Gateway."""

    name = "sep"

    def __init__(self, *, terminal_id: str, timeout_seconds: float = 20.0) -> None:
        self.terminal_id = _validate_sep_terminal_id(terminal_id)
        self.timeout_seconds = timeout_seconds

    async def request_payment(
        self,
        *,
        amount_rial: int,
        description: str,
        callback_url: str,
        email: str,
        plan_type: str,
        order_id: str | None = None,
    ) -> PaymentRequestResult:
        if amount_rial <= 0:
            raise PaymentProviderError("Payment amount must be positive")
        if not order_id:
            raise PaymentProviderError("SEP order id is required")
        callback = urlsplit(callback_url)
        if callback.scheme not in {"http", "https"} or not callback.netloc:
            raise PaymentProviderError("SEP callback URL is invalid")
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(
                    SEP_TOKEN_URL,
                    json={
                        "action": "token",
                        "TerminalId": int(self.terminal_id),
                        "Amount": amount_rial,
                        "ResNum": order_id,
                        "RedirectUrl": callback_url,
                    },
                )
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError):
            raise PaymentProviderError("SEP payment request failed") from None

        if not isinstance(payload, dict) or _integer(payload.get("status")) != 1:
            raise PaymentProviderError("SEP rejected the payment request")
        token = payload.get("token")
        if not isinstance(token, str) or not token.strip():
            raise PaymentProviderError("SEP returned an invalid payment token")
        token = token.strip()
        return PaymentRequestResult(
            authority=token,
            payment_url=f"{SEP_START_URL}?token={quote(token, safe='')}",
        )

    async def verify_payment(
        self,
        *,
        amount_rial: int,
        authority: str,
        reference_number: str | None = None,
    ) -> PaymentVerifyResult:
        if not reference_number:
            raise PaymentProviderError("SEP reference number is required")
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(
                    SEP_VERIFY_URL,
                    json={
                        "RefNum": reference_number,
                        "TerminalNumber": int(self.terminal_id),
                    },
                )
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError):
            raise PaymentProviderError("SEP verification request failed") from None

        normalized = _mapping_with_trimmed_keys(payload)
        if _integer(normalized.get("ResultCode")) != 0 or normalized.get("Success") is not True:
            return PaymentVerifyResult(verified=False, ref_id=None)
        detail = _mapping_with_trimmed_keys(normalized.get("TransactionDetail"))
        returned_amount = _integer(detail.get("OrginalAmount"))
        returned_terminal = _integer(detail.get("TerminalNumber"))
        returned_ref = detail.get("RefNum")
        if returned_amount != amount_rial or returned_terminal != int(self.terminal_id):
            return PaymentVerifyResult(verified=False, ref_id=None)
        if returned_ref is not None and str(returned_ref).strip() != reference_number:
            return PaymentVerifyResult(verified=False, ref_id=None)
        return PaymentVerifyResult(verified=True, ref_id=reference_number)


async def get_payment_provider(
    session: AsyncSession,
    settings: Settings,
) -> PaymentProvider:
    try:
        runtime = await resolve_runtime_provider(
            session,
            provider_type="payment",
            adapters=frozenset({"zarinpal", "sep"}),
            settings=settings,
        )
    except RuntimeProviderConfigurationError as exc:
        raise PaymentProviderError("Payment provider secret is unavailable") from exc
    if runtime is not None:
        if runtime.secret is None:
            raise PaymentProviderError("Payment provider credential is not configured")
        if runtime.adapter == "sep":
            return SepPaymentProvider(
                terminal_id=runtime.secret,
                timeout_seconds=float(runtime.timeout_seconds),
            )
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
