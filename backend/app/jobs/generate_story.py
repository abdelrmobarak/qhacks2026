from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.env import load_settings
from app.db.models import (
    Artifact,
    ArtifactType,
    Entity,
    Snapshot,
    SnapshotStatus,
    User,
)
from app.jobs.ingest_snapshot import generate_entity_story, store_artifact

settings = load_settings()
logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class StoryResult:
    entity_id: str
    status: str
    error: Optional[str] = None


def get_sync_session() -> async_sessionmaker:
    """Create a new async engine and session maker for the worker process."""
    engine = create_async_engine(
        settings.database_url,
        echo=False,
        connect_args={"statement_cache_size": 0},
    )
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def run_story_generation(snapshot_id: str, entity_id: str) -> StoryResult:
    """Generate a story for a specific entity."""
    session_maker = get_sync_session()

    async with session_maker() as session:
        try:
            snapshot_uuid = UUID(snapshot_id)
            entity_uuid = UUID(entity_id)

            # Verify snapshot is done
            result = await session.execute(
                select(Snapshot).where(Snapshot.id == snapshot_uuid)
            )
            snapshot = result.scalar_one_or_none()

            if not snapshot:
                return StoryResult(
                    entity_id=entity_id, status="failed", error="Snapshot not found"
                )

            if snapshot.status != SnapshotStatus.done:
                return StoryResult(
                    entity_id=entity_id,
                    status="failed",
                    error="Snapshot not completed",
                )

            # Check if story already exists
            result = await session.execute(
                select(Artifact)
                .where(Artifact.snapshot_id == snapshot_uuid)
                .where(Artifact.type == ArtifactType.story_text)
                .where(Artifact.key == f"entity:{entity_id}:story")
            )
            existing = result.scalar_one_or_none()

            if existing:
                logger.info(f"Story already exists for entity {entity_id}")
                return StoryResult(entity_id=entity_id, status="skipped")

            # Get entity
            result = await session.execute(
                select(Entity).where(Entity.id == entity_uuid)
            )
            entity = result.scalar_one_or_none()

            if not entity:
                return StoryResult(
                    entity_id=entity_id, status="failed", error="Entity not found"
                )

            # Get user email
            result = await session.execute(
                select(User).where(User.id == snapshot.user_id)
            )
            user = result.scalar_one()

            # Generate the story
            logger.info(f"Generating story for entity {entity.id} ({entity.name})")

            story_data, verification_data = await generate_entity_story(
                session, snapshot_uuid, entity, user.email
            )

            # Store story artifact
            await store_artifact(
                session,
                snapshot_uuid,
                ArtifactType.story_text,
                f"entity:{entity.id}:story",
                story_data,
                model_name=settings.llm_model,
                prompt_version="v1",
            )

            # Store verification artifact
            await store_artifact(
                session,
                snapshot_uuid,
                ArtifactType.story_verification,
                f"entity:{entity.id}:verify",
                verification_data,
                model_name=settings.llm_model,
                prompt_version="v1",
            )

            return StoryResult(entity_id=entity_id, status="done")

        except Exception as e:
            logger.exception(f"Story generation failed for entity {entity_id}")
            return StoryResult(entity_id=entity_id, status="failed", error=str(e))


def generate_story(snapshot_id: str, entity_id: str) -> StoryResult:
    """Entry point for RQ job - runs async story generation."""
    return asyncio.run(run_story_generation(snapshot_id, entity_id))


async def run_batch_story_generation(
    snapshot_id: str, entity_ids: list[str]
) -> list[StoryResult]:
    """Generate stories for multiple entities in batch."""
    results = []
    for entity_id in entity_ids:
        result = await run_story_generation(snapshot_id, entity_id)
        results.append(result)
    return results


def generate_stories_batch(snapshot_id: str, entity_ids: list[str]) -> list[StoryResult]:
    """Entry point for RQ batch job - generates multiple stories."""
    return asyncio.run(run_batch_story_generation(snapshot_id, entity_ids))
