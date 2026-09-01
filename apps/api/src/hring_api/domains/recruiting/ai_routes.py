from datetime import datetime, timezone
import hashlib
import hmac
import secrets
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings, get_settings
from hring_api.db.session import get_db_session
from hring_api.domains.identity.dependencies import Principal, get_current_principal
from hring_api.domains.recruiting.ai_service import RecruitingAiError, RecruitingSourcingUnavailableError, analyze_candidates
from hring_api.domains.recruiting.repository import create_source_run, get_source_run
from hring_api.domains.recruiting.schemas import (
    AnalyzeCandidatesRequest, AnalyzeCandidatesResponse, AutoSourceRequest,
    JobRequirements, SourceRunAcceptedResponse, SourceRunCallbackRequest,
)
from hring_api.domains.recruiting.service import (
    CampaignNotFoundError, add_owner_candidates, get_owner_campaign_detail, update_owner_campaign,
)

router = APIRouter(prefix="/recruiting", tags=["recruiting-ai"])


def _company_id(principal: Principal) -> UUID | None:
    return next((membership.company_id for membership in principal.memberships if membership.is_active), None)


def _ai_error(exc: RecruitingAiError) -> HTTPException:
    code = status.HTTP_503_SERVICE_UNAVAILABLE if isinstance(exc, RecruitingSourcingUnavailableError) else status.HTTP_502_BAD_GATEWAY
    return HTTPException(status_code=code, detail=str(exc))


def _candidate_rows(analysis: AnalyzeCandidatesResponse) -> list[dict[str, object]]:
    return [{
        "name": item.name, "email": item.email or None, "phone": item.phone or None,
        "title": item.title, "education": item.education, "experience": item.experience,
        "last_company": item.last_company, "location": item.location,
        "skills": ", ".join(item.skills) if item.skills else None,
        "match_score": item.match_score, "candidate_temperature": item.candidate_temperature,
        "recommendation": item.recommendation, "green_flags": item.green_flags,
        "red_flags": item.red_flags, "layer_scores": item.layer_scores,
        "raw_data": {"linkedin": item.linkedin, "summary": item.summary, "source": "connector"},
        "status": "pending",
    } for item in analysis.candidates]


@router.post("/analyze-candidates", response_model=AnalyzeCandidatesResponse)
async def analyze_candidate_batch(
    payload: AnalyzeCandidatesRequest,
    principal: Principal = Depends(get_current_principal),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_db_session),
) -> AnalyzeCandidatesResponse:
    try:
        return await analyze_candidates(
            candidates=payload.candidates, job=payload.job_requirements,
            enable_web_search=payload.enable_web_search, user_id=principal.user_id,
            company_id=_company_id(principal), settings=settings, session=db,
        )
    except RecruitingAiError as exc:
        raise _ai_error(exc) from exc


