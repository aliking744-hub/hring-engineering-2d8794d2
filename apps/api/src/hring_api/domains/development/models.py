from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from hring_api.db.base import Base


class OnboardingPlan(Base):
    __tablename__ = "development_onboarding_plans"
    __table_args__ = (
        CheckConstraint(
            "seniority IN ('junior','mid','senior','lead')",
            name="seniority",
        ),
        CheckConstraint(
            "expectation IN ('quick_delivery','learning','leadership','innovation')",
            name="expectation",
        ),
        UniqueConstraint(
            "owner_user_id",
            "idempotency_key",
            name="uq_development_onboarding_plans_owner_idempotency",
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
    idempotency_key: Mapped[str] = mapped_column(String(64), nullable=False)
    job_title: Mapped[str] = mapped_column(Text, nullable=False)
    seniority: Mapped[str] = mapped_column(String(32), nullable=False)
    expectation: Mapped[str] = mapped_column(String(48), nullable=False)
    mentor_role: Mapped[str | None] = mapped_column(Text, nullable=True)
    plan: Mapped[str] = mapped_column(Text, nullable=False)
    welcome_email: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class LearningPath(Base):
    __tablename__ = "development_learning_paths"
    __table_args__ = (
        CheckConstraint(
            "experience_years >= 0 AND experience_years <= 60",
            name="experience_years",
        ),
        CheckConstraint(
            "training_months IS NULL OR (training_months >= 1 AND training_months <= 24)",
            name="training_months",
        ),
        CheckConstraint("jsonb_typeof(result) = 'object'", name="result_object"),
        UniqueConstraint(
            "owner_user_id",
            "idempotency_key",
            name="uq_development_learning_paths_owner_idempotency",
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
    idempotency_key: Mapped[str] = mapped_column(String(80), nullable=False)
    employee_name: Mapped[str] = mapped_column(Text, nullable=False)
    employee_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    job_title: Mapped[str] = mapped_column(Text, nullable=False)
    industry: Mapped[str] = mapped_column(Text, nullable=False)
    seniority_level: Mapped[str] = mapped_column(String(40), nullable=False)
    education_level: Mapped[str] = mapped_column(String(40), nullable=False)
    field_of_study: Mapped[str | None] = mapped_column(Text, nullable=True)
    experience_years: Mapped[int] = mapped_column(Integer, nullable=False)
    training_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    result: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    last_emailed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
