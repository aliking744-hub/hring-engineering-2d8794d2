"""Versioned AI prompt registry.

Revision ID: 20260822_0010
Revises: 20260822_0009
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260822_0010"
down_revision: str | None = "20260822_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ai_prompts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("prompt_key", sa.String(length=120), nullable=False),
        sa.Column("feature_key", sa.String(length=120), nullable=False),
        sa.Column("display_name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("prompt_key", name="uq_ai_prompts_prompt_key"),
    )
    op.create_index("ix_ai_prompts_prompt_key", "ai_prompts", ["prompt_key"])
    op.create_index("ix_ai_prompts_feature_key", "ai_prompts", ["feature_key"])
    op.create_index("ix_ai_prompts_is_active", "ai_prompts", ["is_active"])

    op.create_table(
        "ai_prompt_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("prompt_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("provider_alias", sa.String(length=120), nullable=False),
        sa.Column("model", sa.String(length=240), nullable=False),
        sa.Column("system_template", sa.Text(), nullable=True),
        sa.Column("user_template", sa.Text(), nullable=False),
        sa.Column(
            "input_variables_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("response_format", sa.String(length=20), nullable=False, server_default="text"),
        sa.Column(
            "output_schema_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("temperature", sa.Float(), nullable=True),
        sa.Column("max_output_tokens", sa.Integer(), nullable=True),
        sa.Column("test_status", sa.String(length=20), nullable=False, server_default="untested"),
        sa.Column("last_tested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_test_error", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("published_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('draft','published','archived')",
            name="ck_ai_prompt_versions_ai_prompt_versions_status",
        ),
        sa.CheckConstraint(
            "test_status IN ('untested','passed','failed')",
            name="ck_ai_prompt_versions_ai_prompt_versions_test_status",
        ),
        sa.CheckConstraint(
            "response_format IN ('text','json_object')",
            name="ck_ai_prompt_versions_ai_prompt_versions_response_format",
        ),
        sa.CheckConstraint(
            "temperature IS NULL OR (temperature >= 0 AND temperature <= 2)",
            name="ck_ai_prompt_versions_ai_prompt_versions_temperature_range",
        ),
        sa.CheckConstraint(
            "max_output_tokens IS NULL OR (max_output_tokens >= 1 AND max_output_tokens <= 200000)",
            name="ck_ai_prompt_versions_ai_prompt_versions_max_tokens_range",
        ),
        sa.CheckConstraint(
            "version >= 1",
            name="ck_ai_prompt_versions_ai_prompt_versions_version_positive",
        ),
        sa.ForeignKeyConstraint(["prompt_id"], ["ai_prompts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["published_by"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint(
            "prompt_id",
            "version",
            name="uq_ai_prompt_versions_prompt_version",
        ),
    )
    op.create_index(
        "ix_ai_prompt_versions_prompt_id",
        "ai_prompt_versions",
        ["prompt_id"],
    )
    op.create_index(
        "ix_ai_prompt_versions_status",
        "ai_prompt_versions",
        ["status"],
    )
    op.create_index(
        "uq_ai_prompt_versions_one_draft",
        "ai_prompt_versions",
        ["prompt_id"],
        unique=True,
        postgresql_where=sa.text("status = 'draft'"),
    )
    op.create_index(
        "uq_ai_prompt_versions_one_published",
        "ai_prompt_versions",
        ["prompt_id"],
        unique=True,
        postgresql_where=sa.text("status = 'published'"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_ai_prompt_versions_one_published",
        table_name="ai_prompt_versions",
    )
    op.drop_index(
        "uq_ai_prompt_versions_one_draft",
        table_name="ai_prompt_versions",
    )
    op.drop_index("ix_ai_prompt_versions_status", table_name="ai_prompt_versions")
    op.drop_index("ix_ai_prompt_versions_prompt_id", table_name="ai_prompt_versions")
    op.drop_table("ai_prompt_versions")
    op.drop_index("ix_ai_prompts_is_active", table_name="ai_prompts")
    op.drop_index("ix_ai_prompts_feature_key", table_name="ai_prompts")
    op.drop_index("ix_ai_prompts_prompt_key", table_name="ai_prompts")
    op.drop_table("ai_prompts")
