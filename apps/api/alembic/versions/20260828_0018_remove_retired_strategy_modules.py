"""Remove retired Strategic Radar and Strategic Compass AI controls.

Revision ID: 20260828_0018
Revises: 20260827_0017
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from typing import Any
from uuid import UUID, uuid5

import sqlalchemy as sa
from alembic import op


revision: str = "20260828_0018"
down_revision: str | None = "20260827_0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


SEED_NAMESPACE = UUID("c5508f28-eb29-4c67-9af8-cb26af5f4315")
COMPAT_SYSTEM = """You are the HRing compatibility execution layer. Execute the named HR product capability using only the supplied request data. Never invent identity/contact facts or sensitive personal traits. Preserve the response contract implied by the request. Return valid JSON only, without markdown. If evidence is missing, represent uncertainty explicitly rather than fabricating facts. Respond in Persian unless the request requires another language."""

RETIRED_FEATURES = (
    ("generate-mental-prism", "منشور ذهنی"),
    ("analyze-competitor", "تحلیل رقیب"),
    ("analyze-competitor-swot", "تحلیل SWOT رقیب"),
    ("analyze-global-trends", "تحلیل روندهای جهانی"),
    ("analyze-market-position", "تحلیل جایگاه بازار"),
    ("analyze-tech-edge", "تحلیل مزیت فناوری"),
    ("analyze-value-chain", "تحلیل زنجیره ارزش"),
    ("defense-builder", "ساخت مزیت دفاعی"),
    ("fetch-company-intel", "اطلاعات هوشمند شرکت"),
    ("generate-strategic-recommendations", "پیشنهادهای استراتژیک"),
    ("search-competitor-news", "جست‌وجوی اخبار رقبا"),
    ("track-funding", "رصد جذب سرمایه"),
)
WEB_FEATURES = frozenset(
    {
        "analyze-global-trends",
        "fetch-company-intel",
        "search-competitor-news",
        "track-funding",
    }
)
RETIRED_PROMPT_KEYS = tuple(f"compat.{name}" for name, _ in RETIRED_FEATURES)


def _seed_id(kind: str, prompt_key: str) -> str:
    return str(uuid5(SEED_NAMESPACE, f"{kind}:{prompt_key}"))


def _tables() -> tuple[sa.TableClause, sa.TableClause, sa.TableClause]:
    prompts = sa.table(
        "ai_prompts",
        sa.column("id"),
        sa.column("prompt_key"),
        sa.column("feature_key"),
        sa.column("display_name"),
        sa.column("description"),
        sa.column("is_active"),
    )
    versions = sa.table(
        "ai_prompt_versions",
        sa.column("id"),
        sa.column("prompt_id"),
        sa.column("version"),
        sa.column("status"),
        sa.column("provider_alias"),
        sa.column("model"),
        sa.column("system_template"),
        sa.column("user_template"),
        sa.column("input_variables_json"),
        sa.column("response_format"),
        sa.column("output_schema_json"),
        sa.column("temperature"),
        sa.column("max_output_tokens"),
        sa.column("test_status"),
    )
    routes = sa.table("ai_feature_routes", sa.column("feature_key"))
    return prompts, versions, routes


def upgrade() -> None:
    prompts, versions, routes = _tables()
    prompt_ids = sa.select(prompts.c.id).where(prompts.c.prompt_key.in_(RETIRED_PROMPT_KEYS))
    op.execute(sa.delete(routes).where(routes.c.feature_key.in_(RETIRED_PROMPT_KEYS)))
    op.execute(sa.delete(versions).where(versions.c.prompt_id.in_(prompt_ids)))
    op.execute(sa.delete(prompts).where(prompts.c.prompt_key.in_(RETIRED_PROMPT_KEYS)))


def downgrade() -> None:
    connection = op.get_bind()
    insert_prompt = sa.text(
        """
        INSERT INTO ai_prompts (
            id, prompt_key, feature_key, display_name, description, is_active
        ) VALUES (
            CAST(:id AS uuid), :prompt_key, :feature_key, :display_name, :description, TRUE
        )
        ON CONFLICT (prompt_key) DO NOTHING
        """
    )
    insert_version = sa.text(
        """
        INSERT INTO ai_prompt_versions (
            id, prompt_id, version, status, provider_alias, model,
            system_template, user_template, input_variables_json,
            response_format, output_schema_json, temperature,
            max_output_tokens, test_status
        )
        SELECT
            CAST(:id AS uuid), prompt.id, 1, 'draft', :provider_alias, :model,
            :system_template, :user_template, CAST(:input_variables AS jsonb),
            'text', NULL, NULL, 12000, 'untested'
        FROM ai_prompts AS prompt
        WHERE prompt.prompt_key = :prompt_key
          AND NOT EXISTS (
              SELECT 1 FROM ai_prompt_versions AS version
              WHERE version.prompt_id = prompt.id
          )
        """
    )
    for name, display_name in RETIRED_FEATURES:
        prompt_key = f"compat.{name}"
        connection.execute(
            insert_prompt,
            {
                "id": _seed_id("prompt", prompt_key),
                "prompt_key": prompt_key,
                "feature_key": prompt_key,
                "display_name": display_name,
                "description": "Prompt مدیریتی برای مسیر سازگاری این قابلیت محصول.",
            },
        )
        connection.execute(
            insert_version,
            {
                "id": _seed_id("version-1", prompt_key),
                "prompt_key": prompt_key,
                "provider_alias": "perplexity" if name in WEB_FEATURES else "gemini",
                "model": "sonar" if name in WEB_FEATURES else "gemini-2.5-flash",
                "system_template": COMPAT_SYSTEM,
                "user_template": """HRing capability: {capability_name}
Request JSON: {request_json}

Return the structured result expected by this HRing capability as JSON.""",
                "input_variables": json.dumps(["capability_name", "request_json"]),
            },
        )
