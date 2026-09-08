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
