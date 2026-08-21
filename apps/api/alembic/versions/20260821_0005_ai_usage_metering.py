"""AI usage ledger and historical rate cards.

Revision ID: 20260821_0005
Revises: 20260821_0004
Create Date: 2026-08-21
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260821_0005"
down_revision: str | None = "20260821_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ai_rate_cards",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider", sa.String(length=64), nullable=False),
        sa.Column("model", sa.String(length=160), nullable=False),
        sa.Column("metric", sa.String(length=64), nullable=False),
        sa.Column("unit_size", sa.BigInteger(), nullable=False),
        sa.Column("cost_microusd", sa.BigInteger(), nullable=False),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=False),
        sa.Column("effective_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("unit_size > 0", name="ck_ai_rate_cards_unit_size_positive"),
        sa.CheckConstraint("cost_microusd >= 0", name="ck_ai_rate_cards_cost_nonnegative"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "provider",
            "model",
            "metric",
            "effective_from",
            name="uq_ai_rate_cards_version",
        ),
    )
    op.create_index("ix_ai_rate_cards_provider", "ai_rate_cards", ["provider"], unique=False)
    op.create_index("ix_ai_rate_cards_model", "ai_rate_cards", ["model"], unique=False)
    op.create_index("ix_ai_rate_cards_metric", "ai_rate_cards", ["metric"], unique=False)

    op.create_table(
        "ai_usage_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("request_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("feature_key", sa.String(length=120), nullable=False),
        sa.Column("provider", sa.String(length=64), nullable=False),
        sa.Column("model", sa.String(length=160), nullable=False),
        sa.Column("operation", sa.String(length=48), server_default="generate", nullable=False),
        sa.Column(
            "metrics_json",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("provider_cost_microusd", sa.BigInteger(), nullable=True),
        sa.Column("estimated_cost_microusd", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("credits_charged", sa.Integer(), server_default="0", nullable=False),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="success", nullable=False),
        sa.Column("error_code", sa.String(length=100), nullable=True),
        sa.Column(
            "metadata_json",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('success','failure')", name="ck_ai_usage_events_status"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("request_id", name="uq_ai_usage_events_request_id"),
    )
    op.create_index("ix_ai_usage_events_request_id", "ai_usage_events", ["request_id"], unique=False)
    op.create_index("ix_ai_usage_events_company_id", "ai_usage_events", ["company_id"], unique=False)
    op.create_index("ix_ai_usage_events_user_id", "ai_usage_events", ["user_id"], unique=False)
    op.create_index("ix_ai_usage_events_feature_key", "ai_usage_events", ["feature_key"], unique=False)
    op.create_index("ix_ai_usage_events_provider", "ai_usage_events", ["provider"], unique=False)
    op.create_index("ix_ai_usage_events_model", "ai_usage_events", ["model"], unique=False)
    op.create_index("ix_ai_usage_events_created_at", "ai_usage_events", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_ai_usage_events_created_at", table_name="ai_usage_events")
    op.drop_index("ix_ai_usage_events_model", table_name="ai_usage_events")
    op.drop_index("ix_ai_usage_events_provider", table_name="ai_usage_events")
    op.drop_index("ix_ai_usage_events_feature_key", table_name="ai_usage_events")
    op.drop_index("ix_ai_usage_events_user_id", table_name="ai_usage_events")
    op.drop_index("ix_ai_usage_events_company_id", table_name="ai_usage_events")
    op.drop_index("ix_ai_usage_events_request_id", table_name="ai_usage_events")
    op.drop_table("ai_usage_events")
    op.drop_index("ix_ai_rate_cards_metric", table_name="ai_rate_cards")
    op.drop_index("ix_ai_rate_cards_model", table_name="ai_rate_cards")
    op.drop_index("ix_ai_rate_cards_provider", table_name="ai_rate_cards")
    op.drop_table("ai_rate_cards")
