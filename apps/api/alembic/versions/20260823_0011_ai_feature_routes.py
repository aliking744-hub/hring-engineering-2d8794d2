"""Admin-managed routing for every AI feature.

Revision ID: 20260823_0011
Revises: 20260822_0010
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260823_0011"
down_revision: str | None = "20260822_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ai_feature_routes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("feature_key", sa.String(length=120), nullable=False),
        sa.Column("provider_alias", sa.String(length=120), nullable=False),
        sa.Column("model", sa.String(length=240), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("feature_key", name="uq_ai_feature_routes_feature_key"),
    )
    op.create_index("ix_ai_feature_routes_feature_key", "ai_feature_routes", ["feature_key"])


def downgrade() -> None:
    op.drop_index("ix_ai_feature_routes_feature_key", table_name="ai_feature_routes")
    op.drop_table("ai_feature_routes")

