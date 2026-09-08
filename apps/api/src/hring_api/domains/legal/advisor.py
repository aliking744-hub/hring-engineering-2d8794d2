from __future__ import annotations

from base64 import b64decode
from binascii import Error as Base64Error
import json
import re
from time import time
from urllib.parse import urlsplit
from uuid import UUID

from redis.asyncio import Redis
from redis.exceptions import RedisError
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings
from hring_api.domains.ai.feature_routing import resolve_runtime_feature_route
from hring_api.domains.ai.gateway_client import (
    AiCitation,
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
    Category,
    LegalAdvisorRequest,
    LegalAdvisorResponse,
    LegalAdvisorSource,
    LegalSearchRequest,
)
from hring_api.domains.legal.service import search_legal_knowledge


LEGAL_ADVISOR_FEATURE_KEY = "legal.advisor_chat"
LEGAL_ADVISOR_PROMPT_KEY = LEGAL_ADVISOR_FEATURE_KEY

OFFICIAL_LEGAL_HOSTS = frozenset(
    {
        "mcls.gov.ir",
        "www.mcls.gov.ir",
        "qavanin.ir",
        "www.qavanin.ir",
        "sso.ir",
        "www.sso.ir",
        "divan-edalat.ir",
        "www.divan-edalat.ir",
    }
)

SYSTEM_PROMPT = """شما دستیار تحلیل حقوق کار و تامین اجتماعی ایران هستید. فقط بر اساس منابع رسمی شماره‌گذاری‌شده ارائه‌شده پاسخ دهید و هرگز از حافظه عمومی مدل برای ساخت حکم، ماده، رای، تاریخ یا عدد استفاده نکنید.

قواعد الزامی:
1. هر گزاره حقوقی باید بلافاصله ارجاعی مانند [1] یا [2] داشته باشد.
2. شماره ماده، تبصره، تاریخ و شماره رای را فقط وقتی عیناً در منبع آمده ذکر کنید.
3. میان نص قانون، رای یا مقرره، تحلیل و پیشنهاد عملی مرزبندی روشن داشته باشید.
4. اگر منابع کافی نیستند، بنویسید «منبع رسمی کافی در پایگاه موجود نیست» و حکم احتمالی نسازید.
5. در صورت تعارض منابع، تعارض و تاریخ هر منبع را اعلام کنید.
6. پیوست کاربر شرح واقعه یا سند پرونده است، نه منبع قانون.
7. هیچ وب‌سایت، ماده، رای، تاریخ، مهلت یا مبلغی را حدس نزنید.

قالب اجباری پاسخ:
### نتیجه کوتاه
### مستند قانونی
### تحلیل وضعیت
### استثناها و ریسک‌ها
### اقدام پیشنهادی"""

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
_JSON_OBJECT_PATTERN = re.compile(r"\{.*\}", re.DOTALL)
LIVE_SEARCH_PROVIDER = "avalai.search"
LIVE_SEARCH_MODEL = "sonar"
LIVE_SEARCH_THRESHOLD = 0.45
LIVE_SEARCH_DOMAIN_FILTER = (
    "mcls.gov.ir",
    "qavanin.ir",
    "sso.ir",
    "divan-edalat.ir",
)


def _is_official_source(url: str | None) -> bool:
    if not url:
        return False
    parsed = urlsplit(url)
    hostname = parsed.hostname
    return parsed.scheme == "https" and hostname is not None and any(
        hostname == official_host
        or hostname.endswith(f".{official_host}")
        for official_host in OFFICIAL_LEGAL_HOSTS
    )


def _is_direct_official_source(url: str | None) -> bool:
    if not _is_official_source(url):
        return False
    parsed = urlsplit(url or "")
    # A homepage is not a verifiable legal citation. The URL must identify a
    # document/page through a path or a query parameter.
    return parsed.path not in ("", "/") or bool(parsed.query)


def _live_source_category(title: str, url: str) -> Category:
    value = f"{title} {url}".casefold()
    if any(token in value for token in ("تامین اجتماعی", "تأمین اجتماعی", "بیمه", "sso.ir")):
        return "social_security"
    if any(token in value for token in ("رای", "رأی", "دیوان عدالت", "divan-edalat")):
        return "court_rulings"
    return "labor_law"


