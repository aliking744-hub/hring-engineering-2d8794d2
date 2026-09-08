from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace
from uuid import uuid4

from hring_api.config import Settings
from hring_api.domains.ai.gateway_client import AiCitation, AiGatewayResult
from hring_api.domains.compat.functions import invoke_ai_function
from hring_api.domains.legal.official import is_official_legal_url, official_citations


def _result(content: dict[str, object], citations: tuple[AiCitation, ...]) -> AiGatewayResult:
    return AiGatewayResult(
        request_id=uuid4(),
        content=json.dumps(content, ensure_ascii=False),
        provider="avalai.search",
        model="sonar",
        usage={},
        provider_cost_microusd=1,
        citations=citations,
    )


def test_official_urls_accept_direct_subdomains_and_reject_homepages() -> None:
    assert is_official_legal_url(
        "https://rkj.mcls.gov.ir/fa/moghararaat/ghavanin/ghanoonkar",
        direct=True,
    )
    assert not is_official_legal_url("https://qavanin.ir/", direct=True)
    assert not is_official_legal_url("https://davoudabadi.ir/page/1/", direct=True)


def test_error_titles_are_not_exposed_as_source_titles() -> None:
    rows = official_citations(
        (
            AiCitation(
                url="https://qavanin.ir/Law/PrintText/83566",
                title="Error 403 | Access Denied",
            ),
        )
    )
    assert rows[0].title == "qavanin.ir"


def test_labor_complaint_uses_sonar_domain_filter_and_returns_official_sources(
    monkeypatch,
) -> None:
    captured: dict[str, object] = {}

    async def fake_build_context(_session: object, _body: object) -> object:
        from hring_api.domains.compat.labor_complaint import LaborComplaintContext

        return LaborComplaintContext(
            claim_label="معوقات مزدی",
            evidence_summary="- قرارداد کار: دارد",
            missing_required=[],
            legal_context="اطلاعات قانونی در پایگاه موجود نیست.",
            relevant_articles=[],
            additional_files_count=0,
            available_evidence=["قرارداد کار"],
        )

    async def fake_gateway(**kwargs: object) -> AiGatewayResult:
        captured.update(kwargs)
        return _result(
            {
                "winProbability": 70,
                "riskLevel": "medium",
                "strongPoints": ["قرارداد موجود است"],
                "weakPoints": [],
                "missingEvidence": [],
                "recommendation": "با استناد به قانون اقدام شود.[1]",
                "complaintText": "ریاست محترم هیات تشخیص... ماده مربوط [1] با احترام",
                "relevantArticles": ["ماده قانونی مرتبط [1]"],
            },
            (
                AiCitation(
                    url="https://qavanin.ir/Law/TreeText/?IDS=3983654531606411392",
                    title="قانون کار",
                ),
            ),
        )

    monkeypatch.setattr("hring_api.domains.compat.functions.build_context", fake_build_context)
    monkeypatch.setattr(
        "hring_api.domains.compat.functions.generate_with_ai_gateway", fake_gateway
    )
    result = asyncio.run(
        invoke_ai_function(
            name="labor-complaint-assistant",
            body={"action": "analyze_and_draft", "claimType": "unpaid_salary"},
            principal=None,
            settings=Settings(),
            session=SimpleNamespace(),
        )
    )
    assert captured["provider"] == "avalai.search"
    assert captured["model"] == "sonar"
    assert captured["search_domain_filter"] == [
        "mcls.gov.ir",
        "qavanin.ir",
        "sso.ir",
        "divan-edalat.ir",
    ]
    assert result["sources"][0]["url"].startswith("https://qavanin.ir/")
    assert "تضمین" in result["probabilityDisclaimer"]
