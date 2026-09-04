from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings, get_settings
from hring_api.db.session import get_db_session
from hring_api.domains.billing.credit_service import (
    CreditConflictError,
    CreditError,
    CreditForbiddenError,
    CreditNotFoundError,
    InsufficientCreditsError,
)
from hring_api.domains.identity.dependencies import Principal, get_current_principal
from hring_api.domains.job_engineering.schemas import (
    JobProfileGenerateRequest,
    JobProfileResponse,
)
from hring_api.domains.workspace_outputs.service import save_workspace_output
from hring_api.domains.job_engineering.service import (
    JobEngineeringError,
    generate_job_profile,
)


router = APIRouter(prefix="/job-engineering", tags=["job-engineering"])


def _http_error(exc: Exception) -> HTTPException:
    if isinstance(exc, InsufficientCreditsError):
        return HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=str(exc))
    if isinstance(exc, CreditForbiddenError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    if isinstance(exc, CreditNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, CreditConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, CreditError):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


@router.post("/job-profiles/generate", response_model=JobProfileResponse)
async def create_job_profile(
    payload: JobProfileGenerateRequest,
    request: Request,
    idempotency_key: str = Header(
        ...,
        alias="X-Idempotency-Key",
        min_length=8,
        max_length=128,
    ),
    principal: Principal = Depends(get_current_principal),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_db_session),
) -> JobProfileResponse:
    try:
        result = await generate_job_profile(
            db,
            payload=payload,
            principal=principal,
            idempotency_key=idempotency_key,
            request_id=str(getattr(request.state, "request_id", ""))[:160] or None,
            settings=settings,
        )
        await save_workspace_output(
            db,
            principal=principal,
            feature_key="job_engineering.job_profile",
            idempotency_key=idempotency_key,
            title=payload.job_title,
            payload={
                "input": payload.model_dump(mode="json", by_alias=True),
                "content": result.content,
            },
        )
        await db.commit()
        return result
    except (CreditError, JobEngineeringError) as exc:
        await db.rollback()
        raise _http_error(exc) from exc
