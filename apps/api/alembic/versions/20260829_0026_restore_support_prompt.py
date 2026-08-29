"""Restore the platform-aware HRing support prompt.

Revision ID: 20260829_0026
Revises: 20260829_0025
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from uuid import UUID, uuid5

import sqlalchemy as sa
from alembic import op


revision: str = "20260829_0026"
down_revision: str | None = "20260829_0025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PROMPT_KEY = "support.hring"
SEED_NAMESPACE = UUID("55efe306-74c1-4de8-9684-e4bc33eed102")
PROMPT_ID = str(uuid5(SEED_NAMESPACE, f"prompt:{PROMPT_KEY}"))
VERSION_ID = str(uuid5(SEED_NAMESPACE, f"published-v1:{PROMPT_KEY}"))


def upgrade() -> None:
    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            INSERT INTO ai_prompts (
                id, prompt_key, feature_key, display_name, description, is_active
            ) VALUES (
                CAST(:id AS uuid), :prompt_key, :feature_key,
                'دستیار پشتیبانی HRing',
                'پشتیبانی فارسی مبتنی بر تنظیمات و قابلیت‌های زنده پلتفرم.', TRUE
            )
            ON CONFLICT (prompt_key) DO NOTHING
            """
        ),
        {"id": PROMPT_ID, "prompt_key": PROMPT_KEY, "feature_key": PROMPT_KEY},
    )
    connection.execute(
        sa.text(
            """
            INSERT INTO ai_prompt_versions (
                id, prompt_id, version, status, provider_alias, model,
                system_template, user_template, input_variables_json,
                response_format, output_schema_json, temperature,
                max_output_tokens, test_status, last_tested_at, published_at
            )
            SELECT
                CAST(:id AS uuid), prompt.id, 1, 'published', 'gemini',
                'gemini-2.5-flash', '{support_instructions}',
                'تاریخچه گفتگو به ترتیب زمانی:\n{conversation_json}\n\nفقط پاسخ بعدی دستیار را بنویس.',
                CAST(:input_variables AS jsonb), 'text', NULL, NULL, 2000,
                'passed', now(), now()
            FROM ai_prompts AS prompt
            WHERE prompt.prompt_key = :prompt_key
              AND NOT EXISTS (
                  SELECT 1 FROM ai_prompt_versions AS version
                  WHERE version.prompt_id = prompt.id
              )
            """
        ),
        {
            "id": VERSION_ID,
            "prompt_key": PROMPT_KEY,
            "input_variables": json.dumps(["support_instructions", "conversation_json"]),
        },
    )


def downgrade() -> None:
    connection = op.get_bind()
    connection.execute(
        sa.text("DELETE FROM ai_prompt_versions WHERE id = CAST(:id AS uuid)"),
        {"id": VERSION_ID},
    )
    connection.execute(
        sa.text(
            """
            DELETE FROM ai_prompts
            WHERE id = CAST(:id AS uuid)
              AND NOT EXISTS (
                  SELECT 1 FROM ai_prompt_versions
                  WHERE ai_prompt_versions.prompt_id = ai_prompts.id
              )
            """
        ),
        {"id": PROMPT_ID},
    )
