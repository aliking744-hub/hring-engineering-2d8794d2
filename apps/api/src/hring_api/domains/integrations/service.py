from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings
from hring_api.domains.admin.repository import add_audit_log
from hring_api.domains.integrations.models import IntegrationProvider
from hring_api.domains.integrations.repository import (
    get_integration_provider,
    get_integration_provider_by_key,
)
from hring_api.domains.integrations.schemas import (
    IntegrationProviderCreateRequest,
    IntegrationProviderResponse,
    IntegrationProviderUpdateRequest,
)
from hring_api.domains.integrations.security import (
    IntegrationSecurityError,
    ProviderSecretCipher,
    assert_no_secrets_in_metadata,
    assert_provider_host_is_safe,
    normalize_provider_base_url,
)


class IntegrationError(RuntimeError):
    pass


class IntegrationNotFoundError(IntegrationError):
    pass


class IntegrationConflictError(IntegrationError):
    pass


class IntegrationValidationError(IntegrationError):
    pass


@dataclass(frozen=True)
class ConnectionTestResult:
    provider_id: UUID
    healthy: bool
    status: str
    http_status: int | None
    latency_ms: int | None
    message: str
    tested_at: datetime


def provider_response(provider: IntegrationProvider) -> IntegrationProviderResponse:
    return IntegrationProviderResponse(
        id=provider.id,
        provider_key=provider.provider_key,
        display_name=provider.display_name,
        provider_type=provider.provider_type,
        adapter=provider.adapter,
        base_url=provider.base_url,
        default_model=provider.default_model,
        auth_scheme=provider.auth_scheme,
        secret_configured=provider.secret_ciphertext is not None,
        secret_hint=provider.secret_hint,
        is_active=provider.is_active,
        is_internal=provider.is_internal,
        priority=provider.priority,
        timeout_seconds=provider.timeout_seconds,
        max_retries=provider.max_retries,
        capabilities=provider.capabilities_json,
        settings=provider.settings_json,
        quota=provider.quota_json,
        status=provider.status,
        last_tested_at=provider.last_tested_at,
        last_success_at=provider.last_success_at,
        last_error=provider.last_error,
        created_at=provider.created_at,
        updated_at=provider.updated_at,
    )


def _safe_base_url(
    value: str | None,
    *,
    is_internal: bool,
    settings: Settings,
) -> str | None:
    try:
        return normalize_provider_base_url(
            value,
            is_internal=is_internal,
            allowed_internal_hosts=settings.integration_internal_hosts,
        )
    except IntegrationSecurityError as exc:
        raise IntegrationValidationError(str(exc)) from exc


def _safe_metadata(value: object, *, path: str) -> None:
    try:
        assert_no_secrets_in_metadata(value, path=path)
    except IntegrationSecurityError as exc:
        raise IntegrationValidationError(str(exc)) from exc


async def create_provider(
    session: AsyncSession,
    *,
    payload: IntegrationProviderCreateRequest,
    actor_user_id: UUID,
    ip_address: str | None,
    settings: Settings,
) -> IntegrationProvider:
    if await get_integration_provider_by_key(session, payload.provider_key) is not None:
        raise IntegrationConflictError("Provider key already exists")

    _safe_metadata(payload.settings, path="settings")
    _safe_metadata(payload.quota, path="quota")
    base_url = _safe_base_url(
        payload.base_url,
        is_internal=payload.is_internal,
        settings=settings,
    )
    secret = payload.secret.get_secret_value() if payload.secret is not None else None
    cipher = ProviderSecretCipher(settings)
    provider = IntegrationProvider(
        provider_key=payload.provider_key,
        display_name=payload.display_name.strip(),
        provider_type=payload.provider_type,
        adapter=payload.adapter,
        base_url=base_url,
        default_model=payload.default_model.strip() if payload.default_model else None,
        auth_scheme=payload.auth_scheme,
        secret_ciphertext=cipher.encrypt(secret) if secret else None,
        secret_hint=cipher.hint(secret) if secret else None,
        is_active=payload.is_active,
        is_internal=payload.is_internal,
        priority=payload.priority,
        timeout_seconds=payload.timeout_seconds,
        max_retries=payload.max_retries,
        capabilities_json=payload.capabilities,
        settings_json=payload.settings,
        quota_json=payload.quota,
        status="untested" if payload.is_active else "disabled",
        created_by=actor_user_id,
        updated_by=actor_user_id,
    )
    session.add(provider)
    await session.flush()
    await add_audit_log(
        session,
        actor_user_id=actor_user_id,
        company_id=None,
        action="integration.provider.create",
        resource_type="integration_provider",
        resource_id=str(provider.id),
        metadata_json={
            "provider_key": provider.provider_key,
            "provider_type": provider.provider_type,
            "adapter": provider.adapter,
            "secret_configured": secret is not None,
        },
        ip_address=ip_address,
    )
    return provider


