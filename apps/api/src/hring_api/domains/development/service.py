from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from hashlib import sha256
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings
from hring_api.domains.billing.credit_service import (
    feature_credit_cost,
    run_with_ai_execution_guard,
    run_with_credit_reservation,
)
from hring_api.domains.company_ai.service import uses_company_byok
from hring_api.domains.development.ai_service import (
    LEARNING_PATH_FEATURE_KEY,
    ONBOARDING_FEATURE_KEY,
    generate_learning_path_content,
    generate_onboarding_content,
)
from hring_api.domains.development.email import deliver_learning_path_email
from hring_api.domains.development.models import (\n    LearningPath,\n    OnboardingPlan,\n    OnboardingTask,\n    OnboardingTaskEvent,\n)
from hring_api.domains.development.repository import (
    create_learning_path,
    create_onboarding_plan,
    create_onboarding_task,
    delete_learning_path,
    delete_onboarding_plan,
    get_learning_path,
    get_learning_path_by_idempotency,
    get_onboarding_plan_by_idempotency,
    get_onboarding_task,
    list_learning_paths,
    list_onboarding_plans,
    list_onboarding_tasks,
    update_onboarding_task,
)
from hring_api.domains.development.schemas import (
    LearningPathGenerateRequest,
    OnboardingGenerateRequest,
    OnboardingPlanResponse,
    OnboardingTaskCreateRequest,
    OnboardingTaskResponse,
    OnboardingTaskUpdateRequest,
)
from hring_api.domains.identity.dependencies import Principal


ONBOARDING_DEFAULT_CREDIT_COST = 15
LEARNING_PATH_DEFAULT_CREDIT_COST = 15


class DevelopmentError(RuntimeError):
    pass


class DevelopmentNotFoundError(DevelopmentError):
    pass


class DevelopmentConflictError(DevelopmentError):
    pass


def _key_hash(raw_key: str) -> str:
    normalized = raw_key.strip()
    if len(normalized) < 8 or len(normalized) > 128:
        raise DevelopmentConflictError("Idempotency key must be 8 to 128 characters")
    return sha256(normalized.encode()).hexdigest()


def _onboarding_matches(row: OnboardingPlan, payload: OnboardingGenerateRequest) -> bool:
    return (
        row.employee_name == payload.employee_name
        and row.employee_email == payload.employee_email
        and row.starts_on == (payload.starts_on or date.today())
        and row.job_title == payload.job_title
        and row.seniority == payload.seniority
        and row.expectation == payload.expectation
        and row.mentor_role == payload.mentor_role
    )


def _learning_path_matches(row: LearningPath, payload: LearningPathGenerateRequest) -> bool:
    return (
        row.employee_name == (payload.employee_name or "—")
        and row.employee_email == payload.employee_email
        and row.job_title == payload.job_title
        and row.industry == payload.industry
        and row.seniority_level == payload.seniority_level
        and row.education_level == payload.education_level
        and row.field_of_study == payload.field_of_study
        and row.experience_years == payload.experience_years
        and row.training_months == payload.training_months
    )


