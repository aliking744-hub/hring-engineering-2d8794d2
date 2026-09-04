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
from hring_api.domains.interview.schemas import (
    InterviewKitGenerateRequest,
    InterviewKitResponse,
)
from hring_api.domains.interview.service import InterviewError, generate_interview_kit
from hring_api.domains.workspace_outputs.service import save_workspace_output


router = APIRouter(prefix="/interview", tags=["interview"])


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


@router.post("/kits/generate", response_model=InterviewKitResponse)
async def create_interview_kit(
    payload: InterviewKitGenerateRequest,
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
) -> InterviewKitResponse:
    try:
        result = await generate_interview_kit(
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
            feature_key="interview.kit",
            idempotency_key=idempotency_key,
            title=payload.job_title,
            payload={
                "input": payload.model_dump(mode="json", by_alias=True),
                "questions": result.model_dump(mode="json", by_alias=True)["questions"],
            },
        )
        await db.commit()
        return result
    except (CreditError, InterviewError) as exc:
        await db.rollback()
        raise _http_error(exc) from exc

