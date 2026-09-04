from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.admin.models import SiteSetting
from hring_api.domains.ai.feature_catalog import AI_FEATURES


@dataclass(frozen=True)
class SupportContext:
    system_prompt: str
    conversation_json: str
    support_phone: str | None

    def prompt_variables(self) -> dict[str, str]:
        return {
            "support_instructions": self.system_prompt,
            "conversation_json": self.conversation_json,
        }


class SupportInputError(RuntimeError):
    pass


async def build_support_context(session: AsyncSession, body: Any) -> SupportContext:
    if not isinstance(body, dict):
        raise SupportInputError("پیام پشتیبانی معتبر نیست")
    raw_messages = body.get("messages")
    if not isinstance(raw_messages, list) or not raw_messages or len(raw_messages) > 30:
        raise SupportInputError("تاریخچه گفتگو معتبر نیست")
    messages: list[dict[str, str]] = []
    for item in raw_messages:
        if not isinstance(item, dict) or item.get("role") not in {"user", "assistant"}:
            raise SupportInputError("ساختار پیام پشتیبانی معتبر نیست")
        content = item.get("content")
        if not isinstance(content, str) or not content.strip() or len(content) > 20_000:
            raise SupportInputError("متن پیام پشتیبانی معتبر نیست")
        messages.append({"role": str(item["role"]), "content": content.strip()})

    rows = await session.scalars(
        select(SiteSetting).where(
            SiteSetting.key.in_(["support_system_prompt", "support_phone"])
        )
    )
    settings: dict[str, str] = {}
    for row in rows.all():
        if row.value:
            settings[row.key] = row.value
    phone = settings.get("support_phone", "").strip() or None
    feature_lines = "\n".join(
        f"- {feature.display_name}: {feature.description}"
        for feature in AI_FEATURES
        if not feature.feature_key.startswith("compat.")
    )
    knowledge = f"""## اطلاعات جاری پلتفرم HRing

### قابلیت‌های فعال
{feature_lines}

### مسیرهای اصلی
- داشبورد: /dashboard
- ابزارهای هوش مصنوعی: /modules
- ارتقا و خرید اعتبار: /upgrade
- فروشگاه: /shop
- مشاور حقوقی کار: /legal-advisor
- جست‌وجوی مستند قوانین: /legal-search

### شماره پشتیبانی
{phone or 'در CMS ثبت نشده است؛ کاربر را به /support یا /contact هدایت کن.'}

اگر درباره قیمت، سهمیه یا سطح دسترسی پرسیده شد و عدد قطعی در این دانش‌نامه نبود، عدد نساز و کاربر را به /upgrade یا پشتیبانی انسانی هدایت کن."""
    default_prompt = f"""تو دستیار پشتیبانی HRing هستی؛ بسیار مودب، فروتن و صمیمی باش و به فارسی محاوره‌ای محترمانه پاسخ بده.

{knowledge}

دستورالعمل‌ها:
- از اطلاعات جاری بالا استفاده کن و قابلیت حذف‌شده یا ناموجود نساز
- برای قیمت و ارتقا به /upgrade هدایت کن
- برای قانون کار و مشاوره حقوقی به /legal-advisor هدایت کن
- پاسخ را کوتاه، روشن و عملی نگه دار
- اگر پاسخ در اطلاعات بالا نبود بگو مطمئن نیستی؛ فقط اگر شماره‌ای بالا ثبت شده همان را بده، وگرنه کاربر را به /support یا /contact هدایت کن
- هرگز شماره تلفن، قیمت یا راه ارتباطی نساز"""
    configured = settings.get("support_system_prompt")
    system_prompt = (configured or default_prompt).replace(
        "{SUPPORT_PHONE}", phone or "در CMS ثبت نشده؛ از /support استفاده کنید"
    )
    return SupportContext(
        system_prompt=system_prompt,
        conversation_json=json.dumps(messages, ensure_ascii=False),
        support_phone=phone,
    )


def support_text(value: Any, *, allowed_phone: str | None = None) -> str:
    if isinstance(value, str) and value.strip():
        text = value.strip()
    if isinstance(value, dict):
        for key in ("content", "answer", "message"):
            candidate = value.get(key)
            if isinstance(candidate, str) and candidate.strip():
                text = candidate.strip()
                break
        else:
            raise SupportInputError("پاسخ معتبری از دستیار پشتیبانی دریافت نشد")
    if not isinstance(value, (str, dict)):
        raise SupportInputError("پاسخ معتبری از دستیار پشتیبانی دریافت نشد")
    phones = set(re.findall(r"(?<!\d)09\d{9}(?!\d)", text))
    unauthorized = phones - ({allowed_phone} if allowed_phone else set())
    for phone in unauthorized:
        text = text.replace(phone, "مسیر پشتیبانی /support")
    return text
