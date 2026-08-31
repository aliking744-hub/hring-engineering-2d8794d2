import json
import logging
from typing import Any
from uuid import UUID

import httpx
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings
from hring_api.domains.ai.feature_routing import resolve_runtime_feature_route
from hring_api.domains.ai.gateway_client import (
    AiGatewayError,
    AiGatewayResult,
    generate_with_ai_gateway,
)
from hring_api.domains.ai.prompt_service import (
    PromptRegistryError,
    generate_with_managed_prompt,
)
from hring_api.domains.recruiting.schemas import (
    AnalyzeCandidatesResponse,
    AnalyzedCandidate,
    CandidateAnalysisInput,
    CandidateAnalysisStats,
    JobRequirements,
)


logger = logging.getLogger(__name__)


class RecruitingAiError(RuntimeError):
    pass


class RecruitingSourcingUnavailableError(RecruitingAiError):
    pass


SYSTEM_PROMPT = """تو یک استعدادیاب ارشد هستی. هر کاندیدا را فقط بر اساس داده‌های موجود و اطلاعات عمومی حرفه‌ای که در ورودی آمده در پنج لایه تحلیل کن:
1) Activity & Sentiment، 2) Hard Skill Match، 3) Career Trajectory، 4) Culture Fit، 5) Risk & Opportunity.
برای هر لایه امتیاز 0 تا 100 بده. Red Flag و Green Flag فقط وقتی بنویس که مستند به ورودی باشد؛ نبود اطلاعات را به عنوان هشدار نساز. matchScore باید 0 تا 100 و candidateTemperature یکی از hot/warm/cold باشد.

اطلاعات هویتی و رزومه‌ای منبع حقیقت HRing هستند. نام، ایمیل، تلفن، تحصیلات، سابقه، شرکت، محل، لینکدین و مهارت‌ها را حدس نزن و بازنویسی نکن.
برای هر ورودی فقط این فیلدها را برگردان: sourceIndex, matchScore, candidateTemperature, layerScores, redFlags, greenFlags, summary, recommendation.
sourceIndex را دقیقاً بدون تغییر از همان ورودی برگردان. پاسخ فقط JSON Array معتبر و بدون markdown باشد."""


def _job_text(job: JobRequirements) -> str:
    return (
        f"عنوان: {job.job_title}\nشهر: {job.city}\n"
        f"مهارت‌ها: {job.skills or 'مشخص نشده'}\n"
        f"سابقه: {job.experience or 'مشخص نشده'}\n"
        f"صنعت: {job.industry or 'مشخص نشده'}\n"
        f"سطح ارشدیت: {job.seniority_level or 'مشخص نشده'}\n"
        f"توضیحات: {job.description or 'ندارد'}"
    )


def _extract_json_array(content: str) -> list[dict[str, Any]]:
    text = content.strip()
    if text.startswith("```"):
        text = text.replace("```json", "").replace("```", "").strip()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise RecruitingAiError("AI analysis returned invalid JSON") from exc
    if not isinstance(parsed, list):
        raise RecruitingAiError("AI analysis must return a JSON array")
    return [item for item in parsed if isinstance(item, dict)]


def _candidate_for_provider(candidate: CandidateAnalysisInput, source_index: int) -> dict[str, Any]:
    # rawData may contain an entire imported source row or private HR material.
    # It remains in HRing and is deliberately excluded from third-party AI calls.
    row = candidate.model_dump(
        by_alias=True,
        exclude_none=True,
        exclude={"raw_data", "email", "phone", "linkedin"},
    )
    row["sourceIndex"] = source_index
    return row


def _skills_from_source(value: str | list[str] | None) -> list[str]:
    if isinstance(value, list):
        return [item.strip() for item in value if item.strip()]
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    return []


# sourceIndex is the integrity key that binds provider output to the original candidate.
def _analysis_for_source(
    rows: list[dict[str, Any]],
    *,
    source_index: int,
) -> dict[str, Any] | None:
    for row in rows:
        raw_index = row.get("sourceIndex")
        if isinstance(raw_index, int) and raw_index == source_index:
            return row
    # Compatibility fallback for a provider that omits sourceIndex but keeps order.
    if source_index < len(rows):
        return rows[source_index]
    return None