def _sources_from_gateway_citations(
    provider_citations: tuple[AiCitation, ...],
    references: set[int],
) -> list[LegalAdvisorSource]:
    if not provider_citations or not references:
        raise LegalAdvisorError(
            "جست‌وجوی زنده بدون ارجاع قابل تطبیق از سرویس جست‌وجو بود"
        )
    sources: list[LegalAdvisorSource] = []
    for reference in sorted(references):
        if reference < 1 or reference > len(provider_citations):
            raise LegalAdvisorError("شماره ارجاع جست‌وجوی زنده معتبر نیست")
        citation = provider_citations[reference - 1]
        if not _is_direct_official_source(citation.url):
            raise LegalAdvisorError(
                "یکی از ارجاع‌های پاسخ به منبع رسمی مستقیم متصل نیست"
            )
        hostname = urlsplit(citation.url).hostname or "منبع رسمی"
        title = (citation.title or hostname).strip()
        sources.append(
            LegalAdvisorSource(
                reference_number=reference,
                article_number=None,
                category=_live_source_category(title, citation.url),
                similarity=1.0,
                title=title[:500],
                source_url=citation.url,
                source_version=1,
                published_at=None,
            )
        )
    return sources


def _parse_live_search_response(
    content: str,
    *,
    provider_citations: tuple[AiCitation, ...] | None = None,
) -> tuple[str, list[LegalAdvisorSource]]:
    match = _JSON_OBJECT_PATTERN.search(content)
    if match is None:
        raise LegalAdvisorError("جست‌وجوی زنده پاسخ ساختاریافته و قابل استناد تولید نکرد")
    try:
        payload = json.loads(match.group(0))
    except (json.JSONDecodeError, TypeError) as exc:
        raise LegalAdvisorError("جست‌وجوی زنده پاسخ ساختاریافته و قابل استناد تولید نکرد") from exc
    if not isinstance(payload, dict):
        raise LegalAdvisorError("ساختار پاسخ جست‌وجوی زنده معتبر نیست")
    answer = str(payload.get("answer", "")).strip()
    raw_sources = payload.get("sources")
    if not answer:
        raise LegalAdvisorError("جست‌وجوی زنده بدون پاسخ یا منبع رسمی بود")

    references = {int(value) for value in _CITATION_PATTERN.findall(answer)}
    if provider_citations is not None:
        return answer, _sources_from_gateway_citations(
            provider_citations,
            references,
        )
    if not isinstance(raw_sources, list):
        raise LegalAdvisorError("جست‌وجوی زنده بدون پاسخ یا منبع رسمی بود")

    sources: list[LegalAdvisorSource] = []
    for index, item in enumerate(raw_sources[:5], start=1):
        if not isinstance(item, dict):
            continue
        url = str(item.get("url", "")).strip()
        title = str(item.get("title", "")).strip()
        if not title or not _is_direct_official_source(url):
            continue
        article = str(item.get("article_number", "")).strip() or None
        sources.append(
            LegalAdvisorSource(
                reference_number=index,
                article_number=article[:80] if article else None,
                category=_live_source_category(title, url),
                similarity=1.0,
                title=title[:500],
                source_url=url,
                source_version=1,
                published_at=None,
            )
        )
    citations = {int(value) for value in _CITATION_PATTERN.findall(answer)}
    if (
        not sources
        or not citations
        or any(value < 1 or value > len(sources) for value in citations)
    ):
        raise LegalAdvisorError(
            "جست‌وجوی زنده منبع رسمی قابل تطبیق با ارجاعات پاسخ ارائه نکرد"
        )
    return answer, sources


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


