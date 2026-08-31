from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status

from hring_api.config import Settings, get_settings
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.db.session import get_db_session
from hring_api.domains.identity.dependencies import Principal, get_current_principal
from hring_api.domains.recruiting.schemas import (
    AddCandidatesRequest,
    AnalyzeCandidatesRequest,
    AnalyzeCandidatesResponse,
    CampaignDetailResponse,
    CampaignResponse,
    CandidateResponse,
    CreateCampaignRequest,
    UpdateCampaignRequest,
    UpdateCandidateStatusRequest,
)
from hring_api.domains.recruiting.ai_service import RecruitingAiError, analyze_candidates
from hring_api.domains.recruiting.service import (
    CampaignNotFoundError,
    add_owner_candidates,
    create_owner_campaign,
    delete_owner_campaign,
    get_owner_campaign_detail,
    get_owner_candidate,
    list_owner_campaigns,
    update_owner_campaign,
    update_owner_candidate_status,
)


router = APIRouter(prefix="/recruiting", tags=["recruiting"])


def _primary_company_id(principal: Principal) -> UUID | None:
    for membership in principal.memberships:
        if membership.is_active:
            return membership.company_id
    return None


def _campaign_response(campaign: object, *, candidates_count: int = 0, avg_match_score: int = 0) -> CampaignResponse:
    payload = CampaignResponse.model_validate(campaign)
    return payload.model_copy(update={
        "candidates_count": candidates_count,
        "avg_match_score": avg_match_score,
    })


@router.get("/campaigns", response_model=list[CampaignResponse])
async def list_campaigns(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> list[CampaignResponse]:
    rows = await list_owner_campaigns(db, owner_user_id=principal.user_id)
    return [
        _campaign_response(campaign, candidates_count=count, avg_match_score=avg_score)
        for campaign, count, avg_score in rows
    ]


@router.post("/campaigns", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    payload: CreateCampaignRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> CampaignResponse:
    campaign = await create_owner_campaign(
        db,
        owner_user_id=principal.user_id,
        company_id=_primary_company_id(principal),
        values=payload.model_dump(exclude_none=True),
    )
    await db.commit()
    await db.refresh(campaign)
    return _campaign_response(campaign)


@router.get("/campaigns/{campaign_id}", response_model=CampaignDetailResponse)
async def campaign_detail(
    campaign_id: UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> CampaignDetailResponse:
    try:
        campaign, candidates = await get_owner_campaign_detail(
            db,
            campaign_id=campaign_id,
            owner_user_id=principal.user_id,
        )
    except CampaignNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    avg_score = round(sum(item.match_score for item in candidates) / len(candidates)) if candidates else 0
    base = _campaign_response(campaign, candidates_count=len(candidates), avg_match_score=avg_score)
    return CampaignDetailResponse(**base.model_dump(), candidates=[CandidateResponse.model_validate(item) for item in candidates])


@router.patch("/campaigns/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: UUID,
    payload: UpdateCampaignRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> CampaignResponse:
    try:
        campaign = await update_owner_campaign(
            db,
            campaign_id=campaign_id,
            owner_user_id=principal.user_id,
            values=payload.model_dump(exclude_unset=True),
        )
    except CampaignNotFoundError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    await db.commit()
    await db.refresh(campaign)
    return _campaign_response(campaign)


@router.delete("/campaigns/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_campaign(
    campaign_id: UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    try:
        await delete_owner_campaign(
            db,
            campaign_id=campaign_id,
            owner_user_id=principal.user_id,
        )
    except CampaignNotFoundError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/campaigns/{campaign_id}/candidates", response_model=list[CandidateResponse], status_code=status.HTTP_201_CREATED)
async def add_candidates(
    campaign_id: UUID,
    payload: AddCandidatesRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> list[CandidateResponse]:
    try:
        candidates = await add_owner_candidates(
            db,
            campaign_id=campaign_id,
            owner_user_id=principal.user_id,
            rows=[item.model_dump(exclude_none=True) for item in payload.candidates],
        )
    except CampaignNotFoundError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    await db.commit()
    for candidate in candidates:
        await db.refresh(candidate)
    return [CandidateResponse.model_validate(item) for item in candidates]


@router.get("/campaigns/{campaign_id}/candidates/{candidate_id}", response_model=CandidateResponse)
async def candidate_detail(
    campaign_id: UUID,
    candidate_id: UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> CandidateResponse:
    try:
        candidate = await get_owner_candidate(
            db, campaign_id=campaign_id, candidate_id=candidate_id, owner_user_id=principal.user_id
        )
    except CampaignNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return CandidateResponse.model_validate(candidate)


@router.patch("/campaigns/{campaign_id}/candidates/{candidate_id}", response_model=CandidateResponse)
async def update_candidate_status(
    campaign_id: UUID,
    candidate_id: UUID,
    payload: UpdateCandidateStatusRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> CandidateResponse:
    try:
        candidate = await update_owner_candidate_status(
            db,
            campaign_id=campaign_id,
            candidate_id=candidate_id,
            owner_user_id=principal.user_id,
            status=payload.status,
        )
    except CampaignNotFoundError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    await db.commit()
    await db.refresh(candidate)
    return CandidateResponse.model_validate(candidate)
