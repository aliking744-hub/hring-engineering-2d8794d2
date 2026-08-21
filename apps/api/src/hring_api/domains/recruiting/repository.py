from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.recruiting.models import RecruitingCampaign, RecruitingCandidate


async def list_campaigns_for_owner(
    session: AsyncSession,
    *,
    owner_user_id: UUID,
) -> list[tuple[RecruitingCampaign, int, int]]:
    statement = (
        select(
            RecruitingCampaign,
            func.count(RecruitingCandidate.id).label("candidates_count"),
            func.coalesce(func.round(func.avg(RecruitingCandidate.match_score)), 0).label("avg_match_score"),
        )
        .outerjoin(RecruitingCandidate, RecruitingCandidate.campaign_id == RecruitingCampaign.id)
        .where(RecruitingCampaign.owner_user_id == owner_user_id)
        .group_by(RecruitingCampaign.id)
        .order_by(RecruitingCampaign.created_at.desc())
    )
    result = await session.execute(statement)
    return [(campaign, int(count), int(avg_score)) for campaign, count, avg_score in result.all()]


async def get_campaign_for_owner(
    session: AsyncSession,
    *,
    campaign_id: UUID,
    owner_user_id: UUID,
    for_update: bool = False,
) -> RecruitingCampaign | None:
    statement = select(RecruitingCampaign).where(
        RecruitingCampaign.id == campaign_id,
        RecruitingCampaign.owner_user_id == owner_user_id,
    )
    if for_update:
        statement = statement.with_for_update()
    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def list_candidates_for_campaign(
    session: AsyncSession,
    *,
    campaign_id: UUID,
) -> list[RecruitingCandidate]:
    result = await session.execute(
        select(RecruitingCandidate)
        .where(RecruitingCandidate.campaign_id == campaign_id)
        .order_by(RecruitingCandidate.match_score.desc(), RecruitingCandidate.created_at.desc())
    )
    return list(result.scalars().all())


async def create_campaign(
    session: AsyncSession,
    *,
    owner_user_id: UUID,
    company_id: UUID | None,
    values: dict[str, object],
) -> RecruitingCampaign:
    row = RecruitingCampaign(owner_user_id=owner_user_id, company_id=company_id, **values)
    session.add(row)
    await session.flush()
    return row


async def add_candidates(
    session: AsyncSession,
    *,
    campaign_id: UUID,
    rows: list[dict[str, object]],
) -> list[RecruitingCandidate]:
    candidates = [RecruitingCandidate(campaign_id=campaign_id, **row) for row in rows]
    session.add_all(candidates)
    await session.flush()
    return candidates


async def delete_campaign(session: AsyncSession, *, campaign_id: UUID) -> None:
    await session.execute(delete(RecruitingCampaign).where(RecruitingCampaign.id == campaign_id))
    await session.flush()