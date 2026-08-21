from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.db.session import get_db_session
from hring_api.domains.ai.gateway_client import AiGatewayError
from hring_api.domains.headhunting import repository
from hring_api.domains.headhunting.schemas import (
    AnalyzeCandidatesRequest,
    AnalyzeCandidatesResponse,
    AutoHeadhuntRequest,
    AutoHeadhuntResponse,
    AutoHeadhuntStats,
    CampaignCreate,
    CampaignDetail,
    CampaignOut,
    CampaignUpdate,
    CandidateBatchCreate,
    CandidateOut,
)
from hring_api.domains.headhunting.service import analyze_candidates, auto_headhunt_candidates
from hring_api.domains.headhunting.source_client import HeadhuntingSourceError
from hring_api.domains.identity.dependencies import Principal, get_current_principal


router = APIRouter(prefix="/headhunting", tags=["headhunting"])


def _campaign_out(campaign: object, *, count: int = 0, avg_score: int = 0) -> CampaignOut:
    result = CampaignOut.model_validate(campaign)
    return result.model_copy(update={"candidates_count": count, "avg_match_score": avg_score})


@router.get("/campaigns", response_model=list[CampaignOut])
async def list_campaigns(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> list[CampaignOut]:
    rows = await repository.list_campaigns(db, principal=principal)
    return [
        _campaign_out(campaign, count=count, avg_score=avg_score)
        for campaign, count, avg_score in rows
    ]


@router.post("/campaigns", response_model=CampaignOut, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    payload: CampaignCreate,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> CampaignOut:
    try:
        campaign = await repository.create_campaign(db, principal=principal, payload=payload)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden") from exc
    return _campaign_out(campaign)


@router.get("/campaigns/{campaign_id}", response_model=CampaignDetail)
async def get_campaign_detail(
    campaign_id: UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> CampaignDetail:
    campaign = await repository.get_campaign(db, principal=principal, campaign_id=campaign_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    candidates = await repository.list_candidates(db, campaign_id=campaign_id)
    avg = round(sum(item.match_score for item in candidates) / len(candidates)) if candidates else 0
    return CampaignDetail(
        campaign=_campaign_out(campaign, count=len(candidates), avg_score=avg),
        candidates=[CandidateOut.model_validate(item) for item in candidates],
    )


@router.patch("/campaigns/{campaign_id}", response_model=CampaignOut)
async def patch_campaign(
    campaign_id: UUID,
    payload: CampaignUpdate,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> CampaignOut:
    campaign = await repository.get_campaign(db, principal=principal, campaign_id=campaign_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    updated = await repository.update_campaign(db, campaign=campaign, payload=payload)
    candidates = await repository.list_candidates(db, campaign_id=campaign_id)
    avg = round(sum(item.match_score for item in candidates) / len(candidates)) if candidates else 0
    return _campaign_out(updated, count=len(candidates), avg_score=avg)


@router.delete("/campaigns/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(
    campaign_id: UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    campaign = await repository.get_campaign(db, principal=principal, campaign_id=campaign_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    await repository.remove_campaign(db, campaign=campaign)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/campaigns/{campaign_id}/candidates",
    response_model=list[CandidateOut],
    status_code=status.HTTP_201_CREATED,
)
async def add_campaign_candidates(
    campaign_id: UUID,
    payload: CandidateBatchCreate,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> list[CandidateOut]:
    campaign = await repository.get_campaign(db, principal=principal, campaign_id=campaign_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    rows = await repository.add_candidates(db, campaign_id=campaign_id, candidates=payload.candidates)
    return [CandidateOut.model_validate(item) for item in rows]


@router.post("/analyze-candidates", response_model=AnalyzeCandidatesResponse)
async def analyze_candidate_batch(
    payload: AnalyzeCandidatesRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> AnalyzeCandidatesResponse:
    campaign = None
    company_id = None
    if payload.campaign_id is not None:
        campaign = await repository.get_campaign(
            db,
            principal=principal,
            campaign_id=payload.campaign_id,
        )
        if campaign is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
        company_id = campaign.company_id
    else:
        active_company_ids = repository.active_company_ids(principal)
        if len(active_company_ids) == 1:
            company_id = next(iter(active_company_ids))

    try:
        result = await analyze_candidates(
            principal=principal,
            payload=payload,
            company_id=company_id,
        )
    except (ValueError, AiGatewayError) as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    if campaign is not None:
        await repository.replace_candidates(
            db,
            campaign_id=campaign.id,
            candidates=result.candidates,
        )
        await repository.update_campaign(
            db,
            campaign=campaign,
            payload=CampaignUpdate(status="active", progress=100),
        )

    return result


@router.post("/auto-headhunt", response_model=AutoHeadhuntResponse)
async def auto_headhunt(
    payload: AutoHeadhuntRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> AutoHeadhuntResponse:
    campaign = await repository.get_campaign(
        db,
        principal=principal,
        campaign_id=payload.campaign_id,
    )
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    await repository.update_campaign(
        db,
        campaign=campaign,
        payload=CampaignUpdate(status="processing", progress=20),
    )
    try:
        result = await auto_headhunt_candidates(
            principal=principal,
            requirements=payload.job_requirements,
            company_id=campaign.company_id,
        )
    except HeadhuntingSourceError as exc:
        await repository.update_campaign(
            db,
            campaign=campaign,
            payload=CampaignUpdate(status="paused", progress=0),
        )
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except (ValueError, AiGatewayError) as exc:
        await repository.update_campaign(
            db,
            campaign=campaign,
            payload=CampaignUpdate(status="paused", progress=0),
        )
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    if not result.candidates:
        await repository.replace_candidates(db, campaign_id=campaign.id, candidates=[])
        await repository.update_campaign(
            db,
            campaign=campaign,
            payload=CampaignUpdate(status="paused", progress=0),
        )
    else:
        await repository.replace_candidates(
            db,
            campaign_id=campaign.id,
            candidates=result.candidates,
        )
        await repository.update_campaign(
            db,
            campaign=campaign,
            payload=CampaignUpdate(status="active", progress=100),
        )

    return AutoHeadhuntResponse(
        success=True,
        campaign_id=campaign.id,
        stats=AutoHeadhuntStats(
            total=result.stats.total,
            hot=result.stats.hot_candidates,
            warm=result.stats.warm_candidates,
            cold=result.stats.cold_candidates,
            avg_score=result.stats.avg_score,
        ),
    )
