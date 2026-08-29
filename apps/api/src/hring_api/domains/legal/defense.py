from __future__ import annotations

import json
from base64 import b64decode
from binascii import Error as Base64Error
from time import time
from typing import TypeVar
from uuid import UUID

from pydantic import BaseModel, Field, ValidationError
from redis.asyncio import Redis
from redis.exceptions import RedisError
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
from hring_api.domains.identity.dependencies import Principal
from hring_api.domains.legal.ingestion import (
    MAX_DOCUMENT_BYTES,
    LegalIngestionError,
    extract_upload,
)
from hring_api.domains.legal.schemas import (
    LegalDefenseClaim,
    LegalDefenseEvidenceAnalysis,
    LegalDefenseFollowUpQuestion,
    LegalDefenseGapAnalysis,
    LegalDefenseRequest,
    LegalDefenseResponse,
    LegalDefenseRelevantLaw,
    LegalDefenseVerdict,
    LegalSearchRequest,
)
from hring_api.domains.legal.service import search_legal_knowledge


LEGAL_DEFENSE_FEATURE_KEY = "legal.defense_builder"
CLAIMS_PROMPT_KEY = LEGAL_DEFENSE_FEATURE_KEY
GAP_PROMPT_KEY = "legal.defense_gap"
VERDICT_PROMPT_KEY = "legal.defense_verdict"

CLAIMS_SYSTEM_PROMPT = """شما یک تحلیلگر حقوقی متخصص قانون کار ایران هستید.
ادعاهای اصلی کارگر را فقط از متن پرونده استخراج کنید. اطلاعاتی را که در پرونده نیست اختراع نکنید.
خروجی باید فقط یک شیء JSON معتبر مطابق قرارداد اعلام‌شده باشد."""

CLAIMS_USER_PROMPT = """از دادخواست زیر، ادعاهای اصلی کارگر را استخراج کنید.

دادخواست:
{complaint_text}

اطلاعات تکمیلی:
{additional_info}

سابقه مکالمه:
{conversation_history}

برای هر ادعا claim_type، description و در صورت وجود amount_claimed را برگردانید."""

GAP_SYSTEM_PROMPT = """شما یک وکیل کار متخصص هستید.
مدارک واقعی کارفرما را با الزامات مواد قانونی ارائه‌شده مقایسه کنید و کسری‌ها را دقیق مشخص کنید.
خروجی باید فقط یک شیء JSON معتبر مطابق قرارداد اعلام‌شده باشد."""

GAP_USER_PROMPT = """ادعاهای کارگر:
{claims}

مواد قانونی مرتبط:
{relevant_laws}

مدارک ارائه‌شده توسط کارفرما:
{evidence_context}

برای هر ادعا مدارک لازم، مدارک موجود، مدارک ناقص و مبنای قانونی را تحلیل کنید.
سپس سوالات دقیق لازم برای تکمیل مدارک و مقدار can_proceed را برگردانید."""

VERDICT_SYSTEM_PROMPT = """شما یک وکیل باتجربه در دعاوی کار و دیوان عدالت اداری هستید.
ریسک پرونده کارفرما را فقط بر اساس ادعاها، قانون و مدارک تحلیل‌شده ارزیابی کنید.
خروجی باید فقط یک شیء JSON معتبر مطابق قرارداد اعلام‌شده باشد."""

VERDICT_USER_PROMPT = """ادعاهای کارگر:
{claims}

تحلیل مدارک:
{evidence_analysis}

مدارک موجود:
{evidence_summary}

مدارک ناقص:
{missing_evidence}

احتمال باخت را از ۰ تا ۱۰۰، سطح ریسک، توصیه راهبردی و استدلال را برگردانید.
نقاط قوت و ضعف را مشخص کنید. اگر توصیه fight است متن کامل لایحه دفاعیه و اگر settle است توصیه سازش را بنویسید."""

_ATTACHMENT_TYPES = {
    "application/pdf": (".pdf", "application/pdf"),
    "image/png": (".png", "image/png"),
    "image/jpeg": (".jpg", "image/jpeg"),
    "image/webp": (".webp", "image/webp"),
    "image/tiff": (".tiff", "image/tiff"),
}
ModelT = TypeVar("ModelT", bound=BaseModel)


class LegalDefenseError(RuntimeError):
    pass


class LegalDefenseInputError(LegalDefenseError):
    pass


class LegalDefenseRateLimitError(LegalDefenseError):
    pass


class _ClaimsOutput(BaseModel):
    claims: list[LegalDefenseClaim]


class _GapOutput(BaseModel):
    evidence_analysis: list[LegalDefenseEvidenceAnalysis]
    follow_up_questions: list[LegalDefenseFollowUpQuestion]
    can_proceed: bool


class _VerdictOutput(BaseModel):
    risk_score: float
    risk_level: str
    recommendation: str
    reasoning: str
    key_strengths: list[str] = Field(default_factory=list)
    key_weaknesses: list[str] = Field(default_factory=list)
    defense_bill: str | None = None
    settlement_advice: str | None = None


