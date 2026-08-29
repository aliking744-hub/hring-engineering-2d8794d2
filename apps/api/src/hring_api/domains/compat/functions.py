from __future__ import annotations

import json
from hashlib import sha256
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings
from hring_api.domains.ai.feature_catalog import COMPAT_AI_FUNCTIONS
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
from hring_api.domains.billing.credit_service import (
    compatibility_credit_cost,
    run_with_credit_reservation,
)
from hring_api.domains.compat.labor_complaint import (
    LABOR_SYSTEM_TEMPLATE,
    LABOR_USER_TEMPLATE,
    LaborComplaintContext,
    LaborComplaintError,
    build_context,
    normalize_result,
    required_evidence,
)
from hring_api.domains.identity.dependencies import Principal


AI_FUNCTIONS = COMPAT_AI_FUNCTIONS

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

# These legacy names are intentionally routed to dedicated independent APIs by the
# browser facade rather than executed as generic compatibility functions.
NON_AI_SPECIAL_FUNCTIONS = frozenset(
    {
        "validate-invite-code",
        "auto-headhunt",
        "analyze-candidates",
        "extract-document-text",
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


def _response_with_citations(
    content: str,
    citations: tuple[AiCitation, ...],
) -> Any:
    value = _response_value(content)
    if citations and isinstance(value, dict):
        value.setdefault("citations", [citation.url for citation in citations])
        research_meta = value.get("researchMeta")
        if isinstance(research_meta, dict):
            research_meta.setdefault("sourcesFound", len(citations))
    return value


async def invoke_ai_function(
    *,
    name: str,
    body: Any,
    principal: Principal | None,
    settings: Settings,
    session: AsyncSession | None = None,
    request_id: str | None = None,
    idempotency_key: str | None = None,
) -> Any:
    if name not in AI_FUNCTIONS:
        if name in BLOCKED_SENSITIVE_FUNCTIONS:
            raise CompatFunctionUnavailableError(
                f"{name} is security-sensitive and must use a dedicated HRing API"
            )
        raise CompatFunctionUnavailableError(f"Unsupported compatibility function: {name}")

    if name == "labor-complaint-assistant":
        try:
            evidence_contract = required_evidence(body)
        except LaborComplaintError as exc:
            raise CompatFunctionError(str(exc)) from exc
        if evidence_contract is not None:
            return evidence_contract

    serialized = json.dumps(body, ensure_ascii=False, default=str)
    labor_context: LaborComplaintContext | None = None
    if name == "labor-complaint-assistant":
        if session is None:
            raise CompatFunctionError("Labor complaint analysis requires a database session")
        try:
            labor_context = await build_context(session, body)
        except LaborComplaintError as exc:
            raise CompatFunctionError(str(exc)) from exc
        prompt_variables = labor_context.prompt_variables()
        system_prompt = LABOR_SYSTEM_TEMPLATE.format_map(prompt_variables)
        user_prompt = LABOR_USER_TEMPLATE.format_map(prompt_variables)
        feature_key = "legal.labor_complaint"
    else:
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
        feature_key = f"compat.{name}"
        prompt_variables = {
            "capability_name": name,
            "request_json": serialized,
        }
    if principal is not None and session is None:
        raise CompatFunctionError("Credit-controlled AI execution requires a database session")
    cost = (
        await compatibility_credit_cost(session, function_name=name, body=body)
        if principal is not None and session is not None
        else 0
    )

    async def fallback() -> AiGatewayResult:
        route = await resolve_runtime_feature_route(
            feature_key=feature_key,
            default_provider=settings.recruiting_ai_provider,
            default_model=settings.recruiting_ai_model,
        )
        return await generate_with_ai_gateway(
            feature_key=feature_key,
            user_id=principal.user_id if principal is not None else None,
            company_id=_company_id(principal),
            provider=route.provider,
            model=route.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            credits_charged=cost,
            max_output_tokens=4_000 if labor_context is not None else 12_000,
            response_format="json_object" if labor_context is not None else "text",
            metadata_json={
                "ai_route_source": route.source,
                "prompt_key": feature_key,
                "prompt_mode": "embedded_fallback",
            },
        )

    async def generate() -> Any:
        try:
            result = await generate_with_managed_prompt(
                session,
                prompt_key=feature_key,
                variables=prompt_variables,
                user_id=principal.user_id if principal is not None else None,
                company_id=_company_id(principal),
                fallback=fallback,
                credits_charged=cost,
            )
        except (AiGatewayError, PromptRegistryError) as exc:
            raise CompatFunctionError("HRing AI service is unavailable") from exc
        value = _response_with_citations(result.content, result.citations)
        if labor_context is not None:
            return normalize_result(value, labor_context)
        return value

    if principal is None:
        return await generate()
    if cost <= 0:
        return await generate()
    assert session is not None
    raw_key = (idempotency_key or "").strip()
    if not raw_key:
        raise CompatFunctionError("AI request idempotency key is required")
    operation_key = f"compat:{sha256(f'{name}:{raw_key}'.encode()).hexdigest()}"
    return await run_with_credit_reservation(
        session,
        principal=principal,
        amount=cost,
        idempotency_key=operation_key,
        feature_key=feature_key,
        description=f"Compatibility AI execution: {name}",
        request_id=request_id,
        operation=generate,
    )
