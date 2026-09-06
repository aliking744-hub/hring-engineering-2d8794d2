from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
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
        CheckConstraint(
            "status IN ('active','completed','failed')",
            name="status",
        ),
        CheckConstraint(
            "score IS NULL OR (score >= 0 AND score <= 100)",
            name="score",
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
    employee_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    employee_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    starts_on: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    job_title: Mapped[str] = mapped_column(Text, nullable=False)
    seniority: Mapped[str] = mapped_column(String(32), nullable=False)
    expectation: Mapped[str] = mapped_column(String(48), nullable=False)
    mentor_role: Mapped[str | None] = mapped_column(Text, nullable=True)
    plan: Mapped[str] = mapped_column(Text, nullable=False)
    welcome_email: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="active", index=True)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    certificate_number: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)
    certificate_recipient_title: Mapped[str | None] = mapped_column(String(8), nullable=True)
    certificate_issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class OnboardingTask(Base):
    __tablename__ = "development_onboarding_tasks"
    __table_args__ = (
        CheckConstraint(
            "status IN ('todo','in_progress','completed','blocked')",
            name="status",
        ),
        CheckConstraint("sort_order >= 0", name="sort_order"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    plan_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("development_onboarding_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parent_task_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("development_onboarding_tasks.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    company_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    assignee_label: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_on: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="todo", index=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class OnboardingTaskEvent(Base):
    __tablename__ = "development_onboarding_task_events"
    __table_args__ = (
        CheckConstraint(
            "event_type IN ('created','updated','completed','reopened','deleted')",
            name="event_type",
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    task_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("development_onboarding_tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor_user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(String(24), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
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
