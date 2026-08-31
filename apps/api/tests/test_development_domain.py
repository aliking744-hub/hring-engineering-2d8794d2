import asyncio
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from hring_api.config import Settings
from hring_api.domains.ai.gateway_client import AiGatewayResult
from hring_api.domains.development.ai_service import generate_learning_path_content
from hring_api.domains.development.email import build_learning_path_html
from hring_api.domains.development.schemas import (
    LearningPathGenerateRequest,
    LearningPathResult,
)
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


def _learning_result() -> LearningPathResult:
    return LearningPathResult.model_validate(
        {
            "skillGapAnalysis": "شکاف مهارتی مستند",
            "hardSkills": [
                {"skill": "Python", "reason": "برای توسعه سرویس"},
                {"skill": "SQL", "reason": "برای تحلیل داده"},
            ],
            "softSkills": [
                {"skill": "ارتباط", "reason": "برای همکاری تیمی"},
                {"skill": "اولویت‌بندی", "reason": "برای تحویل پایدار"},
            ],
            "roadmap": [
                {
                    "month": "ماه اول",
                    "focus": "پایه‌ها",
                    "actionItems": ["تکمیل دوره", "اجرای پروژه"],
                },
                {
                    "month": "ماه دوم",
                    "focus": "داده",
                    "actionItems": ["تمرین SQL", "مرور پروژه"],
                },
                {
                    "month": "ماه سوم",
                    "focus": "سرویس",
                    "actionItems": ["ساخت API", "بازبینی کد"],
                },
                {
                    "month": "ماه چهارم",
                    "focus": "پایداری",
                    "actionItems": ["تست‌نویسی", "مستندسازی"],
                }
            ],
            "trainingNote": "هفته‌ای چهار ساعت",
        }
    )


def test_learning_ai_omits_employee_identity_from_provider_payload(monkeypatch) -> None:
    captured_messages: list[dict[str, str]] = []

    async def fake_route(**_kwargs: object) -> SimpleNamespace:
        return SimpleNamespace(provider="test", model="test-model", source="test")

    async def fake_generate(**kwargs: Any) -> AiGatewayResult:
        captured_messages.extend(kwargs["messages"])
        return AiGatewayResult(
            request_id=uuid4(),
            content=_learning_result().model_dump_json(by_alias=True),
            provider="test",
            model="test-model",
            usage={"input_tokens": 10, "output_tokens": 20},
            provider_cost_microusd=1,
        )

    monkeypatch.setattr(
        "hring_api.domains.development.ai_service.resolve_runtime_feature_route",
        fake_route,
    )
    monkeypatch.setattr(
        "hring_api.domains.development.ai_service.generate_with_ai_gateway",
        fake_generate,
    )
    payload = LearningPathGenerateRequest(
        employee_name="PRIVATE PERSON 123",
        employee_email="private-person-123@example.com",
        job_title="Backend Engineer",
        industry="Technology",
        seniority_level="Senior",
        education_level="Bachelor",
        field_of_study="Software Engineering",
        experience_years=5,
        training_months=4,
    )

    result = asyncio.run(
        generate_learning_path_content(
            payload=payload,
            user_id=uuid4(),
            company_id=uuid4(),
            credits_charged=15,
            settings=Settings(),
        )
    )

    provider_payload = "\n".join(item["content"] for item in captured_messages)
    assert "PRIVATE PERSON 123" not in provider_payload
    assert "private-person-123@example.com" not in provider_payload
    assert result.skill_gap_analysis == "شکاف مهارتی مستند"


def test_learning_email_html_escapes_customer_content() -> None:
    result = _learning_result().model_dump(by_alias=True)
    result["skillGapAnalysis"] = "<script>alert('x')</script>"
    document = build_learning_path_html(
        employee_name="<img src=x onerror=alert(1)>",
        job_title="Engineer & Lead",
        result=result,
    )
    assert "<script>" not in document
    assert "<img src=x" not in document
    assert "&lt;script&gt;" in document
    assert "Engineer &amp; Lead" in document


