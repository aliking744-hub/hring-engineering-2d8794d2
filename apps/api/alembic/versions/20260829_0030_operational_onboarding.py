"""Make onboarding plans operational with tasks and task history.

Revision ID: 20260829_0030
Revises: 20260829_0029
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260829_0030"
down_revision: str | None = "20260829_0029"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "development_onboarding_plans",
        sa.Column("employee_name", sa.Text(), nullable=True),
    )
    op.add_column(
        "development_onboarding_plans",
        sa.Column("employee_email", sa.String(length=320), nullable=True),
    )
    op.add_column(
        "development_onboarding_plans",
        sa.Column("starts_on", sa.Date(), nullable=True),
    )
    op.create_index(
        "ix_development_onboarding_plans_starts_on",
        "development_onboarding_plans",
        ["starts_on"],
    )
    op.create_table(
        "development_onboarding_tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("assignee_label", sa.Text(), nullable=True),
        sa.Column("due_on", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="todo"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "status IN ('todo','in_progress','completed','blocked')",
            name="status",
        ),
        sa.CheckConstraint("sort_order >= 0", name="sort_order"),
        sa.ForeignKeyConstraint(
            ["plan_id"],
            ["development_onboarding_plans.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_development_onboarding_tasks_plan_id",
        "development_onboarding_tasks",
        ["plan_id"],
    )
    op.create_index(
        "ix_development_onboarding_tasks_company_id",
        "development_onboarding_tasks",
        ["company_id"],
    )
    op.create_index(
        "ix_development_onboarding_tasks_due_on",
        "development_onboarding_tasks",
        ["due_on"],
    )
    op.create_index(
        "ix_development_onboarding_tasks_status",
        "development_onboarding_tasks",
        ["status"],
    )
    op.create_index(
        "ix_development_onboarding_tasks_created_at",
        "development_onboarding_tasks",
        ["created_at"],
    )
    op.create_table(
        "development_onboarding_task_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event_type", sa.String(length=24), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "event_type IN ('created','updated','completed','reopened','deleted')",
            name="event_type",
        ),
        sa.ForeignKeyConstraint(
            ["task_id"],
            ["development_onboarding_tasks.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_development_onboarding_task_events_task_id",
        "development_onboarding_task_events",
        ["task_id"],
    )
    op.create_index(
        "ix_development_onboarding_task_events_actor_user_id",
        "development_onboarding_task_events",
        ["actor_user_id"],
    )
    op.create_index(
        "ix_development_onboarding_task_events_created_at",
        "development_onboarding_task_events",
        ["created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_development_onboarding_task_events_created_at",
        table_name="development_onboarding_task_events",
    )
    op.drop_index(
        "ix_development_onboarding_task_events_actor_user_id",
        table_name="development_onboarding_task_events",
    )
    op.drop_index(
        "ix_development_onboarding_task_events_task_id",
        table_name="development_onboarding_task_events",
    )
    op.drop_table("development_onboarding_task_events")
    op.drop_index(
        "ix_development_onboarding_tasks_created_at",
        table_name="development_onboarding_tasks",
    )
    op.drop_index(
        "ix_development_onboarding_tasks_status",
        table_name="development_onboarding_tasks",
    )
    op.drop_index(
        "ix_development_onboarding_tasks_due_on",
        table_name="development_onboarding_tasks",
    )
    op.drop_index(
        "ix_development_onboarding_tasks_company_id",
        table_name="development_onboarding_tasks",
    )
    op.drop_index(
        "ix_development_onboarding_tasks_plan_id",
        table_name="development_onboarding_tasks",
    )
    op.drop_table("development_onboarding_tasks")
    op.drop_index(
        "ix_development_onboarding_plans_starts_on",
        table_name="development_onboarding_plans",
    )
    op.drop_column("development_onboarding_plans", "starts_on")
    op.drop_column("development_onboarding_plans", "employee_email")
    op.drop_column("development_onboarding_plans", "employee_name")
