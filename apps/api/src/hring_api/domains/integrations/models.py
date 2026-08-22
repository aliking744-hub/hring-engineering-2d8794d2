from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from hring_api.db.base import Base


class IntegrationProvider(Base):
    __tablename__ = "integration_providers"
    __table_args__ = (
        CheckConstraint(
            "provider_type IN ("
            "'llm','embedding','image','search','crawler','ocr',"
            "'email','sms','payment','webhook'"
            ")",
            name="integration_providers_type",
        ),
        CheckConstraint(
            "auth_scheme IN ("
            "'none','bearer','x-api-key','api-key','x-goog-api-key'"
            ")",
            name="integration_providers_auth_scheme",
        ),
        CheckConstraint(
            "status IN ('untested','healthy','unhealthy','disabled')",
            name="integration_providers_status",
        ),
        CheckConstraint("priority >= 0", name="integration_providers_priority_nonnegative"),
        CheckConstraint(
            "timeout_seconds BETWEEN 1 AND 60",
            name="integration_providers_timeout_range",
        ),
        CheckConstraint(
            "max_retries BETWEEN 0 AND 10",
            name="integration_providers_retries_range",
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    provider_key: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    provider_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    adapter: Mapped[str] = mapped_column(String(80), nullable=False)
    base_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    default_model: Mapped[str | None] = mapped_column(String(240), nullable=True)
    auth_scheme: Mapped[str] = mapped_column(String(32), nullable=False, default="bearer")
    secret_ciphertext: Mapped[str | None] = mapped_column(Text, nullable=True)
    secret_hint: Mapped[str | None] = mapped_column(String(32), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    is_internal: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    timeout_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    max_retries: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    capabilities_json: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    settings_json: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False, default=dict)
    quota_json: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False, default=dict)
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
