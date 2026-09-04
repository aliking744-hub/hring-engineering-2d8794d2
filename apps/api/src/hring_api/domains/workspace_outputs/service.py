from hashlib import sha256
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.identity.dependencies import Principal
from hring_api.domains.workspace_outputs.models import WorkspaceOutput


ALLOWED_FEATURES = {
    "job_engineering.job_profile",
    "interview.kit",
    "job_ads.smart_ad_text",
}


def company_id_for(principal: Principal) -> UUID | None:
    for membership in principal.memberships:
        if membership.is_active:
            return membership.company_id
    return None


async def save_workspace_output(
    session: AsyncSession,
    *,
    principal: Principal,
    feature_key: str,
    idempotency_key: str,
    title: str,
    payload: dict[str, object],
) -> WorkspaceOutput:
    if feature_key not in ALLOWED_FEATURES:
        raise ValueError("Unsupported workspace history feature")
    key_hash = sha256(idempotency_key.strip().encode()).hexdigest()
    existing = await session.execute(
        select(WorkspaceOutput).where(
            WorkspaceOutput.owner_user_id == principal.user_id,
            WorkspaceOutput.feature_key == feature_key,
            WorkspaceOutput.idempotency_hash == key_hash,
        )
    )
    row = existing.scalar_one_or_none()
    if row is not None:
        return row
    row = WorkspaceOutput(
        owner_user_id=principal.user_id,
        company_id=company_id_for(principal),
        feature_key=feature_key,
        idempotency_hash=key_hash,
        title=title.strip()[:240] or "خروجی میزکار",
        payload_json=payload,
    )
    session.add(row)
    return row


async def list_workspace_outputs(
    session: AsyncSession,
    *,
    principal: Principal,
    feature_key: str,
    limit: int,
) -> list[WorkspaceOutput]:
    if feature_key not in ALLOWED_FEATURES:
        return []
    result = await session.execute(
        select(WorkspaceOutput)
        .where(
            WorkspaceOutput.owner_user_id == principal.user_id,
            WorkspaceOutput.feature_key == feature_key,
        )
        .order_by(WorkspaceOutput.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def delete_workspace_output(
    session: AsyncSession,
    *,
    principal: Principal,
    output_id: UUID,
) -> bool:
    result = await session.execute(
        select(WorkspaceOutput).where(
            WorkspaceOutput.id == output_id,
            WorkspaceOutput.owner_user_id == principal.user_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        return False
    await session.delete(row)
    return True