async def _enrich_candidate(
    *,
    candidate: CandidateAnalysisInput,
    job: JobRequirements,
    user_id: UUID,
    company_id: UUID | None,
    settings: Settings,
    session: AsyncSession | None,
) -> str:
    if not settings.recruiting_web_enrichment_enabled or not candidate.name:
        return ""
    variables = {
        "candidate_name": candidate.name,
        "last_company": candidate.last_company or "",
        "target_industry": job.industry or "",
    }
    messages = [
        {
            "role": "system",
            "content": "Find concise, factual, public professional information relevant to recruiting. Respond in Persian. Do not infer sensitive personal traits.",
        },
        {
            "role": "user",
            "content": (
                f"نام: {candidate.name}\nآخرین شرکت: {candidate.last_company or ''}\n"
                f"صنعت هدف: {job.industry or ''}\n"
                "اطلاعات عمومی حرفه‌ای، سابقه کاری و فعالیت حرفه‌ای مرتبط را خلاصه کن."
            ),
        },
    ]

    async def fallback() -> AiGatewayResult:
        route = await resolve_runtime_feature_route(
            feature_key="smart_headhunting.web_enrichment",
            default_provider=settings.recruiting_enrichment_provider,
            default_model=settings.recruiting_enrichment_model,
        )
        return await generate_with_ai_gateway(
            feature_key="smart_headhunting.web_enrichment",
            user_id=user_id,
            company_id=company_id,
            provider=route.provider,
            model=route.model,
            messages=messages,
            max_output_tokens=800,
            metadata_json={
                "ai_route_source": route.source,
                "prompt_key": "smart_headhunting.web_enrichment",
                "prompt_mode": "embedded_fallback",
            },
        )

    try:
        result = await generate_with_managed_prompt(
            session,
            prompt_key="smart_headhunting.web_enrichment",
            variables=variables,
            user_id=user_id,
            company_id=company_id,
            fallback=fallback,
        )
        return result.content[:12_000]
    except (AiGatewayError, PromptRegistryError):
        logger.info("Recruiting web enrichment unavailable for candidate", exc_info=True)
        return ""


