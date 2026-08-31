"""Persist recruiting sourcing callback runs.

Revision ID: 20260831_0031
Revises: 20260829_0030
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260831_0031"
down_revision: str | None = "20260829_0030"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "recruiting_source_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source", sa.String(length=80), nullable=False, server_default="webhook"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="requested"),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("callback_key_hash", sa.String(length=64), nullable=False),
        sa.Column("request_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("received_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "status IN ('requested','accepted','received','failed')",
            name="ck_recruiting_source_runs_status",
        ),
        sa.ForeignKeyConstraint(["campaign_id"], ["recruiting_campaigns.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("idempotency_key"),
    )
    op.create_index("ix_recruiting_source_runs_campaign_id", "recruiting_source_runs", ["campaign_id"])
    op.create_index("ix_recruiting_source_runs_owner_user_id", "recruiting_source_runs", ["owner_user_id"])
    op.create_index("ix_recruiting_source_runs_status", "recruiting_source_runs", ["status"])
    op.create_index("ix_recruiting_source_runs_created_at", "recruiting_source_runs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_recruiting_source_runs_created_at", table_name="recruiting_source_runs")
    op.drop_index("ix_recruiting_source_runs_status", table_name="recruiting_source_runs")
    op.drop_index("ix_recruiting_source_runs_owner_user_id", table_name="recruiting_source_runs")
    op.drop_index("ix_recruiting_source_runs_campaign_id", table_name="recruiting_source_runs")
    op.drop_table("recruiting_source_runs")
