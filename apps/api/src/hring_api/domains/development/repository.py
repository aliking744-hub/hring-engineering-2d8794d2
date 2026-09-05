from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.development.models import (
    LearningPath,
    OnboardingPlan,
    OnboardingTask,
    OnboardingTaskEvent,
)


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


async def get_onboarding_plan(
    session: AsyncSession,
    *,
    plan_id: UUID,
    owner_user_id: UUID,
    for_update: bool = False,
) -> OnboardingPlan | None:
    query = select(OnboardingPlan).where(
            OnboardingPlan.id == plan_id,
            OnboardingPlan.owner_user_id == owner_user_id,
        )
    if for_update:
        query = query.with_for_update()
    result = await session.execute(query)
    return result.scalar_one_or_none()


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


async def create_onboarding_task(
    session: AsyncSession,
    *,
    plan: OnboardingPlan,
    actor_user_id: UUID,
    values: dict[str, object],
    event_summary: str,
) -> OnboardingTask:
    task = OnboardingTask(plan_id=plan.id, company_id=plan.company_id, **values)
    session.add(task)
    await session.flush()
    session.add(
        OnboardingTaskEvent(
            task_id=task.id,
            actor_user_id=actor_user_id,
            event_type="created",
            summary=event_summary,
        )
    )
    await session.flush()
    return task


async def list_onboarding_tasks(
    session: AsyncSession,
    *,
    plan_ids: list[UUID],
) -> tuple[dict[UUID, list[OnboardingTask]], dict[UUID, list[OnboardingTaskEvent]]]:
    if not plan_ids:
        return {}, {}
    task_result = await session.execute(
        select(OnboardingTask)
        .where(OnboardingTask.plan_id.in_(plan_ids))
        .order_by(OnboardingTask.sort_order.asc(), OnboardingTask.created_at.asc())
    )
    tasks = list(task_result.scalars().all())
    task_ids = [task.id for task in tasks]
    event_map: dict[UUID, list[OnboardingTaskEvent]] = {}
    if task_ids:
        event_result = await session.execute(
            select(OnboardingTaskEvent)
            .where(OnboardingTaskEvent.task_id.in_(task_ids))
            .order_by(OnboardingTaskEvent.created_at.desc())
        )
        for event in event_result.scalars().all():
            event_map.setdefault(event.task_id, []).append(event)

    task_map: dict[UUID, list[OnboardingTask]] = {}
    for task in tasks:
        task_map.setdefault(task.plan_id, []).append(task)
    return task_map, event_map


async def get_onboarding_task(
    session: AsyncSession,
    *,
    plan_id: UUID,
    task_id: UUID,
    owner_user_id: UUID,
) -> OnboardingTask | None:
    result = await session.execute(
        select(OnboardingTask)
        .join(OnboardingPlan, OnboardingPlan.id == OnboardingTask.plan_id)
        .where(
            OnboardingTask.id == task_id,
            OnboardingTask.plan_id == plan_id,
            OnboardingPlan.owner_user_id == owner_user_id,
        )
    )
    return result.scalar_one_or_none()


async def update_onboarding_task(
    session: AsyncSession,
    *,
    task: OnboardingTask,
    actor_user_id: UUID,
    values: dict[str, object],
    event_type: str,
    event_summary: str,
) -> OnboardingTask:
    for key, value in values.items():
        setattr(task, key, value)
    session.add(
        OnboardingTaskEvent(
            task_id=task.id,
            actor_user_id=actor_user_id,
            event_type=event_type,
            summary=event_summary,
        )
    )
    await session.flush()
    return task


async def delete_onboarding_plan(
    session: AsyncSession,
    *,
    plan_id: UUID,
    owner_user_id: UUID,
) -> bool:
    row = await get_onboarding_plan(session, plan_id=plan_id, owner_user_id=owner_user_id)
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
    row = await get_learning_path(
        session,
        learning_path_id=learning_path_id,
        owner_user_id=owner_user_id,
    )
    if row is None:
        return False
    await session.delete(row)
    await session.flush()
    return True
