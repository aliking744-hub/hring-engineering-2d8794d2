import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.db.session import SessionFactory
from hring_api.domains.ai.models import AiUsageEvent
from hring_api.domains.ai.repository import active_rate_cards, create_usage_event
from hring_api.domains.ai.schemas import SUPPORTED_USAGE_METRICS


logger = logging.getLogger(__name__)


def normalize_usage_metrics(metrics: dict[str, int] | None) -> dict[str, int]:
    normalized: dict[str, int] = {}
    for key, raw_value in (metrics or {}).items():
        if key not in SUPPORTED_USAGE_METRICS:
            continue
        value = int(raw_value)
        if value < 0:
            raise ValueError(f"AI usage metric cannot be negative: {key}")
        normalized[key] = value
    return normalized


async def calculate_estimated_cost_microusd(
    session: AsyncSession,
    *,
    provider: str,
    model: str,
    metrics: dict[str, int],
    at: datetime | None = None,
) -> int:
    cards = await active_rate_cards(
        session,
        provider=provider,
        model=model,
        at=at or datetime.now(UTC),
    )
    total = 0
    for card in cards:
        quantity = metrics.get(card.metric, 0)
        if quantity <= 0:
            continue
        numerator = quantity * card.cost_microusd
        total += (numerator + card.unit_size // 2) // card.unit_size
    return total


async def record_ai_usage(
    session: AsyncSession,
    *,
    request_id: UUID,
    company_id: UUID | None,
    user_id: UUID | None,
    feature_key: str,
    provider: str,
    model: str,
    operation: str,
    metrics: dict[str, int] | None,
    provider_cost_microusd: int | None,
    credits_charged: int,
    latency_ms: int | None,
    status: str,
    error_code: str | None = None,
    metadata_json: dict[str, object] | None = None,
) -> AiUsageEvent:
    normalized = normalize_usage_metrics(metrics)
    estimated_cost = await calculate_estimated_cost_microusd(
        session,
        provider=provider,
        model=model,
        metrics=normalized,
    )
    return await create_usage_event(
        session,
        request_id=request_id,
        company_id=company_id,
        user_id=user_id,
        feature_key=feature_key,
        provider=provider,
        model=model,
        operation=operation,
        metrics_json=normalized,
        provider_cost_microusd=provider_cost_microusd,
        estimated_cost_microusd=estimated_cost,
        credits_charged=max(0, credits_charged),
        latency_ms=latency_ms,
        status=status,
        error_code=error_code,
        metadata_json=metadata_json,
    )


async def persist_ai_usage_isolated(**kwargs: object) -> None:
    """Persist provider spend independently from the caller's business transaction.

    An upstream AI call can cost money even if a later candidate/campaign write
    rolls back. The usage ledger therefore commits in its own transaction.
    """

    try:
        async with SessionFactory() as session:
            await record_ai_usage(session, **kwargs)  # type: ignore[arg-type]
            await session.commit()
    except Exception:
        logger.exception("Failed to persist AI usage event")
