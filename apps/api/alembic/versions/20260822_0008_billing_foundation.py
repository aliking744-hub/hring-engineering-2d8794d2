"""Independent billing plans and payment ledger.

Revision ID: 20260822_0008
Revises: 20260821_0007
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260822_0008"
down_revision: str | None = "20260821_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    billing_plans = op.create_table(
        "billing_plans",
        sa.Column("plan_type", sa.String(length=80), primary_key=True, nullable=False),
        sa.Column("display_name", sa.String(length=160), nullable=False),
        sa.Column("scope", sa.String(length=20), nullable=False),
        sa.Column("price_toman", sa.Integer(), nullable=False),
        sa.Column("monthly_credits", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("scope IN ('individual','corporate')", name="ck_billing_plans_scope"),
        sa.CheckConstraint("price_toman >= 0", name="ck_billing_plans_price_nonnegative"),
        sa.CheckConstraint("monthly_credits >= 0", name="ck_billing_plans_credits_nonnegative"),
    )
    op.bulk_insert(
        billing_plans,
        [
            {
                "plan_type": "individual_free",
                "display_name": "رایگان فردی",
                "scope": "individual",
                "price_toman": 0,
                "monthly_credits": 50,
                "is_active": True,
            },
            {
                "plan_type": "individual_pro",
                "display_name": "حرفه‌ای فردی",
                "scope": "individual",
                "price_toman": 490000,
                "monthly_credits": 600,
                "is_active": True,
            },
            {
                "plan_type": "individual_plus",
                "display_name": "پلاس فردی",
                "scope": "individual",
                "price_toman": 990000,
                "monthly_credits": 2500,
                "is_active": True,
            },
            {
                "plan_type": "corporate_expert",
                "display_name": "سازمانی کارشناس",
                "scope": "corporate",
                "price_toman": 1490000,
                "monthly_credits": 1000,
                "is_active": True,
            },
            {
                "plan_type": "corporate_decision_support",
                "display_name": "سازمانی پشتیبان تصمیم",
                "scope": "corporate",
                "price_toman": 2990000,
                "monthly_credits": 3000,
                "is_active": True,
            },
            {
                "plan_type": "corporate_decision_making",
                "display_name": "سازمانی تصمیم‌ساز",
                "scope": "corporate",
                "price_toman": 5990000,
                "monthly_credits": 10000,
                "is_active": True,
            },
        ],
    )

    op.create_table(
        "payment_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("provider", sa.String(length=40), nullable=False, server_default="zarinpal"),
        sa.Column("amount_toman", sa.Integer(), nullable=False),
        sa.Column("plan_type", sa.String(length=80), nullable=False),
        sa.Column("authority", sa.String(length=160), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("ref_id", sa.String(length=160), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('pending','verified','failed','cancelled')",
            name="ck_payment_transactions_status",
        ),
        sa.CheckConstraint("amount_toman > 0", name="ck_payment_transactions_amount_positive"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["plan_type"], ["billing_plans.plan_type"], ondelete="RESTRICT"),
        sa.UniqueConstraint("authority", name="uq_payment_transactions_authority"),
    )
    op.create_index("ix_payment_transactions_user_id", "payment_transactions", ["user_id"])
    op.create_index("ix_payment_transactions_company_id", "payment_transactions", ["company_id"])
    op.create_index("ix_payment_transactions_authority", "payment_transactions", ["authority"])
    op.create_index("ix_payment_transactions_status", "payment_transactions", ["status"])


def downgrade() -> None:
    op.drop_index("ix_payment_transactions_status", table_name="payment_transactions")
    op.drop_index("ix_payment_transactions_authority", table_name="payment_transactions")
    op.drop_index("ix_payment_transactions_company_id", table_name="payment_transactions")
    op.drop_index("ix_payment_transactions_user_id", table_name="payment_transactions")
    op.drop_table("payment_transactions")
    op.drop_table("billing_plans")
