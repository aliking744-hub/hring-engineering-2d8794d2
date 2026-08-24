from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings, get_settings
from hring_api.db.session import get_db_session
from hring_api.domains.access.policy import PlatformPrincipal, require_platform_permission
from hring_api.domains.admin.repository import add_audit_log
from hring_api.domains.billing.models import BillingPlan
from hring_api.domains.billing.schemas import (
    BillingPlanResponse,
    BillingPlanUpdateRequest,
    PaymentInitRequest,
    PaymentInitResponse,
    PaymentVerifyRequest,
    PaymentVerifyResponse,
)
from hring_api.domains.billing.service import (
    BillingError,
    BillingForbiddenError,
    BillingNotFoundError,
    BillingUnavailableError,
    PaymentVerificationError,
    initialize_payment,
    list_billing_plans,
    verify_payment,
)
from hring_api.domains.identity.dependencies import Principal, get_current_principal


router = APIRouter(tags=["billing"])


def _billing_http_error(exc: BillingError) -> HTTPException:
    if isinstance(exc, BillingForbiddenError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    if isinstance(exc, BillingNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, BillingUnavailableError):
        return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    if isinstance(exc, PaymentVerificationError):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/billing/plans", response_model=list[BillingPlanResponse])
async def public_billing_plans(
    db: AsyncSession = Depends(get_db_session),
) -> list[BillingPlanResponse]:
    plans = await list_billing_plans(db)
    return [BillingPlanResponse.model_validate(plan) for plan in plans]


@router.post("/billing/payments/init", response_model=PaymentInitResponse)
async def init_payment(
    payload: PaymentInitRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> PaymentInitResponse:
    try:
        result = await initialize_payment(
            db,
            principal=principal,
            plan_type=payload.plan_type,
            settings=settings,
        )
    except BillingError as exc:
        raise _billing_http_error(exc) from exc
    return PaymentInitResponse(
        authority=result.authority,
        payment_url=result.payment_url,
    )


@router.post("/billing/payments/verify", response_model=PaymentVerifyResponse)
async def verify_payment_route(
    payload: PaymentVerifyRequest,
    request: Request,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> PaymentVerifyResponse:
    try:
        result = await verify_payment(
            db,
            principal=principal,
            authority=payload.authority,
            settings=settings,
            request_id=str(getattr(request.state, "request_id", ""))[:160] or None,
            ip_address=request.client.host if request.client else None,
        )
    except BillingError as exc:
        raise _billing_http_error(exc) from exc
    return PaymentVerifyResponse(
        ref_id=result.ref_id,
        already_verified=result.already_verified,
    )


@router.get("/platform/billing/plans", response_model=list[BillingPlanResponse])
async def platform_billing_plans(
    _platform: PlatformPrincipal = Depends(require_platform_permission("platform.billing.read")),
    db: AsyncSession = Depends(get_db_session),
) -> list[BillingPlanResponse]:
    plans = await list_billing_plans(db, include_inactive=True)
    return [BillingPlanResponse.model_validate(plan) for plan in plans]


@router.patch("/platform/billing/plans/{plan_type}", response_model=BillingPlanResponse)
async def update_platform_billing_plan(
    plan_type: str,
    payload: BillingPlanUpdateRequest,
    request: Request,
    platform: PlatformPrincipal = Depends(require_platform_permission("platform.billing.manage")),
    db: AsyncSession = Depends(get_db_session),
) -> BillingPlanResponse:
    plan = await db.get(BillingPlan, plan_type)
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Billing plan not found")

    before = {
        "display_name": plan.display_name,
        "price_toman": plan.price_toman,
        "monthly_credits": plan.monthly_credits,
        "is_active": plan.is_active,
    }
    changes = payload.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(plan, key, value)
    await add_audit_log(
        db,
        actor_user_id=platform.user_id,
        company_id=None,
        action="billing.plan.update",
        resource_type="billing_plan",
        resource_id=plan.plan_type,
        metadata_json={"before": before, "changes": changes},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(plan)
    return BillingPlanResponse.model_validate(plan)
