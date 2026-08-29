from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.legal.schemas import LegalSearchRequest
from hring_api.domains.legal.service import search_legal_knowledge


EVIDENCE_REQUIREMENTS: dict[str, list[dict[str, object]]] = {
    "wrongful_termination": [
        {"name": "قرارداد کار", "description": "قرارداد امضا شده بین شما و کارفرما", "required": True},
        {"name": "حکم اخراج یا فسخ", "description": "نامه رسمی اخراج یا فسخ قرارداد از طرف کارفرما", "required": True},
        {"name": "فیش حقوقی", "description": "آخرین فیش حقوقی یا گواهی پرداخت", "required": False},
        {"name": "شهادت همکاران", "description": "تایید کتبی از همکاران در مورد شرایط کار", "required": False},
        {"name": "سابقه بیمه", "description": "پرینت سوابق بیمه تامین اجتماعی", "required": True},
    ],
    "unpaid_salary": [
        {"name": "قرارداد کار", "description": "قرارداد امضا شده با ذکر حقوق توافقی", "required": True},
        {"name": "فیش‌های حقوقی", "description": "فیش‌های حقوقی ماه‌های پرداخت نشده", "required": False},
        {"name": "اظهارنامه بانکی", "description": "صورت‌حساب بانکی نشان‌دهنده عدم واریز", "required": True},
        {"name": "لیست حقوق و دستمزد", "description": "لیست حقوق امضا شده توسط کارفرما", "required": False},
        {"name": "کارت ساعت‌زنی", "description": "رکورد ورود و خروج یا حضور و غیاب", "required": False},
    ],
    "insurance_claim": [
        {"name": "قرارداد کار", "description": "قرارداد نشان‌دهنده رابطه کارگری", "required": True},
        {"name": "سابقه بیمه ناقص", "description": "پرینت سوابق بیمه نشان‌دهنده خلا یا کسری", "required": True},
        {"name": "فیش حقوقی", "description": "فیش حقوقی نشان‌دهنده کسر بیمه از حقوق", "required": False},
        {"name": "استعلام بیمه", "description": "استعلام رسمی از سازمان تامین اجتماعی", "required": True},
        {"name": "کارت ورود و خروج", "description": "مدرک حضور در محل کار", "required": False},
    ],
    "severance_pay": [
        {"name": "قرارداد کار", "description": "قرارداد با ذکر تاریخ شروع کار", "required": True},
        {"name": "سابقه بیمه", "description": "پرینت سوابق بیمه نشان‌دهنده سنوات", "required": True},
        {"name": "تسویه‌حساب", "description": "برگه تسویه‌حساب (در صورت وجود)", "required": False},
        {"name": "آخرین فیش حقوقی", "description": "فیش حقوقی برای محاسبه مبنای سنوات", "required": True},
        {"name": "نامه پایان کار", "description": "نامه رسمی اتمام همکاری", "required": False},
    ],
}

CLAIM_LABELS = {
    "wrongful_termination": "اخراج غیرقانونی",
    "unpaid_salary": "معوقات مزدی",
    "insurance_claim": "حق بیمه",
    "severance_pay": "سنوات و پایان کار",
}

LABOR_SYSTEM_TEMPLATE = """شما یک وکیل متخصص حقوق کار ایران هستید. وظیفه شما تحلیل پرونده شکایت کارگر و ارزیابی شانس موفقیت است.

قوانین مرتبط:
{legal_context}

شما باید:
1. بر اساس مدارک موجود و الزامات قانونی، احتمال موفقیت را از 0 تا 100 تخمین بزنید
2. نقاط قوت پرونده را شناسایی کنید
3. نقاط ضعف و مدارک ناقص را مشخص کنید
4. توصیه مشخص ارائه دهید (طرح دادخواست یا مذاکره)
5. اگر شانس موفقیت بالای 50% است، متن دادخواست رسمی تنظیم کنید

متن دادخواست باید:
- با عبارت «ریاست محترم هیات تشخیص اداره کار...» شروع شود
- به مواد قانونی مرتبط استناد کند
- فرمت رسمی سامانه جامع روابط کار را رعایت کند
- با عبارت «با احترام» و جای امضا پایان یابد

پاسخ فقط یک شیء JSON معتبر با فیلدهای winProbability، riskLevel، strongPoints، weakPoints، missingEvidence، recommendation، complaintText و relevantArticles باشد."""

LABOR_USER_TEMPLATE = """موضوع شکایت: {claim_label}

وضعیت مدارک کارگر:
{evidence_summary}

مدارک ضروری که ندارد: {missing_required}

تعداد فایل‌های اضافی: {additional_files_count}

پرونده را تحلیل کنید و نتیجه را فقط در فرمت JSON قراردادشده بدهید."""


class LaborComplaintError(RuntimeError):
    pass


