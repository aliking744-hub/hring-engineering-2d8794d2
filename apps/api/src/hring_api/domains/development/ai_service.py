from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from pydantic import ValidationError

from hring_api.config import Settings
from hring_api.domains.ai.feature_routing import resolve_runtime_feature_route
from hring_api.domains.ai.gateway_client import AiGatewayError, generate_with_ai_gateway
from hring_api.domains.development.schemas import (
    LearningPathGenerateRequest,
    LearningPathResult,
)


ONBOARDING_FEATURE_KEY = "development.onboarding_plan"
LEARNING_PATH_FEATURE_KEY = "development.learning_path"


class DevelopmentAiError(RuntimeError):
    pass


def _json_object(content: str) -> dict[str, Any]:
    text = content.strip()
    if text.startswith("```"):
        text = text.replace("```json", "").replace("```", "").strip()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise DevelopmentAiError("AI service returned invalid JSON") from exc
    if not isinstance(parsed, dict):
        raise DevelopmentAiError("AI service must return a JSON object")
    return parsed


async def generate_onboarding_content(
    *,
    job_title: str,
    seniority: str,
    expectation: str,
    mentor_role: str | None,
    user_id: UUID,
    company_id: UUID | None,
    credits_charged: int,
    settings: Settings,
) -> tuple[str, str]:
    system_prompt = """تو معمار ارشد تجربه ورود کارکنان هستی. یک برنامه عملی، سنجش‌پذیر و واقع‌بینانه برای ۹۰ روز اول بساز. برنامه باید دقیقاً سه بخش روزهای ۱ تا ۳۰، ۳۱ تا ۶۰ و ۶۱ تا ۹۰ داشته باشد و برای هر بخش هدف‌ها، اقدام‌ها، نقش منتور و شاخص موفقیت را بنویسد. همچنین یک ایمیل خوش‌آمدگویی حرفه‌ای و گرم آماده کن. اطلاعات هویتی یا سازمانی را حدس نزن. پاسخ فقط JSON معتبر با دو کلید plan و welcomeEmail و بدون markdown fence باشد؛ مقدار هر دو کلید متن Markdown فارسی است."""
    user_prompt = (
        f"عنوان شغل: {job_title}\n"
        f"سطح ارشدیت: {seniority}\n"
        f"انتظار اصلی: {expectation}\n"
        f"نقش منتور: {mentor_role or 'تعیین نشده'}"
    )
    try:
        route = await resolve_runtime_feature_route(
            feature_key=ONBOARDING_FEATURE_KEY,
            default_provider=settings.recruiting_ai_provider,
            default_model=settings.recruiting_ai_model,
        )
        result = await generate_with_ai_gateway(
            feature_key=ONBOARDING_FEATURE_KEY,
            user_id=user_id,
            company_id=company_id,
            provider=route.provider,
            model=route.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            credits_charged=credits_charged,
            max_output_tokens=8_000,
            response_format="json_object",
            metadata_json={"ai_route_source": route.source},
        )
    except AiGatewayError as exc:
        raise DevelopmentAiError("سرویس تولید برنامه آنبوردینگ در دسترس نیست") from exc

    payload = _json_object(result.content)
    plan = payload.get("plan")
    welcome_email = payload.get("welcomeEmail")
    if not isinstance(plan, str) or not plan.strip():
        raise DevelopmentAiError("AI service returned no onboarding plan")
    if not isinstance(welcome_email, str) or not welcome_email.strip():
        raise DevelopmentAiError("AI service returned no welcome email")
    if len(plan) > 40_000 or len(welcome_email) > 20_000:
        raise DevelopmentAiError("AI service returned an oversized onboarding response")
    return plan.strip(), welcome_email.strip()


async def generate_learning_path_content(
    *,
    payload: LearningPathGenerateRequest,
    user_id: UUID,
    company_id: UUID | None,
    credits_charged: int,
    settings: Settings,
) -> LearningPathResult:
    # Deliberately omit employee name/email. They are needed for HRing storage and
    # delivery only, not for the model to design a role-based learning plan.
    provider_input = {
        "jobTitle": payload.job_title,
        "industry": payload.industry,
        "seniorityLevel": payload.seniority_level,
        "educationLevel": payload.education_level,
        "fieldOfStudy": payload.field_of_study,
        "experienceYears": payload.experience_years,
        "trainingMonths": payload.training_months,
    }
    system_prompt = """تو متخصص توسعه استعداد و طراحی مسیر یادگیری هستی. فقط با داده‌های شغلی ورودی یک برنامه عملی و واقع‌بینانه بساز. نبود اطلاعات را با حدس درباره شخص جبران نکن. پاسخ فقط JSON معتبر و بدون markdown fence باشد و دقیقاً این ساختار را داشته باشد:
{
  "skillGapAnalysis": "متن فارسی",
  "hardSkills": [{"skill": "...", "reason": "..."}],
  "softSkills": [{"skill": "...", "reason": "..."}],
  "roadmap": [{"month": "...", "focus": "...", "actionItems": ["..."]}],
  "trainingNote": "متن اختیاری"
}
حداقل دو مهارت سخت، دو مهارت نرم و یک مرحله نقشه راه ارائه کن."""
    user_prompt = json.dumps(provider_input, ensure_ascii=False)
    try:
        route = await resolve_runtime_feature_route(
            feature_key=LEARNING_PATH_FEATURE_KEY,
            default_provider=settings.recruiting_ai_provider,
            default_model=settings.recruiting_ai_model,
        )
        result = await generate_with_ai_gateway(
            feature_key=LEARNING_PATH_FEATURE_KEY,
            user_id=user_id,
            company_id=company_id,
            provider=route.provider,
            model=route.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            credits_charged=credits_charged,
            max_output_tokens=8_000,
            response_format="json_object",
            metadata_json={"ai_route_source": route.source},
        )
    except AiGatewayError as exc:
        raise DevelopmentAiError("سرویس تولید مسیر یادگیری در دسترس نیست") from exc

    try:
        return LearningPathResult.model_validate(_json_object(result.content))
    except ValidationError as exc:
        raise DevelopmentAiError("AI service returned an invalid learning path") from exc
