from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from hring_api.db.base import Base


class CompatRecord(Base):
    """JSONB-backed bridge for legacy feature data not yet promoted to a typed domain model.

    This table belongs to HRing PostgreSQL. It is deliberately scoped by owner/company
    and is not a pass-through to Supabase or any external datastore.
    """

    __tablename__ = "compat_records"
    __table_args__ = (
        UniqueConstraint("table_name", "record_id", name="uq_compat_records_table_record"),
        Index("ix_compat_records_table_owner", "table_name", "owner_user_id"),
        Index("ix_compat_records_table_company", "table_name", "company_id"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    table_name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    record_id: Mapped[str] = mapped_column(String(160), nullable=False)
    owner_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    company_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=True, index=True
    )
    data: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
