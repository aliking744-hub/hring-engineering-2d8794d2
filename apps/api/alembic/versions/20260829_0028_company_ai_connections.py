"""Add tenant-scoped encrypted AI provider connections.

Revision ID: 20260829_0028
Revises: 20260829_0027
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260829_0028"
down_revision: str | None = "20260829_0027"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "company_ai_connections",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("capability_key", sa.String(length=120), nullable=False),
        sa.Column("mode", sa.String(length=20), nullable=False, server_default="hring_managed"),
        sa.Column("provider_key", sa.String(length=120), nullable=True),
        sa.Column("adapter", sa.String(length=80), nullable=True),
        sa.Column("base_url", sa.String(length=2048), nullable=True),
        sa.Column("default_model", sa.String(length=240), nullable=True),
        sa.Column("auth_scheme", sa.String(length=32), nullable=False, server_default="bearer"),
        sa.Column("secret_ciphertext", sa.Text(), nullable=True),
        sa.Column("secret_hint", sa.String(length=32), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="untested"),
        sa.Column("last_tested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_success_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("mode IN ('byok','hring_managed')", name="company_ai_connections_mode"),
        sa.CheckConstraint("auth_scheme IN ('bearer','x-api-key','api-key','x-goog-api-key')", name="company_ai_connections_auth_scheme"),
        sa.CheckConstraint("status IN ('untested','healthy','unhealthy','disabled')", name="company_ai_connections_status"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_id", "capability_key", name="uq_company_ai_connections_capability"),
    )
    op.create_index("ix_company_ai_connections_company_id", "company_ai_connections", ["company_id"])
    op.create_index("ix_company_ai_connections_capability_key", "company_ai_connections", ["capability_key"])
    op.create_index("ix_company_ai_connections_is_active", "company_ai_connections", ["is_active"])
    op.create_index("ix_company_ai_connections_status", "company_ai_connections", ["status"])


def downgrade() -> None:
    op.drop_index("ix_company_ai_connections_status", table_name="company_ai_connections")
    op.drop_index("ix_company_ai_connections_is_active", table_name="company_ai_connections")
    op.drop_index("ix_company_ai_connections_capability_key", table_name="company_ai_connections")
    op.drop_index("ix_company_ai_connections_company_id", table_name="company_ai_connections")
    op.drop_table("company_ai_connections")
