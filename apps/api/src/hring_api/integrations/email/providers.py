import html
import logging
from urllib.parse import urlsplit

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings
from hring_api.domains.integrations.runtime import (
    RuntimeProviderConfigurationError,
    resolve_runtime_provider,
    string_setting,
)
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

    async def send_html_email(
        self, *, to_email: str, subject: str, html: str
    ) -> str | None:
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

    async def send_html_email(
        self, *, to_email: str, subject: str, html: str
    ) -> str | None:
        logger.warning("Development HTML email to %s: %s", to_email, subject)
        return "development-message"


def _resend_base_url(value: str | None) -> str:
    normalized = (value or "https://api.resend.com").rstrip("/")
    parsed = urlsplit(normalized)
    if parsed.scheme != "https" or parsed.hostname != "api.resend.com":
        raise EmailDeliveryError("Resend must use the official HTTPS API host")
    if parsed.path not in {"", "/"}:
        raise EmailDeliveryError("Resend base URL path is invalid")
    return normalized


class ResendEmailProvider:
    def __init__(
        self,
        *,
        api_key: str,
        from_address: str,
        base_url: str | None = None,
        timeout_seconds: float = 15.0,
    ) -> None:
        if not api_key:
            raise EmailDeliveryError("Resend API key is not configured")
        if not from_address.strip():
            raise EmailDeliveryError("Email sender address is not configured")
        self.api_key = api_key
        self.from_address = from_address.strip()
        self.base_url = _resend_base_url(base_url)
        self.timeout_seconds = timeout_seconds

    async def _deliver(self, *, to_email: str, subject: str, html_body: str) -> str | None:
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(
                    f"{self.base_url}/emails",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "from": self.from_address,
                        "to": [to_email],
                        "subject": subject,
                        "html": html_body,
                    },
                )
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError):
            raise EmailDeliveryError("Email provider rejected the message") from None
        message_id = payload.get("id") if isinstance(payload, dict) else None
        return str(message_id) if message_id else None

    async def send_password_reset(
        self, *, email: str, reset_url: str, ttl_minutes: int
    ) -> None:
        safe_url = html.escape(reset_url, quote=True)
        body = (
            '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif">'
            '<h2>بازیابی رمز عبور HRing</h2>'
            f'<p>این لینک تا {ttl_minutes} دقیقه معتبر است.</p>'
            f'<p><a href="{safe_url}">تغییر رمز عبور</a></p>'
            '<p>اگر شما این درخواست را ثبت نکرده‌اید، این پیام را نادیده بگیرید.</p>'
            '</div>'
        )
        await self._deliver(to_email=email, subject="بازیابی رمز عبور HRing", html_body=body)

    async def send_email_verification(
        self, *, email: str, verification_url: str, ttl_hours: int
    ) -> None:
        safe_url = html.escape(verification_url, quote=True)
        body = (
            '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif">'
            '<h2>تأیید ایمیل HRing</h2>'
            f'<p>این لینک تا {ttl_hours} ساعت معتبر است.</p>'
            f'<p><a href="{safe_url}">تأیید ایمیل</a></p>'
            '</div>'
        )
        await self._deliver(to_email=email, subject="تأیید ایمیل HRing", html_body=body)

    async def send_html_email(
        self, *, to_email: str, subject: str, html: str
    ) -> str | None:
        return await self._deliver(to_email=to_email, subject=subject, html_body=html)


async def get_email_provider(
    session: AsyncSession,
    settings: Settings,
) -> EmailProvider:
    try:
        runtime = await resolve_runtime_provider(
            session,
            provider_type="email",
            adapters=frozenset({"resend"}),
            settings=settings,
        )
    except RuntimeProviderConfigurationError as exc:
        raise EmailDeliveryError("Email provider secret is unavailable") from exc
    if runtime is not None:
        if runtime.secret is None:
            raise EmailDeliveryError("Resend API key is not configured")
        return ResendEmailProvider(
            api_key=runtime.secret,
            from_address=string_setting(
                runtime,
                "from_address",
                default=settings.email_from,
            )
            or settings.email_from,
            base_url=runtime.base_url,
            timeout_seconds=float(runtime.timeout_seconds),
        )

    provider = settings.email_provider.strip().lower()
    if provider == "development":
        if settings.environment.lower() == "production":
            raise EmailDeliveryError("Development email provider is forbidden in production")
        return DevelopmentEmailProvider()
    if provider == "resend":
        if settings.email_resend_api_key is None:
            raise EmailDeliveryError("Resend API key is not configured")
        return ResendEmailProvider(
            api_key=settings.email_resend_api_key.get_secret_value(),
            from_address=settings.email_from,
        )
    if provider in {"", "disabled"}:
        return DisabledEmailProvider()
    raise EmailDeliveryError(f"Unsupported email provider: {provider}")
