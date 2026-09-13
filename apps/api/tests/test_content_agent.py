from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest

import hring_api.domains.content.service as content_service
from hring_api.domains.ai.gateway_client import AiCitation
from hring_api.domains.content.service import (
    ContentAgentError,
    _article_object,
    _credibility_score,
    _official_citations,
    _publication_status,
    _quality_score,
    _write_article,
    due_slot_keys,
    run_content_agent,
)


def _settings(**overrides: object) -> SimpleNamespace:
    values = {
        "enabled": True,
        "timezone": "Asia/Tehran",
        "daily_article_count": 2,
        "publishing_times_json": ["09:00", "17:00"],
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_due_slots_are_timezone_aware_and_idempotent() -> None:
    now = datetime(2026, 9, 9, 5, 35, tzinfo=UTC)  # 09:05 in Tehran
    assert due_slot_keys(_settings(), now) == ["2026-09-09:09:00:Asia/Tehran"]
    assert due_slot_keys(_settings(enabled=False), now) == []


def test_citations_require_direct_allowlisted_diverse_sources() -> None:
    citations = (
        AiCitation(url="https://www.cipd.org/en/knowledge/reports/work-trends/", title="CIPD"),
        AiCitation(url="https://www.ilo.org/publications/future-work", title="ILO"),
        AiCitation(url="https://www.shrm.org/topics-tools/research/ai-at-work", title="SHRM"),
        AiCitation(url="https://evil.example/copied", title="Untrusted"),
        AiCitation(url="https://www.cipd.org/", title="Homepage"),
    )
    rows = _official_citations(citations, ["cipd.org", "ilo.org", "shrm.org"])
    assert len(rows) == 3
    assert all("evil.example" not in str(row["url"]) for row in rows)
    assert _credibility_score(rows, 7) >= 75


def test_citations_reject_homepages_and_single_source_research() -> None:
    with pytest.raises(ContentAgentError, match="fewer than three"):
        _official_citations(
            (AiCitation(url="https://www.cipd.org/", title="Homepage"),),
            ["cipd.org"],
        )


def test_quality_gate_rewards_original_structured_cited_article() -> None:
    sources = [
        {"url": f"https://source{i}.example/report", "title": f"Source {i}"}
        for i in range(1, 4)
    ]
    content = "\n".join([
        "## پاسخ کوتاه", *("واژه " * 210 for _ in range(4)),
        "## داده‌های کلیدی", "یافته مستند [1] و تحلیل مقایسه‌ای [2].",
        "## پیامد برای مدیر منابع انسانی", "چارچوب اقدام [3].",
        "## چک‌لیست اجرا", "- اقدام اول\n- اقدام دوم",
    ])
    score = _quality_score(
        {"seo_title": "راهنمای تازه مدیران منابع انسانی برای آینده محیط کار",
         "meta_description": "تحلیل تازه‌ترین پژوهش‌های معتبر جهانی درباره آینده کار و اقدام‌هایی که مدیران منابع انسانی می‌توانند در سازمان اجرا کنند."},
        content, sources, 90,
    )
    assert score >= 80



def test_publication_status_distinguishes_draft_from_quality_rejection() -> None:
    assert _publication_status(
        auto_publish=False, quality_score=94, minimum_quality_score=80
    ) == ("draft", "drafted")
    assert _publication_status(
        auto_publish=True, quality_score=94, minimum_quality_score=80
    ) == ("published", "published")
    assert _publication_status(
        auto_publish=True, quality_score=79, minimum_quality_score=80
    ) == ("rejected", "rejected")




def test_tagged_article_preserves_multiline_markdown_without_json_escaping() -> None:
    article = _article_object("""<<<TITLE>>>عنوان مقاله منابع انسانی<<<END_TITLE>>>
<<<SLUG>>>human-resources-article<<<END_SLUG>>>
<<<EXCERPT>>>خلاصه مقاله برای مدیران منابع انسانی<<<END_EXCERPT>>>
<<<CONTENT_MARKDOWN>>>## بخش اول
متن چندخطی با «نقل‌قول» و [1].

## بخش دوم
- اقدام اول
- اقدام دوم<<<END_CONTENT_MARKDOWN>>>
<<<SEO_TITLE>>>عنوان سئوی مقاله منابع انسانی<<<END_SEO_TITLE>>>
<<<META_DESCRIPTION>>>توضیح متای مقاله منابع انسانی برای نمایش در نتایج جست‌وجو<<<END_META_DESCRIPTION>>>
<<<FOCUS_KEYWORD>>>منابع انسانی<<<END_FOCUS_KEYWORD>>>
<<<RELATED_KEYWORDS>>>آینده کار، تحلیل افراد
تجربه کارکنان<<<END_RELATED_KEYWORDS>>>""")

    assert "## بخش دوم" in str(article["content_markdown"])
    assert article["related_keywords"] == ["آینده کار", "تحلیل افراد", "تجربه کارکنان"]


@pytest.mark.asyncio
async def test_writer_retries_with_tagged_output_after_malformed_response(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict[str, object]] = []
    responses = [
        SimpleNamespace(content='{"title": "broken"', provider="avalai.primary", model="writer"),
        SimpleNamespace(
            content="""<<<TITLE>>>valid article<<<END_TITLE>>>
<<<SLUG>>>valid-article<<<END_SLUG>>>
<<<EXCERPT>>>short summary<<<END_EXCERPT>>>
<<<CONTENT_MARKDOWN>>>## heading
Persian body with "quotes" and
multiple lines.<<<END_CONTENT_MARKDOWN>>>
<<<SEO_TITLE>>>valid seo title<<<END_SEO_TITLE>>>
<<<META_DESCRIPTION>>>valid meta description<<<END_META_DESCRIPTION>>>
<<<FOCUS_KEYWORD>>>HR trends<<<END_FOCUS_KEYWORD>>>
<<<RELATED_KEYWORDS>>>work, people analytics<<<END_RELATED_KEYWORDS>>>""",
            provider="avalai.primary",
            model="writer",
        ),
    ]

    async def fake_route(**_: object) -> SimpleNamespace:
        return SimpleNamespace(provider="avalai.primary", model="writer")

    async def fake_generate(**kwargs: object) -> SimpleNamespace:
        calls.append(kwargs)
        return responses[len(calls) - 1]

    monkeypatch.setattr(content_service, "resolve_runtime_feature_route", fake_route)
    monkeypatch.setattr(content_service, "generate_with_ai_gateway", fake_generate)

    article, provider, model = await _write_article(
        "brief",
        [{"url": "https://example.com/report", "title": "Report"}],
        SimpleNamespace(recruiting_ai_provider="fallback", recruiting_ai_model="fallback"),
    )

    assert article["title"] == "valid article"
    assert provider == "avalai.primary"
    assert model == "writer"
    assert len(calls) == 2
    assert calls[1]["temperature"] == 0.1


@pytest.mark.asyncio
async def test_failed_run_is_persisted_using_id_captured_before_rollback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run_id = uuid4()

    class ExpiringRun:
        status = "failed"
        error_message: str | None = None
        finished_at = None
        article_id = None
        _expired = False

        @property
        def id(self):  # type: ignore[no-untyped-def]
            if self._expired:
                raise AssertionError("run.id was accessed after rollback")
            return run_id

    run = ExpiringRun()

    class FakeSession:
        async def scalar(self, _statement):  # type: ignore[no-untyped-def]
            return run

        async def commit(self) -> None:
            return None

        async def rollback(self) -> None:
            run._expired = True

        async def get(self, _model, identity):  # type: ignore[no-untyped-def]
            assert identity == run_id
            run._expired = False
            return run

    async def fake_settings(_session: object) -> SimpleNamespace:
        return SimpleNamespace(enabled=True)

    async def fail_before_generation(_session: object) -> list[object]:
        raise ContentAgentError("synthetic generation failure")

    monkeypatch.setattr(content_service, "ensure_agent_settings", fake_settings)
    monkeypatch.setattr(content_service, "recent_articles", fail_before_generation)

    result = await run_content_agent(
        FakeSession(),  # type: ignore[arg-type]
        slot_key="2026-09-13:17:00:Asia/Tehran",
        app_settings=SimpleNamespace(),
    )

    assert result.status == "failed"
    assert result.error_message == "synthetic generation failure"
    assert result.finished_at is not None