def _company_id(principal: Principal) -> UUID | None:
    for membership in principal.memberships:
        if membership.is_active:
            return membership.company_id
    return None


async def enforce_legal_defense_rate_limit(
    *,
    user_id: UUID,
    settings: Settings,
) -> None:
    if not settings.rate_limit_enabled or settings.environment.lower() == "test":
        return
    redis = Redis.from_url(settings.redis_url, encoding="utf-8", decode_responses=True)
    window = int(time() // 60)
    key = f"hring:rate:legal_defense:{user_id}:{window}"
    try:
        current = await redis.incr(key)
        if current == 1:
            await redis.expire(key, 75)
    except RedisError as exc:
        if settings.environment.lower() == "production":
            raise LegalDefenseError("محافظت سرویس دفاع کارفرما موقتاً در دسترس نیست") from exc
        return
    finally:
        await redis.aclose()
    if current > settings.rate_limit_legal_defense_per_minute:
        raise LegalDefenseRateLimitError("تعداد درخواست‌ها بیش از حد مجاز است")


def _decode_data_url(value: str, *, expected: str | None = None) -> tuple[str, bytes, str]:
    header, separator, encoded = value.partition(",")
    if not separator or not header.startswith("data:") or ";base64" not in header:
        raise LegalDefenseInputError("فرمت فایل پرونده معتبر نیست")
    mime_type = header[5:].split(";", 1)[0].lower()
    attachment = _ATTACHMENT_TYPES.get(mime_type)
    if attachment is None:
        raise LegalDefenseInputError("نوع فایل پرونده پشتیبانی نمی‌شود")
    if expected == "pdf" and mime_type != "application/pdf":
        raise LegalDefenseInputError("نوع فایل مدرک با مشخصات آن مطابقت ندارد")
    if expected == "image" and not mime_type.startswith("image/"):
        raise LegalDefenseInputError("نوع تصویر مدرک معتبر نیست")
    if len(encoded) > ((MAX_DOCUMENT_BYTES * 4) // 3) + 16:
        raise LegalDefenseInputError("حجم فایل بیش از حد مجاز است")
    try:
        raw = b64decode(encoded, validate=True)
    except (Base64Error, ValueError) as exc:
        raise LegalDefenseInputError("محتوای فایل معتبر نیست") from exc
    if not raw or len(raw) > MAX_DOCUMENT_BYTES:
        raise LegalDefenseInputError("حجم فایل معتبر نیست")
    suffix, declared_type = attachment
    return suffix, raw, declared_type


async def _extract_data_url(
    value: str,
    *,
    filename: str,
    expected: str | None = None,
) -> str:
    suffix, raw, mime_type = _decode_data_url(value, expected=expected)
    safe_name = filename if filename.lower().endswith(suffix) else f"{filename}{suffix}"
    try:
        document = await extract_upload(safe_name, raw, mime_type)
    except LegalIngestionError as exc:
        raise LegalDefenseInputError(f"متن فایل «{filename}» قابل استخراج نیست") from exc
    return document.text


def _history_text(payload: LegalDefenseRequest) -> str:
    if not payload.conversation_history:
        return "سابقه‌ای ارسال نشده است."
    labels = {"user": "کارفرما", "assistant": "وکیل"}
    return "\n".join(
        f"{labels[item.role]}: {item.content}"
        for item in payload.conversation_history[-6:]
    )


async def _case_context(payload: LegalDefenseRequest) -> tuple[str, str, str]:
    complaint_text = "ادامه مکالمه قبلی"
    if payload.complaint:
        complaint_text = await _extract_data_url(
            payload.complaint,
            filename="complaint",
        )

    evidence_parts: list[str] = []
    evidence_names: list[str] = []
    for item in payload.evidence:
        text = await _extract_data_url(
            item.content,
            filename=item.name,
            expected=item.type,
        )
        evidence_names.append(f"{item.name} ({item.type})")
        evidence_parts.append(f"--- محتوای {item.name} ---\n{text[:12_000]}")
    evidence_summary = "\n".join(
        f"{index}. {name}" for index, name in enumerate(evidence_names, start=1)
    ) or "مدرکی آپلود نشده است"
    evidence_context = (
        f"{evidence_summary}\n\n" + "\n\n".join(evidence_parts)
        if evidence_parts
        else evidence_summary
    )
    return complaint_text[:30_000], evidence_context[:60_000], evidence_summary


async def _generate_phase(
    session: AsyncSession,
    *,
    prompt_key: str,
    system_prompt: str,
    user_prompt: str,
    variables: dict[str, str],
    principal: Principal,
    settings: Settings,
    max_output_tokens: int,
) -> AiGatewayResult:
    async def fallback() -> AiGatewayResult:
        route = await resolve_runtime_feature_route(
            feature_key=LEGAL_DEFENSE_FEATURE_KEY,
            default_provider=settings.legal_defense_ai_provider,
            default_model=settings.legal_defense_ai_model,
        )
        return await generate_with_ai_gateway(
            feature_key=LEGAL_DEFENSE_FEATURE_KEY,
            user_id=principal.user_id,
            company_id=_company_id(principal),
            provider=route.provider,
            model=route.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt.format_map(variables)},
            ],
            max_output_tokens=max_output_tokens,
            response_format="json_object",
            metadata_json={
                "ai_route_source": route.source,
                "prompt_key": prompt_key,
                "prompt_mode": "embedded_fallback",
                "defense_phase": prompt_key.rsplit("_", 1)[-1],
            },
        )

    return await generate_with_managed_prompt(
        session,
        prompt_key=prompt_key,
        variables=variables,
        user_id=principal.user_id,
        company_id=_company_id(principal),
        fallback=fallback,
    )


