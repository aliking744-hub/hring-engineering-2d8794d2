"""Independent Smart Headhunting persistence.

Revision ID: 20260821_0006
Revises: 20260821_0005
Create Date: 2026-08-21
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260821_0006"
down_revision: str | None = "20260821_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "campaigns",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("city", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="processing", nullable=False),
        sa.Column("progress", sa.Integer(), server_default="0", nullable=False),
        sa.Column("job_title", sa.Text(), nullable=True),
        sa.Column("industry", sa.Text(), nullable=True),
        sa.Column("experience_range", sa.Text(), nullable=True),
        sa.Column("education_level", sa.Text(), nullable=True),
        sa.Column("skills", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("auto_headhunting", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('processing','active','paused')", name="campaigns_status"),
        sa.CheckConstraint("progress >= 0 AND progress <= 100", name="campaigns_progress"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_campaigns_user_id", "campaigns", ["user_id"], unique=False)
    op.create_index("ix_campaigns_company_id", "campaigns", ["company_id"], unique=False)

    op.create_table(
        "candidates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("email", sa.Text(), nullable=True),
        sa.Column("phone", sa.Text(), nullable=True),
        sa.Column("skills", sa.Text(), nullable=True),
        sa.Column("experience", sa.Text(), nullable=True),
        sa.Column("education", sa.Text(), nullable=True),
        sa.Column("last_company", sa.Text(), nullable=True),
        sa.Column("location", sa.Text(), nullable=True),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("match_score", sa.Integer(), server_default="0", nullable=False),
        sa.Column("candidate_temperature", sa.String(length=16), server_default="cold", nullable=False),
        sa.Column("recommendation", sa.Text(), nullable=True),
        sa.Column("green_flags", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("red_flags", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("layer_scores", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("raw_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "candidate_temperature IN ('hot','warm','cold')",
            name="candidates_temperature",
        ),
        sa.CheckConstraint("match_score >= 0 AND match_score <= 100", name="candidates_match_score"),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_candidates_campaign_id", "candidates", ["campaign_id"], unique=False)
    op.create_index("ix_candidates_match_score", "candidates", ["match_score"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_candidates_match_score", table_name="candidates")
    op.drop_index("ix_candidates_campaign_id", table_name="candidates")
    op.drop_table("candidates")
    op.drop_index("ix_campaigns_company_id", table_name="campaigns")
    op.drop_index("ix_campaigns_user_id", table_name="campaigns")
    op.drop_table("campaigns")
