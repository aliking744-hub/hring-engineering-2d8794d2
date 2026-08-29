"""Restore the exact Lovable labor-complaint prompt contract.

Revision ID: 20260829_0025
Revises: 20260829_0024
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from uuid import UUID, uuid5

import sqlalchemy as sa
from alembic import op

revision: str = "20260829_0025"
down_revision: str | None = "20260829_0024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PROMPT_KEY = "legal.labor_complaint"
SEED_NAMESPACE = UUID("a291059d-9ec7-49e4-9e23-1ba2562096ca")
PROMPT_ID = str(uuid5(SEED_NAMESPACE, f"prompt:{PROMPT_KEY}"))
VERSION_ID = str(uuid5(SEED_NAMESPACE, f"published-v1:{PROMPT_KEY}"))

LABOR_SYSTEM_TEMPLATE = """شما یک وکیل متخصص حقوق کار ایران هستید. وظیفه شما تحلیل پرونده شکایت کارگر و ارزیابی شانس موفقیت است.

قوانین مرتبط:
{legal_context}

بر اساس مدارک و قانون، احتمال موفقیت را از 0 تا 100 تخمین بزنید، نقاط قوت و ضعف و مدارک ناقص را مشخص کنید و توصیه عملی بدهید. اگر شانس موفقیت بالای 50% است، متن دادخواست رسمی تنظیم کنید.

دادخواست باید با «ریاست محترم هیات تشخیص اداره کار...» شروع شود، به مواد مرتبط استناد کند، فرمت سامانه جامع روابط کار را رعایت کند و با «با احترام» و جای امضا پایان یابد.

پاسخ فقط JSON معتبر با فیلدهای winProbability، riskLevel، strongPoints، weakPoints، missingEvidence، recommendation، complaintText و relevantArticles باشد."""

LABOR_USER_TEMPLATE = """موضوع شکایت: {claim_label}

وضعیت مدارک کارگر:
{evidence_summary}

مدارک ضروری که ندارد: {missing_required}

تعداد فایل‌های اضافی: {additional_files_count}

پرونده را تحلیل کنید و نتیجه را فقط در فرمت JSON قراردادشده بدهید."""

VARIABLES = [
    "legal_context",
    "claim_label",
    "evidence_summary",
    "missing_required",
    "additional_files_count",
]
OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "winProbability": {"type": "number"},
        "riskLevel": {"type": "string", "enum": ["high", "medium", "low"]},
        "strongPoints": {"type": "array", "items": {"type": "string"}},
        "weakPoints": {"type": "array", "items": {"type": "string"}},
        "missingEvidence": {"type": "array", "items": {"type": "string"}},
        "recommendation": {"type": "string"},
        "complaintText": {"type": ["string", "null"]},
        "relevantArticles": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "winProbability",
        "riskLevel",
        "strongPoints",
        "weakPoints",
        "missingEvidence",
        "recommendation",
        "complaintText",
        "relevantArticles",
    ],
}


def upgrade() -> None:
    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            INSERT INTO ai_prompts (
                id, prompt_key, feature_key, display_name, description, is_active
            ) VALUES (
                CAST(:id AS uuid), :prompt_key, :feature_key,
                'دستیار شکایت کار',
                'ممیزی مدارک، بازیابی قوانین و تنظیم دادخواست بر پایه قرارداد Lovable.',
                TRUE
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
                'gemini-2.5-pro', :system_template, :user_template,
                CAST(:input_variables AS jsonb), 'json_object',
                CAST(:output_schema AS jsonb), NULL, 4000,
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
            "system_template": LABOR_SYSTEM_TEMPLATE,
            "user_template": LABOR_USER_TEMPLATE,
            "input_variables": json.dumps(VARIABLES),
            "output_schema": json.dumps(OUTPUT_SCHEMA),
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
