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
from hring_api.domains.legal.defense import generate_legal_defense
from hring_api.domains.legal.schemas import (
    LegalDefenseGapAnalysis,
    LegalDefenseRequest,
    LegalDefenseResponse,
    LegalDefenseVerdict,
    LegalSearchResult,
)
from hring_api.main import app


PASSWORD = "correct horse battery staple"


def _gateway_result(content: dict[str, object]) -> AiGatewayResult:
    return AiGatewayResult(
        request_id=uuid4(),
        content=json.dumps(content, ensure_ascii=False),
        provider="gemini",
        model="gemini-2.5-pro",
        usage={},
        provider_cost_microusd=1,
    )


def _register(client: TestClient) -> dict[str, Any]:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"legal-defense-{uuid4()}@example.com",
            "password": PASSWORD,
            "full_name": "Legal Defense Test",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_legal_defense_preserves_three_phase_lovable_contract(monkeypatch) -> None:
    calls: list[dict[str, object]] = []
    searches: list[object] = []
    phase_results = [
        _gateway_result(
            {
                "claims": [
                    {
                        "claim_type": "اضافه‌کاری پرداخت‌نشده",
                        "description": "مطالبه اضافه‌کاری شش ماه",
                        "amount_claimed": "۱۲۰ میلیون ریال",
                    }
                ]
            }
        ),
        _gateway_result(
            {
                "evidence_analysis": [
                    {
                        "claim_type": "اضافه‌کاری پرداخت‌نشده",
                        "required_evidence": ["گزارش حضور و غیاب"],
                        "provided_evidence": ["فیش حقوقی"],
                        "missing_evidence": ["گزارش حضور و غیاب"],
                        "legal_basis": "ماده ۵۹ قانون کار",
                    }
                ],
                "follow_up_questions": [
                    {
                        "question": "گزارش حضور و غیاب موجود است؟",
                        "reason": "برای اثبات ساعت کار لازم است",
                        "related_article": "ماده ۵۹",
                    }
                ],
                "can_proceed": False,
            }
        ),
        _gateway_result(
            {
                "risk_score": 62,
                "risk_level": "high",
                "recommendation": "needs_more_info",
                "reasoning": "مدرک ساعات کار طبق منبع رسمی ناقص است.[1]",
                "key_strengths": ["فیش حقوقی موجود است"],
                "key_weaknesses": ["حضور و غیاب موجود نیست"],
            }
        ),
    ]

    async def fake_context(_payload: LegalDefenseRequest) -> tuple[str, str, str]:
        return "متن واقعی دادخواست", "محتوای استخراج‌شده فیش", "فیش.pdf (pdf)"

    async def fake_managed(_session: object, **kwargs: Any) -> AiGatewayResult:
        calls.append(kwargs)
        return phase_results[len(calls) - 1]

    async def fake_search(_session: object, **kwargs: Any) -> list[LegalSearchResult]:
        searches.append(kwargs["payload"])
        return [
            LegalSearchResult(
                id=uuid4(),
                source_id=uuid4(),
                title="قانون کار",
                content="برای هر ساعت کار اضافی چهل درصد اضافه پرداخت می‌شود.",
                category="labor_law",
                source_url="https://qavanin.ir/Law/TreeText/?IDS=3983654531606411392",
                article_number="59",
                similarity=0.91,
                source_version=1,
                published_at=None,
            )
        ]

    monkeypatch.setattr("hring_api.domains.legal.defense._case_context", fake_context)
    monkeypatch.setattr(
        "hring_api.domains.legal.defense.generate_with_managed_prompt",
        fake_managed,
    )
    monkeypatch.setattr(
        "hring_api.domains.legal.defense.search_legal_knowledge",
        fake_search,
    )

    result = asyncio.run(
        generate_legal_defense(
            SimpleNamespace(),
            payload=LegalDefenseRequest(complaint="data:application/pdf;base64,AAAA"),
            principal=SimpleNamespace(user_id=uuid4(), memberships=[]),
            settings=Settings(),
        )
    )

    assert [call["prompt_key"] for call in calls] == [
        "legal.defense_builder",
        "legal.defense_gap",
        "legal.defense_verdict",
    ]
    assert len(searches) == 1
    assert searches[0].match_count == 3
    assert searches[0].match_threshold == 0.4
    assert result.relevant_laws[0].article_number == "59"
    assert result.relevant_laws[0].source_url.startswith("https://qavanin.ir/")
    assert result.verdict.risk_score == 62
    assert result.gap_analysis.can_proceed is False
    assert "محتوای استخراج‌شده فیش" in calls[1]["variables"]["evidence_context"]


def test_legal_defense_requires_complaint_or_history() -> None:
    with pytest.raises(ValidationError):
        LegalDefenseRequest.model_validate({})


def test_legal_defense_route_requires_auth_and_preserves_ui_aliases(monkeypatch) -> None:
    async def zero_credit_cost(*_args: object, **_kwargs: object) -> int:
        return 0

    monkeypatch.setattr("hring_api.domains.legal.routes.feature_credit_cost", zero_credit_cost)
    async def fake_limit(**_kwargs: object) -> None:
        return None

    async def fake_defense(*_args: object, **_kwargs: object) -> LegalDefenseResponse:
        return LegalDefenseResponse(
            claims=[{"claim_type": "سنوات", "description": "مطالبه سنوات"}],
            relevant_laws=[],
            gap_analysis=LegalDefenseGapAnalysis(
                evidence_analysis=[],
                follow_up_questions=[],
                can_proceed=True,
            ),
            verdict=LegalDefenseVerdict(
                risk_score=25,
                risk_level="low",
                recommendation="fight",
                reasoning="مدارک کافی است.[1]",
                key_strengths=["قرارداد موجود است"],
                key_weaknesses=[],
                defense_bill="متن لایحه",
            ),
        )

    monkeypatch.setattr(
        "hring_api.domains.legal.routes.enforce_legal_defense_rate_limit",
        fake_limit,
    )
    monkeypatch.setattr(
        "hring_api.domains.legal.routes.generate_legal_defense",
        fake_defense,
    )

    with TestClient(app) as client:
        payload = {
            "conversationHistory": [{"role": "user", "content": "پرونده قبلی"}],
            "evidence": [],
            "additionalInfo": "",
        }
        assert client.post(
            "/api/v1/legal/defense/analyze",
            json=payload,
            headers={"X-Idempotency-Key": "test-unauthenticated"},
        ).status_code == 401
        account = _register(client)
        response = client.post(
            "/api/v1/legal/defense/analyze",
            json=payload,
            headers={
                "Authorization": f"Bearer {account['tokens']['access_token']}",
                "X-Idempotency-Key": "test-legal-request",
            },
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["success"] is True
        assert body["gapAnalysis"]["canProceed"] is True
        assert body["verdict"]["riskScore"] == 25
        assert body["verdict"]["defenseBill"] == "متن لایحه"
