"""Persist private smart-ad images for authenticated history.

Revision ID: 20260904_0035
Revises: 20260904_0034
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260904_0035"
down_revision: str | None = "20260904_0034"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "job_ads_artifacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="SET NULL"), nullable=True),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("job_title", sa.Text(), nullable=False),
        sa.Column("company_name", sa.Text(), nullable=False),
        sa.Column("storage_path", sa.Text(), nullable=False, unique=True),
        sa.Column("content_type", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("owner_user_id", "idempotency_key", name="uq_job_ads_artifacts_owner_idempotency"),
    )
    op.create_index("ix_job_ads_artifacts_owner_user_id", "job_ads_artifacts", ["owner_user_id"])
    op.create_index("ix_job_ads_artifacts_company_id", "job_ads_artifacts", ["company_id"])
    op.create_index("ix_job_ads_artifacts_created_at", "job_ads_artifacts", ["created_at"])


def downgrade() -> None:
    op.drop_table("job_ads_artifacts")
