from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings
from hring_api.domains.integrations.models import IntegrationProvider
from hring_api.domains.integrations.security import (
    IntegrationSecurityError,
    ProviderSecretCipher,
)


class RuntimeProviderConfigurationError(RuntimeError):
    pass


@dataclass(frozen=True)
class RuntimeProviderConfig:
    id: UUID
    provider_key: str
    provider_type: str
    adapter: str
    base_url: str | None
    default_model: str | None
    auth_scheme: str
    secret: str | None
    priority: int
    timeout_seconds: int
    max_retries: int
    capabilities: tuple[str, ...]
    settings: dict[str, object]
    quota: dict[str, object]


async def list_runtime_providers(
    session: AsyncSession,
    *,
    provider_type: str,
    settings: Settings,
    adapters: frozenset[str] | None = None,
) -> list[RuntimeProviderConfig]:
    statement = (
        select(IntegrationProvider)
        .where(
            IntegrationProvider.provider_type == provider_type,
            IntegrationProvider.is_active.is_(True),
            IntegrationProvider.status == "healthy",
        )
        .order_by(
            IntegrationProvider.priority,
            IntegrationProvider.provider_key,
        )
    )
    if adapters:
        statement = statement.where(IntegrationProvider.adapter.in_(adapters))
    result = await session.execute(statement)
    rows = list(result.scalars().all())
    cipher = ProviderSecretCipher(settings)
    configs: list[RuntimeProviderConfig] = []
    for row in rows:
        try:
            secret = (
                cipher.decrypt(row.secret_ciphertext)
                if row.secret_ciphertext is not None
                else None
            )
        except IntegrationSecurityError as exc:
            raise RuntimeProviderConfigurationError(
                f"Secret for provider '{row.provider_key}' cannot be decrypted"
            ) from exc
        configs.append(
            RuntimeProviderConfig(
                id=row.id,
                provider_key=row.provider_key,
                provider_type=row.provider_type,
                adapter=row.adapter,
                base_url=row.base_url,
                default_model=row.default_model,
                auth_scheme=row.auth_scheme,
                secret=secret,
                priority=row.priority,
                timeout_seconds=row.timeout_seconds,
                max_retries=row.max_retries,
                capabilities=tuple(row.capabilities_json),
                settings=row.settings_json,
                quota=row.quota_json,
            )
        )
    return configs


async def resolve_runtime_provider(
    session: AsyncSession,
    *,
    provider_type: str,
    settings: Settings,
    adapters: frozenset[str] | None = None,
) -> RuntimeProviderConfig | None:
    providers = await list_runtime_providers(
        session,
        provider_type=provider_type,
        settings=settings,
        adapters=adapters,
    )
    return providers[0] if providers else None


def string_setting(
    provider: RuntimeProviderConfig,
    key: str,
    *,
    default: str | None = None,
) -> str | None:
    value = provider.settings.get(key)
    if isinstance(value, str) and value.strip():
        return value.strip()
    return default
