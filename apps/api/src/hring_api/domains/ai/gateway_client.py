from dataclasses import dataclass
from time import monotonic
from typing import cast
from uuid import UUID, uuid4

import httpx

from hring_api.config import get_settings
from hring_api.domains.ai.service import persist_ai_usage_isolated


class AiGatewayError(RuntimeError):
    pass


@dataclass(frozen=True)
class AiGatewayResult:
    request_id: UUID
    content: str
    provider: str
    model: str
    usage: dict[str, int]
    provider_cost_microusd: int | None


def _usage_dict(value: object) -> dict[str, int]:
    if not isinstance(value, dict):
        return {}
    normalized: dict[str, int] = {}
    for key, raw in value.items():
        if not isinstance(key, str):
            continue
        if isinstance(raw, bool):
            continue
        if isinstance(raw, int):
            normalized[key] = max(0, raw)
    return normalized


def _optional_int(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    return value if isinstance(value, int) else None


async def generate_with_ai_gateway(
    *,
    feature_key: str,
    user_id: UUID | None,
    company_id: UUID | None,
    provider: str,
    model: str,
    messages: list[dict[str, str]],
    credits_charged: int = 0,
    temperature: float | None = None,
    max_output_tokens: int | None = None,
    response_format: str = "text",
    metadata_json: dict[str, object] | None = None,
) -> AiGatewayResult:
    """Call the internal provider hub and persist billing telemetry.

    Provider credentials never enter this process. HRing API authenticates to
    the internal AI Gateway with one internal key; the gateway owns upstream
    provider secrets.
    """

    settings = get_settings()
    request_id = uuid4()
    payload: dict[str, object] = {
        "request_id": str(request_id),
        "provider": provider,
        "model": model,
        "messages": messages,
        "response_format": response_format,
    }
    if temperature is not None:
        payload["temperature"] = temperature
    if max_output_tokens is not None:
        payload["max_output_tokens"] = max_output_tokens

    started = monotonic()
    url = f"{settings.ai_base_url.rstrip('/')}/generate"
    headers = {
        "Authorization": f"Bearer {settings.ai_api_key.get_secret_value()}",
        "X-HRing-Request-ID": str(request_id),
    }

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
        body = cast(dict[str, object], response.json())
        content = body.get("content")
        if not isinstance(content, str):
            raise AiGatewayError("AI Gateway returned no text content")
        returned_provider = body.get("provider")
        returned_model = body.get("model")
        actual_provider = returned_provider if isinstance(returned_provider, str) else provider
        actual_model = returned_model if isinstance(returned_model, str) else model
        usage = _usage_dict(body.get("usage"))
        provider_cost = _optional_int(body.get("provider_cost_microusd"))
        latency_ms = round((monotonic() - started) * 1000)
        gateway_request_id = body.get("provider_request_id")
        metadata: dict[str, object] = dict(metadata_json or {})
        if isinstance(gateway_request_id, str):
            metadata["provider_request_id"] = gateway_request_id[:200]

        await persist_ai_usage_isolated(
            request_id=request_id,
            company_id=company_id,
            user_id=user_id,
            feature_key=feature_key,
            provider=actual_provider,
            model=actual_model,
            operation="generate",
            metrics=usage,
            provider_cost_microusd=provider_cost,
            credits_charged=credits_charged,
            latency_ms=latency_ms,
            status="success",
            error_code=None,
            metadata_json=metadata,
        )
        return AiGatewayResult(
            request_id=request_id,
            content=content,
            provider=actual_provider,
            model=actual_model,
            usage=usage,
            provider_cost_microusd=provider_cost,
        )
    except Exception as exc:
        latency_ms = round((monotonic() - started) * 1000)
        if isinstance(exc, httpx.HTTPStatusError):
            error_code = f"upstream_http_{exc.response.status_code}"
        elif isinstance(exc, httpx.TimeoutException):
            error_code = "upstream_timeout"
        else:
            error_code = "gateway_error"
        await persist_ai_usage_isolated(
            request_id=request_id,
            company_id=company_id,
            user_id=user_id,
            feature_key=feature_key,
            provider=provider,
            model=model,
            operation="generate",
            metrics={},
            provider_cost_microusd=None,
            credits_charged=0,
            latency_ms=latency_ms,
            status="failure",
            error_code=error_code,
            metadata_json=dict(metadata_json or {}),
        )
        if isinstance(exc, AiGatewayError):
            raise
        raise AiGatewayError("AI Gateway request failed") from exc
