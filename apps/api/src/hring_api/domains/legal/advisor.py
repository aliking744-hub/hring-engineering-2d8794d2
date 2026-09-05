from __future__ import annotations

from base64 import b64decode
from binascii import Error as Base64Error
import re
from time import time
from uuid import UUID

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
    LegalAdvisorRequest,
    LegalAdvisorResponse,
    LegalAdvisorSource,
    LegalSearchRequest,
)
from hring_api.domains.legal.service import search_legal_knowledge


LEGAL_ADVISOR_FEATURE_KEY = "legal.advisor_chat"
LEGAL_ADVISOR_PROMPT_KEY = LEGAL_ADVISOR_FEATURE_KEY

SYSTEM_PROMPT = """شما یک مشاور حقوقی متخصص در قوانین کار و تامین اجتماعی ایران هستید. فقط بر اساس منابع شماره‌گذاری‌شده ارائه‌شده پاسخ دهید.

قوانین پاسخگویی:
1. فقط بر اساس متون قانونی ارائه شده پاسخ دهید
2. اگر اطلاعات کافی در متون نیست، صادقانه بگویید
3. پس از هر گزاره حقوقی، ارجاع منبع را دقیقاً به شکل [1]، [2] و مانند آن بنویسید
4. شماره ماده، تاریخ و شماره رای را هرجا در منبع وجود دارد ذکر کنید
5. پاسخ را ساده و قابل فهم بنویسید
6. میان متن قانون، رای دیوان و برداشت تحلیلی تفاوت روشن بگذارید
7. اگر موضوع پیچیده است، توصیه به مشاوره با وکیل کنید
8. متن استخراج‌شده از تصویر یا PDF پیوست‌شده را تحلیل کنید و در پاسخ لحاظ کنید
9. هیچ منبع، ماده، رای یا تاریخی را حدس نزنید"""

USER_PROMPT = """متون قانونی مرتبط:
{legal_context}

---

سابقه مکالمه:
{conversation_history}

---

متن پیوست‌ها:
{attachment_context}

---

سوال کاربر: {query}"""

_ATTACHMENT_TYPES = {
    "application/pdf": (".pdf", "application/pdf"),
    "image/png": (".png", "image/png"),
    "image/jpeg": (".jpg", "image/jpeg"),
    "image/webp": (".webp", "image/webp"),
    "image/tiff": (".tiff", "image/tiff"),
}


class LegalAdvisorError(RuntimeError):
    pass


class LegalAdvisorInputError(LegalAdvisorError):
    pass


class LegalAdvisorRateLimitError(LegalAdvisorError):
    pass


class LegalAdvisorNoSourcesError(LegalAdvisorError):
    pass


_CITATION_PATTERN = re.compile(r"\[(\d+)]")


def _company_id(principal: Principal) -> UUID | None:
    for membership in principal.memberships:
        if membership.is_active:
            return membership.company_id
    return None


