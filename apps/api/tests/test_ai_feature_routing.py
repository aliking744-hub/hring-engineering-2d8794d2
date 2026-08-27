import asyncio
from typing import Any
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from hring_api.db.session import SessionFactory
from hring_api.domains.access.models import PlatformRoleAssignment
from hring_api.domains.ai.feature_catalog import AI_FEATURES, COMPAT_AI_FUNCTIONS
from hring_api.domains.ai.feature_routing import resolve_runtime_feature_route
from hring_api.domains.identity.mfa_security import generate_totp_code
from hring_api.main import app


PASSWORD = "correct horse battery staple"


def _register(client: TestClient, prefix: str) -> dict[str, Any]:
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


def _auth(account: dict[str, Any]) -> dict[str, str]:
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


def _register_with_role(client: TestClient, prefix: str, role: str) -> dict[str, Any]:
    account = _register(client, prefix)
    asyncio.run(_grant_platform_role(UUID(account["user"]["id"]), role))
    enrollment = client.post("/api/v1/auth/mfa/enroll", headers=_auth(account))
    assert enrollment.status_code == 200, enrollment.text
    confirmation = client.post(
        "/api/v1/auth/mfa/confirm",
        headers=_auth(account),
        json={"code": generate_totp_code(enrollment.json()["secret"])},
    )
    assert confirmation.status_code == 200, confirmation.text
    return account


def test_ai_feature_map_is_complete_admin_managed_and_runtime_effective() -> None:
    feature_key = "compat.generate-job-ad"
    with TestClient(app) as client:
        super_admin = _register_with_role(client, "route-super", "super_admin")
        platform_admin = _register_with_role(client, "route-platform", "platform_admin")
        super_headers = _auth(super_admin)
        platform_headers = _auth(platform_admin)

        listed = client.get(
            "/api/v1/admin/platform/ai/routes",
            headers=platform_headers,
        )
        assert listed.status_code == 200, listed.text
        routes = listed.json()
        assert len(routes) == len(AI_FEATURES)
        assert {item["feature_key"] for item in routes} == {
            feature.feature_key for feature in AI_FEATURES
        }
        original = next(item for item in routes if item["feature_key"] == feature_key)
        assert original["source"] == "environment_default"
        assert original["provider_alias"] == "gemini"
        assert original["model"] == "gemini-2.5-pro"
        enrichment = next(
            item
            for item in routes
            if item["feature_key"] == "smart_headhunting.web_enrichment"
        )
        assert enrichment["provider_alias"] == "perplexity"
        assert enrichment["model"] == "sonar"

        forbidden = client.put(
            f"/api/v1/admin/platform/ai/routes/{feature_key}",
            headers=platform_headers,
            json={"provider_alias": "anthropic.primary", "model": "claude-test-model"},
        )
        assert forbidden.status_code == 403

        blank_model = client.put(
            f"/api/v1/admin/platform/ai/routes/{feature_key}",
            headers=super_headers,
            json={"provider_alias": "anthropic.primary", "model": "   "},
        )
        assert blank_model.status_code == 422

        updated = client.put(
            f"/api/v1/admin/platform/ai/routes/{feature_key}",
            headers=super_headers,
            json={"provider_alias": "anthropic.primary", "model": "claude-test-model"},
        )
        assert updated.status_code == 200, updated.text
        assert updated.json()["source"] == "admin_override"
        assert updated.json()["provider_alias"] == "anthropic.primary"
        assert updated.json()["model"] == "claude-test-model"

        resolved = asyncio.run(
            resolve_runtime_feature_route(
                feature_key=feature_key,
                default_provider="gemini",
                default_model="gemini-2.5-pro",
            )
        )
        assert resolved.provider == "anthropic.primary"
        assert resolved.model == "claude-test-model"
        assert resolved.source == "admin_override"

        reset = client.delete(
            f"/api/v1/admin/platform/ai/routes/{feature_key}",
            headers=super_headers,
        )
        assert reset.status_code == 200, reset.text
        assert reset.json()["source"] == "environment_default"
        assert reset.json()["provider_alias"] == "gemini"

        logs = client.get("/api/v1/admin/platform/audit-logs", headers=super_headers)
        assert logs.status_code == 200, logs.text
        actions = {
            row["action"]
            for row in logs.json()
            if row["resource_id"] == feature_key
        }
        assert {"ai.feature_route.update", "ai.feature_route.reset"}.issubset(actions)


def test_retired_strategy_ai_catalog_and_compat_functions_are_removed() -> None:
    retired_feature_keys = {
        "compat.generate-mental-prism",
        "compat.analyze-competitor",
        "compat.analyze-competitor-swot",
        "compat.analyze-global-trends",
        "compat.analyze-market-position",
        "compat.analyze-tech-edge",
        "compat.analyze-value-chain",
        "compat.defense-builder",
        "compat.fetch-company-intel",
        "compat.generate-strategic-recommendations",
        "compat.search-competitor-news",
        "compat.track-funding",
    }
    feature_keys = {feature.feature_key for feature in AI_FEATURES}
    assert feature_keys.isdisjoint(retired_feature_keys)
    assert not any(feature.category == "استراتژی" for feature in AI_FEATURES)
    assert "generate-mental-prism" not in COMPAT_AI_FUNCTIONS
    assert "track-funding" not in COMPAT_AI_FUNCTIONS
    assert "compat.generate-job-ad" in feature_keys
    assert "compat.legal-advisor-chat" in feature_keys
