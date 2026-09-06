from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from hashlib import sha256
from typing import Literal, cast
from uuid import UUID, uuid4

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
from hring_api.domains.development.models import (
    LearningPath,
    OnboardingPlan,
    OnboardingTask,
    OnboardingTaskEvent,
)
from hring_api.domains.development.repository import (
    create_learning_path,
    create_onboarding_plan,
    create_onboarding_task,
    delete_learning_path,
    delete_onboarding_plan,
    get_learning_path,
    get_learning_path_by_idempotency,
    get_onboarding_plan,
    get_onboarding_plan_by_idempotency,
    get_onboarding_task,
    list_learning_paths as list_learning_path_rows,
    list_onboarding_plans,
    list_onboarding_tasks,
    update_onboarding_task,
)
from hring_api.domains.development.schemas import (
    LearningPathGenerateRequest,
    OnboardingCertificateResponse,
    OnboardingGenerateRequest,
    OnboardingPlanResponse,
    OnboardingTaskCreateRequest,
    OnboardingTaskResponse,
    OnboardingTaskUpdateRequest,
)
from hring_api.domains.identity.dependencies import Principal


ONBOARDING_DEFAULT_CREDIT_COST = 12
ONBOARDING_CERTIFICATE_FEATURE_KEY = "development.onboarding_certificate"
ONBOARDING_CERTIFICATE_DEFAULT_CREDIT_COST = 2
LEARNING_PATH_DEFAULT_CREDIT_COST = 12


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
        ("روزهای ۱ تا ۳۰", 30, [
            "تکمیل تجهیزات، حساب‌ها و دسترسی‌های کاری",
            "آشنایی با سیاست‌ها، امنیت اطلاعات و آیین‌نامه‌های سازمان",
            "آموزش محصول یا خدمت، فرایندهای اصلی و نیاز مشتریان",
            "همراهی با همکار باتجربه و ثبت پرسش‌ها و آموخته‌ها",
            "معرفی به تیم، منتور و ذی‌نفعان اصلی",
            "مرور شرح نقش، اهداف و شاخص‌های موفقیت",
            "تحویل نخستین خروجی و دریافت بازخورد ۳۰روزه",
        ]),
        ("روزهای ۳۱ تا ۶۰", 60, [
            "پذیرش مسئولیت مستقل برای یک خروجی اصلی",
            "تحویل یک خروجی سنجش‌پذیر متناسب با نقش",
            "همکاری با یک تیم یا ذی‌نفع بین‌واحدی",
            "مرور شاخص‌های کیفیت، زمان و عملکرد در جلسه میانی",
            "شناسایی و ثبت موانع عملکردی یا آموزشی",
            "جلسه بازخورد میانه دوره با مدیر و منتور",
            "تنظیم برنامه اصلاح و اولویت‌های ماه سوم",
        ]),
        ("روزهای ۶۱ تا ۹۰", 90, [
            "تحویل خروجی نهایی دوره آزمایشی",
            "برنامه‌ریزی مستقل اولویت‌های هفتگی و گزارش پیشرفت",
            "حل یک مسئله واقعی یا پیشنهاد یک بهبود فرایندی",
            "مستندسازی آموخته‌ها و انتقال دانش به تیم",
            "ارزیابی استقلال، همکاری و کیفیت عملکرد",
            "جمع‌بندی بازخورد کارمند، مدیر و منتور",
            "توافق روی اهداف و برنامه توسعه پس از دوره",
        ]),
    ]
    for order, (title, offset, subtasks) in enumerate(seeds):
        parent = await create_onboarding_task(
            session,
            plan=plan,
            actor_user_id=actor_user_id,
            values={
                "title": title,
                "details": "با تکمیل زیرتسک‌ها، درصد پیشرفت این مرحله خودکار محاسبه می‌شود.",
                "assignee_label": owner,
                "due_on": start + timedelta(days=offset),
                "status": "todo",
                "sort_order": order,
            },
            event_summary="مرحله آغازین نقشه راه ۹۰ روزه ساخته شد",
        )
        for child_order, child_title in enumerate(subtasks):
            await create_onboarding_task(
                session,
                plan=plan,
                actor_user_id=actor_user_id,
                values={
                    "parent_task_id": parent.id,
                    "title": child_title,
                    "assignee_label": owner,
                    "due_on": start + timedelta(days=offset),
                    "status": "todo",
                    "sort_order": child_order,
                },
                event_summary="زیرتسک آغازین نقشه راه ۹۰ روزه ساخته شد",
            )


