from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.db.session import get_db_session
from hring_api.domains.access.policy import PlatformPrincipal, require_platform_permission
from hring_api.domains.ai.repository import (
    company_usage_summary_rows,
    create_rate_card_version,
    list_rate_cards,
    list_usage_events,
    usage_summary_rows,
)
from hring_api.domains.ai.schemas import (
    AiCompanyUsageSummaryResponse,
    AiCompanyUsageSummaryRow,
    AiRateCardResponse,
    AiUsageEventResponse,
    AiUsageSummaryResponse,
    AiUsageSummaryRow,
    CreateAiRateCardRequest,
)


router = APIRouter(prefix="/admin/platform/ai", tags=["platform-ai-economics"])


@router.get("/usage-summary", response_model=AiUsageSummaryResponse)
async def ai_usage_summary(
    days: int = Query(default=30, ge=1, le=365),
    company_id: UUID | None = None,
    feature_key: str | None = Query(default=None, max_length=120),
    _: PlatformPrincipal = Depends(require_platform_permission("platform.ai_usage.read")),
    db: AsyncSession = Depends(get_db_session),
) -> AiUsageSummaryResponse:
    since = datetime.now(UTC) - timedelta(days=days)
    raw_rows = await usage_summary_rows(
        db,
        since=since,
        company_id=company_id,
        feature_key=feature_key,
    )
    rows = [AiUsageSummaryRow.model_validate(row) for row in raw_rows]
    return AiUsageSummaryResponse(
        since=since,
        rows=rows,
        total_requests=sum(row.requests for row in rows),
        total_failures=sum(row.failures for row in rows),
        total_estimated_cost_microusd=sum(row.estimated_cost_microusd for row in rows),
        total_provider_cost_microusd=sum(row.provider_cost_microusd for row in rows),
        total_credits_charged=sum(row.credits_charged for row in rows),
    )


@router.get("/company-summary", response_model=AiCompanyUsageSummaryResponse)
async def ai_company_usage_summary(
    days: int = Query(default=30, ge=1, le=365),
    feature_key: str | None = Query(default=None, max_length=120),
    _: PlatformPrincipal = Depends(require_platform_permission("platform.ai_usage.read")),
    db: AsyncSession = Depends(get_db_session),
) -> AiCompanyUsageSummaryResponse:
    since = datetime.now(UTC) - timedelta(days=days)
    raw_rows = await company_usage_summary_rows(
        db,
        since=since,
        feature_key=feature_key,
    )
    rows = [AiCompanyUsageSummaryRow.model_validate(row) for row in raw_rows]
    return AiCompanyUsageSummaryResponse(
        since=since,
        rows=rows,
        total_requests=sum(row.requests for row in rows),
        total_failures=sum(row.failures for row in rows),
        total_estimated_cost_microusd=sum(row.estimated_cost_microusd for row in rows),
        total_provider_cost_microusd=sum(row.provider_cost_microusd for row in rows),
        total_credits_charged=sum(row.credits_charged for row in rows),
    )


@router.get("/usage-events", response_model=list[AiUsageEventResponse])
async def ai_usage_events(
    days: int = Query(default=30, ge=1, le=365),
    company_id: UUID | None = None,
    feature_key: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=200, ge=1, le=1000),
    _: PlatformPrincipal = Depends(require_platform_permission("platform.ai_usage.read")),
    db: AsyncSession = Depends(get_db_session),
) -> list[AiUsageEventResponse]:
    since = datetime.now(UTC) - timedelta(days=days)
    rows = await list_usage_events(
        db,
        since=since,
        company_id=company_id,
        feature_key=feature_key,
        limit=limit,
    )
    return [AiUsageEventResponse.model_validate(row) for row in rows]


@router.get("/rates", response_model=list[AiRateCardResponse])
async def ai_rate_cards(
    provider: str | None = Query(default=None, max_length=64),
    model: str | None = Query(default=None, max_length=160),
    _: PlatformPrincipal = Depends(require_platform_permission("platform.ai_usage.read")),
    db: AsyncSession = Depends(get_db_session),
) -> list[AiRateCardResponse]:
    rows = await list_rate_cards(db, provider=provider, model=model)
    return [AiRateCardResponse.model_validate(row) for row in rows]


@router.post("/rates", response_model=AiRateCardResponse, status_code=status.HTTP_201_CREATED)
async def create_ai_rate_card(
    payload: CreateAiRateCardRequest,
    actor: PlatformPrincipal = Depends(require_platform_permission("platform.ai_rates.manage")),
    db: AsyncSession = Depends(get_db_session),
) -> AiRateCardResponse:
    effective_from = payload.effective_from or datetime.now(UTC)
    row = await create_rate_card_version(
        db,
        provider=payload.provider,
        model=payload.model,
        metric=payload.metric,
        unit_size=payload.unit_size,
        cost_microusd=payload.cost_microusd,
        effective_from=effective_from,
        created_by=actor.user_id,
    )
    await db.commit()
    await db.refresh(row)
    return AiRateCardResponse.model_validate(row)