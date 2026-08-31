from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.company_ai.models import CompanyAiConnection


async def list_company_ai_connections(
    session: AsyncSession, *, company_id: UUID
) -> list[CompanyAiConnection]:
    result = await session.execute(
        select(CompanyAiConnection)
        .where(CompanyAiConnection.company_id == company_id)
        .order_by(CompanyAiConnection.capability_key.asc())
    )
    return list(result.scalars().all())


async def get_company_ai_connection(
    session: AsyncSession, *, company_id: UUID, capability_key: str, for_update: bool = False
) -> CompanyAiConnection | None:
    statement = select(CompanyAiConnection).where(
        CompanyAiConnection.company_id == company_id,
        CompanyAiConnection.capability_key == capability_key,
    )
    if for_update:
        statement = statement.with_for_update()
    result = await session.execute(statement)
    return result.scalar_one_or_none()
