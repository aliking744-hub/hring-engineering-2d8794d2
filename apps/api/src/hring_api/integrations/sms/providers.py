import logging
import re
from urllib.parse import quote, urlsplit

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings
from hring_api.domains.integrations.runtime import (
    RuntimeProviderConfigurationError,
    resolve_runtime_provider,
    string_setting,
)
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


def _kavenegar_base_url(value: str | None) -> str:
    normalized = (value or "https://api.kavenegar.com/v1").rstrip("/")
    parsed = urlsplit(normalized)
    if parsed.scheme != "https" or parsed.hostname != "api.kavenegar.com":
        raise SmsDeliveryError("Kavenegar must use the official HTTPS API host")
    if parsed.path.rstrip("/") != "/v1":
        raise SmsDeliveryError("Kavenegar base URL path is invalid")
    return normalized


class KavenegarSmsProvider:
    def __init__(
        self,
        *,
        api_key: str,
        template: str,
        base_url: str | None = None,
        timeout_seconds: float = 15.0,
    ) -> None:
        if not api_key.strip():
            raise SmsDeliveryError("Kavenegar API key is not configured")
        normalized_template = template.strip()
        if not re.fullmatch(r"[A-Za-z0-9-]+", normalized_template):
            raise SmsDeliveryError("Kavenegar OTP template name is invalid")
        self.api_key = api_key.strip()
        self.template = normalized_template
        self.base_url = _kavenegar_base_url(base_url)
        self.timeout_seconds = timeout_seconds

    async def send_otp(self, *, phone_e164: str, code: str, ttl_seconds: int) -> None:
        _ = ttl_seconds
        encoded_key = quote(self.api_key, safe="")
        url = f"{self.base_url}/{encoded_key}/verify/lookup.json"
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(
                    url,
                    data={
                        "receptor": phone_e164,
                        "token": code,
                        "template": self.template,
                    },
                )
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError):
            # Kavenegar requires the API key in the path. Suppress the original
            # exception context so observability tools do not serialize that URL.
            raise SmsDeliveryError("SMS provider rejected the OTP") from None
        returned = payload.get("return") if isinstance(payload, dict) else None
        if not isinstance(returned, dict) or returned.get("status") != 200:
            raise SmsDeliveryError("SMS provider rejected the OTP")


async def get_sms_provider(
    session: AsyncSession,
    settings: Settings,
) -> SmsProvider:
    try:
        runtime = await resolve_runtime_provider(
            session,
            provider_type="sms",
            adapters=frozenset({"kavenegar"}),
            settings=settings,
        )
    except RuntimeProviderConfigurationError as exc:
        raise SmsDeliveryError("SMS provider secret is unavailable") from exc
    if runtime is not None:
        if runtime.secret is None:
            raise SmsDeliveryError("Kavenegar API key is not configured")
        template = string_setting(runtime, "otp_template")
        if template is None:
            raise SmsDeliveryError("Kavenegar OTP template is not configured")
        return KavenegarSmsProvider(
            api_key=runtime.secret,
            template=template,
            base_url=runtime.base_url,
            timeout_seconds=float(runtime.timeout_seconds),
        )

    provider = settings.sms_provider.strip().lower()
    if provider == "development":
        if settings.environment.lower() == "production":
            raise SmsDeliveryError("Development SMS provider is forbidden in production")
        return DevelopmentSmsProvider()
    if provider in {"", "disabled"}:
        return DisabledSmsProvider()
    raise SmsDeliveryError(f"Unsupported SMS provider: {provider}")
