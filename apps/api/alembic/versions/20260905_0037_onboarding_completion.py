"""Add onboarding workflow completion state.

Revision ID: 20260905_0037
Revises: 20260904_0036
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260905_0037"
down_revision: str | None = "20260904_0036"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "development_onboarding_plans",
        sa.Column("status", sa.String(length=24), nullable=False, server_default="active"),
    )
    op.add_column("development_onboarding_plans", sa.Column("score", sa.Integer(), nullable=True))
    op.add_column(
        "development_onboarding_plans",
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint(
        "ck_development_onboarding_plans_status",
        "development_onboarding_plans",
        "status IN ('active','completed','failed')",
    )
    op.create_check_constraint(
        "ck_development_onboarding_plans_score",
        "development_onboarding_plans",
        "score IS NULL OR (score >= 0 AND score <= 100)",
    )
    op.create_index(
        "ix_development_onboarding_plans_status",
        "development_onboarding_plans",
        ["status"],
    )
    op.alter_column("development_onboarding_plans", "status", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_development_onboarding_plans_status", table_name="development_onboarding_plans")
    op.drop_constraint("ck_development_onboarding_plans_score", "development_onboarding_plans", type_="check")
    op.drop_constraint("ck_development_onboarding_plans_status", "development_onboarding_plans", type_="check")
    op.drop_column("development_onboarding_plans", "completed_at")
    op.drop_column("development_onboarding_plans", "score")
    op.drop_column("development_onboarding_plans", "status")
