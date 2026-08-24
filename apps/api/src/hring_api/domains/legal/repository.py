from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import case, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.legal.models import LegalChunk, LegalSource


async def get_source_by_checksum(
    session: AsyncSession,
    *,
    checksum: str,
    for_update: bool = False,
) -> LegalSource | None:
    statement = select(LegalSource).where(LegalSource.checksum == checksum)
    if for_update:
        statement = statement.with_for_update()
    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def get_source(
    session: AsyncSession,
    *,
    source_id: UUID,
    include_deleted: bool = False,
    for_update: bool = False,
) -> LegalSource | None:
    statement = select(LegalSource).where(LegalSource.id == source_id)
    if not include_deleted:
        statement = statement.where(LegalSource.status != "deleted")
    if for_update:
        statement = statement.with_for_update()
    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def next_source_version(
    session: AsyncSession,
    *,
    source_key: str,
) -> int:
    current = await session.scalar(
        select(func.max(LegalSource.version)).where(LegalSource.source_key == source_key)
    )
    return int(current or 0) + 1


async def create_source(
    session: AsyncSession,
    *,
    values: dict[str, object],
) -> LegalSource:
    row = LegalSource(**values)
    session.add(row)
    await session.flush()
    return row


async def replace_source_chunks(
    session: AsyncSession,
    *,
    source: LegalSource,
    chunks: list[dict[str, object]],
) -> None:
    await session.execute(delete(LegalChunk).where(LegalChunk.source_id == source.id))
    session.add_all(
        [
            LegalChunk(
                source_id=source.id,
                chunk_index=index,
                **values,
            )
            for index, values in enumerate(chunks)
        ]
    )
    await session.flush()


async def count_source_chunks(session: AsyncSession, *, source_id: UUID) -> int:
    count = await session.scalar(
        select(func.count(LegalChunk.id)).where(LegalChunk.source_id == source_id)
    )
    return int(count or 0)


async def list_sources(
    session: AsyncSession,
    *,
    limit: int,
    offset: int,
    include_deleted: bool,
) -> list[tuple[LegalSource, int]]:
    statement = (
        select(LegalSource, func.count(LegalChunk.id))
        .outerjoin(LegalChunk, LegalChunk.source_id == LegalSource.id)
        .group_by(LegalSource.id)
        .order_by(LegalSource.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if not include_deleted:
        statement = statement.where(LegalSource.status != "deleted")
    result = await session.execute(statement)
    return [(source, int(count)) for source, count in result.all()]


async def legal_stats(
    session: AsyncSession,
) -> tuple[int, int, int, list[tuple[str, int, int]]]:
    active_sources = int(
        await session.scalar(
            select(func.count(LegalSource.id)).where(LegalSource.status == "active")
        )
        or 0
    )
    pending_sources = int(
        await session.scalar(
            select(func.count(LegalSource.id)).where(
                LegalSource.status == "active",
                LegalSource.index_status != "ready",
            )
        )
        or 0
    )
    indexed_chunks = int(
        await session.scalar(
            select(func.count(LegalChunk.id)).join(LegalSource).where(
                LegalSource.status == "active"
            )
        )
        or 0
    )
    result = await session.execute(
        select(
            LegalSource.category,
            func.count(func.distinct(LegalSource.id)),
            func.count(LegalChunk.id),
        )
        .outerjoin(LegalChunk, LegalChunk.source_id == LegalSource.id)
        .where(LegalSource.status == "active")
        .group_by(LegalSource.category)
        .order_by(LegalSource.category)
    )
    categories = [
        (str(category), int(source_count), int(chunk_count))
        for category, source_count, chunk_count in result.all()
    ]
    return active_sources, indexed_chunks, pending_sources, categories


async def search_chunks(
    session: AsyncSession,
    *,
    query: str,
    query_embedding: list[float],
    category: str | None,
    limit: int,
    threshold: float,
) -> list[tuple[LegalChunk, LegalSource, float]]:
    lexical_query = func.plainto_tsquery("simple", query)
    raw_lexical_rank = func.ts_rank_cd(LegalChunk.search_vector, lexical_query)
    lexical_score = 1.0 - func.exp(-8.0 * raw_lexical_rank)
    vector_score = case(
        (
            LegalChunk.embedding.is_not(None),
            func.greatest(
                0.0,
                1.0 - LegalChunk.embedding.cosine_distance(query_embedding),
            ),
        ),
        else_=0.0,
    )
    hybrid_score = (vector_score * 0.75 + lexical_score * 0.25).label("similarity")
    today = date.today()
    statement = (
        select(LegalChunk, LegalSource, hybrid_score)
        .join(LegalSource, LegalSource.id == LegalChunk.source_id)
        .where(
            LegalSource.status == "active",
            or_(LegalSource.valid_from.is_(None), LegalSource.valid_from <= today),
            or_(LegalSource.valid_to.is_(None), LegalSource.valid_to >= today),
            hybrid_score >= threshold,
        )
        .order_by(hybrid_score.desc(), LegalChunk.chunk_index.asc())
        .limit(limit)
    )
    if category is not None:
        statement = statement.where(LegalSource.category == category)
    result = await session.execute(statement)
    return [
        (chunk, source, max(0.0, min(1.0, float(score))))
        for chunk, source, score in result.all()
    ]
