"""Add durable idempotency leases for zero-credit AI execution.

Revision ID: 20260829_0029
Revises: 20260829_0028
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260829_0029"
down_revision: str | None = "20260829_0028"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ai_execution_leases",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("feature_key", sa.String(length=120), nullable=False),
        sa.Column("idempotency_key", sa.String(length=160), nullable=False),
        sa.Column("request_id", sa.String(length=160), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("error_code", sa.String(length=120), nullable=True),
        sa.Column("finalized_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "status IN ('active','completed','failed')",
            name="ai_execution_leases_status",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "feature_key",
            "idempotency_key",
            name="uq_ai_execution_leases_user_feature_key",
        ),
    )
    op.create_index("ix_ai_execution_leases_user_id", "ai_execution_leases", ["user_id"])
    op.create_index("ix_ai_execution_leases_company_id", "ai_execution_leases", ["company_id"])
    op.create_index("ix_ai_execution_leases_feature_key", "ai_execution_leases", ["feature_key"])
    op.create_index("ix_ai_execution_leases_request_id", "ai_execution_leases", ["request_id"])
    op.create_index("ix_ai_execution_leases_status", "ai_execution_leases", ["status"])
    op.create_index(
        "ix_ai_execution_leases_company_created",
        "ai_execution_leases",
        ["company_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_ai_execution_leases_company_created", table_name="ai_execution_leases")
    op.drop_index("ix_ai_execution_leases_status", table_name="ai_execution_leases")
    op.drop_index("ix_ai_execution_leases_request_id", table_name="ai_execution_leases")
    op.drop_index("ix_ai_execution_leases_feature_key", table_name="ai_execution_leases")
    op.drop_index("ix_ai_execution_leases_company_id", table_name="ai_execution_leases")
    op.drop_index("ix_ai_execution_leases_user_id", table_name="ai_execution_leases")
    op.drop_table("ai_execution_leases")
