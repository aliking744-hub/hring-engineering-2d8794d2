from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from hring_api.db.base import Base


class AiUsageEvent(Base):
    """Immutable billing telemetry for one upstream AI operation.

    Prompts and generated content are intentionally not persisted here. Only
    billing/operational metadata is stored so cost accounting does not become
    a second copy of customer-sensitive HR data.
    """

    __tablename__ = "ai_usage_events"
    __table_args__ = (
        CheckConstraint(
            "status IN ('success','failure')",
            name="ck_ai_usage_events_status",
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    request_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), nullable=False, unique=True, index=True, default=uuid4
    )
    company_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    feature_key: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    model: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    operation: Mapped[str] = mapped_column(String(48), nullable=False, default="generate")
    metrics_json: Mapped[dict[str, int]] = mapped_column(JSONB, nullable=False, default=dict)
    provider_cost_microusd: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    estimated_cost_microusd: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    credits_charged: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="success")
    error_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    metadata_json: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )


class AiRateCard(Base):
    """Historical provider/model price for one measurable usage metric.

    Example: metric=input_tokens, unit_size=1_000_000,
    cost_microusd=5_000_000 means USD 5 per one million input tokens.
    """

    __tablename__ = "ai_rate_cards"
    __table_args__ = (
        UniqueConstraint(
            "provider",
            "model",
            "metric",
            "effective_from",
            name="uq_ai_rate_cards_version",
        ),
        CheckConstraint("unit_size > 0", name="ck_ai_rate_cards_unit_size_positive"),
        CheckConstraint("cost_microusd >= 0", name="ck_ai_rate_cards_cost_nonnegative"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    provider: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    model: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    metric: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    unit_size: Mapped[int] = mapped_column(BigInteger, nullable=False, default=1)
    cost_microusd: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    effective_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

class AiPrompt(Base):
    __tablename__ = "ai_prompts"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    prompt_key: Mapped[str] = mapped_column(
        String(120), nullable=False, unique=True, index=True
    )
    feature_key: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
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


class AiPromptVersion(Base):
    __tablename__ = "ai_prompt_versions"
    __table_args__ = (
        UniqueConstraint(
            "prompt_id",
            "version",
            name="uq_ai_prompt_versions_prompt_version",
        ),
        CheckConstraint(
            "status IN ('draft','published','archived')",
            name="ai_prompt_versions_status",
        ),
        CheckConstraint(
            "test_status IN ('untested','passed','failed')",
            name="ai_prompt_versions_test_status",
        ),
        CheckConstraint(
            "response_format IN ('text','json_object')",
            name="ai_prompt_versions_response_format",
        ),
        CheckConstraint(
            "temperature IS NULL OR (temperature >= 0 AND temperature <= 2)",
            name="ai_prompt_versions_temperature_range",
        ),
        CheckConstraint(
            "max_output_tokens IS NULL OR "
            "(max_output_tokens >= 1 AND max_output_tokens <= 200000)",
            name="ai_prompt_versions_max_tokens_range",
        ),
        CheckConstraint(
            "version >= 1",
            name="ai_prompt_versions_version_positive",
        ),
        Index(
            "uq_ai_prompt_versions_one_draft",
            "prompt_id",
            unique=True,
            postgresql_where=text("status = 'draft'"),
        ),
        Index(
            "uq_ai_prompt_versions_one_published",
            "prompt_id",
            unique=True,
            postgresql_where=text("status = 'published'"),
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    prompt_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("ai_prompts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft", index=True)
    provider_alias: Mapped[str] = mapped_column(String(120), nullable=False)
    model: Mapped[str] = mapped_column(String(240), nullable=False)
    system_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_template: Mapped[str] = mapped_column(Text, nullable=False)
    input_variables_json: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    response_format: Mapped[str] = mapped_column(String(20), nullable=False, default="text")
    output_schema_json: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True)
    temperature: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    test_status: Mapped[str] = mapped_column(String(20), nullable=False, default="untested")
    last_tested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_test_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    published_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

