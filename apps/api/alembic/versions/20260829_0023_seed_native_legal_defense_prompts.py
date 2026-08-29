"""Seed the native employer-defense prompt drafts.

Revision ID: 20260829_0023
Revises: 20260828_0022
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from uuid import UUID, uuid5

import sqlalchemy as sa
from alembic import op


revision: str = "20260829_0023"
down_revision: str | None = "20260828_0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

FEATURE_KEY = "legal.defense_builder"
SEED_NAMESPACE = UUID("f6c12fc1-2075-41d5-a4a8-30d76d8835bc")

PROMPTS: tuple[dict[str, object], ...] = (
    {
        "key": "legal.defense_claims",
        "name": "دفاع کارفرما — استخراج ادعاها",
        "description": "استخراج ساختاریافته ادعاهای کارگر از متن واقعی دادخواست.",
        "system": """شما یک تحلیلگر حقوقی متخصص قانون کار ایران هستید.
ادعاهای اصلی کارگر را فقط از متن پرونده استخراج کنید. اطلاعاتی را که در پرونده نیست اختراع نکنید.
خروجی باید فقط یک شیء JSON معتبر مطابق قرارداد اعلام‌شده باشد.""",
        "user": """از دادخواست زیر، ادعاهای اصلی کارگر را استخراج کنید.

دادخواست:
{complaint_text}

اطلاعات تکمیلی:
{additional_info}

سابقه مکالمه:
{conversation_history}

برای هر ادعا claim_type، description و در صورت وجود amount_claimed را برگردانید.""",
        "variables": ["complaint_text", "additional_info", "conversation_history"],
        "tokens": 2000,
        "schema": {
            "type": "object",
            "properties": {
                "claims": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "claim_type": {"type": "string"},
                            "description": {"type": "string"},
                            "amount_claimed": {"type": ["string", "null"]},
                        },
                        "required": ["claim_type", "description"],
                    },
                }
            },
            "required": ["claims"],
        },
    },
    {
        "key": "legal.defense_gap",
        "name": "دفاع کارفرما — تحلیل کسری مدارک",
        "description": "مقایسه مدارک واقعی کارفرما با الزامات قانونی هر ادعا.",
        "system": """شما یک وکیل کار متخصص هستید.
مدارک واقعی کارفرما را با الزامات مواد قانونی ارائه‌شده مقایسه کنید و کسری‌ها را دقیق مشخص کنید.
خروجی باید فقط یک شیء JSON معتبر مطابق قرارداد اعلام‌شده باشد.""",
        "user": """ادعاهای کارگر:
{claims}

مواد قانونی مرتبط:
{relevant_laws}

مدارک ارائه‌شده توسط کارفرما:
{evidence_context}

برای هر ادعا مدارک لازم، مدارک موجود، مدارک ناقص و مبنای قانونی را تحلیل کنید.
سپس سوالات دقیق لازم برای تکمیل مدارک و مقدار can_proceed را برگردانید.""",
        "variables": ["claims", "relevant_laws", "evidence_context"],
        "tokens": 4000,
        "schema": {
            "type": "object",
            "properties": {
                "evidence_analysis": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "claim_type": {"type": "string"},
                            "required_evidence": {"type": "array", "items": {"type": "string"}},
                            "provided_evidence": {"type": "array", "items": {"type": "string"}},
                            "missing_evidence": {"type": "array", "items": {"type": "string"}},
                            "legal_basis": {"type": "string"},
                        },
                        "required": [
                            "claim_type",
                            "required_evidence",
                            "provided_evidence",
                            "missing_evidence",
                            "legal_basis",
                        ],
                    },
                },
                "follow_up_questions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "question": {"type": "string"},
                            "reason": {"type": "string"},
                            "related_article": {"type": "string"},
                        },
                        "required": ["question", "reason", "related_article"],
                    },
                },
                "can_proceed": {"type": "boolean"},
            },
            "required": ["evidence_analysis", "follow_up_questions", "can_proceed"],
        },
    },
    {
        "key": "legal.defense_verdict",
        "name": "دفاع کارفرما — رأی و راهبرد",
        "description": "محاسبه ریسک و تولید راهبرد، لایحه دفاعیه یا توصیه سازش.",
        "system": """شما یک وکیل باتجربه در دعاوی کار و دیوان عدالت اداری هستید.
ریسک پرونده کارفرما را فقط بر اساس ادعاها، قانون و مدارک تحلیل‌شده ارزیابی کنید.
خروجی باید فقط یک شیء JSON معتبر مطابق قرارداد اعلام‌شده باشد.""",
        "user": """ادعاهای کارگر:
{claims}

تحلیل مدارک:
{evidence_analysis}

مدارک موجود:
{evidence_summary}

مدارک ناقص:
{missing_evidence}

احتمال باخت را از ۰ تا ۱۰۰، سطح ریسک، توصیه راهبردی و استدلال را برگردانید.
نقاط قوت و ضعف را مشخص کنید. اگر توصیه fight است متن کامل لایحه دفاعیه و اگر settle است توصیه سازش را بنویسید.""",
        "variables": ["claims", "evidence_analysis", "evidence_summary", "missing_evidence"],
        "tokens": 4000,
        "schema": {
            "type": "object",
            "properties": {
                "risk_score": {"type": "number"},
                "risk_level": {"type": "string", "enum": ["low", "medium", "high", "critical"]},
                "recommendation": {"type": "string", "enum": ["fight", "settle", "needs_more_info"]},
                "reasoning": {"type": "string"},
                "key_strengths": {"type": "array", "items": {"type": "string"}},
                "key_weaknesses": {"type": "array", "items": {"type": "string"}},
                "defense_bill": {"type": ["string", "null"]},
                "settlement_advice": {"type": ["string", "null"]},
            },
            "required": ["risk_score", "risk_level", "recommendation", "reasoning"],
        },
    },
)


def _seed_id(kind: str, prompt_key: str) -> str:
    return str(uuid5(SEED_NAMESPACE, f"{kind}:{prompt_key}"))


def upgrade() -> None:
    connection = op.get_bind()
    for prompt in PROMPTS:
        key = str(prompt["key"])
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
                "id": _seed_id("prompt", key),
                "prompt_key": key,
                "feature_key": FEATURE_KEY,
                "display_name": prompt["name"],
                "description": prompt["description"],
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
                    CAST(:id AS uuid), record.id, 1, 'draft', 'gemini',
                    'gemini-2.5-pro', :system_template, :user_template,
                    CAST(:input_variables AS jsonb), 'json_object',
                    CAST(:output_schema AS jsonb), NULL, :max_output_tokens, 'untested'
                FROM ai_prompts AS record
                WHERE record.prompt_key = :prompt_key
                  AND NOT EXISTS (
                      SELECT 1 FROM ai_prompt_versions AS version
                      WHERE version.prompt_id = record.id
                  )
                """
            ),
            {
                "id": _seed_id("version-1", key),
                "prompt_key": key,
                "system_template": prompt["system"],
                "user_template": prompt["user"],
                "input_variables": json.dumps(prompt["variables"]),
                "output_schema": json.dumps(prompt["schema"]),
                "max_output_tokens": prompt["tokens"],
            },
        )


def downgrade() -> None:
    connection = op.get_bind()
    for prompt in reversed(PROMPTS):
        key = str(prompt["key"])
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
            {"prompt_key": key},
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
            {"prompt_key": key},
        )
