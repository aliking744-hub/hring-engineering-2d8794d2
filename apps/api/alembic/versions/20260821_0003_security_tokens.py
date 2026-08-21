"""Add recovery and email verification security tokens.

Revision ID: 20260821_0003
Revises: 20260821_0002
Create Date: 2026-08-21
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260821_0003"
down_revision: str | None = "20260821_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_security_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("purpose", sa.String(length=32), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "purpose IN ('password_reset','email_verify')",
            name="ck_user_security_tokens_purpose",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_user_security_tokens_user_id_users",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_user_security_tokens"),
        sa.UniqueConstraint("token_hash", name="uq_user_security_tokens_token_hash"),
    )
    op.create_index(
        "ix_user_security_tokens_user_id",
        "user_security_tokens",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_user_security_tokens_purpose",
        "user_security_tokens",
        ["purpose"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_user_security_tokens_purpose", table_name="user_security_tokens")
    op.drop_index("ix_user_security_tokens_user_id", table_name="user_security_tokens")
    op.drop_table("user_security_tokens")
