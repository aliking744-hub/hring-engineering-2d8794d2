from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response, status
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
from hring_api.domains.development.ai_service import DevelopmentAiError
from hring_api.domains.development.email import LearningEmailUnavailableError
from hring_api.domains.development.schemas import (
    LearningPathEmailResponse,
    LearningPathGenerateRequest,
    LearningPathResponse,
    OnboardingGenerateRequest,
    OnboardingPlanResponse,
    OnboardingProgressRequest,
)
from hring_api.domains.development.service import (
    DevelopmentConflictError,
    DevelopmentNotFoundError,
    deliver_learning_path,
    generate_learning_path,
    generate_onboarding_plan,
    list_learning_paths,
    list_onboarding_plans,
    remove_learning_path,
    remove_onboarding_plan,
    update_onboarding_progress,
)
from hring_api.domains.identity.dependencies import Principal, get_current_principal


router = APIRouter(prefix="/development", tags=["development"])


def _company_id(principal: Principal) -> UUID | None:
    for membership in principal.memberships:
        if membership.is_active:
            return membership.company_id
    return None


def _request_id(request: Request) -> str | None:
    value = getattr(request.state, "request_id", None) or request.headers.get("x-request-id")
    normalized = str(value or "").strip()
    return normalized[:160] or None


def _credit_http_error(exc: CreditError) -> HTTPException:
    if isinstance(exc, CreditForbiddenError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    if isinstance(exc, CreditNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, InsufficientCreditsError):
        return HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=str(exc))
    if isinstance(exc, CreditConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


def _development_http_error(exc: Exception) -> HTTPException:
    if isinstance(exc, DevelopmentNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, DevelopmentConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, LearningEmailUnavailableError):
        return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    if isinstance(exc, DevelopmentAiError):
        return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/onboarding-plans", response_model=list[OnboardingPlanResponse])
async def onboarding_plan_history(
    limit: int = Query(default=50, ge=1, le=200),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> list[OnboardingPlanResponse]:
    rows = await list_onboarding_plans(db, owner_user_id=principal.user_id, limit=limit)
    return [OnboardingPlanResponse.model_validate(row) for row in rows]


@router.post(
    "/onboarding-plans/generate",
    response_model=OnboardingPlanResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_onboarding_plan(
    payload: OnboardingGenerateRequest,
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
) -> OnboardingPlanResponse:
    try:
        row = await generate_onboarding_plan(
            db,
            payload=payload,
            principal=principal,
            company_id=_company_id(principal),
            idempotency_key=idempotency_key,
            request_id=_request_id(request),
            settings=settings,
        )
        await db.commit()
        await db.refresh(row)
        return OnboardingPlanResponse.model_validate(row)
    except CreditError as exc:
        await db.rollback()
        raise _credit_http_error(exc) from exc
    except (DevelopmentAiError, DevelopmentConflictError) as exc:
        await db.rollback()
        raise _development_http_error(exc) from exc


@router.delete("/onboarding-plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_onboarding_plan_route(
    plan_id: UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    try:
        await remove_onboarding_plan(db, plan_id=plan_id, owner_user_id=principal.user_id)
        await db.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except DevelopmentNotFoundError as exc:
        await db.rollback()
        raise _development_http_error(exc) from exc


@router.put("/onboarding-plans/{plan_id}/progress", response_model=OnboardingPlanResponse)
async def save_onboarding_progress(
    plan_id: UUID,
    payload: OnboardingProgressRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> OnboardingPlanResponse:
    try:
        row = await update_onboarding_progress(
            db,
            plan_id=plan_id,
            owner_user_id=principal.user_id,
            payload=payload,
        )
        await db.commit()
        await db.refresh(row)
        return OnboardingPlanResponse.model_validate(row)
    except DevelopmentNotFoundError as exc:
        await db.rollback()
        raise _development_http_error(exc) from exc


@router.get("/learning-paths", response_model=list[LearningPathResponse])
async def learning_path_history(
    limit: int = Query(default=100, ge=1, le=200),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> list[LearningPathResponse]:
    rows = await list_learning_paths(db, owner_user_id=principal.user_id, limit=limit)
    return [LearningPathResponse.model_validate(row) for row in rows]


@router.post(
    "/learning-paths/generate",
    response_model=LearningPathResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_learning_path(
    payload: LearningPathGenerateRequest,
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
) -> LearningPathResponse:
    try:
        row = await generate_learning_path(
            db,
            payload=payload,
            principal=principal,
            company_id=_company_id(principal),
            idempotency_key=idempotency_key,
            request_id=_request_id(request),
            settings=settings,
        )
        await db.commit()
        await db.refresh(row)
        return LearningPathResponse.model_validate(row)
    except CreditError as exc:
        await db.rollback()
        raise _credit_http_error(exc) from exc
    except (DevelopmentAiError, DevelopmentConflictError) as exc:
        await db.rollback()
        raise _development_http_error(exc) from exc


@router.post(
    "/learning-paths/{learning_path_id}/email",
    response_model=LearningPathEmailResponse,
)
async def email_learning_path(
    learning_path_id: UUID,
    principal: Principal = Depends(get_current_principal),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_db_session),
) -> LearningPathEmailResponse:
    try:
        message_id, sent_at = await deliver_learning_path(
            db,
            learning_path_id=learning_path_id,
            owner_user_id=principal.user_id,
            settings=settings,
        )
        await db.commit()
        return LearningPathEmailResponse(id=message_id, sent_at=sent_at)
    except (
        DevelopmentNotFoundError,
        DevelopmentConflictError,
        LearningEmailUnavailableError,
    ) as exc:
        await db.rollback()
        raise _development_http_error(exc) from exc


@router.delete("/learning-paths/{learning_path_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_learning_path_route(
    learning_path_id: UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    try:
        await remove_learning_path(
            db,
            learning_path_id=learning_path_id,
            owner_user_id=principal.user_id,
        )
        await db.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except DevelopmentNotFoundError as exc:
        await db.rollback()
        raise _development_http_error(exc) from exc
