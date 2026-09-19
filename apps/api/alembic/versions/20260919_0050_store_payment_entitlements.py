"""Support paid digital-product entitlements without changing plan credits.

Revision ID: 20260919_0050
Revises: 20260914_0049
Create Date: 2026-09-19 20:10:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260919_0050"
down_revision = "20260914_0049"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "payment_transactions",
        sa.Column("purpose", sa.String(length=20), nullable=False, server_default="plan"),
    )
    op.add_column(
        "payment_transactions",
        sa.Column("product_id", sa.String(length=160), nullable=True),
    )
    op.alter_column("payment_transactions", "plan_type", existing_type=sa.String(length=80), nullable=True)
    op.create_index(
        "ix_payment_transactions_product_id",
        "payment_transactions",
        ["product_id"],
        unique=False,
    )
    op.create_check_constraint(
        "payment_transactions_purpose",
        "payment_transactions",
        "purpose IN ('plan','product')",
    )
    op.create_check_constraint(
        "payment_transactions_subject",
        "payment_transactions",
        "(purpose = 'plan' AND plan_type IS NOT NULL AND product_id IS NULL) "
        "OR (purpose = 'product' AND plan_type IS NULL AND product_id IS NOT NULL)",
    )
    op.alter_column("payment_transactions", "purpose", server_default=None)


def downgrade() -> None:
    op.drop_constraint("payment_transactions_subject", "payment_transactions", type_="check")
    op.drop_constraint("payment_transactions_purpose", "payment_transactions", type_="check")
    op.drop_index("ix_payment_transactions_product_id", table_name="payment_transactions")
    op.drop_column("payment_transactions", "product_id")
    op.drop_column("payment_transactions", "purpose")
    op.alter_column("payment_transactions", "plan_type", existing_type=sa.String(length=80), nullable=False)
