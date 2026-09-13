from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.ai.models import AiRateCard, AiUsageEvent


async def active_rate_cards(
    session: AsyncSession,
    *,
    provider: str,
    model: str,
    at: datetime | None = None,
) -> list[AiRateCard]:
    moment = at or datetime.now(UTC)
    result = await session.execute(
        select(AiRateCard).where(
            AiRateCard.provider == provider,
            AiRateCard.model == model,
            AiRateCard.effective_from <= moment,
            AiRateCard.is_active.is_(True),
        )
    )
    return list(result.scalars().all())


async def list_rate_cards(
    session: AsyncSession,
    *,
    provider: str | None = None,
    model: str | None = None,
) -> list[AiRateCard]:
    statement = select(AiRateCard).order_by(
        AiRateCard.provider,
        AiRateCard.model,
        AiRateCard.metric,
        AiRateCard.effective_from.desc(),
    )
    if provider:
        statement = statement.where(AiRateCard.provider == provider)
    if model:
        statement = statement.where(AiRateCard.model == model)
    result = await session.execute(statement)
    return list(result.scalars().all())


async def create_rate_card_version(
    session: AsyncSession,
    *,
    provider: str,
    model: str,
    metric: str,
    unit_size: int,
    cost_microusd: int,
    effective_from: datetime,
    created_by: UUID | None,
) -> AiRateCard:
    current_result = await session.execute(
        select(AiRateCard).where(
            AiRateCard.provider == provider,
            AiRateCard.model == model,
            AiRateCard.metric == metric,
            AiRateCard.is_active.is_(True),
        )
    )
    for current in current_result.scalars().all():
        current.is_active = False
        current.effective_to = effective_from

    row = AiRateCard(
        provider=provider,
        model=model,
        metric=metric,
        unit_size=unit_size,
        cost_microusd=cost_microusd,
        effective_from=effective_from,
        effective_to=None,
        is_active=True,
        created_by=created_by,
    )
    session.add(row)
    await session.flush()
    return row


async def create_usage_event(
    session: AsyncSession,
    *,
    request_id: UUID,
    company_id: UUID | None,
    user_id: UUID | None,
    feature_key: str,
    provider: str,
    model: str,
    operation: str,
    metrics_json: dict[str, int],
    provider_cost_microusd: int | None,
    estimated_cost_microusd: int,
    credits_charged: int,
    latency_ms: int | None,
    status: str,
    error_code: str | None,
    metadata_json: dict[str, object] | None = None,
) -> AiUsageEvent:
    row = AiUsageEvent(
        request_id=request_id,
        company_id=company_id,
        user_id=user_id,
        feature_key=feature_key,
        provider=provider,
        model=model,
        operation=operation,
        metrics_json=metrics_json,
        provider_cost_microusd=provider_cost_microusd,
        estimated_cost_microusd=estimated_cost_microusd,
        credits_charged=credits_charged,
        latency_ms=latency_ms,
        status=status,
        error_code=error_code,
        metadata_json=metadata_json or {},
    )
    session.add(row)
    await session.flush()
    return row


async def list_usage_events(
    session: AsyncSession,
    *,
    since: datetime,
    company_id: UUID | None = None,
    feature_key: str | None = None,
    limit: int = 200,
) -> list[AiUsageEvent]:
    statement = (
        select(AiUsageEvent)
        .where(AiUsageEvent.created_at >= since)
        .order_by(AiUsageEvent.created_at.desc())
        .limit(limit)
    )
    if company_id is not None:
        statement = statement.where(AiUsageEvent.company_id == company_id)
    if feature_key:
        statement = statement.where(AiUsageEvent.feature_key == feature_key)
    result = await session.execute(statement)
    return list(result.scalars().all())