def _task_response(
    task: OnboardingTask,
    events: list[OnboardingTaskEvent],
) -> OnboardingTaskResponse:
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
            employee_name=payload.employee_name,
            starts_on=payload.starts_on,
            starts_on_display=payload.starts_on_display,
            company_name=payload.company_name,
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
    if plan.status != "active":
        raise DevelopmentConflictError("Finalized onboarding plans cannot be changed")
    if payload.parent_task_id is not None:
        parent = await get_onboarding_task(
            session,
            plan_id=plan_id,
            task_id=payload.parent_task_id,
            owner_user_id=principal.user_id,
        )
        if parent is None:
            raise DevelopmentNotFoundError("Parent onboarding task was not found")
        if parent.parent_task_id is not None:
            raise DevelopmentConflictError("Onboarding subtasks support one nesting level")
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
    plan = await get_onboarding_plan(
        session,
        plan_id=plan_id,
        owner_user_id=principal.user_id,
    )
    if plan is None:
        raise DevelopmentNotFoundError("Onboarding plan was not found")
    if plan.status != "active":
        raise DevelopmentConflictError("Finalized onboarding plans cannot be changed")
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
    if task.parent_task_id is not None:
        await _sync_parent_task_status(
            session,
            plan=plan,
            parent_task_id=task.parent_task_id,
            actor_user_id=principal.user_id,
        )
    return await _single_task_response(session, updated)


async def _sync_parent_task_status(
    session: AsyncSession,
    *,
    plan: OnboardingPlan,
    parent_task_id: UUID,
    actor_user_id: UUID,
) -> None:
    task_map, _ = await list_onboarding_tasks(session, plan_ids=[plan.id])
    tasks = task_map.get(plan.id, [])
    parent = next((item for item in tasks if item.id == parent_task_id), None)
    children = [item for item in tasks if item.parent_task_id == parent_task_id]
    if parent is None or not children:
        return
    completed = sum(item.status == "completed" for item in children)
    next_status = "completed" if completed == len(children) else "in_progress" if completed else "todo"
    if parent.status == next_status:
        return
    await update_onboarding_task(
        session,
        task=parent,
        actor_user_id=actor_user_id,
        values={
            "status": next_status,
            "completed_at": datetime.now(UTC) if next_status == "completed" else None,
        },
        event_type="completed" if next_status == "completed" else "updated",
        event_summary="وضعیت مرحله بر اساس زیرتسک‌ها به‌روزرسانی شد",
    )


def _scorable_tasks(tasks: list[OnboardingTask]) -> list[OnboardingTask]:
    parent_ids = {
        getattr(task, "parent_task_id", None)
        for task in tasks
        if getattr(task, "parent_task_id", None) is not None
    }
    return [task for task in tasks if getattr(task, "id", None) not in parent_ids]


async def complete_onboarding_workflow(
    session: AsyncSession,
    *,
    plan_id: UUID,
    principal: Principal,
) -> OnboardingPlanResponse:
    plan = await get_onboarding_plan(
        session,
        plan_id=plan_id,
        owner_user_id=principal.user_id,
        for_update=True,
    )
    if plan is None:
        raise DevelopmentNotFoundError("Onboarding plan was not found")
    if plan.status != "active":
        return await onboarding_workflow_response(session, plan=plan)

    task_map, _ = await list_onboarding_tasks(session, plan_ids=[plan.id])
    tasks = task_map.get(plan.id, [])
    if not tasks:
        raise DevelopmentConflictError("Onboarding plan has no tasks to score")

    scorable_tasks = _scorable_tasks(tasks)
    completed_count = sum(task.status == "completed" for task in scorable_tasks)
    score = round((completed_count / len(scorable_tasks)) * 100)
    plan.score = score
    plan.status = "completed"
    plan.completed_at = datetime.now(UTC)
    await session.flush()
    return await onboarding_workflow_response(session, plan=plan)


