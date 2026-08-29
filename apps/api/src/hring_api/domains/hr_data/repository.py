from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.hr_data.models import HrDataUpload


async def list_uploads(session: AsyncSession, *, owner_user_id: UUID, limit: int) -> list[HrDataUpload]:
    result = await session.execute(
        select(HrDataUpload)
        .where(HrDataUpload.owner_user_id == owner_user_id)
        .order_by(HrDataUpload.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_upload(session: AsyncSession, *, upload_id: UUID, owner_user_id: UUID) -> HrDataUpload | None:
    result = await session.execute(
        select(HrDataUpload).where(
            HrDataUpload.id == upload_id,
            HrDataUpload.owner_user_id == owner_user_id,
        )
    )
    return result.scalar_one_or_none()


async def get_latest_upload(session: AsyncSession, *, owner_user_id: UUID) -> HrDataUpload | None:
    rows = await list_uploads(session, owner_user_id=owner_user_id, limit=1)
    return rows[0] if rows else None


async def create_upload(
    session: AsyncSession,
    *,
    owner_user_id: UUID,
    company_id: UUID | None,
    name: str,
    records: list[dict[str, object]],
    is_demo: bool,
) -> HrDataUpload:
    row = HrDataUpload(
        owner_user_id=owner_user_id,
        company_id=company_id,
        name=name,
        employee_count=len(records),
        records=records,
        is_demo=is_demo,
    )
    session.add(row)
    await session.flush()
    return row


async def delete_upload(session: AsyncSession, *, upload_id: UUID, owner_user_id: UUID) -> bool:
    row = await get_upload(session, upload_id=upload_id, owner_user_id=owner_user_id)
    if row is None:
        return False
    await session.delete(row)
    await session.flush()
    return True
