from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import DateTime, ForeignKey, Integer, String, func, select
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from hring_api.db.base import Base
from hring_api.db.session import get_db_session
from hring_api.domains.identity.dependencies import Principal, get_current_principal

class HrDashboardUpload(Base):
    __tablename__ = "hr_dashboard_uploads"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    owner_user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(500))
    employee_count: Mapped[int] = mapped_column(Integer)
    data: Mapped[list[dict[str, object]]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

class UploadCreate(BaseModel):
    name: str = Field(min_length=1, max_length=500)
    data: list[dict[str, object]] = Field(max_length=20_000)

class UploadSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    employee_count: int
    created_at: datetime

class UploadDetail(UploadSummary):
    data: list[dict[str, object]]

router = APIRouter(prefix="/hr-dashboard/uploads", tags=["hr-dashboard"])

@router.get("", response_model=list[UploadSummary])
async def list_uploads(principal: Principal = Depends(get_current_principal), db: AsyncSession = Depends(get_db_session)) -> list[HrDashboardUpload]:
    rows = await db.scalars(select(HrDashboardUpload).where(HrDashboardUpload.owner_user_id == principal.user_id).order_by(HrDashboardUpload.created_at.desc()).limit(50))
    return list(rows)

@router.post("", response_model=UploadSummary, status_code=status.HTTP_201_CREATED)
async def create_upload(payload: UploadCreate, principal: Principal = Depends(get_current_principal), db: AsyncSession = Depends(get_db_session)) -> HrDashboardUpload:
    row = HrDashboardUpload(owner_user_id=principal.user_id, name=payload.name, employee_count=len(payload.data), data=payload.data)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row

@router.get("/{upload_id}", response_model=UploadDetail)
async def get_upload(upload_id: UUID, principal: Principal = Depends(get_current_principal), db: AsyncSession = Depends(get_db_session)) -> HrDashboardUpload:
    row = await db.scalar(select(HrDashboardUpload).where(HrDashboardUpload.id == upload_id, HrDashboardUpload.owner_user_id == principal.user_id))
    if row is None:
        raise HTTPException(status_code=404, detail="HR dashboard upload not found")
    return row

@router.delete("/{upload_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_upload(upload_id: UUID, principal: Principal = Depends(get_current_principal), db: AsyncSession = Depends(get_db_session)) -> Response:
    row = await db.scalar(select(HrDashboardUpload).where(HrDashboardUpload.id == upload_id, HrDashboardUpload.owner_user_id == principal.user_id))
    if row is None:
        raise HTTPException(status_code=404, detail="HR dashboard upload not found")
    await db.delete(row)
    await db.commit()
    return Response(status_code=204)
