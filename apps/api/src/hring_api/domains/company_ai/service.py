from __future__ import annotations

import time
from datetime import UTC, datetime
from uuid import UUID

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings
from hring_api.domains.admin.repository import add_audit_log
from hring_api.domains.ai.feature_catalog import AI_FEATURE_BY_KEY
from hring_api.domains.company_ai.models import CompanyAiConnection
from hring_api.domains.company_ai.repository import get_company_ai_connection
from hring_api.domains.company_ai.schemas import (
    CompanyAiCapabilityResponse,
    CompanyAiConnectionResponse,
    CompanyAiConnectionTestResponse,
    CompanyAiConnectionUpsertRequest,
)
from hring_api.domains.integrations.security import (
    IntegrationSecurityError,
    ProviderSecretCipher,
    assert_provider_host_is_safe,
    normalize_provider_base_url,
)
from hring_api.domains.integrations.service import RUNTIME_ADAPTERS_BY_TYPE


class CompanyAiConnectionError(RuntimeError):
    pass


class CompanyAiConnectionNotFoundError(CompanyAiConnectionError):
    pass


# Headhunting is deliberately excluded until its separate PR744 reconstruction
# is complete.  No tenant can make a connection look functional before that.
COMPANY_CONFIGURABLE_FEATURE_KEYS = frozenset(
    key for key in AI_FEATURE_BY_KEY if not key.startswith("smart_headhunting.")
)


def _validate_capability_key(capability_key: str) -> None:
    if capability_key not in COMPANY_CONFIGURABLE_FEATURE_KEYS:
        raise CompanyAiConnectionNotFoundError("AI capability is not configurable for companies")


def _validate_adapter(adapter: str) -> None:
    if adapter not in RUNTIME_ADAPTERS_BY_TYPE["llm"]:
        raise CompanyAiConnectionError("AI adapter is not supported by the runtime")


def _safe_base_url(value: str, settings: Settings) -> str:
    try:
        normalized = normalize_provider_base_url(
            value, is_internal=False, allowed_internal_hosts=settings.integration_internal_hosts
        )
    except IntegrationSecurityError as exc:
        raise CompanyAiConnectionError(str(exc)) from exc
    if normalized is None:
        raise CompanyAiConnectionError("BYOK requires a provider base URL")
    return normalized


async def uses_company_byok(
    session: AsyncSession,
    *,
    company_id: UUID | None,
    capability_key: str,
) -> bool:
    """Whether this request is eligible for the customer's own provider bill.

    A stale or unhealthy BYOK route is deliberately not considered billable;
    Gateway will fail closed and any managed reservation is released.
    """

    if company_id is None or capability_key not in COMPANY_CONFIGURABLE_FEATURE_KEYS:
        return False
    connection = await get_company_ai_connection(
        session, company_id=company_id, capability_key=capability_key
    )
    return bool(
        connection is not None
        and connection.mode == "byok"
        and connection.is_active
        and connection.status == "healthy"
    )


def connection_response(connection: CompanyAiConnection) -> CompanyAiConnectionResponse:
    return CompanyAiConnectionResponse(
        id=connection.id,
        company_id=connection.company_id,
        capability_key=connection.capability_key,
        mode=connection.mode,
        provider_key=connection.provider_key,
        adapter=connection.adapter,
        base_url=connection.base_url,
        default_model=connection.default_model,
        auth_scheme=connection.auth_scheme,
        secret_configured=connection.secret_ciphertext is not None,
        secret_hint=connection.secret_hint,
        is_active=connection.is_active,
        status=connection.status,
        last_tested_at=connection.last_tested_at,
        last_success_at=connection.last_success_at,
        last_error=connection.last_error,
        created_at=connection.created_at,
        updated_at=connection.updated_at,
    )


