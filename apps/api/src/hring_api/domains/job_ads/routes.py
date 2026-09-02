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
from hring_api.domains.job_ads.schemas import (
    SmartAdGenerateRequest,
    SmartAdImageResponse,
    SmartAdResponse,
    SmartAdTextResponse,
)
from hring_api.domains.job_ads.service import (
    SmartAdError,
    generate_smart_ad,
    generate_smart_ad_image,
)


router = APIRouter(prefix="/job-ads", tags=["job-ads"])


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


@router.post("/generate", response_model=SmartAdResponse)
async def create_smart_ad(
    payload: SmartAdGenerateRequest,
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
) -> SmartAdResponse:
    try:
        result = await generate_smart_ad(
            db,
            payload=payload,
            principal=principal,
            idempotency_key=idempotency_key,
            request_id=str(getattr(request.state, "request_id", ""))[:160] or None,
            settings=settings,
        )
        await db.commit()
        return result
    except (CreditError, SmartAdError) as exc:
        await db.rollback()
        raise _http_error(exc) from exc



@router.post("/generate-text", response_model=SmartAdTextResponse)
async def create_smart_ad_text(
    payload: SmartAdGenerateRequest,
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
) -> SmartAdTextResponse:
    """Generate and bill only smart-ad text."""
    try:
        text_payload = payload.model_copy(update={"generate_image": False})
        result = await generate_smart_ad(
            db,
            payload=text_payload,
            principal=principal,
            idempotency_key=idempotency_key,
            request_id=str(getattr(request.state, "request_id", ""))[:160] or None,
            settings=settings,
        )
        await db.commit()
        return SmartAdTextResponse(generated_text=result.generated_text)
    except (CreditError, SmartAdError) as exc:
        await db.rollback()
        raise _http_error(exc) from exc


@router.post("/generate-image", response_model=SmartAdImageResponse)
async def create_smart_ad_image(
    payload: SmartAdGenerateRequest,
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
) -> SmartAdImageResponse:
    """Generate and bill only a smart-ad image."""
    try:
        result = await generate_smart_ad_image(
            db,
            payload=payload,
            principal=principal,
            idempotency_key=idempotency_key,
            request_id=str(getattr(request.state, "request_id", ""))[:160] or None,
            settings=settings,
        )
        await db.commit()
        return result
    except (CreditError, SmartAdError) as exc:
        await db.rollback()
        raise _http_error(exc) from exc
