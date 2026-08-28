"""Seed the native legal advisor prompt draft.

Revision ID: 20260828_0022
Revises: 20260828_0021
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from uuid import UUID, uuid5

import sqlalchemy as sa
from alembic import op


revision: str = "20260828_0022"
down_revision: str | None = "20260828_0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PROMPT_KEY = "legal.advisor_chat"
SEED_NAMESPACE = UUID("8375e9c4-c766-4b45-98ab-41666cb34096")

SYSTEM_TEMPLATE = """شما یک مشاور حقوقی متخصص در قوانین کار ایران هستید. بر اساس متون قانونی ارائه شده، به سوالات کاربران پاسخ دهید.

قوانین پاسخگویی:
1. فقط بر اساس متون قانونی ارائه شده پاسخ دهید
2. اگر اطلاعات کافی در متون نیست، صادقانه بگویید
3. شماره ماده قانونی را ذکر کنید
4. پاسخ را ساده و قابل فهم بنویسید
5. اگر موضوع پیچیده است، توصیه به مشاوره با وکیل کنید
6. متن استخراج‌شده از تصویر یا PDF پیوست‌شده را تحلیل کنید و در پاسخ لحاظ کنید"""

USER_TEMPLATE = """متون قانونی مرتبط:
{legal_context}

---

سابقه مکالمه:
{conversation_history}

---

متن پیوست‌ها:
{attachment_context}

---

سوال کاربر: {query}"""


def _seed_id(kind: str) -> str:
    return str(uuid5(SEED_NAMESPACE, f"{kind}:{PROMPT_KEY}"))


def upgrade() -> None:
    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            INSERT INTO ai_prompts (
                id, prompt_key, feature_key, display_name, description, is_active
            ) VALUES (
                CAST(:id AS uuid), :prompt_key, :feature_key,
                :display_name, :description, TRUE
            )
            ON CONFLICT (prompt_key) DO NOTHING
            """
        ),
        {
            "id": _seed_id("prompt"),
            "prompt_key": PROMPT_KEY,
            "feature_key": PROMPT_KEY,
            "display_name": "مشاور حقوقی مستند",
            "description": "پاسخ مبتنی بر اسناد قانون کار، مکالمه و پیوست‌ها.",
        },
    )
    connection.execute(
        sa.text(
            """
            INSERT INTO ai_prompt_versions (
                id, prompt_id, version, status, provider_alias, model,
                system_template, user_template, input_variables_json,
                response_format, output_schema_json, temperature,
                max_output_tokens, test_status
            )
            SELECT
                CAST(:id AS uuid), prompt.id, 1, 'draft', 'gemini',
                'gemini-2.5-flash', :system_template, :user_template,
                CAST(:input_variables AS jsonb), 'text', NULL, NULL,
                2000, 'untested'
            FROM ai_prompts AS prompt
            WHERE prompt.prompt_key = :prompt_key
              AND NOT EXISTS (
                  SELECT 1 FROM ai_prompt_versions AS version
                  WHERE version.prompt_id = prompt.id
              )
            """
        ),
        {
            "id": _seed_id("version-1"),
            "prompt_key": PROMPT_KEY,
            "system_template": SYSTEM_TEMPLATE,
            "user_template": USER_TEMPLATE,
            "input_variables": json.dumps(
                [
                    "legal_context",
                    "conversation_history",
                    "attachment_context",
                    "query",
                ]
            ),
        },
    )


def downgrade() -> None:
    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            DELETE FROM ai_prompt_versions AS version
            USING ai_prompts AS prompt
            WHERE version.prompt_id = prompt.id
              AND prompt.prompt_key = :prompt_key
              AND prompt.created_by IS NULL
              AND prompt.updated_by IS NULL
              AND version.version = 1
              AND version.status = 'draft'
              AND version.test_status = 'untested'
              AND version.created_by IS NULL
              AND version.published_by IS NULL
              AND version.last_tested_at IS NULL
            """
        ),
        {"prompt_key": PROMPT_KEY},
    )
    connection.execute(
        sa.text(
            """
            DELETE FROM ai_prompts AS prompt
            WHERE prompt.prompt_key = :prompt_key
              AND prompt.created_by IS NULL
              AND prompt.updated_by IS NULL
              AND NOT EXISTS (
                  SELECT 1 FROM ai_prompt_versions AS version
                  WHERE version.prompt_id = prompt.id
              )
            """
        ),
        {"prompt_key": PROMPT_KEY},
    )
