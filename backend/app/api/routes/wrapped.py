from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import require_current_user
from app.db import get_db
from app.db.models import Artifact, ArtifactType, Snapshot, SnapshotStatus, User

router = APIRouter()


class WrappedMetrics(BaseModel):
    total_meetings: int
    total_meeting_hours: float
    avg_meetings_per_week: float
    avg_meeting_hours_per_week: float
    focus_hours_per_week: float
    meeting_cost_estimate: float
    total_emails: int
    emails_per_week: float
    meeting_heatmap: dict[str, int]
    snapshot_window_days: int


class WrappedResponse(BaseModel):
    status: str
    metrics: Optional[WrappedMetrics] = None


@router.get("/wrapped", response_model=WrappedResponse)
async def get_wrapped(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_current_user)],
) -> WrappedResponse:
    """Get the user's Wrapped metrics. Returns stored artifact only (no computation)."""
    # Get user's latest done snapshot
    result = await db.execute(
        select(Snapshot)
        .where(Snapshot.user_id == user.id)
        .where(Snapshot.status == SnapshotStatus.done)
        .order_by(Snapshot.created_at.desc())
    )
    snapshot = result.scalar_one_or_none()

    if not snapshot:
        # Check if there's a snapshot in progress
        result = await db.execute(
            select(Snapshot)
            .where(Snapshot.user_id == user.id)
            .where(Snapshot.status.in_([SnapshotStatus.queued, SnapshotStatus.running]))
        )
        in_progress = result.scalar_one_or_none()
        if in_progress:
            return WrappedResponse(status="processing")
        return WrappedResponse(status="not_started")

    # Get the wrapped_cards artifact
    result = await db.execute(
        select(Artifact)
        .where(Artifact.snapshot_id == snapshot.id)
        .where(Artifact.type == ArtifactType.wrapped_cards)
        .where(Artifact.key == "wrapped")
    )
    artifact = result.scalar_one_or_none()

    if not artifact:
        return WrappedResponse(status="generating")

    return WrappedResponse(
        status="ready",
        metrics=WrappedMetrics(**artifact.data),
    )
