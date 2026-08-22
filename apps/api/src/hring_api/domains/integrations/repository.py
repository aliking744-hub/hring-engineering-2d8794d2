from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.integrations.models import IntegrationProvider


async def list_integration_providers(session: AsyncSession) -> list[IntegrationProvider]:
    result = await session.execute(
        select(IntegrationProvider).order_by(
            IntegrationProvider.provider_type,
            IntegrationProvider.priority,
            IntegrationProvider.provider_key,
        )
    )
    return list(result.scalars().all())


async def get_integration_provider(
    session: AsyncSession,
    provider_id: UUID,
) -> IntegrationProvider | None:
    return await session.get(IntegrationProvider, provider_id)


async def get_integration_provider_by_key(
    session: AsyncSession,
    provider_key: str,
) -> IntegrationProvider | None:
    result = await session.execute(
        select(IntegrationProvider).where(
            IntegrationProvider.provider_key == provider_key
        )
    )
    return result.scalar_one_or_none()
