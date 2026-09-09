from datetime import UTC, datetime
from types import SimpleNamespace

import pytest

from hring_api.domains.ai.gateway_client import AiCitation
from hring_api.domains.content.service import (
    ContentAgentError,
    _credibility_score,
    _official_citations,
    _quality_score,
    due_slot_keys,
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