async def reopen_onboarding_workflow(
    session: AsyncSession,
    *,
    plan_id: UUID,
    principal: Principal,
) -> OnboardingPlanResponse:
    plan = await get_onboarding_plan(
        session,
        plan_id=plan_id,
        owner_user_id=principal.user_id,
        for_update=True,
    )
    if plan is None:
        raise DevelopmentNotFoundError("Onboarding plan was not found")
    if plan.status == "active":
        return await onboarding_workflow_response(session, plan=plan)
    if plan.certificate_number:
        raise DevelopmentConflictError(
            "A certificate has already been issued; this plan cannot be reopened"
        )

    plan.status = "active"
    plan.score = None
    plan.completed_at = None
    await session.flush()
    return await onboarding_workflow_response(session, plan=plan)


def onboarding_certificate_response(plan: OnboardingPlan) -> OnboardingCertificateResponse:
    if not plan.certificate_number or not plan.certificate_recipient_title or not plan.certificate_issued_at:
        raise DevelopmentConflictError("Onboarding certificate has not been issued")
    if plan.score is None or plan.completed_at is None:
        raise DevelopmentConflictError("Onboarding plan has no final score")
    if plan.certificate_recipient_title not in {"mr", "ms"}:
        raise DevelopmentConflictError("Onboarding certificate title is invalid")
    recipient_title = cast(Literal["mr", "ms"], plan.certificate_recipient_title)
    title = "جناب آقای" if recipient_title == "mr" else "سرکار خانم"
    name = plan.employee_name or "کارمند گرامی"
    return OnboardingCertificateResponse(
        certificate_number=plan.certificate_number,
        recipient_title=recipient_title,
        recipient_name=name,
        job_title=plan.job_title,
        score=plan.score,
        completed_at=plan.completed_at,
        issued_at=plan.certificate_issued_at,
        statement=f"{title} {name} دوره آزمایشی را با نمره {plan.score} از ۱۰۰ به پایان رسانده است.",
    )


async def issue_onboarding_certificate(
    session: AsyncSession,
    *,
    plan_id: UUID,
    recipient_title: str,
    principal: Principal,
    request_id: str | None,
) -> OnboardingCertificateResponse:
    plan = await get_onboarding_plan(
        session, plan_id=plan_id, owner_user_id=principal.user_id, for_update=True
    )
    if plan is None:
        raise DevelopmentNotFoundError("Onboarding plan was not found")
    if plan.status == "active" or plan.score is None or plan.completed_at is None:
        raise DevelopmentConflictError("Complete the onboarding plan before issuing a certificate")
    if plan.certificate_number:
        if plan.certificate_recipient_title != recipient_title:
            raise DevelopmentConflictError("Certificate was already issued with another title")
        return onboarding_certificate_response(plan)

    cost = await feature_credit_cost(
        session,
        feature_key=ONBOARDING_CERTIFICATE_FEATURE_KEY,
        default_cost=ONBOARDING_CERTIFICATE_DEFAULT_CREDIT_COST,
    )

    async def operation() -> OnboardingCertificateResponse:
        plan.certificate_number = f"HRING-90-{datetime.now(UTC):%Y%m%d}-{uuid4().hex[:10].upper()}"
        plan.certificate_recipient_title = recipient_title
        plan.certificate_issued_at = datetime.now(UTC)
        await session.flush()
        return onboarding_certificate_response(plan)

    if cost == 0:
        return await operation()
    return await run_with_credit_reservation(
        session,
        principal=principal,
        amount=cost,
        idempotency_key=f"{ONBOARDING_CERTIFICATE_FEATURE_KEY}:{plan.id}",
        feature_key=ONBOARDING_CERTIFICATE_FEATURE_KEY,
        description="Issue 90-day onboarding certificate",
        request_id=request_id,
        operation=operation,
    )


async def _single_task_response(
    session: AsyncSession,
    task: OnboardingTask,
) -> OnboardingTaskResponse:
    _, event_map = await list_onboarding_tasks(session, plan_ids=[task.plan_id])
    return _task_response(task, event_map.get(task.id, []))


async def list_learning_paths(
    session: AsyncSession,
    *,
    owner_user_id: UUID,
    limit: int,
) -> list[LearningPath]:
    return await list_learning_path_rows(session, owner_user_id=owner_user_id, limit=limit)


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
