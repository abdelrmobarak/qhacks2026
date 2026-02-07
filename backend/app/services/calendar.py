from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

from dateutil.parser import parse as parse_datetime
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

# Patterns for detecting calendar resources (rooms, etc.)
RESOURCE_PATTERNS = [
    r"room",
    r"conf\s*room",
    r"conference",
    r"meeting\s*room",
    r"resource",
    r"boardroom",
    r"huddle",
]
RESOURCE_REGEX = re.compile("|".join(RESOURCE_PATTERNS), re.IGNORECASE)


@dataclass
class CalendarAttendee:
    email: str
    name: Optional[str]
    response_status: str
    is_organizer: bool
    is_resource: bool


@dataclass
class CalendarEvent:
    id: str
    summary: Optional[str]
    description: Optional[str]
    location: Optional[str]
    start: datetime
    end: datetime
    duration_minutes: int
    organizer_email: Optional[str]
    organizer_name: Optional[str]
    attendees: list[CalendarAttendee]
    html_link: Optional[str]
    is_all_day: bool
    is_recurring: bool


def is_resource_attendee(attendee: dict) -> bool:
    """Check if an attendee is a calendar resource (room, etc.)."""
    # Google Calendar marks resources with resource=True
    if attendee.get("resource", False):
        return True

    # Check email/name patterns
    email = attendee.get("email", "").lower()
    name = attendee.get("displayName", "").lower()

    if RESOURCE_REGEX.search(email) or RESOURCE_REGEX.search(name):
        return True

    # Common resource email patterns
    if email.startswith("resource-") or "_resource@" in email:
        return True

    return False


def parse_attendees(attendees_data: list) -> list[CalendarAttendee]:
    """Parse attendees from Calendar API response."""
    result = []
    for att in attendees_data:
        result.append(
            CalendarAttendee(
                email=att.get("email", "").lower(),
                name=att.get("displayName"),
                response_status=att.get("responseStatus", "needsAction"),
                is_organizer=att.get("organizer", False),
                is_resource=is_resource_attendee(att),
            )
        )
    return result


def parse_event_datetime(dt_data: dict) -> datetime:
    """Parse datetime from Calendar API event."""
    if "dateTime" in dt_data:
        return parse_datetime(dt_data["dateTime"])
    elif "date" in dt_data:
        # All-day event
        return parse_datetime(dt_data["date"])
    return datetime.now(timezone.utc)


def build_calendar_service(access_token: str) -> Any:
    """Build a Calendar API service object."""
    credentials = Credentials(token=access_token)
    return build("calendar", "v3", credentials=credentials)


async def list_events(
    access_token: str,
    time_min: datetime,
    time_max: datetime,
    max_results: int = 5000,
) -> list[CalendarEvent]:
    """List calendar events in a time range."""
    service = build_calendar_service(access_token)

    def run_list() -> list[CalendarEvent]:
        events: list[CalendarEvent] = []
        page_token: str | None = None

        while len(events) < max_results:
            results = (
                service.events()
                .list(
                    calendarId="primary",
                    timeMin=time_min.isoformat(),
                    timeMax=time_max.isoformat(),
                    maxResults=min(2500, max_results - len(events)),
                    singleEvents=True,  # Expand recurring events
                    orderBy="startTime",
                    pageToken=page_token,
                    showDeleted=False,
                    fields="items(id,summary,description,location,start,end,organizer,attendees,htmlLink,status,recurringEventId),nextPageToken",
                )
                .execute()
            )

            batch_events = results.get("items", [])

            for event in batch_events:
                # Skip cancelled events
                if event.get("status") == "cancelled":
                    continue

                start_data = event.get("start", {})
                end_data = event.get("end", {})

                start = parse_event_datetime(start_data)
                end = parse_event_datetime(end_data)

                # Calculate duration
                duration_minutes = int((end - start).total_seconds() / 60)

                # Parse organizer
                organizer = event.get("organizer", {})

                # Parse attendees
                attendees = parse_attendees(event.get("attendees", []))

                is_all_day = "date" in start_data and "dateTime" not in start_data

                events.append(
                    CalendarEvent(
                        id=event["id"],
                        summary=event.get("summary"),
                        description=event.get("description", "")[:5000]
                        if event.get("description")
                        else None,
                        location=event.get("location"),
                        start=start,
                        end=end,
                        duration_minutes=duration_minutes,
                        organizer_email=organizer.get("email", "").lower()
                        if organizer.get("email")
                        else None,
                        organizer_name=organizer.get("displayName"),
                        attendees=attendees,
                        html_link=event.get("htmlLink"),
                        is_all_day=is_all_day,
                        is_recurring="recurringEventId" in event,
                    )
                )

            page_token = results.get("nextPageToken")
            if not page_token:
                break

        return events[:max_results]

    return await asyncio.to_thread(run_list)


async def create_event(
    access_token: str,
    summary: str,
    start: datetime,
    end: datetime,
    description: str | None = None,
    location: str | None = None,
) -> dict:
    """Create a calendar event. Returns the created event metadata."""
    service = build_calendar_service(access_token)
    event_body: dict[str, Any] = {
        "summary": summary,
        "start": {"dateTime": start.isoformat(), "timeZone": "UTC"},
        "end": {"dateTime": end.isoformat(), "timeZone": "UTC"},
    }
    if description:
        event_body["description"] = description
    if location:
        event_body["location"] = location

    def run_create() -> dict:
        return service.events().insert(calendarId="primary", body=event_body).execute()

    return await asyncio.to_thread(run_create)


async def count_events(
    access_token: str,
    time_min: datetime,
    time_max: datetime,
) -> int:
    """Count events in a time range (for preflight check)."""
    service = build_calendar_service(access_token)

    try:
        results = (
            service.events()
            .list(
                calendarId="primary",
                timeMin=time_min.isoformat(),
                timeMax=time_max.isoformat(),
                maxResults=1,
                singleEvents=True,
            )
            .execute()
        )
        # This is an estimate
        return len(results.get("items", []))
    except Exception:
        return 0
