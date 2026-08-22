from __future__ import annotations

from typing import Any, cast

import httpx

from hring_ai_gateway.config import GatewaySettings
from hring_ai_gateway.registry import (
    ProviderConfig,
    fetch_registry_providers,
)
from hring_ai_gateway.schemas import GenerateRequest, GenerateResponse


class ProviderUnavailableError(RuntimeError):
    pass


class ProviderResponseError(RuntimeError):
    pass


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
            adapter="openai",
            base_url=settings.openai_base_url.rstrip("/"),
            api_key=settings.openai_api_key.get_secret_value(),
            auth_scheme="bearer",
            endpoint_path="/chat/completions",
            max_tokens_field="max_completion_tokens",
            default_model=None,
            timeout_seconds=settings.upstream_timeout_seconds,
            max_retries=0,
        )
    if normalized == "gemini":
        if not settings.gemini_api_key or not settings.gemini_api_key.get_secret_value():
            raise ProviderUnavailableError("Provider is not configured")
        return ProviderConfig(
            name="gemini",
            adapter="gemini_openai",
            base_url=settings.gemini_base_url.rstrip("/"),
            api_key=settings.gemini_api_key.get_secret_value(),
            auth_scheme="bearer",
            endpoint_path="/chat/completions",
            max_tokens_field="max_completion_tokens",
            default_model=None,
            timeout_seconds=settings.upstream_timeout_seconds,
            max_retries=0,
        )
    if normalized == "perplexity":
        if not settings.perplexity_api_key or not settings.perplexity_api_key.get_secret_value():
            raise ProviderUnavailableError("Provider is not configured")
        return ProviderConfig(
            name="perplexity",
            adapter="perplexity",
            base_url=settings.perplexity_base_url.rstrip("/"),
            api_key=settings.perplexity_api_key.get_secret_value(),
            auth_scheme="bearer",
            endpoint_path="/v1/sonar",
            max_tokens_field="max_tokens",
            default_model=None,
            timeout_seconds=settings.upstream_timeout_seconds,
            max_retries=0,
        )
    raise ProviderUnavailableError("Unsupported provider alias")


async def provider_configs(
    settings: GatewaySettings,
    alias: str,
) -> list[ProviderConfig]:
    registry = await fetch_registry_providers(settings, alias)
    if registry:
        return registry
    return [provider_config(settings, alias)]


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


def _provider_headers(provider: ProviderConfig, request: GenerateRequest) -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if provider.auth_scheme == "none":
        pass
    elif provider.api_key is None:
        raise ProviderUnavailableError("Provider secret is not configured")
    elif provider.auth_scheme == "bearer":
        headers["Authorization"] = f"Bearer {provider.api_key}"
    elif provider.auth_scheme == "x-api-key":
        headers["X-API-Key"] = provider.api_key
    elif provider.auth_scheme == "api-key":
        headers["Api-Key"] = provider.api_key
    elif provider.auth_scheme == "x-goog-api-key":
        headers["X-Goog-Api-Key"] = provider.api_key
    else:
        raise ProviderUnavailableError("Provider authentication scheme is unsupported")
    if provider.adapter == "openai":
        headers["X-Client-Request-Id"] = str(request.request_id)
    return headers


async def _generate_once(
    *,
    settings: GatewaySettings,
    request: GenerateRequest,
    provider: ProviderConfig,
) -> GenerateResponse:
    model = provider.default_model or request.model
    payload: dict[str, object] = {
        "model": model,
        "messages": [message.model_dump() for message in request.messages],
        "stream": False,
    }
    if request.temperature is not None:
        payload["temperature"] = request.temperature
    if request.max_output_tokens is not None:
        payload[provider.max_tokens_field] = request.max_output_tokens
    if request.response_format == "json_object":
        if provider.adapter == "perplexity":
            raise ProviderUnavailableError(
                "Perplexity structured output requires an explicit JSON schema"
            )
        payload["response_format"] = {"type": "json_object"}

    timeout = httpx.Timeout(
        provider.timeout_seconds,
        connect=min(
            provider.timeout_seconds,
            settings.upstream_connect_timeout_seconds,
        ),
    )
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"{provider.base_url}{provider.endpoint_path}",
            json=payload,
            headers=_provider_headers(provider, request),
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
        model=model,
        usage=normalize_usage(body),
        provider_request_id=provider_request_id,
        provider_cost_microusd=None,
    )


def _retryable_http_status(exc: httpx.HTTPStatusError) -> bool:
    return exc.response.status_code in {408, 409, 425, 429} or exc.response.status_code >= 500


async def generate_openai_compatible(
    *,
    settings: GatewaySettings,
    request: GenerateRequest,
    resolved_providers: list[ProviderConfig] | None = None,
) -> GenerateResponse:
    routes = resolved_providers or await provider_configs(settings, request.provider)
    if not routes:
        raise ProviderUnavailableError("Provider is not configured")

    last_error: Exception | None = None
    for provider in routes:
        for attempt in range(provider.max_retries + 1):
            try:
                return await _generate_once(
                    settings=settings,
                    request=request,
                    provider=provider,
                )
            except httpx.HTTPStatusError as exc:
                last_error = exc
                if not _retryable_http_status(exc) or attempt >= provider.max_retries:
                    break
            except (httpx.RequestError, ProviderResponseError) as exc:
                last_error = exc
                if attempt >= provider.max_retries:
                    break
            except ProviderUnavailableError as exc:
                last_error = exc
                break

    if last_error is not None:
        raise last_error
    raise ProviderUnavailableError("No AI provider route is available")
