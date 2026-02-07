from __future__ import annotations

import logging
from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import require_current_user
from app.db import get_db
from app.db.models import (
    Artifact,
    ArtifactType,
    Entity,
    EntityKind,
    Entitlement,
    Snapshot,
    SnapshotStatus,
    User,
)
from app.jobs.generate_story import generate_story
from app.queue import get_queue

router = APIRouter()
logger = logging.getLogger(__name__)


class TopEntity(BaseModel):
    id: str
    name: str
    email: Optional[str]
    domain: Optional[str]
    score: float
    meeting_count: int
    email_count: int
    total_meeting_minutes: int
    contact_count: Optional[int] = None
    story_available: bool
    story_locked: bool


class TopEntitiesResponse(BaseModel):
    status: str
    entities: list[TopEntity] = []


class GraphNode(BaseModel):
    id: str
    name: str
    type: str


class GraphEdge(BaseModel):
    source: str
    target: str
    weight: float = 1.0


class GraphResponse(BaseModel):
    status: str
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []


class StoryClaim(BaseModel):
    text: str
    evidence_ids: list[str]


class StoryTimelineEntry(BaseModel):
    date: str
    description: str
    evidence_ids: list[str]


class StoryResponse(BaseModel):
    status: str
    entity_id: Optional[str] = None
    entity_name: Optional[str] = None
    title: Optional[str] = None
    summary: Optional[str] = None
    claims: list[StoryClaim] = []
    timeline: list[StoryTimelineEntry] = []
    themes: list[str] = []
    locked: bool = False
    error: Optional[str] = None


async def get_user_snapshot(db: AsyncSession, user: User) -> Optional[Snapshot]:
    """Get the user's latest done snapshot."""
    result = await db.execute(
        select(Snapshot)
        .where(Snapshot.user_id == user.id)
        .where(Snapshot.status == SnapshotStatus.done)
        .order_by(Snapshot.created_at.desc())
    )
    return result.scalar_one_or_none()


@router.get("/top", response_model=TopEntitiesResponse)
async def crm_top(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_current_user)],
) -> TopEntitiesResponse:
    """Get the Top 5 entities for the user's snapshot."""
    snapshot = await get_user_snapshot(db, user)

    if not snapshot:
        return TopEntitiesResponse(status="not_ready")

    # Get the top_entities artifact
    result = await db.execute(
        select(Artifact)
        .where(Artifact.snapshot_id == snapshot.id)
        .where(Artifact.type == ArtifactType.top_entities)
        .where(Artifact.key == "top5")
    )
    artifact = result.scalar_one_or_none()

    if not artifact:
        return TopEntitiesResponse(status="generating")

    # Get entitlements to check which stories are unlocked
    result = await db.execute(
        select(Entitlement).where(Entitlement.snapshot_id == snapshot.id)
    )
    entitlement = result.scalar_one_or_none()
    unlocked_count = entitlement.unlocked_story_count if entitlement else 1

    # Check which entities have story artifacts
    entities_data = artifact.data.get("entities", [])
    entities = []

    for i, e in enumerate(entities_data):
        # Check if story artifact exists
        result = await db.execute(
            select(Artifact)
            .where(Artifact.snapshot_id == snapshot.id)
            .where(Artifact.type == ArtifactType.story_text)
            .where(Artifact.key == f"entity:{e['id']}:story")
        )
        story_artifact = result.scalar_one_or_none()

        entities.append(
            TopEntity(
                id=e["id"],
                name=e["name"],
                email=e.get("email"),
                domain=e.get("domain"),
                score=e["score"],
                meeting_count=e["meeting_count"],
                email_count=e["email_count"],
                total_meeting_minutes=e["total_meeting_minutes"],
                contact_count=e.get("contact_count"),
                story_available=story_artifact is not None,
                story_locked=i >= unlocked_count,  # Rank 0 is free, others may be locked
            )
        )

    return TopEntitiesResponse(status="ready", entities=entities)


@router.get("/top-orgs", response_model=TopEntitiesResponse)
async def crm_top_orgs(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_current_user)],
) -> TopEntitiesResponse:
    """Get the Top organizations for the user's snapshot."""
    snapshot = await get_user_snapshot(db, user)
    if not snapshot:
        return TopEntitiesResponse(status="not_ready")

    result = await db.execute(
        select(Artifact)
        .where(Artifact.snapshot_id == snapshot.id)
        .where(Artifact.type == ArtifactType.top_entities)
        .where(Artifact.key == "top_orgs")
    )
    artifact = result.scalar_one_or_none()

    if not artifact:
        return TopEntitiesResponse(status="generating")

    entities_data = artifact.data.get("entities", [])
    entities: list[TopEntity] = []

    for e in entities_data:
        result = await db.execute(
            select(Artifact)
            .where(Artifact.snapshot_id == snapshot.id)
            .where(Artifact.type == ArtifactType.story_text)
            .where(Artifact.key == f"entity:{e['id']}:story")
        )
        story_artifact = result.scalar_one_or_none()

        entities.append(
            TopEntity(
                id=e["id"],
                name=e["name"],
                email=e.get("email"),
                domain=e.get("domain"),
                score=e["score"],
                meeting_count=e["meeting_count"],
                email_count=e["email_count"],
                total_meeting_minutes=e["total_meeting_minutes"],
                contact_count=e.get("contact_count"),
                story_available=story_artifact is not None,
                story_locked=False,  # Org stories are always unlocked (for now)
            )
        )

    return TopEntitiesResponse(status="ready", entities=entities)


