"""Seed editable draft prompts for every product AI feature.

Revision ID: 20260827_0017
Revises: 20260826_0016
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from typing import Any
from uuid import UUID, uuid5

import sqlalchemy as sa
from alembic import op


revision: str = "20260827_0017"
down_revision: str | None = "20260826_0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


SEED_NAMESPACE = UUID("c5508f28-eb29-4c67-9af8-cb26af5f4315")

CANDIDATE_SYSTEM = """تو یک استعدادیاب ارشد هستی. هر کاندیدا را فقط بر اساس داده‌های موجود و اطلاعات عمومی حرفه‌ای که در ورودی آمده در پنج لایه تحلیل کن:
1) Activity & Sentiment، 2) Hard Skill Match، 3) Career Trajectory، 4) Culture Fit، 5) Risk & Opportunity.
برای هر لایه امتیاز 0 تا 100 بده. Red Flag و Green Flag فقط وقتی بنویس که مستند به ورودی باشد؛ نبود اطلاعات را به عنوان هشدار نساز. matchScore باید 0 تا 100 و candidateTemperature یکی از hot/warm/cold باشد.

اطلاعات هویتی و رزومه‌ای منبع حقیقت HRing هستند. نام، ایمیل، تلفن، تحصیلات، سابقه، شرکت، محل، لینکدین و مهارت‌ها را حدس نزن و بازنویسی نکن.
برای هر ورودی فقط این فیلدها را برگردان: sourceIndex, matchScore, candidateTemperature, layerScores, redFlags, greenFlags, summary, recommendation.
sourceIndex را دقیقاً بدون تغییر از همان ورودی برگردان. پاسخ فقط JSON Array معتبر و بدون markdown باشد."""

COMPAT_SYSTEM = """You are the HRing compatibility execution layer. Execute the named HR product capability using only the supplied request data. Never invent identity/contact facts or sensitive personal traits. Preserve the response contract implied by the request. Return valid JSON only, without markdown. If evidence is missing, represent uncertainty explicitly rather than fabricating facts. Respond in Persian unless the request requires another language."""


def _special_prompts() -> list[dict[str, Any]]:
    return [
        {
            "prompt_key": "smart_headhunting.candidate_analysis",
            "feature_key": "smart_headhunting.candidate_analysis",
            "display_name": "تحلیل و امتیازدهی کاندیداها",
            "description": "تحلیل پنج‌لایه کاندیداها بدون بازنویسی داده‌های هویتی.",
            "provider_alias": "gemini",
            "model": "gemini-2.5-flash",
            "system_template": CANDIDATE_SYSTEM,
            "user_template": """الزامات شغلی:
{job_requirements}

کاندیداها:
{candidates_json}

برای هر کاندیدا فقط تحلیل پنج‌لایه و sourceIndex خودش را برگردان. اطلاعات هویتی و رزومه‌ای را در پاسخ تولید نکن. نتایج می‌توانند بر اساس matchScore مرتب شوند چون تطبیق با sourceIndex انجام می‌شود.""",
            "input_variables": ["job_requirements", "candidates_json"],
            "response_format": "text",
            "output_schema": None,
            "temperature": None,
            "max_output_tokens": 12_000,
        },
        {
            "prompt_key": "smart_headhunting.web_enrichment",
            "feature_key": "smart_headhunting.web_enrichment",
            "display_name": "تکمیل اطلاعات عمومی کاندیدا",
            "description": "جست‌وجوی محدود به اطلاعات عمومی و حرفه‌ای مرتبط با استخدام.",
            "provider_alias": "perplexity",
            "model": "sonar",
            "system_template": "Find concise, factual, public professional information relevant to recruiting. Respond in Persian. Do not infer sensitive personal traits.",
            "user_template": """نام: {candidate_name}
