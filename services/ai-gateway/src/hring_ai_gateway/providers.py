from __future__ import annotations

from typing import Any, cast
from urllib.parse import urlsplit

import httpx

from hring_ai_gateway.config import GatewaySettings
from hring_ai_gateway.registry import (
    CompanyAiRouteError,
    ProviderConfig,
    fetch_company_ai_provider,
    fetch_registry_providers,
)
from hring_ai_gateway.schemas import (
    GatewayCitation,
    GatewayImage,
    GenerateRequest,
    GenerateResponse,
)


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
        "input_tokens": max(
            _nested_int(usage, "prompt_tokens"),
            _nested_int(usage, "input_tokens"),
        ),
        "output_tokens": max(
            _nested_int(usage, "completion_tokens"),
            _nested_int(usage, "output_tokens"),
        ),
        "cached_input_tokens": _nested_int(usage, "prompt_tokens_details", "cached_tokens"),
        "reasoning_tokens": reasoning_tokens,
        "citation_tokens": _nested_int(usage, "citation_tokens"),
        "search_queries": _nested_int(usage, "num_search_queries"),
    }
    return {key: value for key, value in normalized.items() if value > 0}


def _optional_citation_text(value: object, *, limit: int) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    return normalized[:limit] if normalized else None


def _safe_citation_url(value: object) -> str | None:
    url = _optional_citation_text(value, limit=4096)
    if url is None:
        return None
    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    if parsed.username is not None or parsed.password is not None:
        return None
    return url


def extract_citations(body: dict[str, Any]) -> list[GatewayCitation]:
    """Normalize provider search metadata without exposing arbitrary payload fields."""

    rows: list[GatewayCitation] = []
    by_url: dict[str, int] = {}

    def add(value: object) -> None:
        if isinstance(value, str):
            url = _safe_citation_url(value)
            title = published_at = snippet = None
        elif isinstance(value, dict):
            url = _safe_citation_url(value.get("url"))
            title = _optional_citation_text(value.get("title"), limit=500)
            published_at = _optional_citation_text(
                value.get("date") or value.get("published_at"),
                limit=120,
            )
            snippet = _optional_citation_text(
                value.get("snippet") or value.get("text"),
                limit=2000,
            )
        else:
            return
        if url is None:
            return
        existing_index = by_url.get(url)
        citation = GatewayCitation(
            url=url,
            title=title,
            published_at=published_at,
            snippet=snippet,
        )
        if existing_index is None:
            if len(rows) >= 100:
                return
            by_url[url] = len(rows)
            rows.append(citation)
            return
        existing = rows[existing_index]
        rows[existing_index] = GatewayCitation(
            url=url,
            title=existing.title or citation.title,
            published_at=existing.published_at or citation.published_at,
            snippet=existing.snippet or citation.snippet,
        )

    citations = body.get("citations")
    if isinstance(citations, list):
        for item in citations:
            add(item)
    search_results = body.get("search_results")
    if isinstance(search_results, list):
        for item in search_results:
            add(item)
    return rows


def _choice_message(body: dict[str, Any]) -> dict[str, Any]:
    choices = body.get("choices")
    if not isinstance(choices, list) or not choices:
        raise ProviderResponseError("Provider returned no choices")
    first = choices[0]
    if not isinstance(first, dict):
        raise ProviderResponseError("Provider returned malformed choice")
    message = first.get("message")
    if not isinstance(message, dict):
        raise ProviderResponseError("Provider returned no message")
    return cast(dict[str, Any], message)


def _extract_content(
    body: dict[str, Any],
    adapter: str,
    *,
    allow_empty: bool = False,
) -> str:
    if adapter == "anthropic":
        blocks = body.get("content")
        if not isinstance(blocks, list):
            raise ProviderResponseError("Anthropic returned no content blocks")
        text = "".join(
            block["text"]
            for block in blocks
            if isinstance(block, dict)
            and block.get("type") == "text"
            and isinstance(block.get("text"), str)
        )
        if text or allow_empty:
            return text
        raise ProviderResponseError("Anthropic returned no text content")

    message = _choice_message(body)
    content = message.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        text = "".join(
            block.get("text", "")
            for block in content
            if isinstance(block, dict)
            and block.get("type") in {"text", "output_text"}
            and isinstance(block.get("text"), str)
        )
        if text or allow_empty:
            return text
    if allow_empty and content is None:
        return ""
    raise ProviderResponseError("Provider returned unsupported content")


