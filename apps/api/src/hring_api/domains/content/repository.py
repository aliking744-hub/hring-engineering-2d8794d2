from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.content.models import ContentAgentRun, ContentAgentSetting, ContentArticle


async def get_agent_settings(session: AsyncSession, *, for_update: bool = False) -> ContentAgentSetting | None:
    statement = select(ContentAgentSetting).limit(1)
    if for_update:
        statement = statement.with_for_update()
    return (await session.execute(statement)).scalar_one_or_none()


async def list_public_articles(session: AsyncSession, *, limit: int, offset: int) -> list[ContentArticle]:
    result = await session.execute(
        select(ContentArticle)
        .where(ContentArticle.status == "published", ContentArticle.published_at <= datetime.now(UTC))
        .order_by(ContentArticle.published_at.desc())
        .limit(limit).offset(offset)
    )
    return list(result.scalars().all())


async def get_public_article(session: AsyncSession, slug: str) -> ContentArticle | None:
    result = await session.execute(
        select(ContentArticle).where(ContentArticle.slug == slug, ContentArticle.status == "published")
    )
    return result.scalar_one_or_none()


async def list_articles_for_admin(session: AsyncSession, *, limit: int, offset: int) -> list[ContentArticle]:
    result = await session.execute(
        select(ContentArticle).order_by(ContentArticle.created_at.desc()).limit(limit).offset(offset)
    )
    return list(result.scalars().all())


async def list_runs(session: AsyncSession, *, limit: int) -> list[ContentAgentRun]:
    result = await session.execute(select(ContentAgentRun).order_by(ContentAgentRun.started_at.desc()).limit(limit))
    return list(result.scalars().all())


async def recent_articles(session: AsyncSession, *, limit: int = 80) -> list[ContentArticle]:
    result = await session.execute(select(ContentArticle).order_by(ContentArticle.created_at.desc()).limit(limit))
    return list(result.scalars().all())


async def get_article(session: AsyncSession, article_id: UUID) -> ContentArticle | None:
    return await session.get(ContentArticle, article_id)