آخرین شرکت: {last_company}
صنعت هدف: {target_industry}
اطلاعات عمومی حرفه‌ای، سابقه کاری و فعالیت حرفه‌ای مرتبط را خلاصه کن.""",
            "input_variables": ["candidate_name", "last_company", "target_industry"],
            "response_format": "text",
            "output_schema": None,
            "temperature": None,
            "max_output_tokens": 800,
        },
        {
            "prompt_key": "development.onboarding_plan",
            "feature_key": "development.onboarding_plan",
            "display_name": "برنامه ورود و آنبوردینگ",
            "description": "برنامه سنجش‌پذیر ۹۰ روزه و ایمیل خوش‌آمدگویی.",
            "provider_alias": "gemini",
            "model": "gemini-2.5-flash",
            "system_template": """تو معمار ارشد تجربه ورود کارکنان هستی. یک برنامه عملی، سنجش‌پذیر و واقع‌بینانه برای ۹۰ روز اول بساز. برنامه باید دقیقاً سه بخش روزهای ۱ تا ۳۰، ۳۱ تا ۶۰ و ۶۱ تا ۹۰ داشته باشد و برای هر بخش هدف‌ها، اقدام‌ها، نقش منتور و شاخص موفقیت را بنویسد. همچنین یک ایمیل خوش‌آمدگویی حرفه‌ای و گرم آماده کن. اطلاعات هویتی یا سازمانی را حدس نزن. پاسخ فقط JSON معتبر با دو کلید plan و welcomeEmail و بدون markdown fence باشد؛ مقدار هر دو کلید متن Markdown فارسی است.""",
            "user_template": """عنوان شغل: {job_title}
سطح ارشدیت: {seniority}
انتظار اصلی: {expectation}
نقش منتور: {mentor_role}""",
            "input_variables": ["job_title", "seniority", "expectation", "mentor_role"],
            "response_format": "json_object",
            "output_schema": {
                "type": "object",
                "properties": {
                    "plan": {"type": "string"},
                    "welcomeEmail": {"type": "string"},
                },
                "required": ["plan", "welcomeEmail"],
            },
            "temperature": None,
            "max_output_tokens": 8_000,
        },
        {
            "prompt_key": "development.learning_path",
            "feature_key": "development.learning_path",
            "display_name": "مسیر یادگیری",
            "description": "مسیر توسعه مهارت بر پایه داده‌های شغلی و بدون ارسال هویت کارمند.",
            "provider_alias": "gemini",
            "model": "gemini-2.5-flash",
            "system_template": """تو متخصص توسعه استعداد و طراحی مسیر یادگیری هستی. فقط با داده‌های شغلی ورودی یک برنامه عملی و واقع‌بینانه بساز. نبود اطلاعات را با حدس درباره شخص جبران نکن. پاسخ فقط JSON معتبر و بدون markdown fence باشد و دقیقاً این ساختار را داشته باشد:
{{
  "skillGapAnalysis": "متن فارسی",
  "hardSkills": [{{"skill": "...", "reason": "..."}}],
  "softSkills": [{{"skill": "...", "reason": "..."}}],
  "roadmap": [{{"month": "...", "focus": "...", "actionItems": ["..."]}}],
  "trainingNote": "متن اختیاری"
}}
حداقل دو مهارت سخت، دو مهارت نرم و یک مرحله نقشه راه ارائه کن.""",
            "user_template": "{role_profile_json}",
            "input_variables": ["role_profile_json"],
            "response_format": "json_object",
            "output_schema": {
                "type": "object",
                "properties": {
                    "skillGapAnalysis": {"type": "string"},
                    "hardSkills": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "skill": {"type": "string"},
                                "reason": {"type": "string"},
                            },
                            "required": ["skill", "reason"],
                        },
                    },
                    "softSkills": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "skill": {"type": "string"},
                                "reason": {"type": "string"},
                            },
                            "required": ["skill", "reason"],
                        },
                    },
                    "roadmap": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "month": {"type": "string"},
                                "focus": {"type": "string"},
                                "actionItems": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                            },
                            "required": ["month", "focus", "actionItems"],
                        },
                    },
                    "trainingNote": {"type": "string"},
                },
                "required": ["skillGapAnalysis", "hardSkills", "softSkills", "roadmap"],
            },
            "temperature": None,
            "max_output_tokens": 8_000,
        },
    ]


COMPAT_FEATURES = (
    ("generate-job-ad", "تولید آگهی شغلی"),
    ("generate-smart-ad", "تولید آگهی هوشمند"),
    ("generate-job-profile", "تولید پروفایل شغلی"),
    ("generate-interview-guide", "راهنمای مصاحبه"),
    ("generate-interview-kit", "کیت مصاحبه"),
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
    ("labor-complaint-assistant", "دستیار شکایت کار"),
    ("legal-advisor-chat", "مشاور حقوقی"),
    ("search-legal-docs", "جست‌وجوی اسناد حقوقی"),
    ("hring-support", "دستیار پشتیبانی HRing"),
)

WEB_COMPAT_FEATURES = frozenset(
    {
        "analyze-global-trends",
        "fetch-company-intel",
        "search-competitor-news",
        "track-funding",
    }
)


def _compat_prompts() -> list[dict[str, Any]]:
    prompts: list[dict[str, Any]] = []
    for name, display_name in COMPAT_FEATURES:
        web_enabled = name in WEB_COMPAT_FEATURES
        prompts.append(
            {
                "prompt_key": f"compat.{name}",
                "feature_key": f"compat.{name}",
                "display_name": display_name,
                "description": "Prompt مدیریتی برای مسیر سازگاری این قابلیت محصول.",
                "provider_alias": "perplexity" if web_enabled else "gemini",
                "model": "sonar" if web_enabled else "gemini-2.5-flash",
                "system_template": COMPAT_SYSTEM,
                "user_template": """HRing capability: {capability_name}
