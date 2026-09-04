from __future__ import annotations

from hashlib import sha256

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.db.session import get_db_session
from hring_api.domains.billing.credit_service import (
    CreditConflictError,
    CreditError,
    CreditForbiddenError,
    CreditNotFoundError,
    InsufficientCreditsError,
    feature_credit_cost,
    run_with_credit_reservation,
)
from hring_api.domains.costing.schemas import (
    EmployeeCostCalculationRequest,
    EmployeeCostCalculationResponse,
    StatutoryRatesResponse,
)
from hring_api.domains.costing.service import calculate_employee_cost, current_rates_response
from hring_api.domains.identity.dependencies import Principal, get_current_principal


router = APIRouter(prefix="/costing", tags=["costing"])
COST_CALCULATOR_FEATURE_KEY = "costing.employee_cost_calculator"
COST_CALCULATOR_DEFAULT_CREDIT_COST = 2


def _http_error(exc: CreditError) -> HTTPException:
    if isinstance(exc, InsufficientCreditsError):
        return HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=str(exc))
    if isinstance(exc, CreditForbiddenError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    if isinstance(exc, CreditNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, CreditConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/statutory-rates/current", response_model=StatutoryRatesResponse)
async def statutory_rates(
    _: Principal = Depends(get_current_principal),
) -> StatutoryRatesResponse:
    return current_rates_response()


@router.post("/calculate", response_model=EmployeeCostCalculationResponse)
async def calculate_cost(
    payload: EmployeeCostCalculationRequest,
    request: Request,
    idempotency_key: str = Header(
        ...,
        alias="X-Idempotency-Key",
        min_length=8,
        max_length=128,
    ),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> EmployeeCostCalculationResponse:
    cost = await feature_credit_cost(
        db,
        feature_key=COST_CALCULATOR_FEATURE_KEY,
        default_cost=COST_CALCULATOR_DEFAULT_CREDIT_COST,
    )
    key_hash = sha256(idempotency_key.strip().encode()).hexdigest()

    async def operation() -> EmployeeCostCalculationResponse:
        return calculate_employee_cost(payload)

    try:
        return await run_with_credit_reservation(
            db,
            principal=principal,
            amount=cost,
            idempotency_key=f"{COST_CALCULATOR_FEATURE_KEY}:{key_hash}",
            feature_key=COST_CALCULATOR_FEATURE_KEY,
            description="Calculate employee total cost",
            request_id=str(getattr(request.state, "request_id", ""))[:160] or None,
            operation=operation,
        )
    except CreditError as exc:
        await db.rollback()
        raise _http_error(exc) from exc
