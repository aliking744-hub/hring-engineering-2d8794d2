import asyncio

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from hring_api.domains.legal.source_sync import LegalSourceSyncError, sync_online_legal_sources
from hring_api.worker.app import celery_app
from hring_api.worker.config import get_worker_settings


@celery_app.task(  # type: ignore[untyped-decorator]
    name="hring.worker.healthcheck",
    ignore_result=False,
)
def worker_healthcheck() -> dict[str, str]:
    return {"status": "ok", "service": "hring-worker"}


async def _sync_legal_sources() -> dict[str, object]:
    settings = get_worker_settings()
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with factory() as session:
            result = await sync_online_legal_sources(session)
            await session.commit()
        return {
            "status": "ok",
            "checked": result.checked,
            "changed": result.changed,
            "unchanged": result.unchanged,
            "failed": list(result.failed),
        }
    finally:
        await engine.dispose()


@celery_app.task(  # type: ignore[untyped-decorator]
    name="hring.legal.sync_sources",
    ignore_result=False,
    autoretry_for=(LegalSourceSyncError, OSError),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def sync_legal_sources_task() -> dict[str, object]:
    return asyncio.run(_sync_legal_sources())