async def _seed_onboarding_tasks(
    session: AsyncSession,
    *,
    plan: OnboardingPlan,
    actor_user_id: UUID,
) -> None:
    start = plan.starts_on or date.today()
    owner = plan.mentor_role or "مدیر مستقیم"
    seeds = [
        (
            "روز اول: خوش‌آمدگویی، معرفی تیم و دسترسی‌ها",
            "تجهیزات، حساب‌ها و مسیر ارتباط با تیم را تأیید کنید.",
            1,
        ),
        (
            "هفتهٔ اول: مرور نقش، اهداف و مستندات",
            "جلسهٔ هم‌راستاسازی با مدیر و مرور مستندات کلیدی نقش.",
            7,
        ),
        (
            "پایان ماه اول: بازخورد و تثبیت برنامه",
            "بازخورد ساختاریافته بگیرید و اهداف ماه دوم را قطعی کنید.",
            30,
        ),
        (
            "پایان ماه دوم: بررسی مشارکت و موانع",
            "پیشرفت عملی، موانع و نیازهای آموزشی را با مدیر مرور کنید.",
            60,
        ),
        (
            "پایان ماه سوم: ارزیابی ۹۰ روزه",
            "جمع‌بندی اهداف، نتیجهٔ دوره و گام‌های بعدی توسعه.",
            90,
        ),
    ]
    for order, (title, details, offset) in enumerate(seeds):
        await create_onboarding_task(
            session,
            plan=plan,
            actor_user_id=actor_user_id,
            values={
                "title": title,
                "details": details,
                "assignee_label": owner,
                "due_on": start + timedelta(days=offset),
                "status": "todo",
                "sort_order": order,
            },
            event_summary="تسک آغازین برنامهٔ ۹۰ روزه ساخته شد",
        )


def _task_response(\n    task: OnboardingTask,\n    events: list[OnboardingTaskEvent],\n) -> OnboardingTaskResponse:
    response = OnboardingTaskResponse.model_validate(task)
    return response.model_copy(
        update={
            "events": [
                {
                    "id": event.id,
                    "event_type": event.event_type,
                    "summary": event.summary,
                    "actor_user_id": event.actor_user_id,
                    "created_at": event.created_at,
                }
                for event in events
            ]
        }
    )


async def onboarding_workflow_response(
    session: AsyncSession,
    *,
    plan: OnboardingPlan,
) -> OnboardingPlanResponse:
    task_map, event_map = await list_onboarding_tasks(session, plan_ids=[plan.id])
    tasks = [
        _task_response(task, event_map.get(task.id, []))
        for task in task_map.get(plan.id, [])
    ]
    response = OnboardingPlanResponse.model_validate(plan)
    return response.model_copy(update={"tasks": tasks})


async def list_onboarding_workflows(
    session: AsyncSession,
    *,
    owner_user_id: UUID,
    limit: int,
) -> list[OnboardingPlanResponse]:
    plans = await list_onboarding_plans(session, owner_user_id=owner_user_id, limit=limit)
    task_map, event_map = await list_onboarding_tasks(session, plan_ids=[plan.id for plan in plans])
    return [
        OnboardingPlanResponse.model_validate(plan).model_copy(
            update={
                "tasks": [
                    _task_response(task, event_map.get(task.id, []))
                    for task in task_map.get(plan.id, [])
                ]
            }
        )
        for plan in plans
    ]


