from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from urllib.parse import quote

import httpx

from hring_ai_gateway.config import GatewaySettings


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    adapter: str
    base_url: str
    api_key: str | None
    auth_scheme: str
    endpoint_path: str
    max_tokens_field: str
    default_model: str | None
    timeout_seconds: float
    max_retries: int


def _optional_string(value: object) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _default_endpoint(adapter: str) -> str:
    if adapter == "perplexity":
        return "/v1/sonar"
    if adapter == "anthropic":
        return "/v1/messages"
    return "/chat/completions"


def _default_max_tokens_field(adapter: str) -> str:
    return (
        "max_tokens"
        if adapter in {"anthropic", "perplexity", "ollama", "vllm"}
        else "max_completion_tokens"
    )


def parse_registry_provider(value: object) -> ProviderConfig | None:
    if not isinstance(value, dict):
        return None
    name = _optional_string(value.get("provider_key"))
    adapter = _optional_string(value.get("adapter"))
    base_url = _optional_string(value.get("base_url"))
    auth_scheme = _optional_string(value.get("auth_scheme"))
    secret = _optional_string(value.get("secret"))
    if not name or not adapter or not base_url or not auth_scheme:
        return None
    if auth_scheme not in {"none", "bearer", "x-api-key", "api-key", "x-goog-api-key"}:
        return None
    if auth_scheme != "none" and secret is None:
        return None

    endpoint_path = _optional_string(value.get("endpoint_path")) or _default_endpoint(adapter)
    if (
        not endpoint_path.startswith("/")
        or endpoint_path.startswith("//")
        or "?" in endpoint_path
        or "#" in endpoint_path
    ):
        return None
    max_tokens_field = (
        _optional_string(value.get("max_tokens_field"))
        or _default_max_tokens_field(adapter)
    )
    if not re.fullmatch(r"[a-z][a-z0-9_]{0,79}", max_tokens_field):
        return None

    timeout_raw = value.get("timeout_seconds")
    retry_raw = value.get("max_retries")
    timeout_seconds = (
        float(timeout_raw)
        if isinstance(timeout_raw, int | float) and not isinstance(timeout_raw, bool)
        else 120.0
    )
    max_retries = retry_raw if isinstance(retry_raw, int) and not isinstance(retry_raw, bool) else 0
    if not 1 <= timeout_seconds <= 300 or not 0 <= max_retries <= 10:
        return None
    return ProviderConfig(
        name=name,
        adapter=adapter,
        base_url=base_url.rstrip("/"),
        api_key=secret,
        auth_scheme=auth_scheme,
        endpoint_path=endpoint_path,
        max_tokens_field=max_tokens_field,
        default_model=_optional_string(value.get("default_model")),
        timeout_seconds=timeout_seconds,
        max_retries=max_retries,
    )


async def fetch_registry_providers(
    settings: GatewaySettings,
    alias: str,
) -> list[ProviderConfig]:
    if not settings.hring_api_base_url:
        return []
    url = (
        f"{settings.hring_api_base_url.rstrip('/')}"
        f"/internal/integrations/ai/providers/{quote(alias, safe='')}"
    )
    try:
        async with httpx.AsyncClient(
            timeout=settings.provider_registry_timeout_seconds,
            follow_redirects=False,
        ) as client:
            response = await client.get(
                url,
                headers={
                    "Authorization": (
                        f"Bearer {settings.internal_api_key.get_secret_value()}"
                    ),
                    "Accept": "application/json",
                },
            )
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError):
        logger.warning("AI provider registry is unavailable; using environment fallback")
        return []
    if not isinstance(payload, list):
        return []
    return [
        config
        for item in payload
        if (config := parse_registry_provider(item)) is not None
    ]


async def fetch_registry_provider_names(settings: GatewaySettings) -> list[str]:
    if not settings.hring_api_base_url:
        return []
    url = f"{settings.hring_api_base_url.rstrip('/')}/internal/integrations/ai/providers"
    try:
        async with httpx.AsyncClient(
            timeout=min(settings.provider_registry_timeout_seconds, 1.0),
            follow_redirects=False,
        ) as client:
            response = await client.get(
                url,
                headers={
                    "Authorization": (f"Bearer {settings.internal_api_key.get_secret_value()}")
                },
            )
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError):
        logger.warning("AI provider registry health lookup failed", exc_info=True)
        return []
    if not isinstance(payload, list):
        return []
    return sorted(
        {
            name.strip()
            for item in payload
            if isinstance(item, dict)
            if isinstance((name := item.get("provider_key")), str)
            if name.strip()
        }
    )