async def analyze_candidates(
    *,
    candidates: list[CandidateAnalysisInput],
    job: JobRequirements,
    enable_web_search: bool,
    user_id: UUID,
    company_id: UUID | None,
    settings: Settings,
    session: AsyncSession | None = None,
) -> AnalyzeCandidatesResponse:
    if len(candidates) > settings.recruiting_analysis_max_candidates:
        raise RecruitingAiError(
            f"حداکثر {settings.recruiting_analysis_max_candidates} کاندیدا در هر درخواست قابل پردازش است"
        )

    prepared: list[dict[str, Any]] = []
    for index, candidate in enumerate(candidates):
        row = _candidate_for_provider(candidate, index)
        if enable_web_search:
            web_info = await _enrich_candidate(
                candidate=candidate,
                job=job,
                user_id=user_id,
                company_id=company_id,
                settings=settings,
                session=session,
            )
            if web_info:
                row["webResearchInfo"] = web_info
        prepared.append(row)

    user_prompt = f"""الزامات شغلی:\n{_job_text(job)}\n\nکاندیداها:\n{json.dumps(prepared, ensure_ascii=False)}\n\nبرای هر کاندیدا فقط تحلیل پنج‌لایه و sourceIndex خودش را برگردان. اطلاعات هویتی و رزومه‌ای را در پاسخ تولید نکن. نتایج می‌توانند بر اساس matchScore مرتب شوند چون تطبیق با sourceIndex انجام می‌شود."""

    async def fallback() -> AiGatewayResult:
        route = await resolve_runtime_feature_route(
            feature_key="smart_headhunting.candidate_analysis",
            default_provider=settings.recruiting_ai_provider,
            default_model=settings.recruiting_ai_model,
        )
        return await generate_with_ai_gateway(
            feature_key="smart_headhunting.candidate_analysis",
            user_id=user_id,
            company_id=company_id,
            provider=route.provider,
            model=route.model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            max_output_tokens=12_000,
            metadata_json={
                "ai_route_source": route.source,
                "prompt_key": "smart_headhunting.candidate_analysis",
                "prompt_mode": "embedded_fallback",
            },
        )

    try:
        result = await generate_with_managed_prompt(
            session,
            prompt_key="smart_headhunting.candidate_analysis",
            variables={
                "job_requirements": _job_text(job),
                "candidates_json": json.dumps(prepared, ensure_ascii=False),
            },
            user_id=user_id,
            company_id=company_id,
            fallback=fallback,
        )
    except (AiGatewayError, PromptRegistryError) as exc:
        raise RecruitingAiError("سرویس تحلیل هوش مصنوعی در دسترس نیست") from exc

    raw_rows = _extract_json_array(result.content)
    processed: list[AnalyzedCandidate] = []
    for source_index, source in enumerate(candidates):
        analysis = _analysis_for_source(raw_rows, source_index=source_index)
        if analysis is None:
            logger.warning("AI omitted recruiting candidate sourceIndex=%s", source_index)
            continue

        source_payload = source.model_dump(by_alias=True, exclude_none=True, exclude={"raw_data"})
        source_title = source_payload.get("title")
        normalized: dict[str, Any] = {
            "name": source.name or f"کاندیدا {source_index + 1}",
            "email": source.email or "",
            "phone": source.phone or "",
            "title": source_title if isinstance(source_title, str) and source_title else "نامشخص",
            "education": source.education or "نامشخص",
            "experience": source.experience or "نامشخص",
            "lastCompany": source.last_company or "نامشخص",
            "location": source.location or job.city,
            "linkedin": source.linkedin or "",
            "skills": _skills_from_source(source.skills),
            "matchScore": analysis.get("matchScore", 50),
            "candidateTemperature": analysis.get("candidateTemperature", "cold"),
            "layerScores": analysis.get("layerScores", {}),
            "redFlags": analysis.get("redFlags", []),
            "greenFlags": analysis.get("greenFlags", []),
            "summary": analysis.get("summary", ""),
            "recommendation": analysis.get("recommendation", "در لیست انتظار"),
            "rawData": source.raw_data,
        }
        try:
            processed.append(AnalyzedCandidate.model_validate(normalized))
        except ValidationError:
            logger.warning(
                "Dropping malformed AI analysis for sourceIndex=%s",
                source_index,
                exc_info=True,
            )

    if not processed:
        raise RecruitingAiError("نتیجه معتبر از تحلیل هوش مصنوعی دریافت نشد")

    processed.sort(key=lambda item: item.match_score, reverse=True)
    total = len(processed)
    stats = CandidateAnalysisStats.model_validate(
        {
            "total": total,
            "excellent": sum(item.match_score >= 85 for item in processed),
            "good": sum(70 <= item.match_score < 85 for item in processed),
            "average": sum(item.match_score < 70 for item in processed),
            "avgScore": round(sum(item.match_score for item in processed) / total),
            "hotCandidates": sum(item.candidate_temperature == "hot" for item in processed),
            "warmCandidates": sum(item.candidate_temperature == "warm" for item in processed),
            "coldCandidates": sum(item.candidate_temperature == "cold" for item in processed),
        }
    )
    return AnalyzeCandidatesResponse(candidates=processed, stats=stats)


async def fetch_sourced_candidates(
    *,
    job: JobRequirements,
    settings: Settings,
) -> list[CandidateAnalysisInput]:
    secret = settings.recruiting_sourcing_webhook_url
    if secret is None or not secret.get_secret_value().strip():
        raise RecruitingSourcingUnavailableError("سرویس sourcing برای این محیط تنظیم نشده است")

    url = secret.get_secret_value().strip()
    payload = {
        "jobTitle": job.job_title,
        "city": job.city,
        "skills": job.skills or "",
        "experience": job.experience or "",
        "industry": job.industry or "",
        "seniorityLevel": job.seniority_level or "",
    }
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            raw: object = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise RecruitingSourcingUnavailableError(
            "دریافت کاندیدا از سرویس sourcing ناموفق بود"
        ) from exc

    if isinstance(raw, list):
        rows = raw
    elif isinstance(raw, dict) and isinstance(raw.get("candidates"), list):
        rows = raw["candidates"]
    elif isinstance(raw, dict) and isinstance(raw.get("data"), list):
        rows = raw["data"]
    else:
        raise RecruitingSourcingUnavailableError("فرمت پاسخ سرویس sourcing معتبر نیست")

    limited = rows[: settings.recruiting_auto_source_max_candidates]
    candidates: list[CandidateAnalysisInput] = []
    for row in limited:
        if not isinstance(row, dict):
            continue
        try:
            candidates.append(CandidateAnalysisInput.model_validate(row))
        except ValidationError:
            logger.warning("Skipping malformed sourced candidate", exc_info=True)
    return candidates
