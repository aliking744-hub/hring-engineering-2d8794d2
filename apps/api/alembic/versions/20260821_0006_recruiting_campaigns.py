"""Recruiting campaigns and candidates.

Revision ID: 20260821_0006
Revises: 20260821_0005
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
        "recruiting_campaigns",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("city", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="processing"),
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("job_title", sa.Text(), nullable=True),
        sa.Column("industry", sa.Text(), nullable=True),
        sa.Column("experience_range", sa.Text(), nullable=True),
        sa.Column("education_level", sa.Text(), nullable=True),
        sa.Column("skills", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("auto_headhunting", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("progress >= 0 AND progress <= 100", name="ck_recruiting_campaigns_progress"),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_recruiting_campaigns_owner_user_id", "recruiting_campaigns", ["owner_user_id"])
    op.create_index("ix_recruiting_campaigns_company_id", "recruiting_campaigns", ["company_id"])
    op.create_index("ix_recruiting_campaigns_created_at", "recruiting_campaigns", ["created_at"])

    op.create_table(
        "recruiting_candidates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
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
        sa.Column("match_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("candidate_temperature", sa.String(length=20), nullable=False, server_default="cold"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("recommendation", sa.Text(), nullable=True),
        sa.Column("green_flags", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("red_flags", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("layer_scores", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("raw_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("match_score >= 0 AND match_score <= 100", name="ck_recruiting_candidates_match_score"),
        sa.CheckConstraint("status IN ('pending','approved','rejected','waiting')", name="ck_recruiting_candidates_status"),
        sa.ForeignKeyConstraint(["campaign_id"], ["recruiting_campaigns.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_recruiting_candidates_campaign_id", "recruiting_candidates", ["campaign_id"])
    op.create_index("ix_recruiting_candidates_match_score", "recruiting_candidates", ["match_score"])
    op.create_index("ix_recruiting_candidates_created_at", "recruiting_candidates", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_recruiting_candidates_created_at", table_name="recruiting_candidates")
    op.drop_index("ix_recruiting_candidates_match_score", table_name="recruiting_candidates")
    op.drop_index("ix_recruiting_candidates_campaign_id", table_name="recruiting_candidates")
    op.drop_table("recruiting_candidates")
    op.drop_index("ix_recruiting_campaigns_created_at", table_name="recruiting_campaigns")
    op.drop_index("ix_recruiting_campaigns_company_id", table_name="recruiting_campaigns")
    op.drop_index("ix_recruiting_campaigns_owner_user_id", table_name="recruiting_campaigns")
    op.drop_table("recruiting_campaigns")