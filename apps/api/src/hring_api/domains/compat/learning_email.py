from __future__ import annotations

import html
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings
from hring_api.integrations.email.base import EmailDeliveryError
from hring_api.integrations.email.providers import get_email_provider


class LearningEmailError(RuntimeError):
    pass


class LearningEmailUnavailableError(LearningEmailError):
    pass


def _safe(value: object) -> str:
    return html.escape(str(value), quote=True)


def _skill_items(items: object, *, accent: str) -> str:
    if not isinstance(items, list):
        return ""
    rows: list[str] = []
    for raw in items:
        if not isinstance(raw, dict):
            continue
        skill = _safe(raw.get("skill", ""))
        reason = _safe(raw.get("reason", ""))
        rows.append(
            f'<li style="margin-bottom:10px;padding:10px 12px;border-right:3px solid {accent};">'
            f'<strong>{skill}</strong><p style="margin:4px 0 0;color:#6b7280">{reason}</p></li>'
        )
    return "".join(rows)


def _roadmap_rows(items: object) -> str:
    if not isinstance(items, list):
        return ""
    rows: list[str] = []
    for index, raw in enumerate(items, start=1):
        if not isinstance(raw, dict):
            continue
        month = _safe(raw.get("month", ""))
        focus = _safe(raw.get("focus", ""))
        actions = raw.get("actionItems")
        action_html = ""
        if isinstance(actions, list):
            action_html = "".join(f"<li>{_safe(item)}</li>" for item in actions)
        rows.append(
            '<tr><td style="padding:12px;border-bottom:1px solid #e5e7eb">'
            f'{index}</td><td style="padding:12px;border-bottom:1px solid #e5e7eb">'
            f'<strong>{month} – {focus}</strong><ul>{action_html}</ul></td></tr>'
        )
    return "".join(rows)


def build_learning_path_html(*, employee_name: str, job_title: str, result: dict[str, Any]) -> str:
    safe_name = _safe(employee_name)
    safe_title = _safe(job_title)
    gap = _safe(result.get("skillGapAnalysis", ""))
    training_note = result.get("trainingNote")
    note_html = (
        f'<div style="background:#f0fdf4;padding:14px;border-radius:8px">✅ {_safe(training_note)}</div>'
        if training_note
        else ""
    )
    hard_skills = _skill_items(result.get("hardSkills"), accent="#3b82f6")
    soft_skills = _skill_items(result.get("softSkills"), accent="#8b5cf6")
    roadmap = _roadmap_rows(result.get("roadmap"))
    return f"""<!doctype html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>نقشه راه آموزشی HRing</title></head>
<body style="font-family:Tahoma,Arial,sans-serif;background:#f9fafb;padding:24px">
<div style="max-width:680px;margin:auto;background:#fff;border-radius:12px;overflow:hidden">
<div style="background:#1d4ed8;color:white;padding:28px"><h1>نقشه راه آموزشی شما</h1>
<p>{safe_name} عزیز، برنامه توسعه شما برای شغل <strong>{safe_title}</strong> آماده است.</p></div>
<div style="padding:28px">{note_html}
<h2>تحلیل شکاف مهارتی</h2><p>{gap}</p>
<h2>مهارت‌های سخت</h2><ul style="list-style:none;padding:0">{hard_skills}</ul>
<h2>مهارت‌های نرم</h2><ul style="list-style:none;padding:0">{soft_skills}</ul>
<h2>نقشه راه اجرایی</h2><table style="width:100%;border-collapse:collapse">{roadmap}</table>
</div><div style="padding:16px;background:#f9fafb;text-align:center;color:#6b7280">
این نقشه راه توسط HRing تولید شده است.</div></div></body></html>"""


async def send_learning_path_email(
    *,
    body: object,
    settings: Settings,
    session: AsyncSession,
) -> dict[str, object]:
    if not isinstance(body, dict):
        raise LearningEmailError("Invalid learning-path email payload")
    employee_email = body.get("employeeEmail")
    employee_name = body.get("employeeName")
    job_title = body.get("jobTitle")
    result = body.get("result")
    if not isinstance(employee_email, str) or not employee_email.strip():
        raise LearningEmailError("Employee email is required")
    if (
        not isinstance(employee_name, str)
        or not isinstance(job_title, str)
        or not isinstance(result, dict)
    ):
        raise LearningEmailError("employeeName, jobTitle and result are required")

    message_html = build_learning_path_html(
        employee_name=employee_name,
        job_title=job_title,
        result=result,
    )
    try:
        provider = await get_email_provider(session, settings)
        message_id = await provider.send_html_email(
            to_email=employee_email.strip(),
            subject=f"نقشه راه آموزشی شما – {job_title}",
            html=message_html,
        )
    except EmailDeliveryError as exc:
        raise LearningEmailUnavailableError(
            "Email service is not configured or unavailable"
        ) from exc
    return {"success": True, "id": message_id}
