from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest

from hring_api.domains.billing.pricing import (
    ExchangeRateError,
    calculate_plan_price_toman,
    parse_tgju_usd_rate,
    pricing_snapshot,
)


def test_parse_tgju_rate_converts_rial_to_toman() -> None:
    html = '<div>نرخ فعلی: <span>2,267,000</span></div><div>واحد پولی : ریال</div>'
    assert parse_tgju_usd_rate(html) == 226_700


def test_parse_tgju_rate_supports_persian_digits() -> None:
    assert parse_tgju_usd_rate("نرخ فعلی: ۲,۲۶۷,۰۰۰ ریال") == 226_700


def test_parse_tgju_rate_rejects_missing_or_implausible_values() -> None:
    with pytest.raises(ExchangeRateError):
        parse_tgju_usd_rate("نرخ فعلی در دسترس نیست")


def test_plan_price_uses_effective_rate_and_rounds_up() -> None:
    assert calculate_plan_price_toman(1_999, 236_700) == 4_729_000


def test_manual_rate_overrides_market_and_is_not_stale() -> None:
    now = datetime.now(UTC)
    setting = SimpleNamespace(
        automatic_rate_toman=220_000,
        manual_rate_toman=210_000,
        markup_toman=10_000,
        source="tgju",
        source_url="https://www.tgju.org/profile/price_dollar_rl",
        source_fetched_at=now - timedelta(days=5),
        stale_after_hours=36,
        last_error=None,
    )
    snapshot = pricing_snapshot(setting, now=now)
    assert snapshot.mode == "manual"
    assert snapshot.effective_rate_toman == 220_000
    assert snapshot.stale is False


def test_automatic_rate_becomes_stale_and_stops_safe_checkout() -> None:
    now = datetime.now(UTC)
    setting = SimpleNamespace(
        automatic_rate_toman=220_000,
        manual_rate_toman=None,
        markup_toman=10_000,
        source="tgju",
        source_url="https://www.tgju.org/profile/price_dollar_rl",
        source_fetched_at=now - timedelta(hours=37),
        stale_after_hours=36,
        last_error=None,
    )
    snapshot = pricing_snapshot(setting, now=now)
    assert snapshot.mode == "automatic"
    assert snapshot.stale is True