async def usage_summary_rows(
    session: AsyncSession,
    *,
    since: datetime,
    company_id: UUID | None = None,
    feature_key: str | None = None,
) -> list[dict[str, object]]:
    conditions = ["created_at >= :since"]
    params: dict[str, object] = {"since": since}
    if company_id is not None:
        conditions.append("company_id = :company_id")
        params["company_id"] = company_id
    if feature_key:
        conditions.append("feature_key = :feature_key")
        params["feature_key"] = feature_key

    statement = text(
        f"""
        SELECT
          feature_key,
          provider,
          model,
          COUNT(*)::bigint AS requests,
          COUNT(*) FILTER (WHERE status = 'failure')::bigint AS failures,
          COALESCE(SUM((metrics_json->>'input_tokens')::bigint), 0)::bigint AS input_tokens,
          COALESCE(SUM((metrics_json->>'output_tokens')::bigint), 0)::bigint AS output_tokens,
          COALESCE(
            SUM(
              COALESCE(
                (metrics_json->>'total_tokens')::bigint,
                COALESCE((metrics_json->>'input_tokens')::bigint, 0)
                  + COALESCE((metrics_json->>'output_tokens')::bigint, 0)
              )
            ),
            0
          )::bigint AS total_tokens,
          COALESCE(SUM((metrics_json->>'cached_input_tokens')::bigint), 0)::bigint AS cached_input_tokens,
          COALESCE(SUM((metrics_json->>'reasoning_tokens')::bigint), 0)::bigint AS reasoning_tokens,
          COALESCE(SUM(credits_charged), 0)::bigint AS credits_charged,
          COALESCE(SUM(estimated_cost_microusd), 0)::bigint AS estimated_cost_microusd,
          COALESCE(SUM(provider_cost_microusd), 0)::bigint AS provider_cost_microusd
        FROM ai_usage_events
        WHERE {' AND '.join(conditions)}
        GROUP BY feature_key, provider, model
        ORDER BY estimated_cost_microusd DESC, requests DESC
        """
    )
    result = await session.execute(statement, params)
    return [dict(row) for row in result.mappings().all()]


async def company_usage_summary_rows(
    session: AsyncSession,
    *,
    since: datetime,
    feature_key: str | None = None,
) -> list[dict[str, object]]:
    conditions = ["created_at >= :since"]
    params: dict[str, object] = {"since": since}
    if feature_key:
        conditions.append("feature_key = :feature_key")
        params["feature_key"] = feature_key

    statement = text(
        f"""
        SELECT
          company_id,
          COUNT(*)::bigint AS requests,
          COUNT(*) FILTER (WHERE status = 'failure')::bigint AS failures,
          COALESCE(SUM((metrics_json->>'input_tokens')::bigint), 0)::bigint AS input_tokens,
          COALESCE(SUM((metrics_json->>'output_tokens')::bigint), 0)::bigint AS output_tokens,
          COALESCE(
            SUM(
              COALESCE(
                (metrics_json->>'total_tokens')::bigint,
                COALESCE((metrics_json->>'input_tokens')::bigint, 0)
                  + COALESCE((metrics_json->>'output_tokens')::bigint, 0)
              )
            ),
            0
          )::bigint AS total_tokens,
          COALESCE(SUM((metrics_json->>'cached_input_tokens')::bigint), 0)::bigint AS cached_input_tokens,
          COALESCE(SUM((metrics_json->>'reasoning_tokens')::bigint), 0)::bigint AS reasoning_tokens,
          COALESCE(SUM(credits_charged), 0)::bigint AS credits_charged,
          COALESCE(SUM(estimated_cost_microusd), 0)::bigint AS estimated_cost_microusd,
          COALESCE(SUM(provider_cost_microusd), 0)::bigint AS provider_cost_microusd
        FROM ai_usage_events
        WHERE {' AND '.join(conditions)}
        GROUP BY company_id
        ORDER BY estimated_cost_microusd DESC, requests DESC
        """
    )
    result = await session.execute(statement, params)
    return [dict(row) for row in result.mappings().all()]