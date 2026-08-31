from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.recruiting.models import RecruitingCampaign, RecruitingCandidate
from hring_api.domains.recruiting.repository import (
    add_candidates,
    create_campaign,
    delete_campaign,
    get_campaign_for_owner,
    get_candidate_for_owner,
    list_candidates_for_campaign,
    list_campaigns_for_owner,
)


class RecruitingError(Exception):
    pass


class CampaignNotFoundError(RecruitingError):
    pass


async def list_owner_campaigns(
    session: AsyncSession,
    *,
    owner_user_id: UUID,
) -> list[tuple[RecruitingCampaign, int, int]]:
    return await list_campaigns_for_owner(session, owner_user_id=owner_user_id)


async def create_owner_campaign(
    session: AsyncSession,
    *,
    owner_user_id: UUID,
    company_id: UUID | None,
    values: dict[str, object],
) -> RecruitingCampaign:
    return await create_campaign(
        session,
        owner_user_id=owner_user_id,
        company_id=company_id,
        values=values,
    )


async def get_owner_campaign_detail(
    session: AsyncSession,
    *,
    campaign_id: UUID,
    owner_user_id: UUID,
) -> tuple[RecruitingCampaign, list[RecruitingCandidate]]:
    campaign = await get_campaign_for_owner(
        session,
        campaign_id=campaign_id,
        owner_user_id=owner_user_id,
    )
    if campaign is None:
        raise CampaignNotFoundError("Campaign not found")
    return campaign, await list_candidates_for_campaign(session, campaign_id=campaign.id)


async def update_owner_campaign(
    session: AsyncSession,
    *,
    campaign_id: UUID,
    owner_user_id: UUID,
    values: dict[str, object],
) -> RecruitingCampaign:
    campaign = await get_campaign_for_owner(
        session,
        campaign_id=campaign_id,
        owner_user_id=owner_user_id,
        for_update=True,
    )
    if campaign is None:
        raise CampaignNotFoundError("Campaign not found")
    for key, value in values.items():
        setattr(campaign, key, value)
    await session.flush()
    return campaign


async def delete_owner_campaign(
    session: AsyncSession,
    *,
    campaign_id: UUID,
    owner_user_id: UUID,
) -> None:
    campaign = await get_campaign_for_owner(
        session,
        campaign_id=campaign_id,
        owner_user_id=owner_user_id,
    )
    if campaign is None:
        raise CampaignNotFoundError("Campaign not found")
    await delete_campaign(session, campaign_id=campaign.id)


async def add_owner_candidates(
    session: AsyncSession,
    *,
    campaign_id: UUID,
    owner_user_id: UUID,
    rows: list[dict[str, object]],
) -> list[RecruitingCandidate]:
    campaign = await get_campaign_for_owner(
        session,
        campaign_id=campaign_id,
        owner_user_id=owner_user_id,
    )
    if campaign is None:
        raise CampaignNotFoundError("Campaign not found")
    return await add_candidates(session, campaign_id=campaign.id, rows=rows)

async def get_owner_candidate(
    session: AsyncSession,
    *,
    campaign_id: UUID,
    candidate_id: UUID,
    owner_user_id: UUID,
) -> RecruitingCandidate:
    candidate = await get_candidate_for_owner(
        session,
        campaign_id=campaign_id,
        candidate_id=candidate_id,
        owner_user_id=owner_user_id,
    )
    if candidate is None:
        raise CampaignNotFoundError("Candidate not found")
    return candidate


async def update_owner_candidate_status(
    session: AsyncSession,
    *,
    campaign_id: UUID,
    candidate_id: UUID,
    owner_user_id: UUID,
    status: str,
) -> RecruitingCandidate:
    candidate = await get_candidate_for_owner(
        session,
        campaign_id=campaign_id,
        candidate_id=candidate_id,
        owner_user_id=owner_user_id,
        for_update=True,
    )
    if candidate is None:
        raise CampaignNotFoundError("Candidate not found")
    candidate.status = status
    await session.flush()
    return candidate