async def generate_onboarding_plan(
    session: AsyncSession,
    *,
    payload: OnboardingGenerateRequest,
    principal: Principal,
    company_id: UUID | None,
    idempotency_key: str,
    request_id: str | None,
    settings: Settings,
) -> OnboardingPlan:
    key_hash = _key_hash(idempotency_key)
    existing = await get_onboarding_plan_by_idempotency(
        session,
        owner_user_id=principal.user_id,
        idempotency_key=key_hash,
    )
    if existing is not None:
        if not _onboarding_matches(existing, payload):
            raise DevelopmentConflictError("Idempotency key was used with another payload")
        return existing

    cost = await feature_credit_cost(
        session,
        feature_key=ONBOARDING_FEATURE_KEY,
        default_cost=ONBOARDING_DEFAULT_CREDIT_COST,
    )
    managed_cost = (
        0
        if await uses_company_byok(
            session,
            company_id=company_id,
            capability_key=ONBOARDING_FEATURE_KEY,
        )
        else cost
    )

    async def operation() -> OnboardingPlan:
        plan, welcome_email = await generate_onboarding_content(
            job_title=payload.job_title,
            seniority=payload.seniority,
            expectation=payload.expectation,
            mentor_role=payload.mentor_role,
            user_id=principal.user_id,
            company_id=company_id,
            credits_charged=managed_cost,
            settings=settings,
            session=session,
        )
        row = await create_onboarding_plan(
            session,
            owner_user_id=principal.user_id,
            company_id=company_id,
            idempotency_key=key_hash,
            values={
                "employee_name": payload.employee_name,
                "employee_email": payload.employee_email,
                "starts_on": payload.starts_on or date.today(),
                "job_title": payload.job_title,
                "seniority": payload.seniority,
                "expectation": payload.expectation,
                "mentor_role": payload.mentor_role,
                "plan": plan,
                "welcome_email": welcome_email,
            },
        )
        await _seed_onboarding_tasks(session, plan=row, actor_user_id=principal.user_id)
        return row

    if managed_cost == 0:
        return await run_with_ai_execution_guard(
            session,
            principal=principal,
            company_id=company_id,
            feature_key=ONBOARDING_FEATURE_KEY,
            idempotency_key=f"{ONBOARDING_FEATURE_KEY}:{key_hash}",
            request_id=request_id,
            operation=operation,
        )

    return await run_with_credit_reservation(
        session,
        principal=principal,
        amount=managed_cost,
        idempotency_key=f"{ONBOARDING_FEATURE_KEY}:{key_hash}",
        feature_key=ONBOARDING_FEATURE_KEY,
        description="Generate native onboarding plan",
        request_id=request_id,
        operation=operation,
    )


async def create_onboarding_workflow_task(
    session: AsyncSession,
    *,
    plan_id: UUID,
    payload: OnboardingTaskCreateRequest,
    principal: Principal,
) -> OnboardingTaskResponse:
    plan = await get_onboarding_plan(session, plan_id=plan_id, owner_user_id=principal.user_id)
    if plan is None:
        raise DevelopmentNotFoundError("Onboarding plan was not found")
    task = await create_onboarding_task(
        session,
        plan=plan,
        actor_user_id=principal.user_id,
        values=payload.model_dump(),
        event_summary="تسک جدید به برنامه اضافه شد",
    )
    return await _single_task_response(session, task)


async def update_onboarding_workflow_task(
    session: AsyncSession,
    *,
    plan_id: UUID,
    task_id: UUID,
    payload: OnboardingTaskUpdateRequest,
    principal: Principal,
) -> OnboardingTaskResponse:
    task = await get_onboarding_task(
        session,
        plan_id=plan_id,
        task_id=task_id,
        owner_user_id=principal.user_id,
    )
    if task is None:
        raise DevelopmentNotFoundError("Onboarding task was not found")
    values = payload.model_dump(exclude_unset=True)
    if not values:
        raise DevelopmentConflictError("At least one task field must be provided")

    old_status = task.status
    new_status = values.get("status", old_status)
    if new_status == "completed" and old_status != "completed":
        values["completed_at"] = datetime.now(UTC)
        event_type = "completed"
        event_summary = "تسک تکمیل شد"
    elif old_status == "completed" and new_status != "completed":
        values["completed_at"] = None
        event_type = "reopened"
        event_summary = "تسک دوباره باز شد"
    else:
        event_type = "updated"
        event_summary = "جزئیات تسک به‌روزرسانی شد"

    updated = await update_onboarding_task(
        session,
        task=task,
        actor_user_id=principal.user_id,
        values=values,
        event_type=event_type,
        event_summary=event_summary,
    )
    return await _single_task_response(session, updated)


async def _single_task_response(
    session: AsyncSession,
    task: OnboardingTask,
) -> OnboardingTaskResponse:
    _, event_map = await list_onboarding_tasks(session, plan_ids=[task.plan_id])
    return _task_response(task, event_map.get(task.id, []))


