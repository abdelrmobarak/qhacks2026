"""Calendar endpoints: create events, list events."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import require_current_user
from app.db import get_db
from app.db.models import User
from app.services.calendar import create_event, list_events
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


@router.get("/events")
async def get_calendar_events(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_current_user)],
    start: Optional[datetime] = Query(default=None),
    end: Optional[datetime] = Query(default=None),
    limit: int = Query(default=50, le=100),
):
    """List calendar events in a time range."""
    access_token = await get_valid_access_token(user, db)

    time_min = start or datetime.now(timezone.utc)
    time_max = end or (time_min + timedelta(days=7))

    events = await list_events(access_token, time_min, time_max, max_results=limit)

    serialized_events = []
    for event in events:
        attendee_list = [
            {
                "email": attendee.email,
                "name": attendee.name,
                "response_status": attendee.response_status,
                "is_organizer": attendee.is_organizer,
            }
            for attendee in event.attendees
            if not attendee.is_resource
        ]

        serialized_events.append({
            "event_id": event.id,
            "summary": event.summary,
            "start": event.start.isoformat(),
            "end": event.end.isoformat(),
            "duration_minutes": event.duration_minutes,
            "location": event.location,
            "description": event.description,
            "organizer_email": event.organizer_email,
            "organizer_name": event.organizer_name,
            "attendees": attendee_list,
            "html_link": event.html_link,
            "is_all_day": event.is_all_day,
            "is_recurring": event.is_recurring,
        })

    return {"events": serialized_events, "count": len(serialized_events)}
