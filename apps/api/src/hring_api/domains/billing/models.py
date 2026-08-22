from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from hring_api.db.base import Base


class BillingPlan(Base):
    __tablename__ = "billing_plans"
    __table_args__ = (
        CheckConstraint("scope IN ('individual','corporate')", name="billing_plans_scope"),
        CheckConstraint("price_toman >= 0", name="billing_plans_price_nonnegative"),
        CheckConstraint("monthly_credits >= 0", name="billing_plans_credits_nonnegative"),
    )

    plan_type: Mapped[str] = mapped_column(String(80), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(160), nullable=False)
    scope: Mapped[str] = mapped_column(String(20), nullable=False)
    price_toman: Mapped[int] = mapped_column(Integer, nullable=False)
    monthly_credits: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','verified','failed','cancelled')",
            name="payment_transactions_status",
        ),
        CheckConstraint("amount_toman > 0", name="payment_transactions_amount_positive"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True
    )
    provider: Mapped[str] = mapped_column(String(40), nullable=False, default="zarinpal")
    amount_toman: Mapped[int] = mapped_column(Integer, nullable=False)
    plan_type: Mapped[str] = mapped_column(
        String(80), ForeignKey("billing_plans.plan_type", ondelete="RESTRICT"), nullable=False
    )
    authority: Mapped[str | None] = mapped_column(String(160), nullable=True, unique=True, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    ref_id: Mapped[str | None] = mapped_column(String(160), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
