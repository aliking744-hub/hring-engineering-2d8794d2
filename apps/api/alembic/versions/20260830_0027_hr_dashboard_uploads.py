"""Store private HR dashboard upload snapshots independently.

Revision ID: 20260830_0027
Revises: 20260829_0026
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260830_0027"
down_revision: str | None = "20260829_0026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

def upgrade() -> None:
    op.create_table(
        "hr_dashboard_uploads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=500), nullable=False),
        sa.Column("employee_count", sa.Integer(), nullable=False),
        sa.Column("data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.CheckConstraint("employee_count >= 0", name="ck_hr_dashboard_uploads_employee_count"),
    )
    op.create_index("ix_hr_dashboard_uploads_owner_user_id", "hr_dashboard_uploads", ["owner_user_id"])
    op.create_index("ix_hr_dashboard_uploads_created_at", "hr_dashboard_uploads", ["created_at"])

def downgrade() -> None:
    op.drop_index("ix_hr_dashboard_uploads_created_at", table_name="hr_dashboard_uploads")
    op.drop_index("ix_hr_dashboard_uploads_owner_user_id", table_name="hr_dashboard_uploads")
    op.drop_table("hr_dashboard_uploads")