def company_ai_capability_catalog(
    connections: list[CompanyAiConnection],
) -> list[CompanyAiCapabilityResponse]:
    by_key = {item.capability_key: item for item in connections}
    return [
        CompanyAiCapabilityResponse(
            feature_key=feature.feature_key,
            display_name=feature.display_name,
            category=feature.category,
            description=feature.description,
            connection=(
                connection_response(by_key[feature.feature_key])
                if feature.feature_key in by_key
                else None
            ),
        )
        for feature in AI_FEATURE_BY_KEY.values()
        if feature.feature_key in COMPANY_CONFIGURABLE_FEATURE_KEYS
    ]


async def upsert_company_ai_connection(
    session: AsyncSession,
    *,
    company_id: UUID,
    capability_key: str,
    payload: CompanyAiConnectionUpsertRequest,
    actor_user_id: UUID,
    ip_address: str | None,
    settings: Settings,
) -> CompanyAiConnection:
    _validate_capability_key(capability_key)
    existing = await get_company_ai_connection(
        session, company_id=company_id, capability_key=capability_key, for_update=True
    )
    secret = payload.secret.get_secret_value() if payload.secret is not None else None

    if payload.mode == "byok":
        assert payload.adapter is not None and payload.base_url is not None
        _validate_adapter(payload.adapter)
        base_url = _safe_base_url(payload.base_url, settings)
        if existing is None and not secret:
            raise CompanyAiConnectionError("BYOK requires a provider secret when it is first configured")
        cipher = ProviderSecretCipher(settings)
        changes = {
            "mode": "byok",
            "provider_key": payload.provider_key.strip() if payload.provider_key else None,
            "adapter": payload.adapter,
            "base_url": base_url,
            "default_model": payload.default_model.strip() if payload.default_model else None,
            "auth_scheme": payload.auth_scheme,
            "is_active": payload.is_active,
            "status": "untested" if payload.is_active else "disabled",
            "last_error": None,
        }
        if secret:
            changes["secret_ciphertext"] = cipher.encrypt(secret)
            changes["secret_hint"] = cipher.hint(secret)
    else:
        changes = {
            "mode": "hring_managed",
            "provider_key": None,
            "adapter": None,
            "base_url": None,
            "default_model": None,
            "auth_scheme": "bearer",
            "secret_ciphertext": None,
            "secret_hint": None,
            "is_active": payload.is_active,
            "status": "untested" if payload.is_active else "disabled",
            "last_error": None,
        }

    if existing is None:
        connection = CompanyAiConnection(
            company_id=company_id,
            capability_key=capability_key,
            created_by=actor_user_id,
            updated_by=actor_user_id,
            **changes,
        )
        session.add(connection)
        action = "company.ai_connection.create"
    else:
        connection = existing
        for field, value in changes.items():
            setattr(connection, field, value)
        connection.updated_by = actor_user_id
        action = "company.ai_connection.update"

    await session.flush()
    await add_audit_log(
        session,
        actor_user_id=actor_user_id,
        company_id=company_id,
        action=action,
        resource_type="company_ai_connection",
        resource_id=str(connection.id),
        metadata_json={
            "capability_key": capability_key,
            "mode": connection.mode,
            "provider_key": connection.provider_key,
            "adapter": connection.adapter,
            "secret_rotated": secret is not None,
        },
        ip_address=ip_address,
    )
    return connection


def _probe_url(connection: CompanyAiConnection) -> str:
    if connection.base_url is None:
        raise CompanyAiConnectionError("Provider base URL is not configured")
    suffix = "/v1/models" if connection.adapter == "anthropic" else "/models"
    return f"{connection.base_url.rstrip('/')}{suffix}"


def _probe_headers(connection: CompanyAiConnection, secret: str) -> dict[str, str]:
    headers = {"Accept": "application/json", "User-Agent": "HRing-Company-AI-Health/1.0"}
    if connection.auth_scheme == "bearer":
        headers["Authorization"] = f"Bearer {secret}"
    elif connection.auth_scheme == "x-api-key":
        headers["x-api-key"] = secret
    elif connection.auth_scheme == "api-key":
        headers["api-key"] = secret
    elif connection.auth_scheme == "x-goog-api-key":
        headers["x-goog-api-key"] = secret
    return headers


