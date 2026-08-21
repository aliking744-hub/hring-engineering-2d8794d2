from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from hring_api.config import get_settings


settings = get_settings()
engine_kwargs: dict[str, object] = {"pool_pre_ping": True}
if settings.environment.lower() == "test":
    # TestClient instances may use different event loops. Avoid reusing asyncpg
    # connections across loops while keeping normal pooling outside tests.
    engine_kwargs["poolclass"] = NullPool

engine = create_async_engine(settings.database_url, **engine_kwargs)
SessionFactory = async_sessionmaker(engine, expire_on_commit=False)


async def get_db_session() -> AsyncIterator[AsyncSession]:
    async with SessionFactory() as session:
        yield session
