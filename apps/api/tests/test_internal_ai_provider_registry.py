import asyncio
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete

from hring_api.config import get_settings
from hring_api.db.session import SessionFactory
from hring_api.domains.integrations.models import IntegrationProvider
from hring_api.domains.integrations.security import ProviderSecretCipher
from hring_api.main import app


async def _seed_ai_routes() -> list[str]:
    settings = get_settings()
    suffix = uuid4().hex
    keys = [f"gemini-primary-{suffix}", f"local-fallback-{suffix}"]
    cipher = ProviderSecretCipher(settings)
    async with SessionFactory() as session:
        async with session.begin():
            session.add_all(
                [
                    IntegrationProvider(
                        provider_key=keys[0],
                        display_name="Gemini primary",
                        provider_type="llm",
                        adapter="gemini_openai",
                        base_url="https://generativelanguage.googleapis.com/v1beta/openai",
                        default_model="gemini-test-model",
                        auth_scheme="bearer",
                        secret_ciphertext=cipher.encrypt("gemini-internal-secret"),
                        secret_hint="••••cret",
                        is_active=True,
                        priority=10,
                        timeout_seconds=17,
                        max_retries=1,
                        capabilities_json=["chat"],
                        settings_json={"aliases": ["gemini"]},
                        quota_json={},
                        status="healthy",
                    ),
                    IntegrationProvider(
                        provider_key=keys[1],
                        display_name="Local fallback",
                        provider_type="llm",
                        adapter="ollama",
                        base_url="http://ollama:11434/v1",
                        default_model="qwen-test",
                        auth_scheme="none",
                        secret_ciphertext=None,
                        secret_hint=None,
                        is_active=True,
                        is_internal=True,
                        priority=5,
                        timeout_seconds=25,
                        max_retries=0,
                        capabilities_json=["chat"],
                        settings_json={
                            "aliases": ["ollama"],
                            "fallback_for": ["gemini"],
                            "endpoint_path": "/chat/completions",
                        },
                        quota_json={},
                        status="healthy",
                    ),
                ]
            )
    return keys


async def _delete_ai_routes(keys: list[str]) -> None:
    async with SessionFactory() as session:
        async with session.begin():
            await session.execute(
                delete(IntegrationProvider).where(
                    IntegrationProvider.provider_key.in_(keys)
                )
            )


def test_internal_ai_registry_is_authenticated_ordered_and_not_documented() -> None:
    keys = asyncio.run(_seed_ai_routes())
    settings = get_settings()
    try:
        with TestClient(app) as client:
            unauthorized = client.get(
                "/api/v1/internal/integrations/ai/providers/gemini"
            )
            assert unauthorized.status_code == 401
            assert "gemini-internal-secret" not in unauthorized.text

            response = client.get(
                "/api/v1/internal/integrations/ai/providers/gemini",
                headers={
                    "Authorization": (
                        f"Bearer {settings.ai_api_key.get_secret_value()}"
                    )
                },
            )
            assert response.status_code == 200, response.text
            assert response.headers["cache-control"] == "private, no-store"
            providers = response.json()
            assert [item["provider_key"] for item in providers] == keys
            assert providers[0]["secret"] == "gemini-internal-secret"
            assert providers[0]["default_model"] == "gemini-test-model"
            assert providers[1]["adapter"] == "ollama"
            assert providers[1]["secret"] is None
            assert providers[1]["default_model"] == "qwen-test"

            openapi = client.get("/openapi.json")
            assert openapi.status_code == 200
            assert (
                "/api/v1/internal/integrations/ai/providers/{alias}"
                not in openapi.json()["paths"]
            )
    finally:
        asyncio.run(_delete_ai_routes(keys))
