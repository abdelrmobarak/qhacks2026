from __future__ import annotations

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.env import load_settings

settings = load_settings()

# asyncpg prepared statements can break when a connection pooler like pgbouncer
# is in "transaction"/"statement" mode (common on hosted Postgres poolers).
# Disabling the statement cache avoids DuplicatePreparedStatementError.
engine = create_async_engine(
    settings.database_url,
    echo=settings.env == "development",
    pool_pre_ping=True,
    connect_args={"statement_cache_size": 0},
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that yields a database session."""
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()
