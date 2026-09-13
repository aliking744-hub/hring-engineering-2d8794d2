"""Add exact credit-plan validity timestamp.

Revision ID: 20260913_0045
Revises: 20260913_0044
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260913_0045"
down_revision: str | None = "20260913_0044"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "credit_accounts",
        sa.Column("valid_until", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_credit_accounts_valid_until",
        "credit_accounts",
        ["valid_until"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_credit_accounts_valid_until", table_name="credit_accounts")
    op.drop_column("credit_accounts", "valid_until")
