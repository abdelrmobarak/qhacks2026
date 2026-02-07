"""Calendar endpoints: create events."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import require_current_user
from app.db import get_db
from app.db.models import User
from app.services.calendar import create_event
from app.services.token_manager import get_valid_access_token

router = APIRouter()


class CreateEventRequest(BaseModel):
    summary: str
    start: datetime
    end: datetime
    description: Optional[str] = None
    location: Optional[str] = None


@router.post("/event")
async def create_calendar_event(
    request: CreateEventRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_current_user)],
):
    """Create a Google Calendar event."""
    access_token = await get_valid_access_token(user, db)
    result = await create_event(
        access_token,
        summary=request.summary,
        start=request.start,
        end=request.end,
        description=request.description,
        location=request.location,
    )
    return {
        "created": True,
        "event_id": result.get("id"),
        "html_link": result.get("htmlLink"),
    }