async def generate_learning_path(
    session: AsyncSession,
    *,
    payload: LearningPathGenerateRequest,
    principal: Principal,
    company_id: UUID | None,
    idempotency_key: str,
    request_id: str | None,
    settings: Settings,
) -> LearningPath:
    key_hash = _key_hash(idempotency_key)
    existing = await get_learning_path_by_idempotency(
        session,
        owner_user_id=principal.user_id,
        idempotency_key=key_hash,
    )
    if existing is not None:
        if not _learning_path_matches(existing, payload):
            raise DevelopmentConflictError("Idempotency key was used with another payload")
        return existing

    cost = await feature_credit_cost(
        session,
        feature_key=LEARNING_PATH_FEATURE_KEY,
        default_cost=LEARNING_PATH_DEFAULT_CREDIT_COST,
    )
    managed_cost = (
        0
        if await uses_company_byok(
            session,
            company_id=company_id,
            capability_key=LEARNING_PATH_FEATURE_KEY,
        )
        else cost
    )

    async def operation() -> LearningPath:
        result = await generate_learning_path_content(
            payload=payload,
            user_id=principal.user_id,
            company_id=company_id,
            credits_charged=managed_cost,
            settings=settings,
            session=session,
        )
        return await create_learning_path(
            session,
            owner_user_id=principal.user_id,
            company_id=company_id,
            idempotency_key=key_hash,
            values={
                "employee_name": payload.employee_name or "—",
                "employee_email": payload.employee_email,
                "job_title": payload.job_title,
                "industry": payload.industry,
                "seniority_level": payload.seniority_level,
                "education_level": payload.education_level,
                "field_of_study": payload.field_of_study,
                "experience_years": payload.experience_years,
                "training_months": payload.training_months,
                "result": result.model_dump(by_alias=True),
            },
        )

    if managed_cost == 0:
        return await run_with_ai_execution_guard(
            session,
            principal=principal,
            company_id=company_id,
            feature_key=LEARNING_PATH_FEATURE_KEY,
            idempotency_key=f"{LEARNING_PATH_FEATURE_KEY}:{key_hash}",
            request_id=request_id,
            operation=operation,
        )

    return await run_with_credit_reservation(
        session,
        principal=principal,
        amount=managed_cost,
        idempotency_key=f"{LEARNING_PATH_FEATURE_KEY}:{key_hash}",
        feature_key=LEARNING_PATH_FEATURE_KEY,
        description="Generate native learning path",
        request_id=request_id,
        operation=operation,
    )


async def deliver_learning_path(
    session: AsyncSession,
    *,
    learning_path_id: UUID,
    owner_user_id: UUID,
    settings: Settings,
) -> tuple[str | None, datetime]:
    row = await get_learning_path(
        session,
        learning_path_id=learning_path_id,
        owner_user_id=owner_user_id,
        for_update=True,
    )
    if row is None:
        raise DevelopmentNotFoundError("Learning path was not found")
    if not row.employee_email:
        raise DevelopmentConflictError("Employee email is required")
    message_id = await deliver_learning_path_email(
        employee_email=row.employee_email,
        employee_name=row.employee_name,
        job_title=row.job_title,
        result=row.result,
        settings=settings,
        session=session,
    )
    sent_at = datetime.now(UTC)
    row.last_emailed_at = sent_at
    await session.flush()
    return message_id, sent_at


async def remove_learning_path(
    session: AsyncSession,
    *,
    learning_path_id: UUID,
    owner_user_id: UUID,
) -> None:
    deleted = await delete_learning_path(
        session,
        learning_path_id=learning_path_id,
        owner_user_id=owner_user_id,
    )
    if not deleted:
        raise DevelopmentNotFoundError("Learning path was not found")


async def remove_onboarding_plan(
    session: AsyncSession,
    *,
    plan_id: UUID,
    owner_user_id: UUID,
) -> None:
    deleted = await delete_onboarding_plan(
        session,
        plan_id=plan_id,
        owner_user_id=owner_user_id,
    )
    if not deleted:
        raise DevelopmentNotFoundError("Onboarding plan was not found")
