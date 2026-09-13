from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from hring_api.db.base import Base


class BillingPlan(Base):
    __tablename__ = "billing_plans"
    __table_args__ = (
        CheckConstraint("scope IN ('individual','corporate')", name="billing_plans_scope"),
        CheckConstraint("price_toman >= 0", name="billing_plans_price_nonnegative"),
        CheckConstraint("monthly_credits >= 0", name="billing_plans_credits_nonnegative"),
        CheckConstraint(
            "price_usd_cents IS NULL OR price_usd_cents >= 0",
            name="billing_plans_price_usd_nonnegative",
        ),
    )

    plan_type: Mapped[str] = mapped_column(String(80), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(160), nullable=False)
    scope: Mapped[str] = mapped_column(String(20), nullable=False)
    price_toman: Mapped[int] = mapped_column(Integer, nullable=False)
    price_usd_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    monthly_credits: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class BillingExchangeRateSetting(Base):
    __tablename__ = "billing_exchange_rate_settings"
    __table_args__ = (
        CheckConstraint("id = 1", name="billing_exchange_rate_settings_singleton"),
        CheckConstraint("markup_toman >= 0", name="billing_exchange_rate_markup_nonnegative"),
        CheckConstraint(
            "automatic_rate_toman IS NULL OR automatic_rate_toman BETWEEN 10000 AND 10000000",
            name="billing_exchange_rate_automatic_bounds",
        ),
        CheckConstraint(
            "manual_rate_toman IS NULL OR manual_rate_toman BETWEEN 10000 AND 10000000",
            name="billing_exchange_rate_manual_bounds",
        ),
        CheckConstraint(
            "stale_after_hours BETWEEN 1 AND 168",
            name="billing_exchange_rate_stale_hours_bounds",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    source: Mapped[str] = mapped_column(String(40), nullable=False, default="tgju")
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    automatic_rate_toman: Mapped[int | None] = mapped_column(Integer, nullable=True)
    manual_rate_toman: Mapped[int | None] = mapped_column(Integer, nullable=True)
    markup_toman: Mapped[int] = mapped_column(Integer, nullable=False, default=10_000)
    auto_refresh_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    stale_after_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=36)
    source_fetched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class BillingExchangeRateHistory(Base):
    __tablename__ = "billing_exchange_rate_history"
    __table_args__ = (
        CheckConstraint("rate_toman BETWEEN 10000 AND 10000000", name="billing_rate_history_bounds"),
        Index("ix_billing_rate_history_created", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    source: Mapped[str] = mapped_column(String(40), nullable=False)
    rate_toman: Mapped[int] = mapped_column(Integer, nullable=False)
    source_fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
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
        PGUUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(40), nullable=False, default="zarinpal")
    amount_toman: Mapped[int] = mapped_column(Integer, nullable=False)
    plan_type: Mapped[str] = mapped_column(
        String(80), ForeignKey("billing_plans.plan_type", ondelete="RESTRICT"), nullable=False
    )
    authority: Mapped[str | None] = mapped_column(
        String(160), nullable=True, unique=True, index=True
    )
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


class CreditAccount(Base):
    __tablename__ = "credit_accounts"
    __table_args__ = (
        CheckConstraint(
            "(owner_type = 'user' AND user_id IS NOT NULL AND company_id IS NULL) "
            "OR (owner_type = 'company' AND company_id IS NOT NULL AND user_id IS NULL)",
            name="owner_scope",
        ),
        CheckConstraint("available_credits >= 0", name="available_nonnegative"),
        CheckConstraint("reserved_credits >= 0", name="reserved_nonnegative"),
        UniqueConstraint("user_id", name="credit_accounts_user_id"),
        UniqueConstraint("company_id", name="credit_accounts_company_id"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    owner_type: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )
    company_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True
    )
    available_credits: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    reserved_credits: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    valid_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class CreditReservation(Base):
    __tablename__ = "credit_reservations"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active','consumed','released','expired')",
            name="status",
        ),
        CheckConstraint("amount > 0", name="amount_positive"),
        UniqueConstraint(
            "account_id",
            "idempotency_key",
            name="credit_reservations_account_idempotency_key",
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    account_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("credit_accounts.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    created_by_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    idempotency_key: Mapped[str] = mapped_column(String(160), nullable=False)
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active", index=True)
    feature_key: Mapped[str | None] = mapped_column(String(120), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    request_id: Mapped[str | None] = mapped_column(String(160), nullable=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finalized_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class CreditLedgerEntry(Base):
    __tablename__ = "credit_ledger_entries"
    __table_args__ = (
        CheckConstraint(
            "event_type IN "
            "('grant','reserve','consume','release','refund','expire','admin_adjustment')",
            name="event_type",
        ),
        CheckConstraint("amount > 0", name="amount_positive"),
        CheckConstraint(
            "available_delta <> 0 OR reserved_delta <> 0",
            name="nonzero_delta",
        ),
        CheckConstraint(
            "event_type <> 'admin_adjustment' "
            "OR (reason IS NOT NULL AND length(trim(reason)) >= 3 "
            "AND actor_user_id IS NOT NULL)",
            name="admin_reason",
        ),
        CheckConstraint(
            "(event_type IN ('grant','refund') AND available_delta = amount "
            "AND reserved_delta = 0) "
            "OR (event_type = 'reserve' AND available_delta = -amount "
            "AND reserved_delta = amount) "
            "OR (event_type = 'consume' AND available_delta = 0 "
            "AND reserved_delta = -amount) "
            "OR (event_type = 'release' AND available_delta = amount "
            "AND reserved_delta = -amount) "
            "OR (event_type = 'expire' AND "
            "((available_delta = -amount AND reserved_delta = 0) "
            "OR (available_delta = amount AND reserved_delta = -amount))) "
            "OR (event_type = 'admin_adjustment' AND reserved_delta = 0 "
            "AND (available_delta = amount OR available_delta = -amount))",
            name="event_deltas",
        ),
        UniqueConstraint(
            "account_id",
            "idempotency_key",
            name="credit_ledger_entries_account_idempotency_key",
        ),
        Index("ix_credit_ledger_entries_account_created", "account_id", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    account_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("credit_accounts.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    reservation_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("credit_reservations.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    actor_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )
    event_type: Mapped[str] = mapped_column(String(24), nullable=False, index=True)
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    available_delta: Mapped[int] = mapped_column(BigInteger, nullable=False)
    reserved_delta: Mapped[int] = mapped_column(BigInteger, nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(200), nullable=False)
    feature_key: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    request_id: Mapped[str | None] = mapped_column(String(160), nullable=True, index=True)
    metadata_json: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )


class AiExecutionLease(Base):
    """Durable idempotency guard for AI calls that do not reserve HRing credits."""

    __tablename__ = "ai_execution_leases"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active','completed','failed')",
            name="ai_execution_leases_status",
        ),
        UniqueConstraint(
            "user_id",
            "feature_key",
            "idempotency_key",
            name="uq_ai_execution_leases_user_feature_key",
        ),
        Index("ix_ai_execution_leases_company_created", "company_id", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    feature_key: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    idempotency_key: Mapped[str] = mapped_column(String(160), nullable=False)
    request_id: Mapped[str | None] = mapped_column(String(160), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active", index=True)
    error_code: Mapped[str | None] = mapped_column(String(120), nullable=True)
    finalized_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
