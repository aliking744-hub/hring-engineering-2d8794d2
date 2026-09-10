import asyncio
from collections.abc import Awaitable, Callable
from typing import TypeVar

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from hring_api.domains.billing.pricing import ExchangeRateError, refresh_exchange_rate
from hring_api.domains.legal.source_sync import LegalSourceSyncError, sync_online_legal_sources
from hring_api.worker.app import celery_app
from hring_api.worker.config import get_worker_settings


T = TypeVar("T")


@celery_app.task(name="hring.worker.healthcheck", ignore_result=False)  # type: ignore[untyped-decorator]
def worker_healthcheck() -> dict[str, str]:
    return {"status": "ok", "service": "hring-worker"}


async def _with_session(operation: Callable[[AsyncSession], Awaitable[T]]) -> T:
    settings = get_worker_settings()
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with factory() as session:
            return await operation(session)
    finally:
        await engine.dispose()


async def _sync_legal_sources() -> dict[str, object]:
    async def run(session: AsyncSession) -> dict[str, object]:
        result = await sync_online_legal_sources(session)
        await session.commit()
        return {
            "status": "ok",
            "checked": result.checked,
            "changed": result.changed,
            "unchanged": result.unchanged,
            "failed": list(result.failed),
        }

    return await _with_session(run)


@celery_app.task(  # type: ignore[untyped-decorator]
    name="hring.legal.sync_sources",
    ignore_result=False,
    autoretry_for=(LegalSourceSyncError, OSError),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def sync_legal_sources_task() -> dict[str, object]:
    return asyncio.run(_sync_legal_sources())


async def _refresh_exchange_rate() -> dict[str, object]:
    async def run(session: AsyncSession) -> dict[str, object]:
        setting = await refresh_exchange_rate(session)
        return {
            "status": "ok",
            "rate_toman": setting.automatic_rate_toman,
            "source_fetched_at": setting.source_fetched_at.isoformat()
            if setting.source_fetched_at
            else None,
        }

    return await _with_session(run)


@celery_app.task(  # type: ignore[untyped-decorator]
    name="hring.billing.refresh_exchange_rate",
    ignore_result=False,
    autoretry_for=(ExchangeRateError, OSError),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def refresh_exchange_rate_task() -> dict[str, object]:
    return asyncio.run(_refresh_exchange_rate())


async def _generate_content_article(
    *, slot_key: str, trigger: str, actor_user_id: str | None, force: bool,
) -> dict[str, object]:
    from uuid import UUID
    from hring_api.config import get_settings
    from hring_api.domains.content.service import run_content_agent

    async def run(session: AsyncSession) -> dict[str, object]:
        result = await run_content_agent(
            session,
            slot_key=slot_key,
            app_settings=get_settings(),
            trigger=trigger,
            actor_user_id=UUID(actor_user_id) if actor_user_id else None,
            force=force,
        )
        return {
            "status": result.status,
            "run_id": str(result.id),
            "article_id": str(result.article_id) if result.article_id else None,
            "quality_score": result.quality_score,
            "credibility_score": result.credibility_score,
        }

    return await _with_session(run)


@celery_app.task(  # type: ignore[untyped-decorator]
    name="hring.content.generate_article",
    ignore_result=False,
    autoretry_for=(OSError, RuntimeError),
    retry_backoff=True,
    retry_kwargs={"max_retries": 2},
)
def generate_content_article_task(
    slot_key: str, trigger: str = "schedule", actor_user_id: str | None = None, force: bool = False,
) -> dict[str, object]:
    result = asyncio.run(_generate_content_article(
        slot_key=slot_key, trigger=trigger, actor_user_id=actor_user_id, force=force,
    ))
    if result["status"] == "failed":
        raise RuntimeError("Content generation failed; retrying the same idempotent slot")
    return result


async def _poll_content_schedule() -> dict[str, object]:
    from hring_api.domains.content.service import due_slot_keys, ensure_agent_settings

    async def run(session: AsyncSession) -> dict[str, object]:
        settings_row = await ensure_agent_settings(session)
        await session.commit()
        queued: list[str] = []
        for slot_key in due_slot_keys(settings_row):
            celery_app.send_task(
                "hring.content.generate_article",
                kwargs={"slot_key": slot_key, "trigger": "schedule", "force": False},
            )
            queued.append(slot_key)
        return {"status": "ok", "queued": queued}

    return await _with_session(run)


@celery_app.task(name="hring.content.poll_schedule", ignore_result=False)  # type: ignore[untyped-decorator]
def poll_content_schedule_task() -> dict[str, object]:
    return asyncio.run(_poll_content_schedule())