@router.post("/campaigns/{campaign_id}/auto-source", response_model=SourceRunAcceptedResponse, status_code=status.HTTP_202_ACCEPTED)
async def auto_source_campaign(
    campaign_id: UUID,
    payload: AutoSourceRequest,
    principal: Principal = Depends(get_current_principal),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_db_session),
) -> SourceRunAcceptedResponse:
    webhook = settings.recruiting_sourcing_webhook_url
    if webhook is None or not webhook.get_secret_value().strip():
        raise _ai_error(RecruitingSourcingUnavailableError("سرویس sourcing برای این محیط تنظیم نشده است"))
    try:
        campaign, _ = await get_owner_campaign_detail(db, campaign_id=campaign_id, owner_user_id=principal.user_id)
    except CampaignNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    callback_token = secrets.token_urlsafe(32)
    request_key = secrets.token_hex(24)
    callback_hash = hashlib.sha256(callback_token.encode()).hexdigest()
    run = await create_source_run(
        db, campaign_id=campaign.id, owner_user_id=principal.user_id, idempotency_key=request_key,
        callback_key_hash=callback_hash, request_payload={"jobRequirements": payload.job_requirements.model_dump(by_alias=True), "maxCandidates": settings.recruiting_auto_source_max_candidates},
    )
    callback_url = f"{str(settings.public_app_url).rstrip('/')}/api/v1/recruiting/source-runs/{run.id}/callback"
    outbound = {
        "sourceRunId": str(run.id), "campaignId": str(campaign.id), "callbackUrl": callback_url,
        "callbackToken": callback_token, "jobRequirements": payload.job_requirements.model_dump(by_alias=True),
        "maxCandidates": settings.recruiting_auto_source_max_candidates,
    }
    await update_owner_campaign(db, campaign_id=campaign.id, owner_user_id=principal.user_id, values={"status": "processing", "progress": 10})
    await db.commit()
    headers = {"Content-Type": "application/json"}
    connector_token = settings.recruiting_sourcing_webhook_bearer_token
    if connector_token is not None and connector_token.get_secret_value().strip():
        headers["Authorization"] = f"Bearer {connector_token.get_secret_value().strip()}"
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=10.0)) as client:
            response = await client.post(webhook.get_secret_value().strip(), json=outbound, headers=headers)
        if response.status_code != status.HTTP_202_ACCEPTED:
            raise RecruitingSourcingUnavailableError("سرویس sourcing درخواست را نپذیرفت")
        run.status, run.accepted_at = "accepted", datetime.now(timezone.utc)
        await db.commit()
    except (httpx.HTTPError, RecruitingAiError) as exc:
        run.status, run.error_message = "failed", "connector request was not accepted"
        await update_owner_campaign(db, campaign_id=campaign.id, owner_user_id=principal.user_id, values={"status": "paused", "progress": 0})
        await db.commit()
        raise _ai_error(RecruitingSourcingUnavailableError("ارسال درخواست sourcing ناموفق بود")) from exc
    return SourceRunAcceptedResponse(campaignId=campaign.id, sourceRunId=run.id)


@router.post("/source-runs/{source_run_id}/callback")
async def receive_sourcing_callback(
    source_run_id: UUID,
    payload: SourceRunCallbackRequest,
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    token = authorization.removeprefix("Bearer ").strip() if authorization else ""
    run = await get_source_run(db, source_run_id=source_run_id, for_update=True)
    if run is None or not token or not hmac.compare_digest(hashlib.sha256(token.encode()).hexdigest(), run.callback_key_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="callback authorization is invalid")
    if run.status == "received":
        return {"accepted": True, "duplicate": True}
    try:
        job = JobRequirements.model_validate(run.request_payload["jobRequirements"])
        campaign, _ = await get_owner_campaign_detail(db, campaign_id=run.campaign_id, owner_user_id=run.owner_user_id)
        analysis = await analyze_candidates(
            candidates=payload.candidates, job=job, enable_web_search=True, user_id=run.owner_user_id,
            company_id=campaign.company_id, settings=settings, session=db,
        )
        await add_owner_candidates(db, campaign_id=campaign.id, owner_user_id=run.owner_user_id, rows=_candidate_rows(analysis))
        run.status, run.received_at, run.received_payload = "received", datetime.now(timezone.utc), payload.model_dump(by_alias=True, exclude_none=True)
        await update_owner_campaign(db, campaign_id=campaign.id, owner_user_id=run.owner_user_id, values={"status": "active", "progress": 100})
        await db.commit()
        return {"accepted": True, "duplicate": False, "candidates": len(analysis.candidates)}
    except (RecruitingAiError, KeyError, ValueError) as exc:
        await db.rollback()
        run = await get_source_run(db, source_run_id=source_run_id, for_update=True)
        if run is not None:
            run.status, run.error_message = "failed", "callback processing failed"
            await update_owner_campaign(db, campaign_id=run.campaign_id, owner_user_id=run.owner_user_id, values={"status": "paused", "progress": 0})
            await db.commit()
        raise _ai_error(RecruitingAiError("پردازش callback sourcing ناموفق بود")) from exc
