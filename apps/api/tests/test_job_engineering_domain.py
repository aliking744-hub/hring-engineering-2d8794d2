import asyncio
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from hring_api.config import Settings
from hring_api.domains.ai.gateway_client import AiGatewayResult
from hring_api.domains.job_engineering.schemas import (
    JobProfileGenerateRequest,
    JobProfileResponse,
)
from hring_api.domains.job_engineering.service import _generate_content
from hring_api.main import app


PASSWORD = "correct horse battery staple"


def _register(client: TestClient) -> dict[str, Any]:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"job-profile-{uuid4()}@example.com",
            "password": PASSWORD,
            "full_name": "Job Profile Test",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_job_profile_prompt_preserves_lovable_contract(monkeypatch) -> None:
    captured: list[dict[str, str]] = []

    async def fake_route(**_kwargs: object) -> SimpleNamespace:
        return SimpleNamespace(provider="test", model="test-model", source="test")

    async def fake_generate(**kwargs: Any) -> AiGatewayResult:
        captured.extend(kwargs["messages"])
        return AiGatewayResult(
            request_id=uuid4(),
            content="# سند پروفایل شغلی",
            provider="test",
            model="test-model",
            usage={"input_tokens": 10, "output_tokens": 20},
            provider_cost_microusd=1,
        )

    async def fake_managed(_session: object, **kwargs: Any) -> AiGatewayResult:
        assert kwargs["variables"] == {
            "job_title": "مدیر محصول",
            "industry": "فناوری",
            "seniority_level": "senior",
            "company_name": "HRing",
        }
        return await kwargs["fallback"]()

    monkeypatch.setattr(
        "hring_api.domains.job_engineering.service.resolve_runtime_feature_route",
        fake_route,
    )
    monkeypatch.setattr(
        "hring_api.domains.job_engineering.service.generate_with_ai_gateway",
        fake_generate,
    )
    monkeypatch.setattr(
        "hring_api.domains.job_engineering.service.generate_with_managed_prompt",
        fake_managed,
    )

    result = asyncio.run(
        _generate_content(
            payload=JobProfileGenerateRequest.model_validate(
                {
                    "jobTitle": "مدیر محصول",
                    "industry": "فناوری",
                    "seniorityLevel": "senior",
                    "companyName": "HRing",
                }
            ),
            principal=SimpleNamespace(user_id=uuid4(), memberships=[]),
            credits_charged=5,
            settings=Settings(),
            session=SimpleNamespace(),
        )
    )

    assert result.content.startswith("# سند پروفایل شغلی")
    assert "**سابقه کار مورد نیاز:** حداقل ۵ سال سابقه کار مرتبط" in result.content
    prompt = "\n".join(item["content"] for item in captured)
    for heading in (
        "## بخش اول: هویت شغلی",
        "## بخش دوم: ماموریت شغل",
        "## بخش سوم: حوزه‌های کلیدی مسئولیت (KRAs)",
        "## بخش چهارم: شرایط احراز شغل",
        "## بخش پنجم: شرایط محیطی",
    ):
        assert heading in prompt
    assert "<job_title>مدیر محصول</job_title>" in prompt
    assert "NO HTML TAGS" in prompt


def test_job_profile_request_rejects_blank_required_fields() -> None:
    with pytest.raises(ValidationError):
        JobProfileGenerateRequest.model_validate(
            {
                "jobTitle": "  ",
                "industry": "فناوری",
                "seniorityLevel": "senior",
            }
        )


def test_job_profile_route_requires_auth_and_uses_dedicated_contract(monkeypatch) -> None:
    async def fake_profile(*_args: object, **_kwargs: object) -> JobProfileResponse:
        return JobProfileResponse(content="# پروفایل اختصاصی")

    monkeypatch.setattr(
        "hring_api.domains.job_engineering.routes.generate_job_profile",
        fake_profile,
    )

    payload = {
        "jobTitle": "مدیر محصول",
        "industry": "فناوری",
        "seniorityLevel": "senior",
        "companyName": "HRing",
    }
    with TestClient(app) as client:
        unauthorized = client.post(
            "/api/v1/job-engineering/job-profiles/generate",
            json=payload,
            headers={"X-Idempotency-Key": "job-profile-test-1"},
        )
        assert unauthorized.status_code == 401

        account = _register(client)
        response = client.post(
            "/api/v1/job-engineering/job-profiles/generate",
            json=payload,
            headers={
                "Authorization": f"Bearer {account['tokens']['access_token']}",
                "X-Idempotency-Key": "job-profile-test-2",
            },
        )
        assert response.status_code == 200, response.text
        assert response.json() == {"content": "# پروفایل اختصاصی"}
