"""Add private workspace output history.

Revision ID: 20260904_0036
Revises: 20260904_0035
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260904_0036"
down_revision: str | None = "20260904_0035"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "workspace_outputs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "owner_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "company_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("companies.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("feature_key", sa.String(length=120), nullable=False),
        sa.Column("idempotency_hash", sa.String(length=64), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("payload_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint(
            "owner_user_id",
            "feature_key",
            "idempotency_hash",
            name="uq_workspace_outputs_owner_feature_idempotency",
        ),
    )
    op.create_index("ix_workspace_outputs_owner_user_id", "workspace_outputs", ["owner_user_id"])
    op.create_index("ix_workspace_outputs_company_id", "workspace_outputs", ["company_id"])
    op.create_index("ix_workspace_outputs_feature_key", "workspace_outputs", ["feature_key"])
    op.create_index("ix_workspace_outputs_created_at", "workspace_outputs", ["created_at"])
    op.create_index(
        "ix_workspace_outputs_owner_feature_created",
        "workspace_outputs",
        ["owner_user_id", "feature_key", "created_at"],
    )


def downgrade() -> None:
    op.drop_table("workspace_outputs")
