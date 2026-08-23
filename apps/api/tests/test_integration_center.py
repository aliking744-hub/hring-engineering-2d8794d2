import asyncio
from types import SimpleNamespace
from uuid import UUID, uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from hring_api.config import Settings
from hring_api.db.session import SessionFactory
from hring_api.domains.access.models import PlatformRoleAssignment
from hring_api.domains.integrations.internal_routes import AI_ADAPTERS
from hring_api.domains.integrations.models import IntegrationProvider
from hring_api.domains.integrations.security import (
    IntegrationSecurityError,
    normalize_provider_base_url,
)
from hring_api.domains.integrations.service import (
    _evaluate_local_ai_inventory,
    _probe_headers,
    _probe_url,
)
from hring_api.main import app


PASSWORD = "correct horse battery staple"


def _register(client: TestClient, prefix: str) -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"{prefix}-{uuid4()}@example.com",
            "password": PASSWORD,
            "full_name": prefix,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _auth(account: dict) -> dict[str, str]:
    return {"Authorization": f"Bearer {account['tokens']['access_token']}"}


async def _grant_platform_role(user_id: UUID, role: str) -> None:
    async with SessionFactory() as session:
        async with session.begin():
            session.add(
                PlatformRoleAssignment(
                    user_id=user_id,
                    role=role,
                    created_by=user_id,
                )
            )


def _register_with_platform_role(client: TestClient, prefix: str, role: str) -> dict:
    account = _register(client, prefix)
    asyncio.run(_grant_platform_role(UUID(account["user"]["id"]), role))
    return account


async def _stored_provider(provider_key: str) -> IntegrationProvider:
    async with SessionFactory() as session:
        result = await session.execute(
            select(IntegrationProvider).where(
                IntegrationProvider.provider_key == provider_key
            )
        )
        return result.scalar_one()


def test_integration_center_separates_read_and_secret_management() -> None:
    with TestClient(app) as client:
        super_admin = _register_with_platform_role(client, "integration-super", "super_admin")
        platform_admin = _register_with_platform_role(
            client, "integration-platform", "platform_admin"
        )
        content_admin = _register_with_platform_role(
            client, "integration-content", "content_admin"
        )

        assert client.get(
            "/api/v1/admin/platform/integrations/providers",
            headers=_auth(platform_admin),
        ).status_code == 200
        assert client.get(
            "/api/v1/admin/platform/integrations/providers",
            headers=_auth(content_admin),
        ).status_code == 403

        forbidden_create = client.post(
            "/api/v1/admin/platform/integrations/providers",
            headers=_auth(platform_admin),
            json={
                "provider_key": f"forbidden-{uuid4().hex}",
                "display_name": "Forbidden provider",
                "provider_type": "llm",
                "adapter": "openai_compatible",
                "auth_scheme": "bearer",
            },
        )
        assert forbidden_create.status_code == 403

        provider_key = f"openai-{uuid4().hex}"
        raw_secret = f"sk-never-return-{uuid4().hex}"
        created = client.post(
            "/api/v1/admin/platform/integrations/providers",
            headers=_auth(super_admin),
            json={
                "provider_key": provider_key,
                "display_name": "OpenAI primary",
                "provider_type": "llm",
                "adapter": "openai_compatible",
                "base_url": "https://api.openai.com/v1/",
                "default_model": "gpt-5",
                "auth_scheme": "bearer",
                "secret": raw_secret,
                "capabilities": ["chat", "embedding", "chat"],
                "settings": {"region": "global"},
            },
        )
        assert created.status_code == 201, created.text
        body = created.json()
        provider_id = body["id"]
        assert body["base_url"] == "https://api.openai.com/v1"
        assert body["secret_configured"] is True
        assert body["secret_hint"].endswith(raw_secret[-4:])
        assert body["capabilities"] == ["chat", "embedding"]
        assert raw_secret not in created.text
        assert "secret_ciphertext" not in body

        stored = asyncio.run(_stored_provider(provider_key))
        assert stored.secret_ciphertext is not None
        assert raw_secret not in stored.secret_ciphertext

        rotate_forbidden = client.post(
            f"/api/v1/admin/platform/integrations/providers/{provider_id}/rotate-secret",
            headers=_auth(platform_admin),
            json={"secret": "replacement-secret"},
        )
        assert rotate_forbidden.status_code == 403

        rotated = client.post(
            f"/api/v1/admin/platform/integrations/providers/{provider_id}/rotate-secret",
            headers=_auth(super_admin),
            json={"secret": "replacement-secret"},
        )
        assert rotated.status_code == 200, rotated.text
        assert rotated.json()["secret_hint"].endswith("cret")
        assert "replacement-secret" not in rotated.text

        revoked = client.delete(
            f"/api/v1/admin/platform/integrations/providers/{provider_id}/secret",
            headers=_auth(super_admin),
        )
        assert revoked.status_code == 200, revoked.text
        assert revoked.json()["secret_configured"] is False
        assert revoked.json()["secret_hint"] is None


