from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.headhunting.models import Campaign, Candidate
from hring_api.domains.headhunting.schemas import CampaignCreate, CampaignUpdate, CandidateCreate
from hring_api.domains.identity.dependencies import Principal


def active_company_ids(principal: Principal) -> set[UUID]:
    return {
        membership.company_id
        for membership in principal.memberships
        if membership.is_active
    }


def assert_company_scope(principal: Principal, company_id: UUID | None) -> None:
    if company_id is not None and company_id not in active_company_ids(principal):
        raise PermissionError("Company scope is not available to this user")


async def list_campaigns(
    session: AsyncSession,
    *,
    principal: Principal,
) -> list[tuple[Campaign, int, int]]:
    company_ids = active_company_ids(principal)
    stmt = (
        select(
            Campaign,
            func.count(Candidate.id).label("candidate_count"),
            func.coalesce(func.round(func.avg(Candidate.match_score)), 0).label("avg_match_score"),
        )
        .outerjoin(Candidate, Candidate.campaign_id == Campaign.id)
        .where(Campaign.user_id == principal.user_id)
        .group_by(Campaign.id)
        .order_by(Campaign.created_at.desc())
    )
    rows = (await session.execute(stmt)).all()
    result: list[tuple[Campaign, int, int]] = []
    for campaign, count, avg_score in rows:
        if campaign.company_id is not None and campaign.company_id not in company_ids:
            continue
        result.append((campaign, int(count or 0), int(avg_score or 0)))
    return result


async def get_campaign(
    session: AsyncSession,
    *,
    principal: Principal,
    campaign_id: UUID,
) -> Campaign | None:
    campaign = await session.get(Campaign, campaign_id)
    if campaign is None or campaign.user_id != principal.user_id:
        return None
    if campaign.company_id is not None and campaign.company_id not in active_company_ids(principal):
        return None
    return campaign


async def create_campaign(
    session: AsyncSession,
    *,
    principal: Principal,
    payload: CampaignCreate,
) -> Campaign:
    assert_company_scope(principal, payload.company_id)
    campaign = Campaign(
        user_id=principal.user_id,
        company_id=payload.company_id,
        name=payload.name,
        city=payload.city,
        job_title=payload.job_title or payload.name,
        industry=payload.industry,
        experience_range=payload.experience_range,
        education_level=payload.education_level,
        skills=payload.skills,
        auto_headhunting=payload.auto_headhunting,
        status="processing",
        progress=0,
    )
    session.add(campaign)
    await session.commit()
    await session.refresh(campaign)
    return campaign


async def update_campaign(
    session: AsyncSession,
    *,
    campaign: Campaign,
    payload: CampaignUpdate,
) -> Campaign:
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(campaign, key, value)
    await session.commit()
    await session.refresh(campaign)
    return campaign


async def remove_campaign(session: AsyncSession, *, campaign: Campaign) -> None:
    await session.delete(campaign)
    await session.commit()


async def list_candidates(
    session: AsyncSession,
    *,
    campaign_id: UUID,
) -> list[Candidate]:
    stmt = (
        select(Candidate)
        .where(Candidate.campaign_id == campaign_id)
        .order_by(Candidate.match_score.desc(), Candidate.created_at.asc())
    )
    return list((await session.scalars(stmt)).all())


async def add_candidates(
    session: AsyncSession,
    *,
    campaign_id: UUID,
    candidates: Sequence[CandidateCreate],
) -> list[Candidate]:
    rows = [
        Candidate(
            campaign_id=campaign_id,
            name=item.name,
            email=item.email,
            phone=item.phone,
            skills=item.skills,
            experience=item.experience,
            education=item.education,
            last_company=item.last_company,
            location=item.location,
            title=item.title,
            match_score=item.match_score,
            candidate_temperature=item.candidate_temperature,
            recommendation=item.recommendation,
            green_flags=item.green_flags,
            red_flags=item.red_flags,
            layer_scores=item.layer_scores,
            raw_data=item.raw_data,
        )
        for item in candidates
    ]
    session.add_all(rows)
    await session.commit()
    for row in rows:
        await session.refresh(row)
    return rows


async def replace_candidates(
    session: AsyncSession,
    *,
    campaign_id: UUID,
    candidates: Sequence[CandidateCreate],
) -> list[Candidate]:
    await session.execute(delete(Candidate).where(Candidate.campaign_id == campaign_id))
    rows = [
        Candidate(
            campaign_id=campaign_id,
            name=item.name,
            email=item.email,
            phone=item.phone,
            skills=item.skills,
            experience=item.experience,
            education=item.education,
            last_company=item.last_company,
            location=item.location,
            title=item.title,
            match_score=item.match_score,
            candidate_temperature=item.candidate_temperature,
            recommendation=item.recommendation,
            green_flags=item.green_flags,
            red_flags=item.red_flags,
            layer_scores=item.layer_scores,
            raw_data=item.raw_data,
        )
        for item in candidates
    ]
    session.add_all(rows)
    await session.commit()
    for row in rows:
        await session.refresh(row)
    return rows
