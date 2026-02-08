"""Agent endpoints: text commands and voice commands."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import require_current_user
from app.db import get_db
from app.db.models import User
from app.services.gmail import fetch_messages, list_messages
from app.services.calendar import create_event
from app.services.token_manager import get_valid_access_token
from app.services.agents.router_agent import route_command
from app.services.agents.email_agent import (
    categorize_emails,
    create_tldr_digest,
    detect_subscriptions,
    extract_todos,
)
from app.services.embedding import search_emails as semantic_search_emails

router = APIRouter()


def _format_gmail_message(msg) -> dict:
    return {
        "message_id": msg.id,
        "thread_id": msg.thread_id,
        "subject": msg.subject or "",
        "from_email": msg.from_email or "",
        "from_name": msg.from_name or "",
        "snippet": msg.snippet or "",
        "body_preview": msg.body_preview or "",
        "date": msg.internal_date.isoformat() if msg.internal_date else "",
        "is_automated": msg.is_automated_sender,
    }


class CommandRequest(BaseModel):
    command: str


def _build_steps(
    action: str,
    params: dict,
    routing: dict,
    result: dict,
) -> list[dict]:
    """Build chain-of-thought steps for the frontend."""
    steps: list[dict] = [
        {"label": f"Routing command → {action}"},
    ]

    if action == "search_emails":
        indexed = result.get("indexed_count", 0)
        if indexed:
            steps.append({"label": f"Indexed {indexed} new emails"})
        query = params.get("query", "")
        steps.append({"label": f"Searching for '{query}'"})
        email_count = len(result.get("emails", []))
        steps.append({"label": f"Found {email_count} matching emails"})

    elif action in ("summarize_emails", "create_tldr"):
        steps.append({"label": "Fetching recent emails"})
        highlight_count = len(result.get("highlights", []))
        steps.append({"label": f"Generated digest with {highlight_count} highlights"})

    elif action in ("suggest_replies", "fetch_recent"):
        steps.append({"label": "Fetching recent emails"})
        email_count = len(result.get("emails", []))
        steps.append({"label": f"Categorized {email_count} emails"})

    elif action == "track_subscriptions":
        steps.append({"label": "Scanning billing emails"})
        sub_count = len(result.get("subscriptions", []))
        steps.append({"label": f"Detected {sub_count} subscriptions"})

    elif action == "generate_todos":
        steps.append({"label": "Analyzing emails for tasks"})
        todo_count = len(result.get("todos", []))
        steps.append({"label": f"Extracted {todo_count} tasks"})

    elif action == "add_to_calendar":
        summary = params.get("summary", "New Event")
        steps.append({"label": f"Creating event: {summary}"})

    return steps


def _build_sources(action: str, result: dict) -> list[dict]:
    """Build source references for the frontend."""
    sources: list[dict] = []

    if action == "search_emails":
        for email in result.get("emails", []):
            message_id = email.get("message_id", "")
            sources.append({
                "title": email.get("subject", "(no subject)"),
                "description": email.get("snippet", ""),
                "href": f"https://mail.google.com/mail/u/0/#inbox/{message_id}",
            })

    elif action in ("summarize_emails", "create_tldr"):
        for highlight in result.get("highlights", []):
            sender = highlight.get("from", "Unknown")
            sources.append({
                "title": f"From {sender}",
                "description": highlight.get("gist", ""),
                "href": "https://mail.google.com/mail/u/0/#inbox",
            })

    elif action == "generate_todos":
        for todo in result.get("todos", []):
            link = todo.get("link", "")
            if link:
                sources.append({
                    "title": todo.get("source", "Email"),
                    "description": todo.get("text", ""),
                    "href": link,
                })

    return sources


async def _execute_action(
    action: str,
    params: dict,
    access_token: str,
    user_id: "UUIDType | None" = None,
    db: "AsyncSession | None" = None,
) -> tuple[dict, str]:
    """Execute a routed action. Returns (result_dict, human_message)."""

    if action in ("summarize_emails", "create_tldr"):
        message_refs = await list_messages(
            access_token, query="in:inbox newer_than:3d -category:promotions", max_results=30
        )
        msg_ids = [m["id"] for m in message_refs if isinstance(m, dict) and "id" in m]
        if not msg_ids:
            return {}, "No recent emails found."
        messages = await fetch_messages(access_token, msg_ids, include_body=True)
        email_dicts = [_format_gmail_message(m) for m in messages if not m.is_automated_sender]
        digest = await asyncio.to_thread(create_tldr_digest, email_dicts)
        summary = digest.get("summary", "")
        highlights = digest.get("highlights", [])
        parts = [summary] if summary else []
        for highlight in highlights:
            gist = highlight.get("gist", "")
            sender = highlight.get("from", "")
            action = " (action needed)" if highlight.get("action_needed") else ""
            parts.append(f"- {sender}: {gist}{action}")
        return digest, "\n".join(parts) if parts else "No highlights found."

    if action == "suggest_replies" or action == "fetch_recent":
        message_refs = await list_messages(
            access_token, query="in:inbox newer_than:7d", max_results=20
        )
        msg_ids = [m["id"] for m in message_refs if isinstance(m, dict) and "id" in m]
        if not msg_ids:
            return {"emails": []}, "No recent emails found."
        messages = await fetch_messages(access_token, msg_ids, include_body=True)
        email_dicts = [_format_gmail_message(m) for m in messages]
        categorized = await asyncio.to_thread(categorize_emails, email_dicts)
        needs_reply = [e for e in categorized if e.get("category") == "needs_reply"]
        return {"emails": categorized}, f"Found {len(categorized)} emails, {len(needs_reply)} need replies."

    if action == "track_subscriptions":
        message_refs = await list_messages(
            access_token,
            query=(
                "in:inbox (subject:subscription OR subject:invoice OR subject:receipt "
                "OR subject:renewal OR subject:billing) newer_than:90d"
            ),
            max_results=50,
        )
        msg_ids = [m["id"] for m in message_refs if isinstance(m, dict) and "id" in m]
        if not msg_ids:
            return {"subscriptions": []}, "No subscription-related emails found."
        messages = await fetch_messages(access_token, msg_ids, include_body=True)
        email_dicts = [_format_gmail_message(m) for m in messages]
        subs = await asyncio.to_thread(detect_subscriptions, email_dicts)
        return {"subscriptions": subs}, f"Found {len(subs)} subscriptions/bills."

    if action == "generate_todos":
        message_refs = await list_messages(
            access_token, query="in:inbox newer_than:7d -category:promotions", max_results=40
        )
        msg_ids = [m["id"] for m in message_refs if isinstance(m, dict) and "id" in m]
        if not msg_ids:
            return {"todos": []}, "No recent emails found to extract tasks from."
        messages = await fetch_messages(access_token, msg_ids, include_body=True)
        email_dicts = [_format_gmail_message(m) for m in messages if not m.is_automated_sender]
        todos_result = await asyncio.to_thread(extract_todos, email_dicts)
        todo_count = len(todos_result.get("todos", []))
        return todos_result, f"Found {todo_count} action items from your recent emails."

    if action == "add_to_calendar":
        # Parse date/time from parameters
        date_str = params.get("date", "")
        start_time = params.get("start_time", "09:00")
        end_time = params.get("end_time", "10:00")
        summary = params.get("summary", "New Event")
        description = params.get("description", "")

        try:
            start = datetime.fromisoformat(f"{date_str}T{start_time}:00+00:00")
            end = datetime.fromisoformat(f"{date_str}T{end_time}:00+00:00")
        except (ValueError, TypeError):
            # Default to tomorrow 9-10 AM
            tomorrow = datetime.now(timezone.utc) + timedelta(days=1)
            start = tomorrow.replace(hour=9, minute=0, second=0, microsecond=0)
            end = tomorrow.replace(hour=10, minute=0, second=0, microsecond=0)

        result = await create_event(
            access_token,
            summary=summary,
            start=start,
            end=end,
            description=description or None,
        )
        return {
            "created": True,
            "event_id": result.get("id"),
            "html_link": result.get("htmlLink"),
        }, f"Created calendar event: {summary}"

    if action == "search_emails":
        query_text = params.get("query", "")
        if not query_text:
            return {}, "Please provide a search query."
        if user_id is None or db is None:
            return {}, "Search is unavailable right now."
        result = await semantic_search_emails(user_id, query_text, access_token, db)
        email_count = len(result.get("emails", []))
        return result, result.get("summary", f"Found {email_count} matching emails.")

    return {}, "I didn't understand that command. Try: 'summarize my emails', 'search my emails about [topic]', or 'add meeting to calendar'."


@router.post("/command")
async def agent_command(
    request: CommandRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_current_user)],
):
    """Process a text command through the AI agent router."""
    access_token = await get_valid_access_token(user, db)

    # Route the command
    routing = await asyncio.to_thread(route_command, request.command)
    action = routing.get("action", "unknown")
    params = routing.get("parameters", {})

    # Execute the action
    result, message = await _execute_action(action, params, access_token, user_id=user.id, db=db)

    return {
        "action": action,
        "result": result,
        "message": message,
        "routing_confidence": routing.get("confidence", 0),
        "steps": _build_steps(action, params, routing, result),
        "sources": _build_sources(action, result),
    }


@router.post("/voice")
async def agent_voice(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_current_user)],
    file: UploadFile = File(...),
):
    """Process a voice command: STT -> Agent Router -> Execute."""
    from app.services.stt import transcribe_audio

    access_token = await get_valid_access_token(user, db)

    # Step 1: Transcribe audio
    audio_bytes = await file.read()
    transcript = await transcribe_audio(audio_bytes, filename=file.filename or "audio.wav")

    if not transcript.strip():
        return {
            "transcript": "",
            "action": "unknown",
            "result": {},
            "message": "Could not transcribe audio. Please try again.",
        }

    # Step 2: Route the transcribed command
    routing = await asyncio.to_thread(route_command, transcript)
    action = routing.get("action", "unknown")
    params = routing.get("parameters", {})

    # Step 3: Execute the action
    result, message = await _execute_action(action, params, access_token, user_id=user.id, db=db)

    return {
        "transcript": transcript,
        "action": action,
        "result": result,
        "message": message,
        "routing_confidence": routing.get("confidence", 0),
        "steps": _build_steps(action, params, routing, result),
        "sources": _build_sources(action, result),
    }