async def test_company_ai_connection(
    session: AsyncSession,
    *,
    company_id: UUID,
    capability_key: str,
    actor_user_id: UUID,
    ip_address: str | None,
    settings: Settings,
) -> CompanyAiConnectionTestResponse:
    _validate_capability_key(capability_key)
    connection = await get_company_ai_connection(
        session, company_id=company_id, capability_key=capability_key, for_update=True
    )
    if connection is None:
        raise CompanyAiConnectionNotFoundError("AI connection not found")
    if connection.mode != "byok":
        raise CompanyAiConnectionError("HRing-managed routes are tested by platform operations")
    if not connection.is_active:
        raise CompanyAiConnectionError("AI connection is disabled")
    if not connection.base_url or not connection.secret_ciphertext:
        raise CompanyAiConnectionError("BYOK connection is incomplete")

    tested_at = datetime.now(UTC)
    started = time.perf_counter()
    http_status: int | None = None
    healthy = False
    message = "Provider connection could not be established"
    try:
        await assert_provider_host_is_safe(
            connection.base_url,
            is_internal=False,
            allowed_internal_hosts=settings.integration_internal_hosts,
        )
        secret = ProviderSecretCipher(settings).decrypt(connection.secret_ciphertext)
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=False, trust_env=False) as client:
            response = await client.get(_probe_url(connection), headers=_probe_headers(connection, secret))
        http_status = response.status_code
        healthy = 200 <= response.status_code < 300
        message = "Connection succeeded" if healthy else f"Provider returned HTTP {response.status_code}"
    except (IntegrationSecurityError, CompanyAiConnectionError) as exc:
        message = str(exc)
    except httpx.TimeoutException:
        message = "Provider connection timed out"
    except httpx.HTTPError:
        message = "Provider connection could not be established"

    latency_ms = max(0, int((time.perf_counter() - started) * 1000))
    connection.status = "healthy" if healthy else "unhealthy"
    connection.last_tested_at = tested_at
    connection.last_success_at = tested_at if healthy else connection.last_success_at
    connection.last_error = None if healthy else message[:500]
    connection.updated_by = actor_user_id
    await session.flush()
    await add_audit_log(
        session,
        actor_user_id=actor_user_id,
        company_id=company_id,
        action="company.ai_connection.test",
        resource_type="company_ai_connection",
        resource_id=str(connection.id),
        outcome="success" if healthy else "failure",
        metadata_json={
            "capability_key": capability_key,
            "http_status": http_status,
            "latency_ms": latency_ms,
        },
        ip_address=ip_address,
    )
    return CompanyAiConnectionTestResponse(
        healthy=healthy,
        status=connection.status,
        http_status=http_status,
        latency_ms=latency_ms,
        message=message,
        tested_at=tested_at,
    )


async def delete_company_ai_connection(
    session: AsyncSession,
    *,
    company_id: UUID,
    capability_key: str,
    actor_user_id: UUID,
    ip_address: str | None,
) -> None:
    _validate_capability_key(capability_key)
    connection = await get_company_ai_connection(
        session, company_id=company_id, capability_key=capability_key, for_update=True
    )
    if connection is None:
        raise CompanyAiConnectionNotFoundError("AI connection not found")
    connection_id = str(connection.id)
    await session.delete(connection)
    await session.flush()
    await add_audit_log(
        session,
        actor_user_id=actor_user_id,
        company_id=company_id,
        action="company.ai_connection.delete",
        resource_type="company_ai_connection",
        resource_id=connection_id,
        metadata_json={"capability_key": capability_key},
        ip_address=ip_address,
    )
