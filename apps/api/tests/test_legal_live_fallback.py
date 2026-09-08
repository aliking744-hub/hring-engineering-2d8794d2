import pytest

from hring_api.domains.ai.gateway_client import AiCitation
from hring_api.domains.legal.advisor import (
    LegalAdvisorError,
    _parse_live_search_response,
)


def test_live_search_accepts_only_official_cited_sources() -> None:
    answer, sources = _parse_live_search_response(
        """
        {
          "answer": "### نتیجه کوتاه\\nمرخصی تابع ماده رسمی است. [1]",
          "sources": [
            {
              "title": "قانون کار",
              "url": "https://qavanin.ir/Law/TreeText/?IDS=3983654531606411392",
              "article_number": "64"
            },
            {
              "title": "وبلاگ غیررسمی",
              "url": "https://example.com/labor",
              "article_number": null
            }
          ]
        }
        """
    )

    assert "[1]" in answer
    assert len(sources) == 1
    assert sources[0].source_url.startswith("https://qavanin.ir/")


def test_live_search_uses_real_gateway_citations_instead_of_model_urls() -> None:
    answer, sources = _parse_live_search_response(
        """
        {
          "answer": "مرخصی استحقاقی در ماده قانونی تعیین شده است. [1]",
          "sources": [
            {
              "title": "لینک نوشته‌شده توسط مدل",
              "url": "https://qavanin.ir/",
              "article_number": "64"
            }
          ]
        }
        """,
        provider_citations=(
            AiCitation(
                url="https://qavanin.ir/Law/TreeText/?IDS=3983654531606411392",
                title="قانون کار",
            ),
        ),
    )

    assert answer.endswith("[1]")
    assert len(sources) == 1
    assert sources[0].reference_number == 1
    assert sources[0].source_url.endswith("IDS=3983654531606411392")


def test_live_search_rejects_nonofficial_gateway_citation() -> None:
    with pytest.raises(LegalAdvisorError, match="منبع رسمی مستقیم"):
        _parse_live_search_response(
            '{"answer":"پاسخ [1]","sources":[]}',
            provider_citations=(
                AiCitation(
                    url="https://davoudabadi.ir/page/1",
                    title="منبع غیررسمی",
                ),
            ),
        )


def test_live_search_accepts_official_ministry_subdomain_citation() -> None:
    answer, sources = _parse_live_search_response(
        '{"answer":"قانون کار در منبع رسمی آمده است. [1]","sources":[]}',
        provider_citations=(
            AiCitation(
                url=(
                    "https://rkj.mcls.gov.ir/fa/moghararaat/ghavanin/"
                    "ghanoonkar"
                ),
                title="قانون کار",
            ),
        ),
    )

    assert answer.endswith("[1]")
    assert sources[0].source_url.startswith("https://rkj.mcls.gov.ir/")


def test_live_search_rejects_nonofficial_only_response() -> None:
    with pytest.raises(LegalAdvisorError, match="منبع رسمی"):
        _parse_live_search_response(
            """
            {
              "answer": "یک پاسخ ظاهراً مستند. [1]",
              "sources": [
                {
                  "title": "سایت تجاری",
                  "url": "https://davoudabadi.ir/page/1",
                  "article_number": "1"
                }
              ]
            }
            """
        )


def test_live_search_rejects_official_homepage_as_citation() -> None:
    with pytest.raises(LegalAdvisorError, match="منبع رسمی"):
        _parse_live_search_response(
            """
            {
              "answer": "پاسخ دارای ارجاع ظاهری. [1]",
              "sources": [
                {
                  "title": "قانون کار",
                  "url": "https://qavanin.ir/",
                  "article_number": "64"
                }
              ]
            }
            """
        )


def test_live_search_rejects_uncited_response() -> None:
    with pytest.raises(LegalAdvisorError, match="ارجاعات"):
        _parse_live_search_response(
            """
            {
              "answer": "پاسخ بدون ارجاع",
              "sources": [
                {
                  "title": "قانون کار",
                  "url": "https://qavanin.ir/Law/TreeText/?IDS=3983654531606411392",
                  "article_number": "64"
                }
              ]
            }
            """
        )
