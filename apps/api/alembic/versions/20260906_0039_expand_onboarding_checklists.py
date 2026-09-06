"""Expand active onboarding checklists with standard monthly tasks.

Revision ID: 20260906_0039
Revises: 20260906_0038
"""

from collections.abc import Sequence

from alembic import op


revision: str = "20260906_0039"
down_revision: str | None = "20260906_0038"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Existing active plans receive only the missing standard tasks. The bounded
    # CTE keeps every monthly stage at no more than ten children.
    op.execute(
        """
        WITH candidates(stage_title, task_title, priority) AS (
            VALUES
                ('روزهای ۱ تا ۳۰', 'آشنایی با سیاست‌ها، امنیت اطلاعات و آیین‌نامه‌های سازمان', 1),
                ('روزهای ۱ تا ۳۰', 'آموزش محصول یا خدمت، فرایندهای اصلی و نیاز مشتریان', 2),
                ('روزهای ۱ تا ۳۰', 'همراهی با همکار باتجربه و ثبت پرسش‌ها و آموخته‌ها', 3),
                ('روزهای ۳۱ تا ۶۰', 'تحویل یک خروجی سنجش‌پذیر متناسب با نقش', 1),
                ('روزهای ۳۱ تا ۶۰', 'همکاری با یک تیم یا ذی‌نفع بین‌واحدی', 2),
                ('روزهای ۳۱ تا ۶۰', 'مرور شاخص‌های کیفیت، زمان و عملکرد در جلسه میانی', 3),
                ('روزهای ۶۱ تا ۹۰', 'برنامه‌ریزی مستقل اولویت‌های هفتگی و گزارش پیشرفت', 1),
                ('روزهای ۶۱ تا ۹۰', 'حل یک مسئله واقعی یا پیشنهاد یک بهبود فرایندی', 2),
                ('روزهای ۶۱ تا ۹۰', 'مستندسازی آموخته‌ها و انتقال دانش به تیم', 3)
        ),
        missing AS (
            SELECT parent.id AS parent_id, parent.plan_id, parent.company_id,
                   parent.assignee_label, parent.due_on, candidate.task_title,
                   ROW_NUMBER() OVER (
                       PARTITION BY parent.id ORDER BY candidate.priority
                   ) AS missing_order,
                   (
                       SELECT COUNT(*)
                       FROM development_onboarding_tasks child
                       WHERE child.parent_task_id = parent.id
                   ) AS existing_count,
                   COALESCE(
                       (
                           SELECT MAX(child.sort_order)
                           FROM development_onboarding_tasks child
                           WHERE child.parent_task_id = parent.id
                       ),
                       -1
                   ) AS max_sort_order
            FROM development_onboarding_tasks parent
            JOIN development_onboarding_plans plan ON plan.id = parent.plan_id
            JOIN candidates candidate ON candidate.stage_title = parent.title
            WHERE plan.status = 'active'
              AND parent.parent_task_id IS NULL
              AND NOT EXISTS (
                  SELECT 1
                  FROM development_onboarding_tasks child
                  WHERE child.parent_task_id = parent.id
                    AND child.title = candidate.task_title
              )
        )
        INSERT INTO development_onboarding_tasks
            (id, plan_id, company_id, parent_task_id, title, assignee_label,
             due_on, status, sort_order, created_at, updated_at)
        SELECT gen_random_uuid(), plan_id, company_id, parent_id, task_title,
               assignee_label, due_on, 'todo', max_sort_order + missing_order,
               now(), now()
        FROM missing
        WHERE missing_order <= GREATEST(0, 10 - existing_count)
        """
    )


def downgrade() -> None:
    # Preserve task history; rolling back application code does not require
    # deleting checklist rows that users may already have completed.
    pass
