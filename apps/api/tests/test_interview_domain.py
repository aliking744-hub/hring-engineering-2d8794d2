import asyncio
import json
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from hring_api.config import Settings
from hring_api.domains.ai.gateway_client import AiGatewayResult
from hring_api.domains.interview.schemas import (
    InterviewKitGenerateRequest,
    InterviewKitResponse,
)
from hring_api.domains.interview.service import _generate_content, _parse_response
from hring_api.main import app


PASSWORD = "correct horse battery staple"


def _register(client: TestClient) -> dict[str, Any]:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"interview-{uuid4()}@example.com",
            "password": PASSWORD,
            "full_name": "Interview Test",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _questions() -> list[dict[str, object]]:
    specs = [
        ("technical", 4, "سؤالات تخصصی و فنی"),
        ("behavioral", 3, "سؤالات رفتاری و مهارت‌های نرم"),
        ("intelligence", 2, "سؤالات هوش و حل مسئله"),
        ("cultural", 2, "سؤالات صنعت و تناسب فرهنگی"),
    ]
    questions: list[dict[str, object]] = []
    for icon, count, section in specs:
        for index in range(1, count + 1):
            questions.append(
                {
                    "id": f"{icon}-{index}",
                    "section": section,
                    "sectionIcon": icon,
                    "question": f"سؤال عمیق و غیرکلیشه‌ای شماره {index} برای ارزیابی واقعی",
                    "goodSigns": ["پاسخ مستند و دارای مثال مشخص"],
                    "redFlags": ["پاسخ کلی و بدون شاهد عملی"],
                }
            )
    return questions


def test_interview_prompt_preserves_exact_lovable_contract(monkeypatch) -> None:
    captured: list[dict[str, str]] = []

    async def fake_route(**_kwargs: object) -> SimpleNamespace:
        return SimpleNamespace(provider="test", model="test-model", source="test")

    async def fake_generate(**kwargs: Any) -> AiGatewayResult:
        captured.extend(kwargs["messages"])
        assert kwargs["response_format"] == "json_object"
        return AiGatewayResult(
            request_id=uuid4(),
            content=json.dumps({"questions": _questions()}, ensure_ascii=False),
            provider="test",
            model="test-model",
            usage={"input_tokens": 10, "output_tokens": 20},
            provider_cost_microusd=1,
        )

    async def fake_managed(_session: object, **kwargs: Any) -> AiGatewayResult:
        assert kwargs["variables"]["seniority_level"] == "کارشناس ارشد (Senior)"
        assert kwargs["variables"]["focus_instruction"].startswith("⚠️")
        return await kwargs["fallback"]()

    monkeypatch.setattr(
        "hring_api.domains.interview.service.resolve_runtime_feature_route",
        fake_route,
    )
    monkeypatch.setattr(
        "hring_api.domains.interview.service.generate_with_ai_gateway",
        fake_generate,
    )
    monkeypatch.setattr(
        "hring_api.domains.interview.service.generate_with_managed_prompt",
        fake_managed,
    )

    result = asyncio.run(
        _generate_content(
            payload=InterviewKitGenerateRequest.model_validate(
                {
                    "jobTitle": "مدیر محصول",
                    "industry": "فناوری",
                    "seniorityLevel": "senior",
                    "focusArea": "leadership",
                }
            ),
            principal=SimpleNamespace(user_id=uuid4(), memberships=[]),
            credits_charged=5,
            settings=Settings(),
            session=SimpleNamespace(),
        )
    )

    assert len(result.questions) == 11
    prompt = "\n".join(item["content"] for item in captured)
    assert 'هرگز سوالات کلیشه‌ای مثل "درباره خودتان بگویید" نپرس' in prompt
    assert "برای سوالات رفتاری از متد STAR استفاده کن" in prompt
    assert "دقیقاً ۵ سؤال برای بخش behavioral" in prompt
    assert "**بخش ۳: سوالات هوش و حل مسئله (۲ سوال)**" in prompt
    assert "**بخش ۴: سوالات صنعت و تناسب فرهنگی (۲ سوال)**" in prompt
    assert "تأکید بیشتر روی سوالات رهبری و مدیریت" in prompt