@router.get("/graph", response_model=GraphResponse)
async def crm_graph(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_current_user)],
) -> GraphResponse:
    """Get the relationship graph for the user's snapshot."""
    snapshot = await get_user_snapshot(db, user)

    if not snapshot:
        return GraphResponse(status="not_ready")

    # Get the graph artifact
    result = await db.execute(
        select(Artifact)
        .where(Artifact.snapshot_id == snapshot.id)
        .where(Artifact.type == ArtifactType.graph)
        .where(Artifact.key == "graph")
    )
    artifact = result.scalar_one_or_none()

    if not artifact:
        return GraphResponse(status="generating")

    nodes = [GraphNode(**n) for n in artifact.data.get("nodes", [])]
    edges = [GraphEdge(**e) for e in artifact.data.get("edges", [])]

    return GraphResponse(status="ready", nodes=nodes, edges=edges)


@router.get("/story/{entity_id}", response_model=StoryResponse)
async def crm_story(
    entity_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_current_user)],
) -> StoryResponse:
    """Get the relationship story for a specific entity."""
    snapshot = await get_user_snapshot(db, user)

    if not snapshot:
        raise HTTPException(status_code=404, detail="No snapshot available")

    # Validate entity_id as UUID
    try:
        entity_uuid = UUID(entity_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid entity ID")

    # Check if entity belongs to this snapshot
    result = await db.execute(
        select(Entity)
        .where(Entity.snapshot_id == snapshot.id)
        .where(Entity.id == entity_uuid)
    )
    entity = result.scalar_one_or_none()

    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    # Get entitlements and check if story is locked
    result = await db.execute(
        select(Entitlement).where(Entitlement.snapshot_id == snapshot.id)
    )
    entitlement = result.scalar_one_or_none()
    unlocked_count = entitlement.unlocked_story_count if entitlement else 1

    is_locked = False
    if entity.kind == EntityKind.person:
        result = await db.execute(
            select(Entity)
            .where(Entity.snapshot_id == snapshot.id)
            .where(Entity.kind == EntityKind.person)
            .order_by(Entity.score.desc())
        )
        people = result.scalars().all()
        entity_rank = next(
            (i for i, e in enumerate(people) if e.id == entity_uuid),
            len(people),
        )
        is_locked = entity_rank >= unlocked_count

    if is_locked:
        return StoryResponse(
            status="locked",
            entity_id=entity_id,
            entity_name=entity.name,
            locked=True,
        )

    # Get the story artifact
    result = await db.execute(
        select(Artifact)
        .where(Artifact.snapshot_id == snapshot.id)
        .where(Artifact.type == ArtifactType.story_text)
        .where(Artifact.key == f"entity:{entity_id}:story")
    )
    artifact = result.scalar_one_or_none()

    if not artifact:
        try:
            queue = get_queue()
            queue.enqueue(
                generate_story,
                str(snapshot.id),
                entity_id,
                job_id=f"story:{snapshot.id}:{entity_id}",
                job_timeout=300,
            )
        except Exception as e:
            # If Redis is unavailable, just report status without enqueue.
            logger.warning("Failed to enqueue story generation job: %s", e)
        return StoryResponse(
            status="generating",
            entity_id=entity_id,
            entity_name=entity.name,
        )

    story_data = artifact.data

    generation_error = story_data.get("generation_error")
    if isinstance(generation_error, str) and generation_error.strip():
        return StoryResponse(
            status="failed",
            entity_id=story_data.get("entity_id") or entity_id,
            entity_name=story_data.get("entity_name") or entity.name,
            title=story_data.get("title"),
            summary=story_data.get("summary"),
            claims=[StoryClaim(**c) for c in story_data.get("claims", [])],
            timeline=[StoryTimelineEntry(**t) for t in story_data.get("timeline", [])],
            themes=story_data.get("themes", []),
            locked=False,
            error=generation_error,
        )

    return StoryResponse(
        status="ready",
        entity_id=story_data.get("entity_id"),
        entity_name=story_data.get("entity_name"),
        title=story_data.get("title"),
        summary=story_data.get("summary"),
        claims=[StoryClaim(**c) for c in story_data.get("claims", [])],
        timeline=[StoryTimelineEntry(**t) for t in story_data.get("timeline", [])],
        themes=story_data.get("themes", []),
        locked=False,
    )
