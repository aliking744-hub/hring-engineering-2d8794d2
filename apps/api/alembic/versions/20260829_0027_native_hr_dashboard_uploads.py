"""Move private HR dashboard uploads into the native database.

Revision ID: 20260829_0027
Revises: 20260829_0026
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260829_0027"
down_revision: str | None = "20260829_0026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "hr_data_uploads",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=240), nullable=False),
        sa.Column("employee_count", sa.Integer(), nullable=False),
        sa.Column("is_demo", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("records", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("employee_count >= 0 AND employee_count <= 2000", name="employee_count_range"),
        sa.CheckConstraint("jsonb_typeof(records) = 'array'", name="records_array"),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_hr_data_uploads_owner_user_id", "hr_data_uploads", ["owner_user_id"])
    op.create_index("ix_hr_data_uploads_company_id", "hr_data_uploads", ["company_id"])
    op.create_index("ix_hr_data_uploads_created_at", "hr_data_uploads", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_hr_data_uploads_created_at", table_name="hr_data_uploads")
    op.drop_index("ix_hr_data_uploads_company_id", table_name="hr_data_uploads")
    op.drop_index("ix_hr_data_uploads_owner_user_id", table_name="hr_data_uploads")
    op.drop_table("hr_data_uploads")
