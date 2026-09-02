import asyncio
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

from fastapi.testclient import TestClient

from hring_api.config import Settings
from hring_api.domains.ai.gateway_client import AiGatewayResult
from hring_api.domains.legal.advisor import _decode_data_url, generate_legal_advice
from hring_api.domains.legal.schemas import (
    LegalAdvisorRequest,
    LegalAdvisorResponse,
    LegalAdvisorSource,
    LegalSearchResult,
)
from hring_api.main import app


PASSWORD = "correct horse battery staple"


def _register(client: TestClient) -> dict[str, Any]:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"legal-advisor-{uuid4()}@example.com",
            "password": PASSWORD,
            "full_name": "Legal Advisor Test",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_legal_advisor_uses_five_rag_results_and_returns_three_sources(monkeypatch) -> None:
    captured: dict[str, object] = {}
    results = [
        LegalSearchResult(
            id=uuid4(),
            source_id=uuid4(),
            title=f"قانون کار {index}",
            content=f"ماده {index} متن قانونی مرتبط با مرخصی کارگر",
            category="labor_law",
            source_url=f"https://example.com/law/{index}",
            article_number=str(index),
            similarity=0.9 - (index / 100),
            source_version=1,
            published_at=None,
        )
        for index in range(1, 6)
    ]

    async def fake_search(_session: object, **kwargs: Any) -> list[LegalSearchResult]:
        captured["search_payload"] = kwargs["payload"]
        return results

    async def fake_managed(_session: object, **kwargs: Any) -> AiGatewayResult:
        captured["variables"] = kwargs["variables"]
        return AiGatewayResult(
            request_id=uuid4(),
            content="طبق ماده ۱ قانون کار، پاسخ مستند این است.",
            provider="test",
            model="test-model",
            usage={},
            provider_cost_microusd=1,
        )

    monkeypatch.setattr(
        "hring_api.domains.legal.advisor.search_legal_knowledge",
        fake_search,
    )
    monkeypatch.setattr(
        "hring_api.domains.legal.advisor.generate_with_managed_prompt",
        fake_managed,
    )

    result = asyncio.run(
        generate_legal_advice(
            SimpleNamespace(),
            payload=LegalAdvisorRequest.model_validate(
                {
                    "query": "حقوق مرخصی چقدر است؟",
                    "conversationHistory": [
                        {"role": "user", "content": "قرارداد من یک‌ساله است."},
                        {"role": "assistant", "content": "نوع قرارداد ثبت شد."},
                    ],
                }
            ),
            principal=SimpleNamespace(user_id=uuid4(), memberships=[]),
            settings=Settings(),
        )
    )

    search_payload = captured["search_payload"]
    assert search_payload.match_count == 5
    assert search_payload.match_threshold == 0.3
    assert len(result.sources) == 3
    assert result.sources[0].article_number == "1"
    variables = captured["variables"]
    assert "ماده 1" in variables["legal_context"]
    assert "کاربر: قرارداد من یک‌ساله است." in variables["conversation_history"]
    assert variables["attachment_context"] == "پیوستی ارسال نشده است."


def test_attachment_data_url_is_strictly_validated() -> None:
    suffix, raw, mime_type = _decode_data_url(
        "data:image/png;base64,iVBORw0KGgo=",
        expected="image",
    )
    assert suffix == ".png"
    assert raw.startswith(b"\x89PNG")
    assert mime_type == "image/png"


def test_legal_advisor_route_requires_auth_and_preserves_ui_contract(monkeypatch) -> None:
    async def fake_limit(**_kwargs: object) -> None:
        return None

    async def fake_advice(*_args: object, **_kwargs: object) -> LegalAdvisorResponse:
        return LegalAdvisorResponse(
            answer="پاسخ مستند",
            sources=[
                LegalAdvisorSource(
                    article_number="7",
                    category="labor_law",
                    similarity=0.91,
                    title="قانون کار",
                    source_url="https://example.com/labor-law",
                )
            ],
        )

    monkeypatch.setattr(
        "hring_api.domains.legal.routes.enforce_legal_advisor_rate_limit",
        fake_limit,
    )
    monkeypatch.setattr(
        "hring_api.domains.legal.routes.generate_legal_advice",
        fake_advice,
    )

    with TestClient(app) as client:
        payload = {"query": "شرایط مرخصی چیست؟", "conversationHistory": []}
        assert client.post(
            "/api/v1/legal/advisor/chat",
            json=payload,
            headers={"X-Idempotency-Key": "test-unauthenticated"},
        ).status_code == 401
        account = _register(client)
        response = client.post(
            "/api/v1/legal/advisor/chat",
            json=payload,
            headers={
                "Authorization": f"Bearer {account['tokens']['access_token']}",
                "X-Idempotency-Key": "test-legal-request",
            },
        )
        assert response.status_code == 200, response.text
        assert response.json() == {
            "success": True,
            "answer": "پاسخ مستند",
            "sources": [
                {
                    "articleNumber": "7",
                    "category": "labor_law",
                    "similarity": 0.91,
                    "title": "قانون کار",
                    "sourceUrl": "https://example.com/labor-law",
                }
            ],
        }
