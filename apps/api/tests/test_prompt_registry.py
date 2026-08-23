import asyncio
from typing import Any
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from hring_api.db.session import SessionFactory
from hring_api.domains.access.models import PlatformRoleAssignment
from hring_api.domains.ai import prompt_service
from hring_api.domains.ai.gateway_client import AiGatewayResult
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
    return account


def _create_payload(prompt_key: str) -> dict[str, object]:
    return {
        "prompt_key": prompt_key,
        "feature_key": "recruiting.candidate_summary",
        "display_name": "خلاصه کاندیدا",
        "description": "Prompt controlled by Super Admin",
        "version": {
            "provider_alias": "gemini",
            "model": "gemini-2.5-flash",
            "system_template": "You are an HR analyst for {company_name}.",
            "user_template": "Summarize candidate {candidate_name}.",
            "input_variables": ["company_name", "candidate_name"],
            "response_format": "json_object",
            "output_schema": {
                "type": "object",
                "properties": {"summary": {"type": "string"}},
                "required": ["summary"],
            },
            "temperature": 0.2,
            "max_output_tokens": 400,
        },
    }


def test_prompt_registry_draft_test_publish_compare_and_rollback(monkeypatch) -> None:
    captured: list[dict[str, object]] = []

    async def fake_generate(**kwargs: object) -> AiGatewayResult:
        captured.append(dict(kwargs))
        return AiGatewayResult(
            request_id=uuid4(),
            content='{"summary":"Strong profile"}',
            provider="gemini-primary",
            model="gemini-2.5-flash",
            usage={"input_tokens": 20, "output_tokens": 8},
            provider_cost_microusd=12,
        )

    monkeypatch.setattr(prompt_service, "generate_with_ai_gateway", fake_generate)

    with TestClient(app) as client:
        super_admin = _register_with_role(client, "prompt-super", "super_admin")
        platform_admin = _register_with_role(client, "prompt-platform", "platform_admin")
        content_admin = _register_with_role(client, "prompt-content", "content_admin")
        super_headers = _auth(super_admin)
        platform_headers = _auth(platform_admin)
        content_headers = _auth(content_admin)

        assert client.get(
            "/api/v1/admin/platform/ai/prompts", headers=platform_headers
        ).status_code == 200
        forbidden = client.post(
            "/api/v1/admin/platform/ai/prompts",
            headers=platform_headers,
            json=_create_payload(f"forbidden-{uuid4().hex}"),
        )
        assert forbidden.status_code == 403

        mismatch_payload = _create_payload(f"mismatch-{uuid4().hex}")
        mismatch_payload["version"]["input_variables"] = ["candidate_name"]  # type: ignore[index]
        mismatch = client.post(
            "/api/v1/admin/platform/ai/prompts",
            headers=super_headers,
            json=mismatch_payload,
        )
        assert mismatch.status_code == 422

        prompt_key = f"candidate-summary-{uuid4().hex}"
        created = client.post(
            "/api/v1/admin/platform/ai/prompts",
            headers=super_headers,
            json=_create_payload(prompt_key),
        )
        assert created.status_code == 201, created.text
        prompt = created.json()
        prompt_id = prompt["id"]
        first = prompt["versions"][0]
        assert first["version"] == 1
        assert first["status"] == "draft"
        assert first["test_status"] == "untested"
        assert prompt["published_provider_alias"] is None
        assert prompt["draft_provider_alias"] == "gemini"
        assert prompt["draft_model"] == "gemini-2.5-flash"

        tested = client.post(
            f"/api/v1/admin/platform/ai/prompts/{prompt_id}/versions/{first['id']}/test",
            headers=content_headers,
            json={
                "variables": {
                    "company_name": "Acme",
                    "candidate_name": "Sara",
                }
            },
        )
        assert tested.status_code == 200, tested.text
        assert tested.json()["passed"] is True
        assert tested.json()["schema_valid"] is True
        assert "Acme" in tested.json()["rendered_system"]
        assert captured[-1]["provider"] == "gemini"
        assert captured[-1]["model"] == "gemini-2.5-flash"
        metadata = captured[-1]["metadata_json"]
        assert isinstance(metadata, dict)
        assert metadata["prompt_key"] == prompt_key
        assert metadata["prompt_version"] == 1

        forbidden_publish = client.post(
            f"/api/v1/admin/platform/ai/prompts/{prompt_id}/versions/{first['id']}/publish",
            headers=content_headers,
        )
        assert forbidden_publish.status_code == 403

        published = client.post(
            f"/api/v1/admin/platform/ai/prompts/{prompt_id}/versions/{first['id']}/publish",
            headers=super_headers,
        )
        assert published.status_code == 200, published.text
        assert published.json()["published_version"] == 1
        assert published.json()["published_provider_alias"] == "gemini"
        assert published.json()["published_model"] == "gemini-2.5-flash"
        assert published.json()["draft_version"] is None

        listed = client.get(
            "/api/v1/admin/platform/ai/prompts",
            headers=platform_headers,
        )
        assert listed.status_code == 200, listed.text
        summary = next(item for item in listed.json() if item["id"] == prompt_id)
        assert summary["published_provider_alias"] == "gemini"
        assert summary["published_model"] == "gemini-2.5-flash"

        draft = client.post(
            f"/api/v1/admin/platform/ai/prompts/{prompt_id}/drafts",
            headers=content_headers,
            json={},
        )
        assert draft.status_code == 201, draft.text
        assert draft.json()["version"] == 2
        second_id = draft.json()["id"]

        updated = client.patch(
            f"/api/v1/admin/platform/ai/prompts/{prompt_id}/versions/{second_id}",
            headers=content_headers,
            json={
                "provider_alias": "ollama",
                "model": "qwen3:8b",
                "system_template": "Analyze for {company_name} locally.",
                "user_template": "Candidate: {candidate_name}",
            },
        )
        assert updated.status_code == 200, updated.text
        assert updated.json()["provider_alias"] == "ollama"
        assert updated.json()["test_status"] == "untested"

        tested_second = client.post(
            f"/api/v1/admin/platform/ai/prompts/{prompt_id}/versions/{second_id}/test",
            headers=content_headers,
            json={
                "variables": {
                    "company_name": "Acme",
                    "candidate_name": "Sara",
                }
            },
        )
        assert tested_second.status_code == 200, tested_second.text
        assert tested_second.json()["passed"] is True
        assert captured[-1]["provider"] == "ollama"
        assert captured[-1]["model"] == "qwen3:8b"

        published_second = client.post(
            f"/api/v1/admin/platform/ai/prompts/{prompt_id}/versions/{second_id}/publish",
            headers=super_headers,
        )
        assert published_second.status_code == 200, published_second.text
        versions = published_second.json()["versions"]
        version_one = next(item for item in versions if item["version"] == 1)
        assert version_one["status"] == "archived"
        assert next(item for item in versions if item["version"] == 2)["status"] == "published"

        immutable = client.patch(
            f"/api/v1/admin/platform/ai/prompts/{prompt_id}/versions/{first['id']}",
            headers=content_headers,
            json={"model": "must-not-change"},
        )
        assert immutable.status_code == 409

        rolled_back = client.post(
            f"/api/v1/admin/platform/ai/prompts/{prompt_id}/rollback",
            headers=super_headers,
            json={"target_version_id": version_one["id"]},
        )
        assert rolled_back.status_code == 200, rolled_back.text
        restored_versions = rolled_back.json()["versions"]
        restored = next(item for item in restored_versions if item["status"] == "published")
        assert restored["version"] == 3
        assert restored["model"] == "gemini-2.5-flash"
        assert restored["published_by"] == super_admin["user"]["id"]

        async def run_registered_prompt() -> AiGatewayResult:
            async with SessionFactory() as session:
                return await prompt_service.generate_with_registered_prompt(
                    session,
                    prompt_key=prompt_key,
                    variables={"company_name": "Acme", "candidate_name": "Sara"},
                    user_id=UUID(super_admin["user"]["id"]),
                    company_id=None,
                )

        runtime_result = asyncio.run(run_registered_prompt())
        assert runtime_result.content == '{"summary":"Strong profile"}'
        runtime_metadata = captured[-1]["metadata_json"]
        assert isinstance(runtime_metadata, dict)
        assert runtime_metadata["prompt_mode"] == "runtime"
        assert runtime_metadata["prompt_version"] == 3

        logs = client.get("/api/v1/admin/platform/audit-logs", headers=super_headers)
        assert logs.status_code == 200, logs.text
        actions = {
            row["action"]
            for row in logs.json()
            if row["metadata_json"].get("prompt_key") == prompt_key
        }
        assert {
            "ai.prompt.create",
            "ai.prompt.test",
            "ai.prompt.publish",
            "ai.prompt.rollback",
        }.issubset(actions)
