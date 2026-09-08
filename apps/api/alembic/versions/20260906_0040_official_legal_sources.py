"""Require official legal sources and strengthen legal-advisor responses.

Revision ID: 20260906_0040
Revises: 20260906_0039
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260906_0040"
down_revision: str | None = "20260906_0039"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PROMPT_KEY = "legal.advisor_chat"

SYSTEM_TEMPLATE = """شما دستیار تحلیل حقوق کار و تامین اجتماعی ایران هستید. فقط بر اساس منابع رسمی شماره‌گذاری‌شده ارائه‌شده پاسخ دهید و از حافظه عمومی مدل برای ساخت حکم، ماده، رای، تاریخ یا عدد استفاده نکنید.

قواعد الزامی:
1. هر گزاره حقوقی باید بلافاصله ارجاعی مانند [1] یا [2] داشته باشد.
2. شماره ماده، تبصره، تاریخ و شماره رای را فقط وقتی عیناً در منبع آمده ذکر کنید.
3. میان نص قانون، رای یا مقرره، تحلیل و پیشنهاد عملی مرزبندی روشن داشته باشید.
4. اگر منابع کافی نیستند، اعلام کنید «منبع رسمی کافی در پایگاه موجود نیست».
5. هیچ وب‌سایت، ماده، رای، تاریخ، مهلت یا مبلغی را حدس نزنید.

قالب اجباری پاسخ:
### نتیجه کوتاه
### مستند قانونی
### تحلیل وضعیت
### استثناها و ریسک‌ها
### اقدام پیشنهادی"""

OLD_SYSTEM_TEMPLATE = """شما یک مشاور حقوقی متخصص در قوانین کار ایران هستید. بر اساس متون قانونی ارائه شده، به سوالات کاربران پاسخ دهید.

قوانین پاسخگویی:
1. فقط بر اساس متون قانونی ارائه شده پاسخ دهید
2. اگر اطلاعات کافی در متون نیست، صادقانه بگویید
3. شماره ماده قانونی را ذکر کنید
4. پاسخ را ساده و قابل فهم بنویسید
5. اگر موضوع پیچیده است، توصیه به مشاوره با وکیل کنید
6. متن استخراج‌شده از تصویر یا PDF پیوست‌شده را تحلیل کنید و در پاسخ لحاظ کنید"""


def upgrade() -> None:
    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            UPDATE legal_sources
            SET status = 'superseded', updated_at = now()
            WHERE status = 'active'
              AND (
                source_url IS NULL
                OR source_url !~*
                  '^https://(www\\.)?(mcls\\.gov\\.ir|qavanin\\.ir|divan-edalat\\.ir)(/|$)'
              )
            """
        )
    )
    connection.execute(
        sa.text(
            """
            UPDATE ai_prompt_versions AS version
            SET system_template = :system_template,
                test_status = 'untested'
            FROM ai_prompts AS prompt
            WHERE version.prompt_id = prompt.id
              AND prompt.prompt_key = :prompt_key
            """
        ),
        {"prompt_key": PROMPT_KEY, "system_template": SYSTEM_TEMPLATE},
    )


def downgrade() -> None:
    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            UPDATE ai_prompt_versions AS version
            SET system_template = :system_template,
                test_status = 'untested'
            FROM ai_prompts AS prompt
            WHERE version.prompt_id = prompt.id
              AND prompt.prompt_key = :prompt_key
            """
        ),
        {"prompt_key": PROMPT_KEY, "system_template": OLD_SYSTEM_TEMPLATE},
    )
