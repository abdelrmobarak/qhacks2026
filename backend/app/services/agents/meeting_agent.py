"""Meeting Agent (B): Summarizes calendar events.

Input: Calendar event details
Output: Meeting summary with context, participants, inferred purpose
"""
from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass

from app.services.agents.base import call_llm_json

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a meeting summarizer. Given calendar event details, extract:
1. A brief description of the meeting's apparent purpose
2. Meeting type (1:1, team sync, external, interview, etc.)
3. Key participants and likely roles
4. Any context from the description

Be factual. If information is not available, indicate "unknown" rather than guessing.
Output valid JSON matching the schema provided."""

USER_PROMPT = """Summarize this calendar event:

EVENT ID: {event_id}
TITLE: {title}
DATE: {date}
DURATION: {duration_minutes} minutes
LOCATION: {location}

ORGANIZER: {organizer}

ATTENDEES:
{attendees}

DESCRIPTION:
{description}

OUTPUT FORMAT (JSON):
{{
  "purpose": "string",
  "meeting_type": "1:1" | "team_sync" | "external" | "interview" | "presentation" | "workshop" | "other",
  "participants": [
    {{"email": "string", "role": "string"}}
  ],
  "topics": ["string"],
  "is_recurring": boolean
}}"""

BATCH_SYSTEM_PROMPT = """You are a meeting summarizer. Given multiple calendar events, extract for EACH event:
1. A brief description of the meeting's apparent purpose
2. Meeting type (1:1, team sync, external, interview, etc.)
3. Key participants and likely roles
4. Any context from the description

Be factual. If information is not available, indicate "unknown" rather than guessing.
Output valid JSON matching the schema provided."""

BATCH_USER_PROMPT = """Summarize these calendar events.

EVENTS (JSON):
{events_json}

Return exactly one summary per input event. Use the provided event_id for each output item.

OUTPUT FORMAT (JSON):
{{
  "meetings": [
    {{
      "event_id": "string",
      "purpose": "string",
      "meeting_type": "1:1" | "team_sync" | "external" | "interview" | "presentation" | "workshop" | "other",
      "participants": [{{"email": "string", "role": "string"}}],
      "topics": ["string"],
      "is_recurring": boolean
    }}
  ]
}}"""


@dataclass
class MeetingSummary:
    event_id: str
    purpose: str
    meeting_type: str
    participants: list[dict]
    topics: list[str]
    is_recurring: bool


async def summarize_meeting(
    event_id: str,
    title: str,
    date: str,
    duration_minutes: int,
    location: str | None,
    organizer: str | None,
    attendees: list[dict],
    description: str | None,
    is_recurring: bool = False,
    *,
    model: str | None = None,
) -> MeetingSummary:
    """Summarize a calendar event.

    Args:
        event_id: Calendar event ID
        title: Event title/summary
        date: Event date string
        duration_minutes: Event duration
        location: Event location
        organizer: Organizer email
        attendees: List of attendee dicts with email, name, response_status
        description: Event description text
        is_recurring: Whether this is a recurring event

    Returns:
        MeetingSummary dataclass
    """
    # Format attendees
    attendees_text = "\n".join([
        f"- {a.get('name', a.get('email', 'unknown'))} ({a.get('email', '')}) - {a.get('response_status', 'unknown')}"
        for a in attendees[:20]
    ]) or "No attendees listed"

    prompt = USER_PROMPT.format(
        event_id=event_id,
        title=title or "(no title)",
        date=date,
        duration_minutes=duration_minutes,
        location=location or "(no location)",
        organizer=organizer or "(no organizer)",
        attendees=attendees_text,
        description=(description or "")[:1000] or "(no description)",
    )

    try:
        data = await asyncio.to_thread(call_llm_json, SYSTEM_PROMPT, prompt, 600, model=model)

        return MeetingSummary(
            event_id=event_id,
            purpose=data.get("purpose", ""),
            meeting_type=data.get("meeting_type", "other"),
            participants=data.get("participants", []),
            topics=data.get("topics", []),
            is_recurring=data.get("is_recurring", is_recurring),
        )

    except Exception as e:
        logger.exception(f"Meeting summarization failed for {event_id}: {e}")
        # Return basic summary on failure
        return MeetingSummary(
            event_id=event_id,
            purpose=title or "Meeting",
            meeting_type="other",
            participants=[{"email": a.get("email", "")} for a in attendees[:5]],
            topics=[],
            is_recurring=is_recurring,
        )


async def summarize_meetings_batch(
    events: list[dict],
    *,
    model: str | None = None,
) -> list[MeetingSummary]:
    """Summarize multiple calendar events in a single LLM call.

    Args:
        events: List of dicts with keys: event_id, title, date, duration_minutes, location, organizer, attendees, description, is_recurring
        model: Optional LLM model override

    Returns:
        List of MeetingSummary in the same order as input.
    """
    if not events:
        return []

    events_json = json.dumps(events, ensure_ascii=False)
    prompt = BATCH_USER_PROMPT.format(events_json=events_json)

    try:
        data = await asyncio.to_thread(call_llm_json, BATCH_SYSTEM_PROMPT, prompt, 1800, model=model)
        items = data.get("meetings", [])
        if not isinstance(items, list):
            raise ValueError("Expected 'meetings' to be a list")

        by_id: dict[str, dict] = {}
        for item in items:
            if not isinstance(item, dict):
                continue
            eid = item.get("event_id")
            if isinstance(eid, str) and eid.strip():
                by_id[eid] = item

        results: list[MeetingSummary] = []
        for event in events:
            eid = str(event.get("event_id") or "")
            item = by_id.get(eid, {})

            raw_is_recurring = item.get("is_recurring", event.get("is_recurring", False))
            if isinstance(raw_is_recurring, bool):
                is_recurring = raw_is_recurring
            elif isinstance(raw_is_recurring, str):
                is_recurring = raw_is_recurring.strip().lower() in {
                    "1",
                    "true",
                    "yes",
                    "y",
                    "on",
                }
            else:
                is_recurring = bool(raw_is_recurring)

            results.append(
                MeetingSummary(
                    event_id=eid,
                    purpose=str(item.get("purpose") or ""),
                    meeting_type=str(item.get("meeting_type") or "other"),
                    participants=item.get("participants", []) if isinstance(item.get("participants"), list) else [],
                    topics=item.get("topics", []) if isinstance(item.get("topics"), list) else [],
                    is_recurring=is_recurring,
                )
            )

        return results

    except Exception as e:
        logger.exception("Meeting batch summarization failed: %s", e)
        # Fallback to per-meeting calls to keep behavior working.
        results: list[MeetingSummary] = []
        for event in events:
            results.append(
                await summarize_meeting(
                    event_id=str(event.get("event_id") or ""),
                    title=str(event.get("title") or ""),
                    date=str(event.get("date") or ""),
                    duration_minutes=int(event.get("duration_minutes") or 0),
                    location=event.get("location") if isinstance(event.get("location"), str) else None,
                    organizer=event.get("organizer") if isinstance(event.get("organizer"), str) else None,
                    attendees=event.get("attendees", []) if isinstance(event.get("attendees"), list) else [],
                    description=event.get("description") if isinstance(event.get("description"), str) else None,
                    is_recurring=bool(event.get("is_recurring", False)),
                    model=model,
                )
            )
        return results