def _safe_generated_image_url(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    try:
        return GatewayImage(url=normalized).url
    except ValueError:
        return None


def extract_generated_images(body: dict[str, Any]) -> list[GatewayImage]:
    """Normalize OpenAI-compatible image output without leaking arbitrary fields."""

    try:
        message = _choice_message(body)
    except ProviderResponseError:
        return []

    rows: list[GatewayImage] = []
    seen: set[str] = set()

    def add(value: object, mime_type: object = None) -> None:
        if isinstance(value, dict):
            raw_url = value.get("url")
        else:
            raw_url = value
        url = _safe_generated_image_url(raw_url)
        if url is None or url in seen or len(rows) >= 4:
            return
        normalized_mime = (
            mime_type.strip()[:120]
            if isinstance(mime_type, str) and mime_type.strip()
            else None
        )
        seen.add(url)
        rows.append(GatewayImage(url=url, mime_type=normalized_mime))

    images = message.get("images")
    if isinstance(images, list):
        for item in images:
            if not isinstance(item, dict):
                continue
            add(item.get("image_url"), item.get("mime_type"))

    content = message.get("content")
    if isinstance(content, list):
        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get("type") in {"image_url", "output_image"}:
                add(
                    block.get("image_url") or block.get("url"),
                    block.get("mime_type"),
                )
    return rows


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
    if provider.adapter == "anthropic":
        headers["anthropic-version"] = "2023-06-01"
    return headers


def _anthropic_payload(request: GenerateRequest, model: str) -> dict[str, object]:
    if "image" in request.modalities:
        raise ProviderUnavailableError("Anthropic image output is not supported")
    if request.temperature is not None and request.temperature > 1:
        raise ProviderUnavailableError("Anthropic temperature must be between 0 and 1")

    system_parts: list[str] = []
    messages: list[dict[str, str]] = []
    for message in request.messages:
        if message.role in {"system", "developer"}:
            system_parts.append(message.content)
        else:
            messages.append({"role": message.role, "content": message.content})
    if not messages:
        raise ProviderUnavailableError("Anthropic requires at least one user or assistant message")
    if request.response_format == "json_object":
        system_parts.append(
            "Return only one valid JSON object. Do not wrap the JSON in Markdown code fences."
        )
    payload: dict[str, object] = {
        "model": model,
        "messages": messages,
        "max_tokens": request.max_output_tokens or 4096,
        "stream": False,
    }
    if system_parts:
        payload["system"] = "\n\n".join(system_parts)
    if request.temperature is not None:
        payload["temperature"] = request.temperature
    return payload


async def _generate_once(
    *,
    settings: GatewaySettings,
    request: GenerateRequest,
    provider: ProviderConfig,
) -> GenerateResponse:
    model = provider.default_model or request.model
    if provider.adapter == "anthropic":
        payload = _anthropic_payload(request, model)
    else:
        payload = {
            "model": model,
            "messages": [message.model_dump() for message in request.messages],
        }
        # AvalAI's documented Gemini image contract omits the stream field.
        # Some image backends return a successful but non-image response when
        # stream=false is sent explicitly.
        if "image" not in request.modalities:
            payload["stream"] = False
        if request.modalities != ["text"]:
            payload["modalities"] = request.modalities
        if "image" in request.modalities and request.image_aspect_ratio is not None:
            image_config: dict[str, str] = {
                "aspectRatio": request.image_aspect_ratio,
            }
            if request.image_size is not None:
                image_config["imageSize"] = request.image_size
            # AvalAI documents Gemini-specific settings under extra_body for
            # its OpenAI-compatible /chat/completions endpoint.
            payload["extra_body"] = {
                "generationConfig": {
                    "imageConfig": image_config,
                }
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
    provider_request_id = response.headers.get("x-request-id") or response.headers.get("request-id")
    if not provider_request_id:
        body_id = body.get("id")
        provider_request_id = body_id if isinstance(body_id, str) else None

    images = extract_generated_images(body)
    if "image" in request.modalities and not images:
        raise ProviderResponseError("Provider returned no generated image")

    return GenerateResponse(
        content=_extract_content(
            body,
            provider.adapter,
            allow_empty="image" in request.modalities,
        ),
        provider=provider.name,
        model=model,
        usage=normalize_usage(body),
        provider_request_id=provider_request_id,
        provider_cost_microusd=None,
        citations=extract_citations(body),
        images=images,
    )


def _retryable_http_status(exc: httpx.HTTPStatusError) -> bool:
    return exc.response.status_code in {408, 409, 425, 429} or exc.response.status_code >= 500


async def generate_openai_compatible(
    *,
    settings: GatewaySettings,
    request: GenerateRequest,
    resolved_providers: list[ProviderConfig] | None = None,
) -> GenerateResponse:
    if resolved_providers is not None:
        routes = resolved_providers
    elif request.company_id is not None and request.feature_key is not None:
        try:
            company_provider = await fetch_company_ai_provider(
                settings,
                company_id=request.company_id,
                feature_key=request.feature_key,
            )
        except CompanyAiRouteError as exc:
            raise ProviderUnavailableError(str(exc)) from exc
        routes = [company_provider] if company_provider is not None else await provider_configs(
            settings, request.provider
        )
    else:
        routes = await provider_configs(settings, request.provider)
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