async def enforce_legal_advisor_rate_limit(
    *,
    user_id: UUID,
    settings: Settings,
) -> None:
    if not settings.rate_limit_enabled or settings.environment.lower() == "test":
        return
    redis = Redis.from_url(settings.redis_url, encoding="utf-8", decode_responses=True)
    window = int(time() // 60)
    key = f"hring:rate:legal_advisor:{user_id}:{window}"
    try:
        current = await redis.incr(key)
        if current == 1:
            await redis.expire(key, 75)
    except RedisError as exc:
        if settings.environment.lower() == "production":
            raise LegalAdvisorError("محافظت سرویس مشاور حقوقی موقتاً در دسترس نیست") from exc
        return
    finally:
        await redis.aclose()
    if current > settings.rate_limit_legal_advisor_per_minute:
        raise LegalAdvisorRateLimitError("تعداد درخواست‌ها بیش از حد مجاز است")


def _decode_data_url(value: str, *, expected: str) -> tuple[str, bytes, str]:
    header, separator, encoded = value.partition(",")
    if not separator or not header.startswith("data:") or ";base64" not in header:
        raise LegalAdvisorInputError("فرمت فایل پیوست معتبر نیست")
    mime_type = header[5:].split(";", 1)[0].lower()
    attachment = _ATTACHMENT_TYPES.get(mime_type)
    if attachment is None or (expected == "pdf" and mime_type != "application/pdf"):
        raise LegalAdvisorInputError("نوع فایل پیوست پشتیبانی نمی‌شود")
    if expected == "image" and not mime_type.startswith("image/"):
        raise LegalAdvisorInputError("نوع تصویر پیوست معتبر نیست")
    if len(encoded) > ((MAX_DOCUMENT_BYTES * 4) // 3) + 16:
        raise LegalAdvisorInputError("حجم فایل پیوست بیش از حد مجاز است")
    try:
        raw = b64decode(encoded, validate=True)
    except (Base64Error, ValueError) as exc:
        raise LegalAdvisorInputError("محتوای فایل پیوست معتبر نیست") from exc
    if not raw or len(raw) > MAX_DOCUMENT_BYTES:
        raise LegalAdvisorInputError("حجم فایل پیوست معتبر نیست")
    suffix, declared_type = attachment
    return suffix, raw, declared_type


async def _attachment_context(payload: LegalAdvisorRequest) -> str:
    extracted: list[str] = []
    items = [(value, "image") for value in payload.images]
    items.extend((value, "pdf") for value in payload.pdfs)
    for index, (value, kind) in enumerate(items, start=1):
        suffix, raw, mime_type = _decode_data_url(value, expected=kind)
        try:
            document = await extract_upload(
                f"legal-attachment-{index}{suffix}",
                raw,
                mime_type,
            )
        except LegalIngestionError as exc:
            raise LegalAdvisorInputError("متن پیوست قابل استخراج نیست") from exc
        extracted.append(f"[پیوست {index}]\n{document.text[:12_000]}")
    return "\n\n".join(extracted)[:30_000] or "پیوستی ارسال نشده است."


def _history_text(payload: LegalAdvisorRequest) -> str:
    if not payload.conversation_history:
        return "این نخستین پیام مکالمه است."
    labels = {"user": "کاربر", "assistant": "مشاور"}
    return "\n".join(
        f"{labels[item.role]}: {item.content}"
        for item in payload.conversation_history[-6:]
    )


async def generate_legal_advice(
    session: AsyncSession,
    *,
    payload: LegalAdvisorRequest,
    principal: Principal,
    settings: Settings,
    credits_charged: int = 0,
) -> LegalAdvisorResponse:
    results = await search_legal_knowledge(
        session,
        payload=LegalSearchRequest(
            query=payload.query,
            match_count=5,
            match_threshold=0.3,
        ),
    )
    if not results:
        raise LegalAdvisorNoSourcesError(
            "منبع قانونی مرتبطی در پایگاه دانش پیدا نشد؛ اعتباری کسر نشد. "
            "پرسش را دقیق‌تر کنید یا پس از تکمیل منابع قانونی دوباره تلاش کنید."
        )
    legal_context = "\n\n---\n\n".join(
            f"[{index}] "
            f"{'ماده ' + item.article_number if item.article_number else item.title}\n"
            f"{item.content[:1500]}"
            for index, item in enumerate(results, start=1)
        )
    variables = {
        "legal_context": legal_context,
        "conversation_history": _history_text(payload),
        "attachment_context": await _attachment_context(payload),
        "query": payload.query,
    }

    async def fallback() -> AiGatewayResult:
        route = await resolve_runtime_feature_route(
            feature_key=LEGAL_ADVISOR_FEATURE_KEY,
            default_provider=settings.legal_advisor_ai_provider,
            default_model=settings.legal_advisor_ai_model,
        )
        return await generate_with_ai_gateway(
            feature_key=LEGAL_ADVISOR_FEATURE_KEY,
            user_id=principal.user_id,
            company_id=_company_id(principal),
            provider=route.provider,
            model=route.model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": USER_PROMPT.format_map(variables)},
            ],
            max_output_tokens=2_000,
            credits_charged=credits_charged,
            metadata_json={
                "ai_route_source": route.source,
                "prompt_key": LEGAL_ADVISOR_PROMPT_KEY,
                "prompt_mode": "embedded_fallback",
                "legal_sources_found": len(results),
                "images_attached": len(payload.images),
                "pdfs_attached": len(payload.pdfs),
            },
        )

    try:
        generated = await generate_with_managed_prompt(
            session,
            prompt_key=LEGAL_ADVISOR_PROMPT_KEY,
            variables=variables,
            user_id=principal.user_id,
            company_id=_company_id(principal),
            fallback=fallback,
            credits_charged=credits_charged,
        )
    except (AiGatewayError, PromptRegistryError) as exc:
        raise LegalAdvisorError("سرویس مشاور حقوقی در دسترس نیست") from exc
    answer = generated.content.strip()
    if not answer:
        raise LegalAdvisorError("پاسخی از مشاور حقوقی دریافت نشد")
    citations = {int(value) for value in _CITATION_PATTERN.findall(answer)}
    if not citations or any(value < 1 or value > len(results) for value in citations):
        raise LegalAdvisorError("پاسخ بدون ارجاع معتبر تولید شد؛ اعتباری کسر نشد")
    return LegalAdvisorResponse(
        answer=answer,
        sources=[
            LegalAdvisorSource(
                reference_number=index,
                article_number=item.article_number,
                category=item.category,
                similarity=item.similarity,
                title=item.title,
                source_url=item.source_url,
                source_version=item.source_version,
                published_at=item.published_at,
            )
            for index, item in enumerate(results, start=1)
        ],
    )