async def _generate_live_official_advice(
    *,
    payload: LegalAdvisorRequest,
    principal: Principal,
    credits_charged: int,
) -> LegalAdvisorResponse:
    live_system_prompt = """شما موتور جست‌وجوی حقوق کار ایران هستید.
فقط در این دامنه‌های رسمی جست‌وجو کنید: mcls.gov.ir، qavanin.ir، sso.ir و divan-edalat.ir.
هیچ منبع دیگری مجاز نیست. اگر منبع رسمی کافی نیست، پاسخ نسازید.
خروجی باید فقط یک JSON معتبر و بدون markdown با این ساختار باشد:
{"answer":"پاسخ فارسی ساختاریافته با ارجاع‌های [1] و [2]","sources":[{"title":"عنوان رسمی","url":"https://...","article_number":"شماره ماده یا null"}]}
URL هر منبع باید لینک مستقیم همان صفحه، سند، قانون، بخشنامه یا رأی باشد.
لینک صفحه اصلی دامنه مانند https://qavanin.ir/ یا https://www.mcls.gov.ir/ منبع معتبر محسوب نمی‌شود.
URL را دقیقاً از نتیجه جست‌وجو بردارید و هرگز آن را حدس نزنید یا کوتاه نکنید.
برای قانون کار، این نشانی مستقیم و از پیش تأییدشده سامانه ملی قوانین را در اولویت قرار دهید:
https://qavanin.ir/Law/TreeText/?IDS=3983654531606411392
فهرست رسمی قوانین و دستورالعمل‌های کارگری وزارت تعاون نیز این نشانی است:
https://www.mcls.gov.ir/fa/rahnamayemorajein/karegaran-%D9%82%D9%88%D8%A7%D9%86%DB%8C%D9%86-%D9%85%D8%B1%D8%AA%D8%A8%D8%B7-%D8%A8%D8%A7-%DA%A9%D8%A7%D8%B1%DA%AF%D8%B1%D8%A7%D9%86
در پرسش‌های مربوط به مواد قانون کار، منبع نخست باید نشانی مستقیم سامانه ملی قوانین بالا باشد،
مگر اینکه یک URL رسمی و مستقیم دقیق‌تر برای همان سند پیدا کرده باشید.
در آرایه sources فقط منابعی را قرار دهید که URL مستقیم و معتبر دارند؛
منبع دارای URL صفحه اصلی را حتی به‌عنوان منبع اضافی برنگردانید.
در answer از قالب نتیجه کوتاه، مستند قانونی، تحلیل وضعیت، استثناها و اقدام پیشنهادی استفاده کنید.
هر ادعای حقوقی باید ارجاع داشته باشد و شماره ماده، رای، تاریخ، مهلت یا مبلغ نباید حدس زده شود."""
    generated = await generate_with_ai_gateway(
        feature_key=LEGAL_ADVISOR_FEATURE_KEY,
        user_id=principal.user_id,
        company_id=_company_id(principal),
        provider=LIVE_SEARCH_PROVIDER,
        model=LIVE_SEARCH_MODEL,
        messages=[
            {"role": "system", "content": live_system_prompt},
            {
                "role": "user",
                "content": (
                    f"سؤال کاربر: {payload.query}\n\n"
                    f"سابقه مکالمه:\n{_history_text(payload)}\n\n"
                    f"متن پیوست‌ها:\n{await _attachment_context(payload)}"
                ),
            },
        ],
        max_output_tokens=2_000,
        credits_charged=credits_charged,
        search_domain_filter=list(LIVE_SEARCH_DOMAIN_FILTER),
        metadata_json={
            "prompt_key": LEGAL_ADVISOR_PROMPT_KEY,
            "prompt_mode": "official_live_search_fallback",
            "official_domain_allowlist": sorted(OFFICIAL_LEGAL_HOSTS),
        },
    )
    answer, sources = _parse_live_search_response(
        generated.content.strip(),
        provider_citations=generated.citations,
    )
    return LegalAdvisorResponse(answer=answer, sources=sources)


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
    results = [item for item in results if _is_official_source(item.source_url)]
    if not results or max(item.similarity for item in results) < LIVE_SEARCH_THRESHOLD:
        try:
            return await _generate_live_official_advice(
                payload=payload,
                principal=principal,
                credits_charged=credits_charged,
            )
        except AiGatewayError as exc:
            raise LegalAdvisorNoSourcesError(
                "منبع رسمی مرتبطی در پایگاه و جست‌وجوی زنده پیدا نشد؛ "
                "پاسخی تولید و اعتباری کسر نشد."
            ) from exc
    legal_context = "\n\n---\n\n".join(
            f"[{index}] منبع رسمی: {item.title}\n"
            f"{'ماده ' + item.article_number if item.article_number else item.title}\n"
            f"نشانی رسمی: {item.source_url}\n"
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

