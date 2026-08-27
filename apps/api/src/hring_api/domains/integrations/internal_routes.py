from __future__ import annotations

from hmac import compare_digest

from fastapi import APIRouter, Depends, Header, HTTPException, Path, Response, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings, get_settings
from hring_api.db.session import get_db_session
from hring_api.domains.integrations.runtime import (
    RuntimeProviderConfig,
    list_runtime_providers,
    string_setting,
)


router = APIRouter(tags=["internal-integrations"])


AI_ADAPTERS = frozenset(
    {
        "openai",
        "openai_compatible",
        "anthropic",
        "gemini_openai",
        "perplexity",
        "ollama",
        "vllm",
    }
)


class InternalAiProviderResponse(BaseModel):
    provider_key: str
    adapter: str
    base_url: str
    default_model: str | None
    auth_scheme: str
    secret: str | None
    priority: int
    timeout_seconds: int
    max_retries: int
    endpoint_path: str | None
    max_tokens_field: str | None


class InternalAiProviderSummaryResponse(BaseModel):
    provider_key: str
    adapter: str
    default_model: str | None


def _require_internal_key(authorization: str | None, settings: Settings) -> None:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    supplied = authorization.removeprefix("Bearer ").strip()
    expected = settings.ai_api_key.get_secret_value()
    if not supplied or not compare_digest(supplied, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")


def _string_set(value: object) -> set[str]:
    if not isinstance(value, list):
        return set()
    return {
        item.strip().lower()
        for item in value
        if isinstance(item, str) and item.strip()
    }


def _canonical_alias(adapter: str) -> str | None:
    return {
        "openai": "openai",
        "anthropic": "anthropic",
        "gemini_openai": "gemini",
        "perplexity": "perplexity",
        "ollama": "ollama",
        "vllm": "vllm",
    }.get(adapter)


def _route_rank(provider: RuntimeProviderConfig, alias: str) -> int | None:
    normalized = alias.strip().lower()
    primary_aliases = _string_set(provider.settings.get("aliases"))
    fallback_aliases = _string_set(provider.settings.get("fallback_for"))
    implicit_aliases = {
        provider.provider_key.lower(),
        provider.provider_key.split(".", maxsplit=1)[0].lower(),
    }
    canonical = _canonical_alias(provider.adapter)
    if canonical is not None:
        implicit_aliases.add(canonical)
    if normalized in primary_aliases or normalized in implicit_aliases:
        return 0
    if normalized in fallback_aliases:
        return 1
    return None


def _safe_endpoint_path(value: str | None) -> str | None:
    if value is None:
        return None
    if (
        not value.startswith("/")
        or value.startswith("//")
        or "?" in value
        or "#" in value
        or len(value) > 240
    ):
        return None
    return value


@router.get(
    "/internal/integrations/ai/providers",
    response_model=list[InternalAiProviderSummaryResponse],
    include_in_schema=False,
)
async def internal_ai_provider_summaries(
    response: Response,
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> list[InternalAiProviderSummaryResponse]:
    """Return the healthy runtime inventory without provider secrets."""

    _require_internal_key(authorization, settings)
    response.headers["Cache-Control"] = "private, no-store"
    providers = await list_runtime_providers(
        db,
        provider_type="llm",
        adapters=AI_ADAPTERS,
        settings=settings,
    )
    return [
        InternalAiProviderSummaryResponse(
            provider_key=provider.provider_key,
            adapter=provider.adapter,
            default_model=provider.default_model,
        )
        for provider in providers
    ]


@router.get(
    "/internal/integrations/ai/providers/{alias}",
    response_model=list[InternalAiProviderResponse],
    include_in_schema=False,
)
async def internal_ai_providers(
    response: Response,
    alias: str = Path(min_length=1, max_length=120, pattern=r"^[a-zA-Z0-9_.-]+$"),
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> list[InternalAiProviderResponse]:
    _require_internal_key(authorization, settings)
    response.headers["Cache-Control"] = "private, no-store"
    providers = await list_runtime_providers(
        db,
        provider_type="llm",
        adapters=AI_ADAPTERS,
        settings=settings,
    )
    ranked = [
        (rank, provider)
        for provider in providers
        if provider.base_url is not None
        if (rank := _route_rank(provider, alias)) is not None
    ]
    ranked.sort(key=lambda item: (item[0], item[1].priority, item[1].provider_key))
    return [
        InternalAiProviderResponse(
            provider_key=provider.provider_key,
            adapter=provider.adapter,
            base_url=provider.base_url or "",
            default_model=provider.default_model,
            auth_scheme=provider.auth_scheme,
            secret=provider.secret,
            priority=provider.priority,
            timeout_seconds=provider.timeout_seconds,
            max_retries=provider.max_retries,
            endpoint_path=_safe_endpoint_path(string_setting(provider, "endpoint_path")),
            max_tokens_field=string_setting(provider, "max_tokens_field"),
        )
        for _rank, provider in ranked
    ]
