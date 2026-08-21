from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.admin.models import AuditLog, SiteSetting
from hring_api.domains.identity.models import Company, Profile, User


async def platform_counts(session: AsyncSession) -> tuple[int, int, int, int, int, int]:
    total_users = int((await session.scalar(select(func.count(User.id)))) or 0)
    active_users = int(
        (await session.scalar(select(func.count(User.id)).where(User.is_active.is_(True)))) or 0
    )
    total_companies = int((await session.scalar(select(func.count(Company.id)))) or 0)
    active_companies = int(
        (await session.scalar(select(func.count(Company.id)).where(Company.status == "active"))) or 0
    )
    trial_companies = int(
        (await session.scalar(select(func.count(Company.id)).where(Company.status == "trial"))) or 0
    )
    suspended_companies = int(
        (await session.scalar(select(func.count(Company.id)).where(Company.status == "suspended"))) or 0
    )
    return (
        total_users,
        active_users,
        total_companies,
        active_companies,
        trial_companies,
        suspended_companies,
    )


async def list_users_for_admin(
    session: AsyncSession,
    *,
    search: str | None,
    limit: int,
    offset: int,
) -> list[tuple[User, Profile | None]]:
    statement = select(User, Profile).outerjoin(Profile, Profile.id == User.id)
    if search:
        pattern = f"%{search.strip()}%"
        statement = statement.where(
            or_(
                User.email.ilike(pattern),
                Profile.full_name.ilike(pattern),
            )
        )
    result = await session.execute(
        statement.order_by(User.created_at.desc()).limit(limit).offset(offset)
    )
    return [(row[0], row[1]) for row in result.all()]


async def list_companies_for_admin(
    session: AsyncSession,
    *,
    search: str | None,
    limit: int,
    offset: int,
) -> list[Company]:
    statement = select(Company)
    if search:
        pattern = f"%{search.strip()}%"
        statement = statement.where(
            or_(
                Company.name.ilike(pattern),
                Company.domain.ilike(pattern),
            )
        )
    result = await session.execute(
        statement.order_by(Company.created_at.desc()).limit(limit).offset(offset)
    )
    return list(result.scalars().all())


async def get_user_for_admin(session: AsyncSession, user_id: UUID) -> User | None:
    return await session.get(User, user_id)


async def get_profile_for_admin(session: AsyncSession, user_id: UUID) -> Profile | None:
    return await session.get(Profile, user_id)


async def get_company_for_admin(session: AsyncSession, company_id: UUID) -> Company | None:
    return await session.get(Company, company_id)


async def list_site_settings(
    session: AsyncSession,
    *,
    public_only: bool = False,
) -> list[SiteSetting]:
    statement = select(SiteSetting)
    if public_only:
        statement = statement.where(SiteSetting.is_public.is_(True))
    result = await session.execute(statement.order_by(SiteSetting.category, SiteSetting.key))
    return list(result.scalars().all())


async def get_site_setting(session: AsyncSession, key: str) -> SiteSetting | None:
    result = await session.execute(select(SiteSetting).where(SiteSetting.key == key))
    return result.scalar_one_or_none()


async def upsert_site_setting(
    session: AsyncSession,
    *,
    key: str,
    value: str | None,
    label: str | None,
    category: str,
    value_type: str,
    is_public: bool,
    updated_by: UUID,
) -> SiteSetting:
    row = await get_site_setting(session, key)
    if row is None:
        row = SiteSetting(
            key=key,
            value=value,
            label=label,
            category=category,
            value_type=value_type,
            is_public=is_public,
            updated_by=updated_by,
        )
        session.add(row)
    else:
        row.value = value
        row.label = label
        row.category = category
        row.value_type = value_type
        row.is_public = is_public
        row.updated_by = updated_by
    await session.flush()
    return row


async def add_audit_log(
    session: AsyncSession,
    *,
    actor_user_id: UUID | None,
    company_id: UUID | None,
    action: str,
    resource_type: str,
    resource_id: str | None,
    outcome: str = "success",
    metadata_json: dict[str, object] | None = None,
    ip_address: str | None = None,
) -> AuditLog:
    row = AuditLog(
        actor_user_id=actor_user_id,
        company_id=company_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        outcome=outcome,
        metadata_json=metadata_json or {},
        ip_address=ip_address,
    )
    session.add(row)
    await session.flush()
    return row


async def list_audit_logs(
    session: AsyncSession,
    *,
    company_id: UUID | None,
    limit: int,
    offset: int,
) -> list[AuditLog]:
    statement = select(AuditLog)
    if company_id is not None:
        statement = statement.where(AuditLog.company_id == company_id)
    result = await session.execute(
        statement.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
    )
    return list(result.scalars().all())
