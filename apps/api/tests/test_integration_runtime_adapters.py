import asyncio
from uuid import uuid4

from sqlalchemy import delete

from hring_api.config import Settings
from hring_api.db.session import SessionFactory
from hring_api.domains.integrations.models import IntegrationProvider
from hring_api.domains.integrations.runtime import resolve_runtime_provider
from hring_api.domains.integrations.security import ProviderSecretCipher
from hring_api.integrations.email.providers import ResendEmailProvider, get_email_provider
from hring_api.integrations.payment.providers import (
    ZarinpalPaymentProvider,
    get_payment_provider,
)
from hring_api.integrations.sms.providers import KavenegarSmsProvider, get_sms_provider


async def _seed_runtime_providers(settings: Settings) -> list[str]:
    suffix = uuid4().hex
    cipher = ProviderSecretCipher(settings)
    keys = [
        f"zarinpal-runtime-{suffix}",
        f"resend-runtime-{suffix}",
        f"kavenegar-runtime-{suffix}",
    ]
    async with SessionFactory() as session:
        async with session.begin():
            session.add_all(
                [
                    IntegrationProvider(
                        provider_key=keys[0],
                        display_name="Zarinpal runtime",
                        provider_type="payment",
                        adapter="zarinpal",
                        base_url="https://api.zarinpal.com/pg/v4/payment",
                        auth_scheme="none",
                        secret_ciphertext=cipher.encrypt(
                            "12345678-1234-4234-9234-123456789012"
                        ),
                        secret_hint="••••9012",
                        is_active=True,
                        priority=0,
                        timeout_seconds=11,
                        capabilities_json=["request", "verify"],
                        settings_json={},
                        quota_json={},
                        status="healthy",
                    ),
                    IntegrationProvider(
                        provider_key=keys[1],
                        display_name="Resend runtime",
                        provider_type="email",
                        adapter="resend",
                        base_url="https://api.resend.com",
                        auth_scheme="bearer",
                        secret_ciphertext=cipher.encrypt("re_runtime_secret"),
                        secret_hint="••••cret",
                        is_active=True,
                        priority=0,
                        timeout_seconds=12,
                        capabilities_json=["transactional"],
                        settings_json={"from_address": "HRing Test <test@hring.ir>"},
                        quota_json={},
                        status="healthy",
                    ),
                    IntegrationProvider(
                        provider_key=keys[2],
                        display_name="Kavenegar runtime",
                        provider_type="sms",
                        adapter="kavenegar",
                        base_url="https://api.kavenegar.com/v1",
                        auth_scheme="none",
                        secret_ciphertext=cipher.encrypt("kavenegar-runtime-secret"),
                        secret_hint="••••cret",
                        is_active=True,
                        priority=0,
                        timeout_seconds=13,
                        capabilities_json=["otp"],
                        settings_json={"otp_template": "hringotp"},
                        quota_json={},
                        status="healthy",
                    ),
                ]
            )
    return keys


async def _delete_runtime_providers(keys: list[str]) -> None:
    async with SessionFactory() as session:
        async with session.begin():
            await session.execute(
                delete(IntegrationProvider).where(
                    IntegrationProvider.provider_key.in_(keys)
                )
            )


def test_runtime_adapters_use_healthy_admin_managed_secrets() -> None:
    settings = Settings(
        payment_provider="disabled",
        email_provider="disabled",
        sms_provider="disabled",
    )
    keys = asyncio.run(_seed_runtime_providers(settings))

    async def run() -> None:
        async with SessionFactory() as session:
            payment = await get_payment_provider(session, settings)
            assert isinstance(payment, ZarinpalPaymentProvider)
            assert payment.merchant_id == "12345678-1234-4234-9234-123456789012"
            assert payment.request_url == (
                "https://api.zarinpal.com/pg/v4/payment/request.json"
            )
            assert payment.timeout_seconds == 11.0

            email = await get_email_provider(session, settings)
            assert isinstance(email, ResendEmailProvider)
            assert email.api_key == "re_runtime_secret"
            assert email.from_address == "HRing Test <test@hring.ir>"
            assert email.timeout_seconds == 12.0

            sms = await get_sms_provider(session, settings)
            assert isinstance(sms, KavenegarSmsProvider)
            assert sms.api_key == "kavenegar-runtime-secret"
            assert sms.template == "hringotp"
            assert sms.timeout_seconds == 13.0

            resolved = await resolve_runtime_provider(
                session,
                provider_type="payment",
                adapters=frozenset({"zarinpal"}),
                settings=settings,
            )
            assert resolved is not None
            assert resolved.provider_key == keys[0]
            assert resolved.secret == "12345678-1234-4234-9234-123456789012"

    try:
        asyncio.run(run())
    finally:
        asyncio.run(_delete_runtime_providers(keys))


def test_untested_provider_is_not_activated_at_runtime() -> None:
    settings = Settings(payment_provider="disabled")
    suffix = uuid4().hex
    provider_key = f"zarinpal-untested-{suffix}"

    async def run() -> None:
        cipher = ProviderSecretCipher(settings)
        async with SessionFactory() as session:
            async with session.begin():
                session.add(
                    IntegrationProvider(
                        provider_key=provider_key,
                        display_name="Untested payment",
                        provider_type="payment",
                        adapter="zarinpal",
                        base_url="https://api.zarinpal.com/pg/v4/payment",
                        auth_scheme="none",
                        secret_ciphertext=cipher.encrypt(
                            "12345678-1234-4234-9234-123456789012"
                        ),
                        secret_hint="••••9012",
                        is_active=True,
                        priority=0,
                        capabilities_json=[],
                        settings_json={},
                        quota_json={},
                        status="untested",
                    )
                )
        async with SessionFactory() as session:
            resolved = await resolve_runtime_provider(
                session,
                provider_type="payment",
                adapters=frozenset({"zarinpal"}),
                settings=settings,
            )
            assert resolved is None
        await _delete_runtime_providers([provider_key])

    asyncio.run(run())
