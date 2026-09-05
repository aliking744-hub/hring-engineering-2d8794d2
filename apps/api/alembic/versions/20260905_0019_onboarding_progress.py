"""Add durable onboarding progress and completion outcome.

Revision ID: 20260905_0019
Revises: 20260827_0018
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260905_0019"
down_revision: str | None = "20260827_0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "development_onboarding_plans",
        sa.Column("progress", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.add_column("development_onboarding_plans", sa.Column("status", sa.String(length=20), nullable=False, server_default="active"))
    op.add_column("development_onboarding_plans", sa.Column("score", sa.Integer(), nullable=True))
    op.add_column("development_onboarding_plans", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    op.create_check_constraint("ck_development_onboarding_plans_status", "development_onboarding_plans", "status IN ('active','completed','failed')")
    op.create_check_constraint("ck_development_onboarding_plans_score", "development_onboarding_plans", "score IS NULL OR (score >= 0 AND score <= 100)")
    op.alter_column("development_onboarding_plans", "progress", server_default=None)
    op.alter_column("development_onboarding_plans", "status", server_default=None)


def downgrade() -> None:
    op.drop_constraint("ck_development_onboarding_plans_score", "development_onboarding_plans", type_="check")
    op.drop_constraint("ck_development_onboarding_plans_status", "development_onboarding_plans", type_="check")
    op.drop_column("development_onboarding_plans", "completed_at")
    op.drop_column("development_onboarding_plans", "score")
    op.drop_column("development_onboarding_plans", "status")
    op.drop_column("development_onboarding_plans", "progress")
