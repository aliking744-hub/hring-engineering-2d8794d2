from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from hring_api.db.base import Base


class WorkspaceOutput(Base):
    """Private generated output retained for the requesting user."""

    __tablename__ = "workspace_outputs"
    __table_args__ = (
        UniqueConstraint(
            "owner_user_id",
            "feature_key",
            "idempotency_hash",
            name="uq_workspace_outputs_owner_feature_idempotency",
        ),
        Index(
            "ix_workspace_outputs_owner_feature_created",
            "owner_user_id",
            "feature_key",
            "created_at",
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    owner_user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    company_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    feature_key: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    idempotency_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    payload_json: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
