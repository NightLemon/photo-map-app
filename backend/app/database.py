from functools import lru_cache

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.config import get_settings


def _create_engine():
    settings = get_settings()
    return create_async_engine(
        settings.database_url,
        echo=False,
        pool_size=10,
        max_overflow=20,
    )


@lru_cache
def get_engine():
    return _create_engine()


@lru_cache
def get_async_session_factory():
    return async_sessionmaker(get_engine(), class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncSession:  # type: ignore[misc]
    async_session = get_async_session_factory()
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
