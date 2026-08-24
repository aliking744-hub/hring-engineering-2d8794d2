from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.development.models import LearningPath, OnboardingPlan


async def get_onboarding_plan_by_idempotency(
    session: AsyncSession,
    *,
    owner_user_id: UUID,
    idempotency_key: str,
) -> OnboardingPlan | None:
    result = await session.execute(
        select(OnboardingPlan).where(
            OnboardingPlan.owner_user_id == owner_user_id,
            OnboardingPlan.idempotency_key == idempotency_key,
        )
    )
    return result.scalar_one_or_none()


async def create_onboarding_plan(
    session: AsyncSession,
    *,
    owner_user_id: UUID,
    company_id: UUID | None,
    idempotency_key: str,
    values: dict[str, object],
) -> OnboardingPlan:
    row = OnboardingPlan(
        owner_user_id=owner_user_id,
        company_id=company_id,
        idempotency_key=idempotency_key,
        **values,
    )
    session.add(row)
    await session.flush()
    return row


async def list_onboarding_plans(
    session: AsyncSession,
    *,
    owner_user_id: UUID,
    limit: int,
) -> list[OnboardingPlan]:
    result = await session.execute(
        select(OnboardingPlan)
        .where(OnboardingPlan.owner_user_id == owner_user_id)
        .order_by(OnboardingPlan.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def delete_onboarding_plan(
    session: AsyncSession,
    *,
    plan_id: UUID,
    owner_user_id: UUID,
) -> bool:
    result = await session.execute(
        select(OnboardingPlan).where(
            OnboardingPlan.id == plan_id,
            OnboardingPlan.owner_user_id == owner_user_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        return False
    await session.delete(row)
    await session.flush()
    return True


async def get_learning_path_by_idempotency(
    session: AsyncSession,
    *,
    owner_user_id: UUID,
    idempotency_key: str,
) -> LearningPath | None:
    result = await session.execute(
        select(LearningPath).where(
            LearningPath.owner_user_id == owner_user_id,
            LearningPath.idempotency_key == idempotency_key,
        )
    )
    return result.scalar_one_or_none()


async def create_learning_path(
    session: AsyncSession,
    *,
    owner_user_id: UUID,
    company_id: UUID | None,
    idempotency_key: str,
    values: dict[str, object],
) -> LearningPath:
    row = LearningPath(
        owner_user_id=owner_user_id,
        company_id=company_id,
        idempotency_key=idempotency_key,
        **values,
    )
    session.add(row)
    await session.flush()
    return row


async def list_learning_paths(
    session: AsyncSession,
    *,
    owner_user_id: UUID,
    limit: int,
) -> list[LearningPath]:
    result = await session.execute(
        select(LearningPath)
        .where(LearningPath.owner_user_id == owner_user_id)
        .order_by(LearningPath.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_learning_path(
    session: AsyncSession,
    *,
    learning_path_id: UUID,
    owner_user_id: UUID,
    for_update: bool = False,
) -> LearningPath | None:
    statement = select(LearningPath).where(
        LearningPath.id == learning_path_id,
        LearningPath.owner_user_id == owner_user_id,
    )
    if for_update:
        statement = statement.with_for_update()
    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def delete_learning_path(
    session: AsyncSession,
    *,
    learning_path_id: UUID,
    owner_user_id: UUID,
) -> bool:
    result = await session.execute(
        select(LearningPath).where(
            LearningPath.id == learning_path_id,
            LearningPath.owner_user_id == owner_user_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        return False
    await session.delete(row)
    await session.flush()
    return True
