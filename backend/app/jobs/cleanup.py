from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.core.env import load_settings
from app.db.models import Snapshot

settings = load_settings()
logger = logging.getLogger(__name__)


async def run_cleanup() -> int:
    """Delete all expired snapshots."""
    engine = create_async_engine(
        settings.database_url,
        echo=False,
        connect_args={"statement_cache_size": 0},
    )
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_maker() as session:
        # Find expired snapshots
        result = await session.execute(
            select(Snapshot).where(
                Snapshot.expires_at < datetime.now(timezone.utc)
            )
        )
        expired_snapshots = result.scalars().all()

        count = len(expired_snapshots)
        if count > 0:
            # Delete them (cascade will handle related records)
            for snapshot in expired_snapshots:
                await session.delete(snapshot)
            await session.commit()
            logger.info(f"Deleted {count} expired snapshots")

        return count


def cleanup_expired_snapshots() -> int:
    """Entry point for RQ job - cleanup expired snapshots."""
    return asyncio.run(run_cleanup())
