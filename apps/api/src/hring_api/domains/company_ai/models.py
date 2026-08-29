from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from hring_api.db.base import Base


class CompanyAiConnection(Base):
    """An AI routing choice owned by exactly one company.

    The provider secret is deliberately separate from platform providers and is
    stored encrypted.  API responses must only expose ``secret_hint``.
    """

    __tablename__ = "company_ai_connections"
    __table_args__ = (
        UniqueConstraint("company_id", "capability_key", name="uq_company_ai_connections_capability"),
        CheckConstraint("mode IN ('byok','hring_managed')", name="company_ai_connections_mode"),
        CheckConstraint(
            "auth_scheme IN ('bearer','x-api-key','api-key','x-goog-api-key')",
            name="company_ai_connections_auth_scheme",
        ),
        CheckConstraint(
            "status IN ('untested','healthy','unhealthy','disabled')",
            name="company_ai_connections_status",
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    company_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    capability_key: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    mode: Mapped[str] = mapped_column(String(20), nullable=False, default="hring_managed")
    provider_key: Mapped[str | None] = mapped_column(String(120), nullable=True)
    adapter: Mapped[str | None] = mapped_column(String(80), nullable=True)
    base_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    default_model: Mapped[str | None] = mapped_column(String(240), nullable=True)
    auth_scheme: Mapped[str] = mapped_column(String(32), nullable=False, default="bearer")
    secret_ciphertext: Mapped[str | None] = mapped_column(Text, nullable=True)
    secret_hint: Mapped[str | None] = mapped_column(String(32), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="untested", index=True)
    last_tested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