Request JSON: {request_json}

Return the structured result expected by this HRing capability as JSON.""",
                "input_variables": ["capability_name", "request_json"],
                "response_format": "text",
                "output_schema": None,
                "temperature": None,
                "max_output_tokens": 12_000,
            }
        )
    return prompts


PROMPTS = _special_prompts() + _compat_prompts()


def _seed_id(kind: str, prompt_key: str) -> str:
    return str(uuid5(SEED_NAMESPACE, f"{kind}:{prompt_key}"))


def upgrade() -> None:
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
            :response_format, CAST(:output_schema AS jsonb), :temperature,
            :max_output_tokens, 'untested'
        FROM ai_prompts AS prompt
        WHERE prompt.prompt_key = :prompt_key
          AND NOT EXISTS (
              SELECT 1 FROM ai_prompt_versions AS version
              WHERE version.prompt_id = prompt.id
          )
        """
    )

    for prompt in PROMPTS:
        connection.execute(
            insert_prompt,
            {
                "id": _seed_id("prompt", prompt["prompt_key"]),
                "prompt_key": prompt["prompt_key"],
                "feature_key": prompt["feature_key"],
                "display_name": prompt["display_name"],
                "description": prompt["description"],
            },
        )
        connection.execute(
            insert_version,
            {
                "id": _seed_id("version-1", prompt["prompt_key"]),
                "prompt_key": prompt["prompt_key"],
                "provider_alias": prompt["provider_alias"],
                "model": prompt["model"],
                "system_template": prompt["system_template"],
                "user_template": prompt["user_template"],
                "input_variables": json.dumps(prompt["input_variables"]),
                "response_format": prompt["response_format"],
                "output_schema": (
                    json.dumps(prompt["output_schema"], ensure_ascii=False)
                    if prompt["output_schema"] is not None
                    else None
                ),
                "temperature": prompt["temperature"],
                "max_output_tokens": prompt["max_output_tokens"],
            },
        )


def downgrade() -> None:
    connection = op.get_bind()
    delete_untouched_version = sa.text(
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
    )
    delete_empty_prompt = sa.text(
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
    )
    for prompt in reversed(PROMPTS):
        values = {"prompt_key": prompt["prompt_key"]}
        connection.execute(delete_untouched_version, values)
        connection.execute(delete_empty_prompt, values)