def _parse_json(result: AiGatewayResult, model: type[ModelT]) -> ModelT:
    try:
        return model.model_validate(json.loads(result.content))
    except (ValueError, ValidationError) as exc:
        raise LegalDefenseError("خروجی تحلیل حقوقی ساختار معتبر ندارد") from exc


async def generate_legal_defense(
    session: AsyncSession,
    *,
    payload: LegalDefenseRequest,
    principal: Principal,
    settings: Settings,
) -> LegalDefenseResponse:
    complaint_text, evidence_context, evidence_summary = await _case_context(payload)
    claims_variables = {
        "complaint_text": complaint_text,
        "additional_info": payload.additional_info or "اطلاعات تکمیلی ارسال نشده است.",
        "conversation_history": _history_text(payload),
    }
    try:
        claims_result = await _generate_phase(
            session,
            prompt_key=CLAIMS_PROMPT_KEY,
            system_prompt=CLAIMS_SYSTEM_PROMPT,
            user_prompt=CLAIMS_USER_PROMPT,
            variables=claims_variables,
            principal=principal,
            settings=settings,
            max_output_tokens=2_000,
        )
        claims_output = _parse_json(claims_result, _ClaimsOutput)
        claims = claims_output.claims
        if not claims:
            raise LegalDefenseError("ادعایی از دادخواست قابل استخراج نبود")

        relevant_laws: list[LegalDefenseRelevantLaw] = []
        for claim in claims:
            results = await search_legal_knowledge(
                session,
                payload=LegalSearchRequest(
                    query=f"{claim.claim_type} {claim.description}",
                    match_count=3,
                    match_threshold=0.4,
                ),
            )
            relevant_laws.extend(
                LegalDefenseRelevantLaw(
                    claim_type=claim.claim_type,
                    article_number=item.article_number,
                    category=item.category,
                    content=item.content[:1_000],
                    similarity=item.similarity,
                )
                for item in results
            )

        claims_text = "\n".join(
            f"{index}. {claim.claim_type}: {claim.description}"
            for index, claim in enumerate(claims, start=1)
        )
        laws_text = "\n\n".join(
            f"- ماده {law.article_number or 'نامشخص'} ({law.category}): "
            f"{law.content[:500]}"
            for law in relevant_laws
        ) or "ماده مرتبطی در پایگاه قوانین یافت نشد."
        gap_result = await _generate_phase(
            session,
            prompt_key=GAP_PROMPT_KEY,
            system_prompt=GAP_SYSTEM_PROMPT,
            user_prompt=GAP_USER_PROMPT,
            variables={
                "claims": claims_text,
                "relevant_laws": laws_text,
                "evidence_context": evidence_context,
            },
            principal=principal,
            settings=settings,
            max_output_tokens=4_000,
        )
        gap_output = _parse_json(gap_result, _GapOutput)
        evidence_analysis = gap_output.evidence_analysis
        follow_up_questions = gap_output.follow_up_questions
        can_proceed = gap_output.can_proceed

        missing = [
            item
            for analysis in evidence_analysis
            for item in analysis.missing_evidence
        ]
        verdict_result = await _generate_phase(
            session,
            prompt_key=VERDICT_PROMPT_KEY,
            system_prompt=VERDICT_SYSTEM_PROMPT,
            user_prompt=VERDICT_USER_PROMPT,
            variables={
                "claims": claims_text,
                "evidence_analysis": json.dumps(
                    [item.model_dump() for item in evidence_analysis],
                    ensure_ascii=False,
                    indent=2,
                ),
                "evidence_summary": evidence_summary,
                "missing_evidence": ", ".join(missing) or "ندارد",
            },
            principal=principal,
            settings=settings,
            max_output_tokens=4_000,
        )
        verdict_output = _parse_json(verdict_result, _VerdictOutput)
        verdict = LegalDefenseVerdict.model_validate(verdict_output.model_dump())
    except (AiGatewayError, PromptRegistryError) as exc:
        raise LegalDefenseError("سرویس تحلیل دفاع کارفرما در دسترس نیست") from exc

    return LegalDefenseResponse(
        claims=claims,
        relevant_laws=relevant_laws[:5],
        gap_analysis=LegalDefenseGapAnalysis(
            evidence_analysis=evidence_analysis,
            follow_up_questions=follow_up_questions,
            can_proceed=can_proceed,
        ),
        verdict=verdict,
    )
