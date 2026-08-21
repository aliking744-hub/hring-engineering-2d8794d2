from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from hring_api.config import Settings
from hring_api.domains.ai.gateway_client import AiGatewayError, generate_with_ai_gateway
from hring_api.domains.identity.dependencies import Principal


AI_FUNCTIONS = frozenset(
    {
        "analyze-competitor",
        "analyze-competitor-swot",
        "analyze-global-trends",
        "analyze-market-position",
        "analyze-tech-edge",
        "analyze-unicorn",
        "analyze-unicorn-engine",
        "analyze-value-chain",
        "defense-builder",
        "fetch-company-intel",
        "generate-interview-guide",
        "generate-interview-kit",
        "generate-job-ad",
        "generate-job-profile",
        "generate-learning-path",
        "generate-mental-prism",
        "generate-onboarding-plan",
        "generate-smart-ad",
        "generate-strategic-recommendations",
        "hring-support",
        "labor-complaint-assistant",
        "legal-advisor-chat",
        "search-competitor-news",
        "search-legal-docs",
        "track-funding",
        "unicorn-ai-chat",
        "unicorn-web-radar",
    }
)

BLOCKED_SENSITIVE_FUNCTIONS = frozenset(
    {
        "admin-manage-users",
        "create-company-user",
        "reset-company-user-password",
        "update-company-user-profile",
        "reset-monthly-credits",
        "zarinpal-payment",
    }
)

NON_AI_SPECIAL_FUNCTIONS = frozenset(
    {
        "download-product",
        "extract-document-text",
        "process-legal-html",
        "scrape-legal-docs",
        "send-learning-path-email",
        "submit-feedback",
        "validate-invite-code",
        "auto-headhunt",
        "analyze-candidates",
    }
)


class CompatFunctionError(RuntimeError):
    pass


class CompatFunctionUnavailableError(CompatFunctionError):
    pass


def _company_id(principal: Principal | None) -> UUID | None:
    if principal is None:
        return None
    for membership in principal.memberships:
        if membership.is_active:
            return membership.company_id
    return None


def _response_value(content: str) -> Any:
    text = content.strip()
    if text.startswith("```"):
        text = text.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"content": content}


async def invoke_ai_function(
    *,
    name: str,
    body: Any,
    principal: Principal | None,
    settings: Settings,
) -> Any:
    if name not in AI_FUNCTIONS:
        if name in BLOCKED_SENSITIVE_FUNCTIONS:
            raise CompatFunctionUnavailableError(
                f"{name} is security-sensitive and must use a dedicated HRing API"
            )
        raise CompatFunctionUnavailableError(f"Unsupported compatibility function: {name}")

    serialized = json.dumps(body, ensure_ascii=False, default=str)
    system_prompt = (
        "You are the HRing compatibility execution layer. Execute the named HR product capability "
        "using only the supplied request data. Never invent identity/contact facts or sensitive "
        "personal traits. Preserve the response contract implied by the request. Return valid JSON "
        "only, without markdown. If evidence is missing, represent uncertainty explicitly rather "
        "than fabricating facts. Respond in Persian unless the request requires another language."
    )
    user_prompt = (
        f"HRing capability: {name}\n"
        f"Request JSON: {serialized}\n\n"
        "Return the structured result expected by this HRing capability as JSON."
    )
    try:
        result = await generate_with_ai_gateway(
            feature_key=f"compat.{name}",
            user_id=principal.user_id if principal is not None else None,
            company_id=_company_id(principal),
            provider=settings.recruiting_ai_provider,
            model=settings.recruiting_ai_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_output_tokens=12_000,
        )
    except AiGatewayError as exc:
        raise CompatFunctionError("HRing AI service is unavailable") from exc
    return _response_value(result.content)