async def update_provider(
    session: AsyncSession,
    *,
    provider_id: UUID,
    payload: IntegrationProviderUpdateRequest,
    actor_user_id: UUID,
    ip_address: str | None,
    settings: Settings,
) -> IntegrationProvider:
    provider = await get_integration_provider(session, provider_id)
    if provider is None:
        raise IntegrationNotFoundError("Integration provider not found")

    changes = payload.model_dump(exclude_unset=True)
    is_internal = bool(changes.get("is_internal", provider.is_internal))
    requested_base_url = changes.get("base_url", provider.base_url)
    base_url = _safe_base_url(
        requested_base_url if isinstance(requested_base_url, str) else None,
        is_internal=is_internal,
        settings=settings,
    )
    if "settings" in changes:
        _safe_metadata(changes["settings"], path="settings")
    if "quota" in changes:
        _safe_metadata(changes["quota"], path="quota")

    field_map = {
        "display_name": "display_name",
        "provider_type": "provider_type",
        "adapter": "adapter",
        "default_model": "default_model",
        "auth_scheme": "auth_scheme",
        "is_active": "is_active",
        "is_internal": "is_internal",
        "priority": "priority",
        "timeout_seconds": "timeout_seconds",
        "max_retries": "max_retries",
        "capabilities": "capabilities_json",
        "settings": "settings_json",
        "quota": "quota_json",
    }
    changed_fields: list[str] = []
    for request_field, model_field in field_map.items():
        if request_field not in changes:
            continue
        setattr(provider, model_field, changes[request_field])
        changed_fields.append(request_field)
    if "base_url" in changes or "is_internal" in changes:
        provider.base_url = base_url
        if "base_url" not in changed_fields:
            changed_fields.append("base_url")

    provider.updated_by = actor_user_id
    provider.status = "untested" if provider.is_active else "disabled"
    provider.last_error = None
    await session.flush()
    await add_audit_log(
        session,
        actor_user_id=actor_user_id,
        company_id=None,
        action="integration.provider.update",
        resource_type="integration_provider",
        resource_id=str(provider.id),
        metadata_json={
            "provider_key": provider.provider_key,
            "changed_fields": sorted(changed_fields),
        },
        ip_address=ip_address,
    )
    return provider


async def rotate_provider_secret(
    session: AsyncSession,
    *,
    provider_id: UUID,
    secret: str,
    actor_user_id: UUID,
    ip_address: str | None,
    settings: Settings,
) -> IntegrationProvider:
    provider = await get_integration_provider(session, provider_id)
    if provider is None:
        raise IntegrationNotFoundError("Integration provider not found")
    cipher = ProviderSecretCipher(settings)
    provider.secret_ciphertext = cipher.encrypt(secret)
    provider.secret_hint = cipher.hint(secret)
    provider.status = "untested" if provider.is_active else "disabled"
    provider.last_error = None
    provider.updated_by = actor_user_id
    await session.flush()
    await add_audit_log(
        session,
        actor_user_id=actor_user_id,
        company_id=None,
        action="integration.secret.rotate",
        resource_type="integration_provider",
        resource_id=str(provider.id),
        metadata_json={"provider_key": provider.provider_key},
        ip_address=ip_address,
    )
    return provider


async def revoke_provider_secret(
    session: AsyncSession,
    *,
    provider_id: UUID,
    actor_user_id: UUID,
    ip_address: str | None,
) -> IntegrationProvider:
    provider = await get_integration_provider(session, provider_id)
    if provider is None:
        raise IntegrationNotFoundError("Integration provider not found")
    provider.secret_ciphertext = None
    provider.secret_hint = None
    provider.status = "untested" if provider.is_active else "disabled"
    provider.last_error = None
    provider.updated_by = actor_user_id
    await session.flush()
    await add_audit_log(
        session,
        actor_user_id=actor_user_id,
        company_id=None,
        action="integration.secret.revoke",
        resource_type="integration_provider",
        resource_id=str(provider.id),
        metadata_json={"provider_key": provider.provider_key},
        ip_address=ip_address,
    )
    return provider