@dataclass(frozen=True)
class LaborComplaintContext:
    claim_label: str
    evidence_summary: str
    missing_required: list[str]
    legal_context: str
    relevant_articles: list[str]
    additional_files_count: int
    available_evidence: list[str]

    def prompt_variables(self) -> dict[str, str]:
        return {
            "legal_context": self.legal_context,
            "claim_label": self.claim_label,
            "evidence_summary": self.evidence_summary,
            "missing_required": "، ".join(self.missing_required) or "همه مدارک ضروری موجود است",
            "additional_files_count": str(self.additional_files_count),
        }


def required_evidence(body: Any) -> dict[str, object] | None:
    if not isinstance(body, dict) or body.get("action") != "get_required_evidence":
        return None
    claim_type = body.get("claimType")
    if not isinstance(claim_type, str) or claim_type not in CLAIM_LABELS:
        raise LaborComplaintError("نوع شکایت معتبر نیست")
    return {"requiredEvidence": EVIDENCE_REQUIREMENTS[claim_type]}


async def build_context(
    session: AsyncSession,
    body: Any,
) -> LaborComplaintContext:
    if not isinstance(body, dict) or body.get("action") != "analyze_and_draft":
        raise LaborComplaintError("عملیات شکایت کار معتبر نیست")
    claim_type = body.get("claimType")
    if not isinstance(claim_type, str) or claim_type not in CLAIM_LABELS:
        raise LaborComplaintError("نوع شکایت معتبر نیست")
    raw_evidence = body.get("evidence", [])
    if not isinstance(raw_evidence, list) or len(raw_evidence) > 20:
        raise LaborComplaintError("فهرست مدارک معتبر نیست")

    normalized: list[tuple[str, bool, bool]] = []
    for item in raw_evidence:
        if not isinstance(item, dict):
            continue
        label = item.get("label")
        if not isinstance(label, str) or not label.strip():
            continue
        normalized.append((label.strip()[:500], item.get("hasIt") is True, bool(item.get("file"))))
    evidence_summary = "\n".join(
        f"- {label}: {'دارد' if has_it else 'ندارد'}{' (فایل پیوست)' if has_file else ''}"
        for label, has_it, has_file in normalized
    ) or "هیچ مدرکی اعلام نشده است"
    available = [label for label, has_it, _has_file in normalized if has_it]
    held = set(available)
    missing = [
        str(item["name"])
        for item in EVIDENCE_REQUIREMENTS[claim_type]
        if item["required"] is True and item["name"] not in held
    ]
    search_results = await search_legal_knowledge(
        session,
        payload=LegalSearchRequest(
            query=f"قانون کار {CLAIM_LABELS[claim_type]} مدارک اثبات شرایط",
            match_count=8,
            match_threshold=0.5,
        ),
    )
    legal_context = "\n\n".join(
        f"[{result.article_number or result.category}]: {result.content}"
        for result in search_results
    ) or "اطلاعات قانونی در دسترس نیست. از ساختن ماده قانونی خودداری کنید."
    articles = list(
        dict.fromkeys(
            result.article_number
            for result in search_results
            if result.article_number is not None
        )
    )
    additional = body.get("additionalFiles", [])
    additional_count = len(additional) if isinstance(additional, list) else 0
    return LaborComplaintContext(
        claim_label=CLAIM_LABELS[claim_type],
        evidence_summary=evidence_summary,
        missing_required=missing,
        legal_context=legal_context,
        relevant_articles=articles,
        additional_files_count=min(additional_count, 20),
        available_evidence=available,
    )


def fallback_result(context: LaborComplaintContext) -> dict[str, object]:
    complete = not context.missing_required
    return {
        "winProbability": 60 if complete else 30,
        "riskLevel": "medium" if complete else "high",
        "strongPoints": [f'مدرک «{label}» موجود است' for label in context.available_evidence],
        "weakPoints": [f'مدرک ضروری «{label}» موجود نیست' for label in context.missing_required],
        "missingEvidence": context.missing_required,
        "recommendation": (
            "مدارک کافی به نظر می‌رسد. می‌توانید اقدام کنید."
            if complete
            else "قبل از طرح شکایت، مدارک ناقص را تکمیل کنید."
        ),
        "complaintText": None,
        "relevantArticles": context.relevant_articles,
    }


def normalize_result(value: Any, context: LaborComplaintContext) -> dict[str, object]:
    if not isinstance(value, dict):
        return fallback_result(context)
    result: dict[str, object] = {str(key): item for key, item in value.items()}
    required = {
        "winProbability",
        "riskLevel",
        "strongPoints",
        "weakPoints",
        "missingEvidence",
        "recommendation",
    }
    if not required.issubset(result):
        return fallback_result(context)
    if not result.get("relevantArticles"):
        result["relevantArticles"] = context.relevant_articles
    return result
