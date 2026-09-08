from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal, ROUND_CEILING
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.billing.models import (
    BillingExchangeRateHistory,
    BillingExchangeRateSetting,
    BillingPlan,
)


TGJU_USD_URL = "https://www.tgju.org/profile/price_dollar_rl"
MIN_USD_TOMAN = 10_000
MAX_USD_TOMAN = 10_000_000
MAX_DAILY_JUMP_RATIO = Decimal("0.30")
PRICE_ROUNDING_TOMAN = 1_000


class ExchangeRateError(RuntimeError):
    pass


@dataclass(frozen=True)
class PricingSnapshot:
    market_rate_toman: int | None
    manual_rate_toman: int | None
    markup_toman: int
    effective_rate_toman: int | None
    mode: str
    source: str
    source_url: str
    source_fetched_at: datetime | None
    stale: bool
    last_error: str | None


def _latin_digits(value: str) -> str:
    return value.translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789"))


def parse_tgju_usd_rate(html: str) -> int:
    """Extract TGJU's free-market USD rate and convert rial to toman."""

    normalized = _latin_digits(html).replace("٬", ",")
    patterns = (
        r"نرخ\s*فعلی\s*:?[^0-9]{0,160}([0-9][0-9,]{5,})",
        r"price_dollar_rl[^0-9]{0,500}([0-9][0-9,]{5,})",
    )
    for pattern in patterns:
        match = re.search(pattern, normalized, flags=re.IGNORECASE | re.DOTALL)
        if match is None:
            continue
        rate_rial = int(match.group(1).replace(",", ""))
        rate_toman = rate_rial // 10
        if MIN_USD_TOMAN <= rate_toman <= MAX_USD_TOMAN:
            return rate_toman
    raise ExchangeRateError("نرخ معتبر دلار از منبع بازار استخراج نشد")


async def fetch_tgju_usd_rate() -> tuple[int, datetime]:
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(20.0, connect=8.0),
            follow_redirects=True,
            headers={"User-Agent": "HRing-Pricing/1.0"},
        ) as client:
            response = await client.get(TGJU_USD_URL)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise ExchangeRateError("دریافت نرخ دلار از منبع بازار ناموفق بود") from exc
    return parse_tgju_usd_rate(response.text), datetime.now(UTC)


async def get_exchange_rate_setting(
    db: AsyncSession, *, lock: bool = False
) -> BillingExchangeRateSetting:
    statement = select(BillingExchangeRateSetting).where(BillingExchangeRateSetting.id == 1)
    if lock:
        statement = statement.with_for_update()
    setting = (await db.execute(statement)).scalar_one_or_none()
    if setting is None:
        setting = BillingExchangeRateSetting(
            id=1,
            source="tgju",
            source_url=TGJU_USD_URL,
            markup_toman=10_000,
            auto_refresh_enabled=True,
            stale_after_hours=36,
        )
        db.add(setting)
        await db.flush()
    return setting


def pricing_snapshot(setting: BillingExchangeRateSetting, *, now: datetime | None = None) -> PricingSnapshot:
    current = now or datetime.now(UTC)
    mode = "manual" if setting.manual_rate_toman is not None else "automatic"
    base_rate = setting.manual_rate_toman or setting.automatic_rate_toman
    stale = (
        mode == "automatic"
        and (
            setting.source_fetched_at is None
            or setting.source_fetched_at < current - timedelta(hours=setting.stale_after_hours)
        )
    )
    return PricingSnapshot(
        market_rate_toman=setting.automatic_rate_toman,
        manual_rate_toman=setting.manual_rate_toman,
        markup_toman=setting.markup_toman,
        effective_rate_toman=(base_rate + setting.markup_toman) if base_rate is not None else None,
        mode=mode,
        source=setting.source,
        source_url=setting.source_url,
        source_fetched_at=setting.source_fetched_at,
        stale=stale,
        last_error=setting.last_error,
    )


def calculate_plan_price_toman(price_usd_cents: int, effective_rate_toman: int) -> int:
    raw = Decimal(price_usd_cents) * Decimal(effective_rate_toman) / Decimal(100)
    units = (raw / Decimal(PRICE_ROUNDING_TOMAN)).quantize(Decimal("1"), rounding=ROUND_CEILING)
    return int(units * PRICE_ROUNDING_TOMAN)


async def recalculate_usd_plans(db: AsyncSession, setting: BillingExchangeRateSetting) -> None:
    snapshot = pricing_snapshot(setting)
    if snapshot.effective_rate_toman is None:
        return
    plans = (
        await db.execute(select(BillingPlan).where(BillingPlan.price_usd_cents.is_not(None)))
    ).scalars()
    for plan in plans:
        assert plan.price_usd_cents is not None
        plan.price_toman = calculate_plan_price_toman(
            plan.price_usd_cents,
            snapshot.effective_rate_toman,
        )


async def refresh_exchange_rate(
    db: AsyncSession,
    *,
    actor_user_id: UUID | None = None,
    force: bool = False,
) -> BillingExchangeRateSetting:
    setting = await get_exchange_rate_setting(db, lock=True)
    if not setting.auto_refresh_enabled and not force:
        return setting
    try:
        rate_toman, fetched_at = await fetch_tgju_usd_rate()
        if setting.automatic_rate_toman is not None:
            change = abs(Decimal(rate_toman - setting.automatic_rate_toman)) / Decimal(
                setting.automatic_rate_toman
            )
            if change > MAX_DAILY_JUMP_RATIO:
                raise ExchangeRateError("جهش نرخ بیش از حد مجاز است و نیاز به بررسی ادمین دارد")
        setting.automatic_rate_toman = rate_toman
        setting.source_fetched_at = fetched_at
        setting.source = "tgju"
        setting.source_url = TGJU_USD_URL
        setting.last_error = None
        setting.updated_by = actor_user_id
        db.add(
            BillingExchangeRateHistory(
                source="tgju",
                rate_toman=rate_toman,
                source_fetched_at=fetched_at,
                created_by=actor_user_id,
            )
        )
        await recalculate_usd_plans(db, setting)
        await db.commit()
        await db.refresh(setting)
        return setting
    except ExchangeRateError as exc:
        setting.last_error = str(exc)
        await db.commit()
        raise


async def assert_pricing_is_safe(db: AsyncSession, plan: BillingPlan) -> None:
    if plan.price_usd_cents is None:
        return
    setting = await get_exchange_rate_setting(db)
    snapshot = pricing_snapshot(setting)
    if snapshot.effective_rate_toman is None or snapshot.stale:
        raise ExchangeRateError("نرخ دلار به‌روز نیست؛ خرید تا بروزرسانی نرخ متوقف شده است")

