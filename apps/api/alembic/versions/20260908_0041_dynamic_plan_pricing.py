"""Add dynamic USD plan pricing and exchange-rate history.

Revision ID: 20260908_0041
Revises: 20260906_0040
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260908_0041"
down_revision: str | None = "20260906_0040"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("billing_plans", sa.Column("price_usd_cents", sa.Integer(), nullable=True))
    op.create_check_constraint(
        "billing_plans_price_usd_nonnegative",
        "billing_plans",
        "price_usd_cents IS NULL OR price_usd_cents >= 0",
    )

    op.create_table(
        "billing_exchange_rate_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=40), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("automatic_rate_toman", sa.Integer(), nullable=True),
        sa.Column("manual_rate_toman", sa.Integer(), nullable=True),
        sa.Column("markup_toman", sa.Integer(), nullable=False),
        sa.Column("auto_refresh_enabled", sa.Boolean(), nullable=False),
        sa.Column("stale_after_hours", sa.Integer(), nullable=False),
        sa.Column("source_fetched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("id = 1", name="billing_exchange_rate_settings_singleton"),
        sa.CheckConstraint("markup_toman >= 0", name="billing_exchange_rate_markup_nonnegative"),
        sa.CheckConstraint(
            "automatic_rate_toman IS NULL OR automatic_rate_toman BETWEEN 10000 AND 10000000",
            name="billing_exchange_rate_automatic_bounds",
        ),
        sa.CheckConstraint(
            "manual_rate_toman IS NULL OR manual_rate_toman BETWEEN 10000 AND 10000000",
            name="billing_exchange_rate_manual_bounds",
        ),
        sa.CheckConstraint(
            "stale_after_hours BETWEEN 1 AND 168",
            name="billing_exchange_rate_stale_hours_bounds",
        ),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "billing_exchange_rate_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source", sa.String(length=40), nullable=False),
        sa.Column("rate_toman", sa.Integer(), nullable=False),
        sa.Column("source_fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("rate_toman BETWEEN 10000 AND 10000000", name="billing_rate_history_bounds"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_billing_rate_history_created",
        "billing_exchange_rate_history",
        ["created_at"],
    )
    op.execute(
        """
        INSERT INTO billing_exchange_rate_settings (
            id, source, source_url, markup_toman, auto_refresh_enabled, stale_after_hours
        ) VALUES (
            1, 'tgju', 'https://www.tgju.org/profile/price_dollar_rl', 10000, TRUE, 36
        )
        """
    )


def downgrade() -> None:
    op.drop_index("ix_billing_rate_history_created", table_name="billing_exchange_rate_history")
    op.drop_table("billing_exchange_rate_history")
    op.drop_table("billing_exchange_rate_settings")
    op.drop_constraint("billing_plans_price_usd_nonnegative", "billing_plans", type_="check")
    op.drop_column("billing_plans", "price_usd_cents")

