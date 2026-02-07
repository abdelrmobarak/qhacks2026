from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from rq.exceptions import NoSuchJobError
from rq.job import Job

from app.api.routes.auth import require_current_user
from app.db import get_db
from app.db.models import Snapshot, SnapshotStatus, User
from app.queue import get_queue

router = APIRouter()


class SnapshotStatusResponse(BaseModel):
    status: str
    stage: Optional[str] = None
    progress: Optional[dict] = None
    failure_reason: Optional[str] = None
    created_at: Optional[str] = None
    completed_at: Optional[str] = None
    expires_at: Optional[str] = None


class CurrentSnapshotResponse(BaseModel):
    id: Optional[str] = None
    status: str
    stage: Optional[str] = None
    progress: Optional[dict] = None
    window_start: Optional[str] = None
    window_end: Optional[str] = None


@router.get("/status", response_model=SnapshotStatusResponse)
async def snapshot_status(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_current_user)],
) -> SnapshotStatusResponse:
    """Get the status of the user's current snapshot."""
    result = await db.execute(
        select(Snapshot)
        .where(Snapshot.user_id == user.id)
        .order_by(Snapshot.created_at.desc())
        .limit(1)
    )
    snapshot = result.scalar_one_or_none()

    if not snapshot:
        return SnapshotStatusResponse(status="not_started")

    if snapshot.status in (SnapshotStatus.queued, SnapshotStatus.running):
        # If Redis was restarted/flushed, the snapshot can remain queued/running
        # with no corresponding RQ job. Re-enqueue once to avoid getting stuck.
        try:
            queue = get_queue()
            job_exists = False

            if snapshot.ingest_job_id:
                try:
                    Job.fetch(snapshot.ingest_job_id, connection=queue.connection)
                    job_exists = True
                except NoSuchJobError:
                    job_exists = False

            if not job_exists:
                job = queue.enqueue(
                    "app.jobs.ingest_snapshot.ingest_snapshot",
                    str(snapshot.id),
                    job_timeout=1800,
                )
                snapshot.ingest_job_id = job.id
                snapshot.status = SnapshotStatus.queued
                await db.commit()
        except Exception:
            # If Redis is unavailable, just report status without requeue.
            pass

    return SnapshotStatusResponse(
        status=snapshot.status.value,
        stage=snapshot.stage.value if snapshot.stage else None,
        progress=snapshot.progress_counts,
        failure_reason=snapshot.failure_reason,
        created_at=snapshot.created_at.isoformat() if snapshot.created_at else None,
        completed_at=snapshot.completed_at.isoformat() if snapshot.completed_at else None,
        expires_at=snapshot.expires_at.isoformat() if snapshot.expires_at else None,
    )


@router.get("/current", response_model=CurrentSnapshotResponse)
async def current_snapshot(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_current_user)],
) -> CurrentSnapshotResponse:
    """Get the user's current snapshot details."""
    result = await db.execute(
        select(Snapshot)
        .where(Snapshot.user_id == user.id)
        .order_by(Snapshot.created_at.desc())
        .limit(1)
    )
    snapshot = result.scalar_one_or_none()

    if not snapshot:
        return CurrentSnapshotResponse(status="not_started")

    return CurrentSnapshotResponse(
        id=str(snapshot.id),
        status=snapshot.status.value,
        stage=snapshot.stage.value if snapshot.stage else None,
        progress=snapshot.progress_counts,
        window_start=snapshot.window_start.isoformat() if snapshot.window_start else None,
        window_end=snapshot.window_end.isoformat() if snapshot.window_end else None,
    )