def test_interview_response_normalizes_common_provider_json_variants() -> None:
    questions = _questions()
    icons = {
        "technical": "💻",
        "behavioral": "🤝",
        "intelligence": "🧠",
        "cultural": "🏢",
    }
    for index, question in enumerate(questions, start=1):
        question["id"] = index
        question["sectionIcon"] = icons[str(question["sectionIcon"])]
        question["goodSigns"] = "پاسخ مستند و دارای مثال مشخص"
        question["redFlags"] = "پاسخ کلی و بدون شاهد عملی"

    result = _parse_response(json.dumps({"questions": questions}, ensure_ascii=False))

    assert [item.section_icon for item in result.questions] == [
        "technical",
        "technical",
        "technical",
        "technical",
        "technical",
        "behavioral",
        "behavioral",
        "intelligence",
        "intelligence",
        "cultural",
        "cultural",
    ]
    assert result.questions[0].id == "q-1"
    assert result.questions[0].good_signs == ["پاسخ مستند و دارای مثال مشخص"]
    assert result.questions[0].red_flags == ["پاسخ کلی و بدون شاهد عملی"]


def test_interview_response_normalizes_nested_aliases_and_extra_question() -> None:
    questions = _questions()
    questions.append(dict(questions[-1]))
    for question in questions:
        question["text"] = question.pop("question")
        question["good_signs"] = question.pop("goodSigns")
        question["warningSigns"] = question.pop("redFlags")
        question.pop("sectionIcon")

    result = _parse_response(
        json.dumps({"interviewGuide": {"questions": questions}}, ensure_ascii=False)
    )

    assert len(result.questions) == 11
    assert result.questions[0].id == "q-1"
    assert result.questions[-1].section_icon == "cultural"


def test_interview_focus_distribution_is_exactly_five_plus_two_each() -> None:
    for focus in ("technical", "behavioral", "intelligence", "cultural"):
        result = _parse_response(
            json.dumps({"questions": _questions()}, ensure_ascii=False),
            focus_area=focus,
        )
        counts = {icon: 0 for icon in ("technical", "behavioral", "intelligence", "cultural")}
        for question in result.questions:
            counts[question.section_icon] += 1
        assert counts[focus] == 5
        assert sorted(count for icon, count in counts.items() if icon != focus) == [2, 2, 2]


def test_interview_response_rejects_missing_section_or_evaluation_key() -> None:
    missing_section = _questions()[:-1]
    with pytest.raises(ValidationError):
        InterviewKitResponse.model_validate({"questions": missing_section})

    missing_key = _questions()
    missing_key[0]["goodSigns"] = []
    with pytest.raises(ValidationError):
        InterviewKitResponse.model_validate({"questions": missing_key})


def test_interview_route_requires_auth_and_returns_ui_aliases(monkeypatch) -> None:
    expected = InterviewKitResponse.model_validate({"questions": _questions()})

    async def fake_kit(*_args: object, **_kwargs: object) -> InterviewKitResponse:
        return expected

    monkeypatch.setattr(
        "hring_api.domains.interview.routes.generate_interview_kit",
        fake_kit,
    )
    payload = {
        "jobTitle": "مدیر محصول",
        "industry": "فناوری",
        "seniorityLevel": "senior",
        "focusArea": "general",
    }
    with TestClient(app) as client:
        unauthorized = client.post(
            "/api/v1/interview/kits/generate",
            json=payload,
            headers={"X-Idempotency-Key": "interview-test-1"},
        )
        assert unauthorized.status_code == 401

        account = _register(client)
        response = client.post(
            "/api/v1/interview/kits/generate",
            json=payload,
            headers={
                "Authorization": f"Bearer {account['tokens']['access_token']}",
                "X-Idempotency-Key": "interview-test-2",
            },
        )
        assert response.status_code == 200, response.text
        first = response.json()["questions"][0]
        assert first["sectionIcon"] == "technical"
        assert first["goodSigns"] == ["پاسخ مستند و دارای مثال مشخص"]
        assert first["redFlags"] == ["پاسخ کلی و بدون شاهد عملی"]