def _probe_url(provider: IntegrationProvider) -> str:
    if provider.base_url is None:
        raise IntegrationValidationError("Provider base URL is not configured")
    if provider.adapter in {
        "openai",
        "openai_compatible",
        "gemini_openai",
        "perplexity",
        "ollama",
        "vllm",
    }:
        return f"{provider.base_url.rstrip('/')}/models"
    if provider.adapter == "resend":
        return f"{provider.base_url.rstrip('/')}/domains"
    return provider.base_url


def _probe_headers(provider: IntegrationProvider, secret: str | None) -> dict[str, str]:
    if provider.auth_scheme == "none":
        return {"Accept": "application/json", "User-Agent": "HRing-Integration-Health/1.0"}
    if not secret:
        raise IntegrationValidationError("Provider secret is not configured")
    header_names = {
        "bearer": "Authorization",
        "x-api-key": "X-API-Key",
        "api-key": "Api-Key",
        "x-goog-api-key": "X-Goog-Api-Key",
    }
    name = header_names.get(provider.auth_scheme)
    if name is None:
        raise IntegrationValidationError("Provider authentication scheme is unsupported")
    value = f"Bearer {secret}" if provider.auth_scheme == "bearer" else secret
    return {
        "Accept": "application/json",
        "User-Agent": "HRing-Integration-Health/1.0",
        name: value,
    }


async def test_provider_connection(
    session: AsyncSession,
    *,
    provider_id: UUID,
    actor_user_id: UUID,
    ip_address: str | None,
    settings: Settings,
) -> ConnectionTestResult:
    provider = await get_integration_provider(session, provider_id)
    if provider is None:
        raise IntegrationNotFoundError("Integration provider not found")

    tested_at = datetime.now(UTC)
    healthy = False
    http_status: int | None = None
    latency_ms: int | None = None
    message = "Provider connection test failed"
    started = time.perf_counter()
    try:
        if not provider.is_active:
            raise IntegrationValidationError("Provider is disabled")
        if provider.base_url is None:
            raise IntegrationValidationError("Provider base URL is not configured")
        await assert_provider_host_is_safe(
            provider.base_url,
            is_internal=provider.is_internal,
            allowed_internal_hosts=settings.integration_internal_hosts,
        )
        secret = None
        if provider.secret_ciphertext is not None:
            secret = ProviderSecretCipher(settings).decrypt(provider.secret_ciphertext)
        headers = _probe_headers(provider, secret)
        url = _probe_url(provider)
        async with httpx.AsyncClient(
            timeout=float(provider.timeout_seconds),
            follow_redirects=False,
        ) as client:
            response = await client.get(url, headers=headers)
        http_status = response.status_code
        healthy = 200 <= response.status_code < 300
        message = "Connection succeeded" if healthy else f"Provider returned HTTP {http_status}"
    except (IntegrationSecurityError, IntegrationValidationError) as exc:
        message = str(exc)
    except httpx.TimeoutException:
        message = "Provider connection timed out"
    except httpx.HTTPError:
        message = "Provider connection could not be established"
    finally:
        latency_ms = max(0, int((time.perf_counter() - started) * 1000))

    provider.status = "healthy" if healthy else ("disabled" if not provider.is_active else "unhealthy")
    provider.last_tested_at = tested_at
    provider.last_success_at = tested_at if healthy else provider.last_success_at
    provider.last_error = None if healthy else message[:500]
    provider.updated_by = actor_user_id
    await session.flush()
    await add_audit_log(
        session,
        actor_user_id=actor_user_id,
        company_id=None,
        action="integration.provider.test",
        resource_type="integration_provider",
        resource_id=str(provider.id),
        outcome="success" if healthy else "failure",
        metadata_json={
            "provider_key": provider.provider_key,
            "healthy": healthy,
            "http_status": http_status,
            "latency_ms": latency_ms,
        },
        ip_address=ip_address,
    )
    return ConnectionTestResult(
        provider_id=provider.id,
        healthy=healthy,
        status=provider.status,
        http_status=http_status,
        latency_ms=latency_ms,
        message=message,
        tested_at=tested_at,
    )
