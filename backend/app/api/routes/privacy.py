from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import require_current_user, SESSION_COOKIE_NAME
from app.db import get_db
from app.db.models import Session, Snapshot, User

router = APIRouter()


class DeleteResponse(BaseModel):
    deleted: bool


@router.delete("/me", response_model=DeleteResponse)
async def delete_me(
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_current_user)],
) -> DeleteResponse:
    """Delete all user data including snapshots, artifacts, and sessions."""
    # All cascade deletes will happen automatically due to FK constraints
    # Delete user (cascades to sessions, snapshots, and everything under snapshots)
    await db.delete(user)
    await db.commit()

    # Clear session cookie
    response.delete_cookie(SESSION_COOKIE_NAME)

    return DeleteResponse(deleted=True)


@router.delete("/snapshot", response_model=DeleteResponse)
async def delete_snapshot(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_current_user)],
) -> DeleteResponse:
    """Delete the user's current snapshot and all associated data."""
    # Get user's snapshots
    result = await db.execute(
        select(Snapshot).where(Snapshot.user_id == user.id)
    )
    snapshots = result.scalars().all()

    for snapshot in snapshots:
        await db.delete(snapshot)

    await db.commit()

    return DeleteResponse(deleted=True)
