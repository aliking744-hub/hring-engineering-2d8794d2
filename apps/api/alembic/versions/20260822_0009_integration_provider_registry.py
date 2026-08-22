"""Encrypted integration provider registry.

Revision ID: 20260822_0009
Revises: 20260822_0008
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260822_0009"
down_revision: str | None = "20260822_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "integration_providers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("provider_key", sa.String(length=120), nullable=False),
        sa.Column("display_name", sa.String(length=200), nullable=False),
        sa.Column("provider_type", sa.String(length=32), nullable=False),
        sa.Column("adapter", sa.String(length=80), nullable=False),
        sa.Column("base_url", sa.String(length=2048), nullable=True),
        sa.Column("default_model", sa.String(length=240), nullable=True),
        sa.Column("auth_scheme", sa.String(length=32), nullable=False, server_default="bearer"),
        sa.Column("secret_ciphertext", sa.Text(), nullable=True),
        sa.Column("secret_hint", sa.String(length=32), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_internal", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("timeout_seconds", sa.Integer(), nullable=False, server_default="15"),
        sa.Column("max_retries", sa.Integer(), nullable=False, server_default="2"),
        sa.Column(
            "capabilities_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "settings_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "quota_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="untested"),
        sa.Column("last_tested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_success_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "provider_type IN ("
            "'llm','embedding','image','search','crawler','ocr',"
            "'email','sms','payment','webhook'"
            ")",
            name="ck_integration_providers_integration_providers_type",
        ),
        sa.CheckConstraint(
            "auth_scheme IN ("
            "'none','bearer','x-api-key','api-key','x-goog-api-key'"
            ")",
            name="ck_integration_providers_integration_providers_auth_scheme",
        ),
        sa.CheckConstraint(
            "status IN ('untested','healthy','unhealthy','disabled')",
            name="ck_integration_providers_integration_providers_status",
        ),
        sa.CheckConstraint(
            "priority >= 0",
            name="ck_integration_providers_integration_providers_priority_nonnegative",
        ),
        sa.CheckConstraint(
            "timeout_seconds BETWEEN 1 AND 60",
            name="ck_integration_providers_integration_providers_timeout_range",
        ),
        sa.CheckConstraint(
            "max_retries BETWEEN 0 AND 10",
            name="ck_integration_providers_integration_providers_retries_range",
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("provider_key", name="uq_integration_providers_provider_key"),
    )
    op.create_index(
        "ix_integration_providers_provider_key",
        "integration_providers",
        ["provider_key"],
    )
    op.create_index(
        "ix_integration_providers_provider_type",
        "integration_providers",
        ["provider_type"],
    )
    op.create_index(
        "ix_integration_providers_is_active",
        "integration_providers",
        ["is_active"],
    )
    op.create_index(
        "ix_integration_providers_status",
        "integration_providers",
        ["status"],
    )


def downgrade() -> None:
    op.drop_index("ix_integration_providers_status", table_name="integration_providers")
    op.drop_index("ix_integration_providers_is_active", table_name="integration_providers")
    op.drop_index("ix_integration_providers_provider_type", table_name="integration_providers")
    op.drop_index("ix_integration_providers_provider_key", table_name="integration_providers")
    op.drop_table("integration_providers")
