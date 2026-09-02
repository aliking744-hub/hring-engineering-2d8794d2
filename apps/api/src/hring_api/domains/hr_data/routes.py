from hashlib import sha256
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response, status
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
from hring_api.domains.hr_data.repository import (
    create_upload,
    delete_upload,
    get_latest_upload,
    get_upload,
    list_uploads,
)
from hring_api.domains.hr_data.schemas import (
    HrDataUploadCreateRequest,
    HrDataUploadResponse,
    HrDataUploadSummary,
)
from hring_api.domains.identity.dependencies import Principal, get_current_principal


router = APIRouter(prefix="/hr-data", tags=["hr-data"])
HR_DASHBOARD_DEMO_FEATURE_KEY = "hr_data.dashboard_demo"
HR_DASHBOARD_UPLOAD_FEATURE_KEY = "hr_data.dashboard_upload"
HR_DASHBOARD_DEMO_DEFAULT_CREDIT_COST = 25
HR_DASHBOARD_UPLOAD_DEFAULT_CREDIT_COST = 50


def _company_id(principal: Principal) -> UUID | None:
    for membership in principal.memberships:
        if membership.is_active:
            return membership.company_id
    return None


def _credit_http_error(exc: CreditError) -> HTTPException:
    if isinstance(exc, InsufficientCreditsError):
        return HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=str(exc))
    if isinstance(exc, CreditForbiddenError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    if isinstance(exc, CreditNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, CreditConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/uploads", response_model=list[HrDataUploadSummary])
async def upload_history(
    limit: int = Query(default=50, ge=1, le=100),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> list[HrDataUploadSummary]:
    rows = await list_uploads(db, owner_user_id=principal.user_id, limit=limit)
    return [HrDataUploadSummary.model_validate(row) for row in rows]


@router.get("/uploads/latest", response_model=HrDataUploadResponse | None)
async def latest_upload(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> HrDataUploadResponse | None:
    row = await get_latest_upload(db, owner_user_id=principal.user_id)
    return HrDataUploadResponse.model_validate(row) if row is not None else None


@router.get("/uploads/{upload_id}", response_model=HrDataUploadResponse)
async def fetch_upload(
    upload_id: UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> HrDataUploadResponse:
    row = await get_upload(db, upload_id=upload_id, owner_user_id=principal.user_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="HR upload was not found")
    return HrDataUploadResponse.model_validate(row)


@router.post("/uploads", response_model=HrDataUploadResponse, status_code=status.HTTP_201_CREATED)
async def create_hr_upload(
    payload: HrDataUploadCreateRequest,
    request: Request,
    idempotency_key: str = Header(..., alias="X-Idempotency-Key", min_length=8, max_length=128),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> HrDataUploadResponse:
    feature_key = HR_DASHBOARD_DEMO_FEATURE_KEY if payload.is_demo else HR_DASHBOARD_UPLOAD_FEATURE_KEY
    default_cost = (
        HR_DASHBOARD_DEMO_DEFAULT_CREDIT_COST
        if payload.is_demo
        else HR_DASHBOARD_UPLOAD_DEFAULT_CREDIT_COST
    )
    cost = await feature_credit_cost(db, feature_key=feature_key, default_cost=default_cost)
    key_hash = sha256(idempotency_key.strip().encode()).hexdigest()

    async def operation() -> HrDataUploadResponse:
        row = await create_upload(
            db,
            owner_user_id=principal.user_id,
            company_id=_company_id(principal),
            name=payload.name,
            records=payload.records,
            is_demo=payload.is_demo,
        )
        await db.flush()
        return HrDataUploadResponse.model_validate(row)

    try:
        return await run_with_credit_reservation(
            db,
            principal=principal,
            amount=cost,
            idempotency_key=f"{feature_key}:{key_hash}",
            feature_key=feature_key,
            description="Generate HR dashboard from demo data" if payload.is_demo else "Generate HR dashboard from spreadsheet",
            request_id=str(getattr(request.state, "request_id", ""))[:160] or None,
            operation=operation,
        )
    except CreditError as exc:
        await db.rollback()
        raise _credit_http_error(exc) from exc


@router.delete("/uploads/{upload_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_hr_upload(
    upload_id: UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    if not await delete_upload(db, upload_id=upload_id, owner_user_id=principal.user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="HR upload was not found")
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
