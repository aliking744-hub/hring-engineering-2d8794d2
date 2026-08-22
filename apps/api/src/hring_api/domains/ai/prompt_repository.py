from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.ai.models import AiPrompt, AiPromptVersion


async def list_prompts(session: AsyncSession) -> list[AiPrompt]:
    result = await session.execute(
        select(AiPrompt).order_by(AiPrompt.updated_at.desc(), AiPrompt.prompt_key)
    )
    return list(result.scalars().all())


async def get_prompt(
    session: AsyncSession,
    prompt_id: UUID,
    *,
    for_update: bool = False,
) -> AiPrompt | None:
    statement = select(AiPrompt).where(AiPrompt.id == prompt_id)
    if for_update:
        statement = statement.with_for_update()
    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def get_prompt_by_key(session: AsyncSession, prompt_key: str) -> AiPrompt | None:
    result = await session.execute(
        select(AiPrompt).where(AiPrompt.prompt_key == prompt_key)
    )
    return result.scalar_one_or_none()


async def list_prompt_versions(
    session: AsyncSession,
    prompt_id: UUID,
) -> list[AiPromptVersion]:
    result = await session.execute(
        select(AiPromptVersion)
        .where(AiPromptVersion.prompt_id == prompt_id)
        .order_by(AiPromptVersion.version.desc())
    )
    return list(result.scalars().all())


async def get_prompt_version(
    session: AsyncSession,
    *,
    prompt_id: UUID,
    version_id: UUID,
) -> AiPromptVersion | None:
    result = await session.execute(
        select(AiPromptVersion).where(
            AiPromptVersion.id == version_id,
            AiPromptVersion.prompt_id == prompt_id,
        )
    )
    return result.scalar_one_or_none()


async def get_prompt_version_by_status(
    session: AsyncSession,
    *,
    prompt_id: UUID,
    status: str,
) -> AiPromptVersion | None:
    result = await session.execute(
        select(AiPromptVersion).where(
            AiPromptVersion.prompt_id == prompt_id,
            AiPromptVersion.status == status,
        )
    )
    return result.scalar_one_or_none()


async def next_prompt_version(session: AsyncSession, prompt_id: UUID) -> int:
    result = await session.execute(
        select(func.coalesce(func.max(AiPromptVersion.version), 0)).where(
            AiPromptVersion.prompt_id == prompt_id
        )
    )
    return int(result.scalar_one()) + 1
