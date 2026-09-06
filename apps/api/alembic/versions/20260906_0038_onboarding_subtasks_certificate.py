"""Add onboarding subtasks and completion certificates.

Revision ID: 20260906_0038
Revises: 20260905_0037
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260906_0038"
down_revision: str | None = "20260905_0037"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "development_onboarding_tasks",
        sa.Column("parent_task_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "fk_development_onboarding_tasks_parent",
        "development_onboarding_tasks",
        "development_onboarding_tasks",
        ["parent_task_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        "ix_development_onboarding_tasks_parent_task_id",
        "development_onboarding_tasks",
        ["parent_task_id"],
    )
    op.add_column(
        "development_onboarding_plans",
        sa.Column("certificate_number", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "development_onboarding_plans",
        sa.Column("certificate_recipient_title", sa.String(length=8), nullable=True),
    )
    op.add_column(
        "development_onboarding_plans",
        sa.Column("certificate_issued_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_unique_constraint(
        "uq_development_onboarding_plans_certificate_number",
        "development_onboarding_plans",
        ["certificate_number"],
    )
    # Preserve active plans already created before this release: organize their
    # flat checklist under the three 30/60/90-day stages immediately.
    op.execute(
        """
        INSERT INTO development_onboarding_tasks
            (id, plan_id, company_id, title, details, assignee_label, due_on,
             status, sort_order, created_at, updated_at)
        SELECT gen_random_uuid(), p.id, p.company_id, stage.title,
               'مرحله خودکار نقشه راه ۹۰ روزه', p.mentor_role,
               p.starts_on + stage.day_offset, 'todo', stage.stage_order,
               now(), now()
        FROM development_onboarding_plans AS p
        CROSS JOIN (VALUES
            ('روزهای ۱ تا ۳۰', 30, 0),
            ('روزهای ۳۱ تا ۶۰', 60, 1),
            ('روزهای ۶۱ تا ۹۰', 90, 2)
        ) AS stage(title, day_offset, stage_order)
        WHERE p.status = 'active'
          AND EXISTS (
              SELECT 1 FROM development_onboarding_tasks t
              WHERE t.plan_id = p.id AND t.parent_task_id IS NULL
          )
          AND NOT EXISTS (
              SELECT 1 FROM development_onboarding_tasks t
              WHERE t.plan_id = p.id AND t.parent_task_id IS NOT NULL
          )
        """
    )
    op.execute(
        """
        UPDATE development_onboarding_tasks AS child
        SET parent_task_id = parent.id
        FROM development_onboarding_tasks AS parent,
             development_onboarding_plans AS plan
        WHERE child.plan_id = parent.plan_id
          AND plan.id = child.plan_id
          AND plan.status = 'active'
          AND child.parent_task_id IS NULL
          AND child.details IS DISTINCT FROM 'مرحله خودکار نقشه راه ۹۰ روزه'
          AND parent.details = 'مرحله خودکار نقشه راه ۹۰ روزه'
          AND parent.title = CASE
              WHEN child.sort_order <= 1 THEN 'روزهای ۱ تا ۳۰'
              WHEN child.sort_order <= 3 THEN 'روزهای ۳۱ تا ۶۰'
              ELSE 'روزهای ۶۱ تا ۹۰'
          END
        """
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_development_onboarding_plans_certificate_number",
        "development_onboarding_plans",
        type_="unique",
    )
    op.drop_column("development_onboarding_plans", "certificate_issued_at")
    op.drop_column("development_onboarding_plans", "certificate_recipient_title")
    op.drop_column("development_onboarding_plans", "certificate_number")
    op.drop_index(
        "ix_development_onboarding_tasks_parent_task_id",
        table_name="development_onboarding_tasks",
    )
    op.drop_constraint(
        "fk_development_onboarding_tasks_parent",
        "development_onboarding_tasks",
        type_="foreignkey",
    )
    op.drop_column("development_onboarding_tasks", "parent_task_id")
