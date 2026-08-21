from dataclasses import dataclass
from typing import Any, cast

import httpx

from hring_ai_gateway.config import GatewaySettings
from hring_ai_gateway.schemas import GenerateRequest, GenerateResponse


class ProviderUnavailableError(RuntimeError):
    pass


class ProviderResponseError(RuntimeError):
    pass


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    base_url: str
    api_key: str
    endpoint_path: str
    max_tokens_field: str


def enabled_provider_names(settings: GatewaySettings) -> list[str]:
    names: list[str] = []
    if settings.openai_api_key and settings.openai_api_key.get_secret_value():
        names.append("openai")
    if settings.gemini_api_key and settings.gemini_api_key.get_secret_value():
        names.append("gemini")
    if settings.perplexity_api_key and settings.perplexity_api_key.get_secret_value():
        names.append("perplexity")
    return names


def provider_config(settings: GatewaySettings, alias: str) -> ProviderConfig:
    normalized = alias.strip().lower()
    if normalized == "openai":
        if not settings.openai_api_key or not settings.openai_api_key.get_secret_value():
            raise ProviderUnavailableError("Provider is not configured")
        return ProviderConfig(
            name="openai",
            base_url=settings.openai_base_url.rstrip("/"),
            api_key=settings.openai_api_key.get_secret_value(),
            endpoint_path="/chat/completions",
            max_tokens_field="max_completion_tokens",
        )
    if normalized == "gemini":
        if not settings.gemini_api_key or not settings.gemini_api_key.get_secret_value():
            raise ProviderUnavailableError("Provider is not configured")
        return ProviderConfig(
            name="gemini",
            base_url=settings.gemini_base_url.rstrip("/"),
            api_key=settings.gemini_api_key.get_secret_value(),
            endpoint_path="/chat/completions",
            max_tokens_field="max_completion_tokens",
        )
    if normalized == "perplexity":
        if not settings.perplexity_api_key or not settings.perplexity_api_key.get_secret_value():
            raise ProviderUnavailableError("Provider is not configured")
        return ProviderConfig(
            name="perplexity",
            base_url=settings.perplexity_base_url.rstrip("/"),
            api_key=settings.perplexity_api_key.get_secret_value(),
            endpoint_path="/v1/sonar",
            max_tokens_field="max_tokens",
        )
    raise ProviderUnavailableError("Unsupported provider alias")


def _nested_int(value: object, *keys: str) -> int:
    current = value
    for key in keys:
        if not isinstance(current, dict):
            return 0
        current = current.get(key)
    if isinstance(current, bool) or not isinstance(current, int):
        return 0
    return max(0, current)


def normalize_usage(body: dict[str, Any]) -> dict[str, int]:
    usage = body.get("usage")
    if not isinstance(usage, dict):
        return {}
    reasoning_tokens = max(
        _nested_int(usage, "completion_tokens_details", "reasoning_tokens"),
        _nested_int(usage, "reasoning_tokens"),
    )
    normalized = {
        "input_tokens": _nested_int(usage, "prompt_tokens"),
        "output_tokens": _nested_int(usage, "completion_tokens"),
        "cached_input_tokens": _nested_int(usage, "prompt_tokens_details", "cached_tokens"),
        "reasoning_tokens": reasoning_tokens,
        "citation_tokens": _nested_int(usage, "citation_tokens"),
        "search_queries": _nested_int(usage, "num_search_queries"),
    }
    return {key: value for key, value in normalized.items() if value > 0}


def _extract_content(body: dict[str, Any]) -> str:
    choices = body.get("choices")
    if not isinstance(choices, list) or not choices:
        raise ProviderResponseError("Provider returned no choices")
    first = choices[0]
    if not isinstance(first, dict):
        raise ProviderResponseError("Provider returned malformed choice")
    message = first.get("message")
    if not isinstance(message, dict):
        raise ProviderResponseError("Provider returned no message")
    content = message.get("content")
    if isinstance(content, str):
        return content
    raise ProviderResponseError("Provider returned unsupported content")


async def generate_openai_compatible(
    *,
    settings: GatewaySettings,
    request: GenerateRequest,
) -> GenerateResponse:
    provider = provider_config(settings, request.provider)
    payload: dict[str, object] = {
        "model": request.model,
        "messages": [message.model_dump() for message in request.messages],
        "stream": False,
    }
    if request.temperature is not None:
        payload["temperature"] = request.temperature
    if request.max_output_tokens is not None:
        payload[provider.max_tokens_field] = request.max_output_tokens
    if request.response_format == "json_object":
        if provider.name == "perplexity":
            raise ProviderUnavailableError(
                "Perplexity structured output requires an explicit JSON schema"
            )
        payload["response_format"] = {"type": "json_object"}

    headers = {
        "Authorization": f"Bearer {provider.api_key}",
        "Content-Type": "application/json",
    }
    if provider.name == "openai":
        headers["X-Client-Request-Id"] = str(request.request_id)

    timeout = httpx.Timeout(
        settings.upstream_timeout_seconds,
        connect=settings.upstream_connect_timeout_seconds,
    )
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"{provider.base_url}{provider.endpoint_path}",
            json=payload,
            headers=headers,
        )
        response.raise_for_status()

    raw = response.json()
    if not isinstance(raw, dict):
        raise ProviderResponseError("Provider returned malformed JSON")
    body = cast(dict[str, Any], raw)
    provider_request_id = response.headers.get("x-request-id")
    if not provider_request_id:
        body_id = body.get("id")
        provider_request_id = body_id if isinstance(body_id, str) else None

    return GenerateResponse(
        content=_extract_content(body),
        provider=provider.name,
        model=request.model,
        usage=normalize_usage(body),
        provider_request_id=provider_request_id,
        provider_cost_microusd=None,
    )