def test_integration_metadata_rejects_secrets_and_failed_tests_are_audited() -> None:
    with TestClient(app) as client:
        super_admin = _register_with_platform_role(client, "integration-audit", "super_admin")
        header = _auth(super_admin)

        rejected = client.post(
            "/api/v1/admin/platform/integrations/providers",
            headers=header,
            json={
                "provider_key": f"unsafe-{uuid4().hex}",
                "display_name": "Unsafe provider",
                "provider_type": "sms",
                "adapter": "generic_http",
                "auth_scheme": "none",
                "settings": {"api_key": "must-not-be-here"},
            },
        )
        assert rejected.status_code == 422

        provider_key = f"draft-{uuid4().hex}"
        created = client.post(
            "/api/v1/admin/platform/integrations/providers",
            headers=header,
            json={
                "provider_key": provider_key,
                "display_name": "Draft local model",
                "provider_type": "llm",
                "adapter": "ollama",
                "auth_scheme": "none",
                "is_internal": True,
            },
        )
        assert created.status_code == 201, created.text
        provider_id = created.json()["id"]

        tested = client.post(
            f"/api/v1/admin/platform/integrations/providers/{provider_id}/test",
            headers=header,
        )
        assert tested.status_code == 200, tested.text
        assert tested.json()["healthy"] is False
        assert tested.json()["status"] == "unhealthy"
        assert "base URL" in tested.json()["message"]

        logs = client.get("/api/v1/admin/platform/audit-logs", headers=header)
        assert logs.status_code == 200, logs.text
        provider_logs = [
            row for row in logs.json() if row["resource_id"] == provider_id
        ]
        assert any(row["action"] == "integration.provider.create" for row in provider_logs)
        assert any(
            row["action"] == "integration.provider.test" and row["outcome"] == "failure"
            for row in provider_logs
        )
        assert provider_key in {row["metadata_json"]["provider_key"] for row in provider_logs}


def test_provider_url_policy_blocks_external_ssrf_targets() -> None:
    settings = Settings()
    with pytest.raises(IntegrationSecurityError):
        normalize_provider_base_url(
            "http://127.0.0.1:8000",
            is_internal=False,
            allowed_internal_hosts=settings.integration_internal_hosts,
        )
    with pytest.raises(IntegrationSecurityError):
        normalize_provider_base_url(
            "https://api.example.com/v1?api_key=leak",
            is_internal=False,
            allowed_internal_hosts=settings.integration_internal_hosts,
        )
    with pytest.raises(IntegrationSecurityError):
        normalize_provider_base_url(
            "http://unapproved-model:11434",
            is_internal=True,
            allowed_internal_hosts=settings.integration_internal_hosts,
        )
    assert normalize_provider_base_url(
        "http://ollama:11434/v1/",
        is_internal=True,
        allowed_internal_hosts=settings.integration_internal_hosts,
    ) == "http://ollama:11434/v1"


def test_local_ai_inventory_requires_the_configured_model() -> None:
    response = httpx.Response(
        200,
        json={
            "object": "list",
            "data": [
                {"id": "qwen-local", "object": "model"},
                {"id": "embedding-local", "object": "model"},
            ],
        },
    )
    healthy, message = _evaluate_local_ai_inventory(
        response,
        configured_model="qwen-local",
    )
    assert healthy is True
    assert "2 model" in message

    healthy, message = _evaluate_local_ai_inventory(
        response,
        configured_model="missing-model",
    )
    assert healthy is False
    assert "missing-model" in message

    malformed = httpx.Response(200, json={"data": []})
    healthy, message = _evaluate_local_ai_inventory(
        malformed,
        configured_model=None,
    )
    assert healthy is False
    assert "no models" in message.lower()


def test_anthropic_probe_uses_models_endpoint_and_required_version_header() -> None:
    assert "anthropic" in AI_ADAPTERS
    provider = SimpleNamespace(
        adapter="anthropic",
        base_url="https://api.anthropic.com",
        auth_scheme="x-api-key",
    )
    assert _probe_url(provider, "anthropic-secret") == "https://api.anthropic.com/v1/models"
    headers = _probe_headers(provider, "anthropic-secret")
    assert headers["X-API-Key"] == "anthropic-secret"
    assert headers["anthropic-version"] == "2023-06-01"
