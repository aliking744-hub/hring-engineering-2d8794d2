from uuid import uuid4

import pytest
from pydantic import ValidationError

from hring_ai_gateway.schemas import GenerateRequest


def _request(domains: list[str]) -> GenerateRequest:
    return GenerateRequest(
        request_id=uuid4(),
        feature_key="legal.advisor_chat",
        provider="avalai.search",
        model="sonar",
        messages=[{"role": "user", "content": "پرسش حقوقی"}],
        search_domain_filter=domains,
    )


def test_search_domain_filter_normalizes_and_deduplicates_domains() -> None:
    request = _request(
        [
            "MCLS.GOV.IR",
            "qavanin.ir.",
            "mcls.gov.ir",
            "sso.ir",
            "divan-edalat.ir",
        ]
    )

    assert request.search_domain_filter == [
        "mcls.gov.ir",
        "qavanin.ir",
        "sso.ir",
        "divan-edalat.ir",
    ]


@pytest.mark.parametrize(
    "domain",
    [
        "https://qavanin.ir",
        "qavanin.ir/Law/TreeText",
        "qavanin.ir:443",
        "user@qavanin.ir",
        "",
    ],
)
def test_search_domain_filter_rejects_urls_and_invalid_hosts(domain: str) -> None:
    with pytest.raises(ValidationError):
        _request([domain])
