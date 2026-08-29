from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.db.session import get_db_session
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


def _company_id(principal: Principal) -> UUID | None:
    for membership in principal.memberships:
        if membership.is_active:
            return membership.company_id
    return None


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
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> HrDataUploadResponse:
    row = await create_upload(
        db,
        owner_user_id=principal.user_id,
        company_id=_company_id(principal),
        name=payload.name,
        records=payload.records,
        is_demo=payload.is_demo,
    )
    await db.commit()
    await db.refresh(row)
    return HrDataUploadResponse.model_validate(row)


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