def test_learning_request_rejects_invalid_employee_email() -> None:
    with pytest.raises(ValidationError):
        LearningPathGenerateRequest(
            employee_email="not-an-email",
            job_title="Engineer",
            industry="Technology",
            seniority_level="Senior",
            education_level="Bachelor",
            experience_years=5,
        )


def test_native_development_records_are_owner_scoped_and_idempotent(monkeypatch) -> None:
    async def fake_learning(**_kwargs: object) -> LearningPathResult:
        return _learning_result()

    async def fake_onboarding(**_kwargs: object) -> tuple[str, str]:
        return "# برنامه ۹۰ روزه", "سلام و خوش آمدید"

    monkeypatch.setattr(
        "hring_api.domains.development.service.generate_learning_path_content",
        fake_learning,
    )
    monkeypatch.setattr(
        "hring_api.domains.development.service.generate_onboarding_content",
        fake_onboarding,
    )

    with TestClient(app) as client:
        first = _register(client, "development-first")
        second = _register(client, "development-second")
        first_headers = _auth(first)
        second_headers = _auth(second)

        assert client.get("/api/v1/development/learning-paths").status_code == 401

        learning_payload = {
            "employee_name": "کارمند اول",
            "employee_email": "employee@example.com",
            "job_title": "Backend Engineer",
            "industry": "Technology",
            "seniority_level": "Senior",
            "education_level": "Bachelor",
            "field_of_study": "Software Engineering",
            "experience_years": 5,
            "training_months": 4,
        }
        created = client.post(
            "/api/v1/development/learning-paths/generate",
            json=learning_payload,
            headers={**first_headers, "X-Idempotency-Key": "learning-owner-scope-1"},
        )
        assert created.status_code == 201, created.text
        learning_path_id = created.json()["id"]
        assert created.json()["result"]["skillGapAnalysis"] == "شکاف مهارتی مستند"

        first_history = client.get(
            "/api/v1/development/learning-paths",
            headers=first_headers,
        )
        second_history = client.get(
            "/api/v1/development/learning-paths",
            headers=second_headers,
        )
        assert [row["id"] for row in first_history.json()] == [learning_path_id]
        assert second_history.json() == []

        foreign_delete = client.delete(
            f"/api/v1/development/learning-paths/{learning_path_id}",
            headers=second_headers,
        )
        foreign_email = client.post(
            f"/api/v1/development/learning-paths/{learning_path_id}/email",
            headers=second_headers,
        )
        assert foreign_delete.status_code == 404
        assert foreign_email.status_code == 404

        onboarding_payload = {
            "job_title": "Product Manager",
            "seniority": "mid",
            "expectation": "learning",
            "mentor_role": "Head of Product",
        }
        request_headers = {
            **first_headers,
            "X-Idempotency-Key": "onboarding-idempotent-1",
        }
        onboarding = client.post(
            "/api/v1/development/onboarding-plans/generate",
            json=onboarding_payload,
            headers=request_headers,
        )
        assert onboarding.status_code == 201, onboarding.text
        balance_after_first = client.get(
            "/api/v1/billing/credits/me",
            headers=first_headers,
        ).json()["available_credits"]

        replay = client.post(
            "/api/v1/development/onboarding-plans/generate",
            json=onboarding_payload,
            headers=request_headers,
        )
        balance_after_replay = client.get(
            "/api/v1/billing/credits/me",
            headers=first_headers,
        ).json()["available_credits"]
        assert replay.status_code == 201, replay.text
        assert replay.json()["id"] == onboarding.json()["id"]
        assert balance_after_replay == balance_after_first

        conflicting_replay = client.post(
            "/api/v1/development/onboarding-plans/generate",
            json={**onboarding_payload, "job_title": "Another Role"},
            headers=request_headers,
        )
        assert conflicting_replay.status_code == 409

        own_delete = client.delete(
            f"/api/v1/development/learning-paths/{learning_path_id}",
            headers=first_headers,
        )
        assert own_delete.status_code == 204
