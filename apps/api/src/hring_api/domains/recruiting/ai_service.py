import json
import logging
from typing import Any
from uuid import UUID

import httpx
from pydantic import ValidationError

from hring_api.config import Settings
from hring_api.domains.ai.gateway_client import AiGatewayError, generate_with_ai_gateway
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
برای هر لایه امتیاز 0 تا 100 بده. Red Flag و Green Flag فقط وقتی بنویس که مستند به ورودی باشد؛ نبود اطلاعات را به عنوان هشدار نساز. matchScore باید 0 تا 100 و candidateTemperature یکی از hot/warm/cold باشد. پاسخ فقط JSON Array معتبر و بدون markdown باشد."""


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


async def _enrich_candidate(
    *,
    candidate: CandidateAnalysisInput,
    job: JobRequirements,
    user_id: UUID,
    company_id: UUID | None,
    settings: Settings,
) -> str:
    if not settings.recruiting_web_enrichment_enabled or not candidate.name:
        return ""
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
    try:
        result = await generate_with_ai_gateway(
            feature_key="smart_headhunting.web_enrichment",
            user_id=user_id,
            company_id=company_id,
            provider=settings.recruiting_enrichment_provider,
            model=settings.recruiting_enrichment_model,
            messages=messages,
            max_output_tokens=800,
        )
        return result.content[:12_000]
    except AiGatewayError:
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
) -> AnalyzeCandidatesResponse:
    if len(candidates) > settings.recruiting_analysis_max_candidates:
        raise RecruitingAiError(
            f"حداکثر {settings.recruiting_analysis_max_candidates} کاندیدا در هر درخواست قابل پردازش است"
        )

    prepared: list[dict[str, Any]] = []
    for index, candidate in enumerate(candidates):
        row = candidate.model_dump(by_alias=True, exclude_none=True)
        row["sourceIndex"] = index
        if enable_web_search:
            web_info = await _enrich_candidate(
                candidate=candidate,
                job=job,
                user_id=user_id,
                company_id=company_id,
                settings=settings,
            )
            if web_info:
                row["webResearchInfo"] = web_info
        prepared.append(row)

    user_prompt = f"""الزامات شغلی:\n{_job_text(job)}\n\nکاندیداها:\n{json.dumps(prepared, ensure_ascii=False)}\n\nبرای هر کاندیدا این فیلدها را برگردان: name,email,phone,title,education,experience,lastCompany,location,linkedin,skills,matchScore,candidateTemperature,layerScores(activitySentiment,hardSkillMatch,careerTrajectory,cultureFit,riskOpportunity),redFlags,greenFlags,summary,recommendation. نتایج را بر اساس matchScore نزولی مرتب کن."""

    try:
        result = await generate_with_ai_gateway(
            feature_key="smart_headhunting.candidate_analysis",
            user_id=user_id,
            company_id=company_id,
            provider=settings.recruiting_ai_provider,
            model=settings.recruiting_ai_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            max_output_tokens=12_000,
        )
    except AiGatewayError as exc:
        raise RecruitingAiError("سرویس تحلیل هوش مصنوعی در دسترس نیست") from exc

    raw_rows = _extract_json_array(result.content)
    processed: list[AnalyzedCandidate] = []
    for index, raw in enumerate(raw_rows):
        source = candidates[index] if index < len(candidates) else None
        normalized: dict[str, Any] = dict(raw)
        normalized.setdefault("name", source.name if source and source.name else f"کاندیدا {index + 1}")
        normalized.setdefault("email", source.email if source and source.email else "")
        normalized.setdefault("phone", source.phone if source and source.phone else "")
        normalized.setdefault("location", source.location if source and source.location else job.city)
        normalized.setdefault("skills", [])
        normalized.setdefault("matchScore", 50)
        normalized.setdefault("candidateTemperature", "cold")
        normalized.setdefault("layerScores", {})
        normalized.setdefault("redFlags", [])
        normalized.setdefault("greenFlags", [])
        normalized.setdefault("summary", "")
        normalized.setdefault("recommendation", "در لیست انتظار")
        if source is not None:
            normalized["rawData"] = source.raw_data
        try:
            processed.append(AnalyzedCandidate.model_validate(normalized))
        except ValidationError:
            logger.warning("Dropping malformed AI candidate row", exc_info=True)

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
        raise RecruitingSourcingUnavailableError("دریافت کاندیدا از سرویس sourcing ناموفق بود") from exc

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