from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings, get_settings
from hring_api.db.session import get_db_session
from hring_api.domains.identity.dependencies import Principal, get_current_principal
from hring_api.domains.recruiting.ai_service import (
    RecruitingAiError,
    RecruitingSourcingUnavailableError,
    analyze_candidates,
    fetch_sourced_candidates,
)
from hring_api.domains.recruiting.schemas import (
    AnalyzeCandidatesRequest,
    AnalyzeCandidatesResponse,
    AutoSourceRequest,
    AutoSourceResponse,
    AutoSourceStats,
)
from hring_api.domains.recruiting.service import (
    CampaignNotFoundError,
    add_owner_candidates,
    get_owner_campaign_detail,
    update_owner_campaign,
)


router = APIRouter(prefix="/recruiting", tags=["recruiting-ai"])


def _company_id(principal: Principal) -> UUID | None:
    for membership in principal.memberships:
        if membership.is_active:
            return membership.company_id
    return None


def _ai_error(exc: RecruitingAiError) -> HTTPException:
    if isinstance(exc, RecruitingSourcingUnavailableError):
        return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


@router.post("/analyze-candidates", response_model=AnalyzeCandidatesResponse)
async def analyze_candidate_batch(
    payload: AnalyzeCandidatesRequest,
    principal: Principal = Depends(get_current_principal),
    settings: Settings = Depends(get_settings),
) -> AnalyzeCandidatesResponse:
    try:
        return await analyze_candidates(
            candidates=payload.candidates,
            job=payload.job_requirements,
            enable_web_search=payload.enable_web_search,
            user_id=principal.user_id,
            company_id=_company_id(principal),
            settings=settings,
        )
    except RecruitingAiError as exc:
        raise _ai_error(exc) from exc


@router.post("/campaigns/{campaign_id}/auto-source", response_model=AutoSourceResponse)
async def auto_source_campaign(
    campaign_id: UUID,
    payload: AutoSourceRequest,
    principal: Principal = Depends(get_current_principal),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_db_session),
) -> AutoSourceResponse:
    try:
        campaign, _ = await get_owner_campaign_detail(
            db,
            campaign_id=campaign_id,
            owner_user_id=principal.user_id,
        )
    except CampaignNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    try:
        sourced = await fetch_sourced_candidates(job=payload.job_requirements, settings=settings)
        if not sourced:
            await update_owner_campaign(
                db,
                campaign_id=campaign.id,
                owner_user_id=principal.user_id,
                values={"status": "paused", "progress": 0},
            )
            await db.commit()
            return AutoSourceResponse(
                stats=AutoSourceStats.model_validate(
                    {"total": 0, "hot": 0, "warm": 0, "cold": 0, "avgScore": 0}
                ),
                campaignId=campaign.id,
            )

        await update_owner_campaign(
            db,
            campaign_id=campaign.id,
            owner_user_id=principal.user_id,
            values={"status": "processing", "progress": 33},
        )
        await db.commit()

        analysis = await analyze_candidates(
            candidates=sourced,
            job=payload.job_requirements,
            enable_web_search=True,
            user_id=principal.user_id,
            company_id=campaign.company_id,
            settings=settings,
        )

        await update_owner_campaign(
            db,
            campaign_id=campaign.id,
            owner_user_id=principal.user_id,
            values={"progress": 66},
        )

        rows: list[dict[str, object]] = []
        for item in analysis.candidates:
            rows.append(
                {
                    "name": item.name,
                    "email": item.email or None,
                    "phone": item.phone or None,
                    "title": item.title,
                    "education": item.education,
                    "experience": item.experience,
                    "last_company": item.last_company,
                    "location": item.location,
                    "skills": ", ".join(item.skills) if item.skills else None,
                    "match_score": item.match_score,
                    "candidate_temperature": item.candidate_temperature,
                    "recommendation": item.recommendation,
                    "green_flags": item.green_flags,
                    "red_flags": item.red_flags,
                    "layer_scores": item.layer_scores,
                    "raw_data": {
                        "linkedin": item.linkedin,
                        "summary": item.summary,
                        "source": "auto",
                    },
                    "status": "pending",
                }
            )

        await add_owner_candidates(
            db,
            campaign_id=campaign.id,
            owner_user_id=principal.user_id,
            rows=rows,
        )
        await update_owner_campaign(
            db,
            campaign_id=campaign.id,
            owner_user_id=principal.user_id,
            values={"status": "active", "progress": 100},
        )
        await db.commit()

        scores = [item.match_score for item in analysis.candidates]
        stats = AutoSourceStats.model_validate(
            {
                "total": len(analysis.candidates),
                "hot": sum(item.candidate_temperature == "hot" for item in analysis.candidates),
                "warm": sum(item.candidate_temperature == "warm" for item in analysis.candidates),
                "cold": sum(item.candidate_temperature == "cold" for item in analysis.candidates),
                "avgScore": round(sum(scores) / len(scores)) if scores else 0,
            }
        )
        return AutoSourceResponse(stats=stats, campaignId=campaign.id)
    except RecruitingAiError as exc:
        await db.rollback()
        try:
            await update_owner_campaign(
                db,
                campaign_id=campaign.id,
                owner_user_id=principal.user_id,
                values={"status": "paused", "progress": 0},
            )
            await db.commit()
        except Exception:
            await db.rollback()
        raise _ai_error(exc) from exc