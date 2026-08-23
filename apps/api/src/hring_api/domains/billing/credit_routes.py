from __future__ import annotations

from typing import cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.db.session import get_db_session
from hring_api.domains.access.policy import PlatformPrincipal, require_platform_permission
from hring_api.domains.billing.credit_schemas import (
    AdminCreditAccountResponse,
    AdminCreditAdjustmentRequest,
    CreditBalanceResponse,
    CreditLedgerEntryResponse,
    CreditPreflightRequest,
    CreditPreflightResponse,
    CreditReconciliationResponse,
    OwnerType,
)
from hring_api.domains.billing.credit_service import (
    CreditConflictError,
    CreditError,
    CreditForbiddenError,
    CreditNotFoundError,
    InsufficientCreditsError,
    admin_adjust_credits,
    get_credit_balance,
    list_credit_accounts_for_admin,
    list_credit_ledger_entries,
    reconcile_credit_accounts,
)
from hring_api.domains.identity.dependencies import Principal, get_current_principal


router = APIRouter(tags=["credits"])


def _request_id(request: Request) -> str:
    value = getattr(request.state, "request_id", None) or request.headers.get("x-request-id")
    return str(value or "")[:160]


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


@router.get("/billing/credits/me", response_model=CreditBalanceResponse)
async def my_credit_balance(
    request: Request,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> CreditBalanceResponse:
    try:
        balance = await get_credit_balance(
            db,
            principal=principal,
            request_id=_request_id(request),
        )
    except CreditError as exc:
        raise _credit_http_error(exc) from exc
    return CreditBalanceResponse(
        account_id=balance.account.id,
        owner_type=cast(OwnerType, balance.account.owner_type),
        owner_id=balance.owner_id,
        available_credits=int(balance.account.available_credits),
        reserved_credits=int(balance.account.reserved_credits),
        total_credits=int(balance.account.available_credits + balance.account.reserved_credits),
        projection_reconciled=balance.reconciled,
    )


@router.post("/billing/credits/preflight", response_model=CreditPreflightResponse)
async def credit_preflight(
    payload: CreditPreflightRequest,
    request: Request,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> CreditPreflightResponse:
    try:
        balance = await get_credit_balance(
            db,
            principal=principal,
            request_id=_request_id(request),
        )
    except CreditError as exc:
        raise _credit_http_error(exc) from exc
    available = int(balance.account.available_credits)
    return CreditPreflightResponse(allowed=available >= payload.amount, available_credits=available)


@router.get(
    "/platform/billing/credits/accounts",
    response_model=list[AdminCreditAccountResponse],
)
async def platform_credit_accounts(
    owner_type: str = Query(default="user", pattern=r"^(user|company)$"),
    search: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _platform: PlatformPrincipal = Depends(require_platform_permission("platform.billing.read")),
    db: AsyncSession = Depends(get_db_session),
) -> list[AdminCreditAccountResponse]:
    try:
        rows = await list_credit_accounts_for_admin(
            db,
            owner_type=owner_type,
            search=search,
            limit=limit,
            offset=offset,
        )
    except CreditError as exc:
        raise _credit_http_error(exc) from exc
    return [
        AdminCreditAccountResponse(
            account_id=row.account_id,
            owner_type=cast(OwnerType, row.owner_type),
            owner_id=row.owner_id,
            owner_label=row.owner_label,
            owner_secondary_label=row.owner_secondary_label,
            available_credits=row.available_credits,
            reserved_credits=row.reserved_credits,
            total_credits=row.available_credits + row.reserved_credits,
            legacy_available_credits=row.legacy_available_credits,
            projection_reconciled=row.projection_reconciled,
        )
        for row in rows
    ]


@router.post(
    "/platform/billing/credits/adjustments",
    response_model=CreditLedgerEntryResponse,
)
async def platform_credit_adjustment(
    payload: AdminCreditAdjustmentRequest,
    request: Request,
    platform: PlatformPrincipal = Depends(require_platform_permission("platform.billing.manage")),
    db: AsyncSession = Depends(get_db_session),
) -> CreditLedgerEntryResponse:
    try:
        entry = await admin_adjust_credits(
            db,
            owner_type=payload.owner_type,
            owner_id=payload.owner_id,
            amount=payload.amount,
            idempotency_key=payload.idempotency_key,
            reason=payload.reason.strip(),
            actor_user_id=platform.user_id,
            request_id=_request_id(request),
            ip_address=request.client.host if request.client else None,
        )
    except CreditError as exc:
        raise _credit_http_error(exc) from exc
    return CreditLedgerEntryResponse.model_validate(entry)


@router.get(
    "/platform/billing/credits/ledger",
    response_model=list[CreditLedgerEntryResponse],
)
async def platform_credit_ledger(
    account_id: UUID | None = None,
    event_type: str | None = Query(
        default=None,
        pattern=r"^(grant|reserve|consume|release|refund|expire|admin_adjustment)$",
    ),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _platform: PlatformPrincipal = Depends(require_platform_permission("platform.billing.read")),
    db: AsyncSession = Depends(get_db_session),
) -> list[CreditLedgerEntryResponse]:
    rows = await list_credit_ledger_entries(
        db,
        account_id=account_id,
        event_type=event_type,
        limit=limit,
        offset=offset,
    )
    return [CreditLedgerEntryResponse.model_validate(row) for row in rows]


@router.get(
    "/platform/billing/credits/reconciliation",
    response_model=list[CreditReconciliationResponse],
)
async def platform_credit_reconciliation(
    account_id: UUID | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _platform: PlatformPrincipal = Depends(require_platform_permission("platform.billing.read")),
    db: AsyncSession = Depends(get_db_session),
) -> list[CreditReconciliationResponse]:
    rows = await reconcile_credit_accounts(
        db,
        account_id=account_id,
        limit=limit,
        offset=offset,
    )
    return [
        CreditReconciliationResponse(
            account_id=row.account_id,
            projected_available=row.projected_available,
            ledger_available=row.ledger_available,
            projected_reserved=row.projected_reserved,
            ledger_reserved=row.ledger_reserved,
            legacy_available=row.legacy_available,
            reconciled=row.reconciled,
        )
        for row in rows
    ]
