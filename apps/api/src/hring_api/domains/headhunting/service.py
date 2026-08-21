import asyncio
import json
import re
from typing import Any
from uuid import UUID

from hring_api.config import get_settings
from hring_api.domains.ai.gateway_client import AiGatewayError, generate_with_ai_gateway
from hring_api.domains.headhunting.schemas import (
    AnalysisStats,
    AnalyzeCandidatesRequest,
    AnalyzeCandidatesResponse,
    CandidateCreate,
    CandidateInput,
)
from hring_api.domains.identity.dependencies import Principal


SYSTEM_PROMPT = """تو یک استعدادیاب ارشد هستی. برای هر کاندیدا فقط بر اساس اطلاعات داده‌شده، پنج لایه را ارزیابی کن:
1) Activity & Sentiment
2) Hard Skill Match
3) Career Trajectory
4) Soft Skills & Culture Fit
5) Risk & Opportunity

قوانین:
- هرگز نام، ایمیل، تلفن یا سایر اطلاعات هویتی را حدس نزن یا بازنویسی نکن.
- نبود اطلاعات را Red Flag محسوب نکن.
- Green/Red Flag فقط با شاهد موجود بنویس.
- امتیازها بین 0 و 100 باشند.
- candidateTemperature فقط hot، warm یا cold باشد.
- خروجی دقیقاً JSON Array باشد؛ بدون markdown.

برای هر عضو فقط این فیلدها را برگردان:
sourceIndex, matchScore, candidateTemperature, layerScores, redFlags, greenFlags, summary, recommendation.
"""


def _safe_candidate_for_ai(candidate: CandidateInput, source_index: int) -> dict[str, object]:
    # raw_data can contain arbitrary uploaded/private content and is intentionally
    # excluded from third-party AI calls. Only declared professional fields leave HRing.
    data = candidate.model_dump(exclude={"raw_data"}, exclude_none=True)
    data["sourceIndex"] = source_index
    return data


def _extract_json_array(content: str) -> list[dict[str, Any]]:
    text = content.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        start = text.find("[")
        end = text.rfind("]")
        if start < 0 or end <= start:
            raise ValueError("AI analysis did not return a JSON array") from exc
        parsed = json.loads(text[start : end + 1])
    if not isinstance(parsed, list):
        raise ValueError("AI analysis did not return a JSON array")
    result: list[dict[str, Any]] = []
    for item in parsed:
        if isinstance(item, dict):
            result.append(item)
    return result


def _score(value: object, default: int = 50) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return default
    return max(0, min(100, round(value)))


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()][:50]


def _analysis_for_source(
    analyses: list[dict[str, Any]],
    *,
    source_index: int,
) -> dict[str, Any]:
    for item in analyses:
        raw_index = item.get("sourceIndex")
        if isinstance(raw_index, int) and raw_index == source_index:
            return item
    if source_index < len(analyses):
        return analyses[source_index]
    return {}


async def _research_candidate(
    *,
    semaphore: asyncio.Semaphore,
    candidate: CandidateInput,
    source_index: int,
    job_title: str,
    industry: str | None,
    principal: Principal,
    company_id: UUID | None,
) -> str:
    if not candidate.name:
        return ""
    settings = get_settings()
    query = " ".join(
        part
        for part in [candidate.name, candidate.last_company, industry, job_title]
        if part
    )
    async with semaphore:
        try:
            result = await generate_with_ai_gateway(
                feature_key="headhunting.web_research",
                user_id=principal.user_id,
                company_id=company_id,
                provider=settings.ai_headhunting_research_provider,
                model=settings.ai_headhunting_research_model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a professional headhunter researching only public professional "
                            "information. Focus on career history, professional activity and recent "
                            "career signals. Respond in Persian. Do not infer sensitive personal data."
                        ),
                    },
                    {
                        "role": "user",
                        "content": f"جستجوی حرفه‌ای برای کاندیدای شماره {source_index + 1}: {query}",
                    },
                ],
                max_output_tokens=1500,
            )
            return result.content[:20_000]
        except AiGatewayError:
            # Web enrichment is optional. A provider outage must not make the base
            # resume analysis unusable; the failed call is still recorded by metering.
            return ""


