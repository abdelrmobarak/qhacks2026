"""Tool execution dispatch for the function-calling agent."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from app.services.gmail import fetch_messages, list_messages, send_reply
from app.services.calendar import create_event, list_events
from app.services.agents.email_agent import (
    categorize_emails,
    create_tldr_digest,
    detect_subscriptions,
)
from app.services.agents.date_parsing import parse_flexible_datetime

logger = logging.getLogger(__name__)


def _format_gmail_message(msg) -> dict:
    return {
        "message_id": msg.id,
        "thread_id": msg.thread_id,
        "subject": msg.subject or "",
        "from_email": msg.from_email or "",
        "from_name": msg.from_name or "",
        "snippet": msg.snippet or "",
        "body_preview": (msg.body_preview or "")[:500],
        "date": msg.internal_date.isoformat() if msg.internal_date else "",
        "is_automated": msg.is_automated_sender,
    }


async def _execute_send_email(arguments: dict, access_token: str) -> dict:
    to_address = arguments.get("to", "")
    subject = arguments.get("subject", "")
    body = arguments.get("body", "")

    if not to_address or not subject:
        return {"success": False, "error": "Missing required fields: to, subject"}

    result = await send_reply(
        access_token,
        to=to_address,
        subject=subject,
        body=body,
    )
    return {
        "success": True,
        "data": {"message_id": result.get("id"), "sent_to": to_address},
    }


async def _execute_search_emails(arguments: dict, access_token: str) -> dict:
    query = arguments.get("query", "in:inbox newer_than:7d")
    limit = min(arguments.get("limit", 20), 50)

    message_refs = await list_messages(access_token, query=query, max_results=limit)
    message_ids = [
        item["id"] for item in message_refs if isinstance(item, dict) and "id" in item
    ]

    if not message_ids:
        return {"success": True, "data": {"emails": [], "count": 0}}

    messages = await fetch_messages(access_token, message_ids, include_body=True)
    email_dicts = [_format_gmail_message(message) for message in messages]
    categorized = await asyncio.to_thread(categorize_emails, email_dicts)

    return {"success": True, "data": {"emails": categorized, "count": len(categorized)}}


async def _execute_get_email_summary(arguments: dict, access_token: str) -> dict:
    message_refs = await list_messages(
        access_token,
        query="in:inbox newer_than:3d -category:promotions",
        max_results=30,
    )
    message_ids = [
        item["id"] for item in message_refs if isinstance(item, dict) and "id" in item
    ]

    if not message_ids:
        return {
            "success": True,
            "data": {"summary": "No recent emails found.", "highlights": []},
        }

    messages = await fetch_messages(access_token, message_ids, include_body=True)
    email_dicts = [
        _format_gmail_message(message)
        for message in messages
        if not message.is_automated_sender
    ]

    digest = await asyncio.to_thread(create_tldr_digest, email_dicts)
    return {"success": True, "data": digest}


async def _execute_create_calendar_event(arguments: dict, access_token: str) -> dict:
    summary = arguments.get("summary", "New Event")
    start_time_raw = arguments.get("start_time", "")
    end_time_raw = arguments.get("end_time", "")
    description = arguments.get("description")
    location = arguments.get("location")

    if not start_time_raw or not end_time_raw:
        return {"success": False, "error": "Missing required fields: start_time, end_time"}

    now = datetime.now(timezone.utc)
    try:
        start = parse_flexible_datetime(start_time_raw, reference_time=now)
    except ValueError as date_error:
        return {"success": False, "error": f"Could not parse start_time: {date_error}"}

    try:
        end = parse_flexible_datetime(end_time_raw, reference_time=now)
    except ValueError as date_error:
        return {"success": False, "error": f"Could not parse end_time: {date_error}"}

    result = await create_event(
        access_token,
        summary=summary,
        start=start,
        end=end,
        description=description,
        location=location,
    )
    return {
        "success": True,
        "data": {
            "event_id": result.get("id"),
            "html_link": result.get("htmlLink"),
            "summary": summary,
            "start": start.isoformat(),
            "end": end.isoformat(),
        },
    }


async def _execute_list_calendar_events(arguments: dict, access_token: str) -> dict:
    now = datetime.now(timezone.utc)
    limit = min(arguments.get("limit", 50), 100)

    start_date_raw = arguments.get("start_date", "")
    end_date_raw = arguments.get("end_date", "")

    if start_date_raw:
        try:
            time_min = parse_flexible_datetime(start_date_raw, reference_time=now)
        except ValueError:
            time_min = now
    else:
        time_min = now

    if end_date_raw:
        try:
            time_max = parse_flexible_datetime(end_date_raw, reference_time=now)
        except ValueError:
            time_max = time_min + timedelta(days=7)
    else:
        time_max = time_min + timedelta(days=7)

    events = await list_events(access_token, time_min, time_max, max_results=limit)

    serialized_events = []
    for event in events:
        serialized_events.append({
            "event_id": event.id,
            "summary": event.summary,
            "start": event.start.isoformat(),
            "end": event.end.isoformat(),
            "duration_minutes": event.duration_minutes,
            "location": event.location,
            "description": (event.description or "")[:200],
            "organizer_email": event.organizer_email,
            "attendee_count": len([
                attendee for attendee in event.attendees if not attendee.is_resource
            ]),
            "is_recurring": event.is_recurring,
        })

    return {
        "success": True,
        "data": {"events": serialized_events, "count": len(serialized_events)},
    }


async def _execute_get_subscriptions(arguments: dict, access_token: str) -> dict:
    message_refs = await list_messages(
        access_token,
        query=(
            "in:inbox (subject:subscription OR subject:invoice OR subject:receipt "
            "OR subject:renewal OR subject:billing) newer_than:90d"
        ),
        max_results=50,
    )
    message_ids = [
        item["id"] for item in message_refs if isinstance(item, dict) and "id" in item
    ]

    if not message_ids:
        return {"success": True, "data": {"subscriptions": [], "count": 0}}

    messages = await fetch_messages(access_token, message_ids, include_body=True)
    email_dicts = [_format_gmail_message(message) for message in messages]
    subscriptions = await asyncio.to_thread(detect_subscriptions, email_dicts)

    return {
        "success": True,
        "data": {"subscriptions": subscriptions, "count": len(subscriptions)},
    }


_TOOL_EXECUTORS: dict[str, Any] = {
    "send_email": _execute_send_email,
    "search_emails": _execute_search_emails,
    "get_email_summary": _execute_get_email_summary,
    "create_calendar_event": _execute_create_calendar_event,
    "list_calendar_events": _execute_list_calendar_events,
    "get_subscriptions": _execute_get_subscriptions,
}


async def execute_tool(tool_name: str, arguments: dict, access_token: str) -> dict:
    """Execute a tool by name and return the result."""
    executor = _TOOL_EXECUTORS.get(tool_name)
    if not executor:
        return {"success": False, "error": f"Unknown tool: {tool_name}"}

    try:
        return await executor(arguments, access_token)
    except Exception as execution_error:
        logger.exception("Tool execution failed: %s", tool_name)
        return {"success": False, "error": str(execution_error)}