async def analyze_candidates(
    *,
    principal: Principal,
    payload: AnalyzeCandidatesRequest,
    company_id: UUID | None,
) -> AnalyzeCandidatesResponse:
    settings = get_settings()
    research_results = [""] * len(payload.candidates)

    if payload.enable_web_search:
        semaphore = asyncio.Semaphore(4)
        research_results = await asyncio.gather(
            *[
                _research_candidate(
                    semaphore=semaphore,
                    candidate=candidate,
                    source_index=index,
                    job_title=payload.job_requirements.job_title,
                    industry=payload.job_requirements.industry,
                    principal=principal,
                    company_id=company_id,
                )
                for index, candidate in enumerate(payload.candidates)
            ]
        )

    candidates_for_ai: list[dict[str, object]] = []
    for index, candidate in enumerate(payload.candidates):
        item = _safe_candidate_for_ai(candidate, index)
        if research_results[index]:
            item["publicProfessionalResearch"] = research_results[index]
        candidates_for_ai.append(item)

    requirements = payload.job_requirements.model_dump(exclude_none=True)
    user_prompt = (
        "الزامات شغلی:\n"
        + json.dumps(requirements, ensure_ascii=False)
        + "\n\nکاندیداها:\n"
        + json.dumps(candidates_for_ai, ensure_ascii=False)
        + "\n\nبرای همه کاندیداها تحلیل پنج‌لایه را انجام بده. sourceIndex هر ورودی را بدون تغییر برگردان."
    )

    result = await generate_with_ai_gateway(
        feature_key="headhunting.candidate_analysis",
        user_id=principal.user_id,
        company_id=company_id,
        provider=settings.ai_headhunting_analysis_provider,
        model=settings.ai_headhunting_analysis_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        max_output_tokens=12_000,
    )
    analyses = _extract_json_array(result.content)

    processed: list[CandidateCreate] = []
    for index, original in enumerate(payload.candidates):
        analysis = _analysis_for_source(analyses, source_index=index)
        layer_raw = analysis.get("layerScores")
        layer_scores: dict[str, int] = {}
        if isinstance(layer_raw, dict):
            layer_scores = {
                str(key): _score(value)
                for key, value in layer_raw.items()
                if len(str(key)) <= 80
            }

        temperature = str(analysis.get("candidateTemperature", "cold")).lower()
        if temperature not in {"hot", "warm", "cold"}:
            temperature = "cold"

        raw_data = dict(original.raw_data or {})
        summary = str(analysis.get("summary", "")).strip()
        if summary:
            raw_data["ai_summary"] = summary[:20_000]

        processed.append(
            CandidateCreate(
                name=original.name,
                email=original.email,
                phone=original.phone,
                skills=original.skills,
                experience=original.experience,
                education=original.education,
                last_company=original.last_company,
                location=original.location,
                title=original.title,
                raw_data=raw_data or None,
                match_score=_score(analysis.get("matchScore")),
                candidate_temperature=temperature,  # type: ignore[arg-type]
                recommendation=str(analysis.get("recommendation", "در لیست انتظار"))[:10_000],
                green_flags=_string_list(analysis.get("greenFlags")),
                red_flags=_string_list(analysis.get("redFlags")),
                layer_scores=layer_scores,
            )
        )

    processed.sort(key=lambda item: item.match_score, reverse=True)
    scores = [item.match_score for item in processed]
    stats = AnalysisStats(
        total=len(processed),
        excellent=sum(score >= 85 for score in scores),
        good=sum(70 <= score < 85 for score in scores),
        average=sum(score < 70 for score in scores),
        avg_score=round(sum(scores) / len(scores)) if scores else 0,
        hot_candidates=sum(item.candidate_temperature == "hot" for item in processed),
        warm_candidates=sum(item.candidate_temperature == "warm" for item in processed),
        cold_candidates=sum(item.candidate_temperature == "cold" for item in processed),
    )
    return AnalyzeCandidatesResponse(candidates=processed, stats=stats)
