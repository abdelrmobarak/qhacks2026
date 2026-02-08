"""Agent endpoints: text commands and voice commands."""

from __future__ import annotations

import asyncio
import base64
import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
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
)
from app.services.agents.base import call_llm
from app.services.stt import transcribe_audio
from app.services.tts import synthesize_speech

logger = logging.getLogger(__name__)

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


async def _execute_action(action: str, params: dict, access_token: str) -> tuple[dict, str]:
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
        return digest, f"Here's your email digest with {len(digest.get('highlights', []))} highlights."

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

    return {}, "I didn't understand that command. Try: 'summarize my emails', 'show my subscriptions', or 'add meeting to calendar'."


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
    result, message = await _execute_action(action, params, access_token)

    return {
        "action": action,
        "result": result,
        "message": message,
        "routing_confidence": routing.get("confidence", 0),
    }


@router.post("/voice")
async def agent_voice(
    file: UploadFile = File(...),
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    user: Annotated[User, Depends(require_current_user)] = None,
):
    """Process a voice command: STT -> Agent Router -> Execute."""
    access_token = await get_valid_access_token(user, db)

    audio_bytes = await file.read()
    transcript = await transcribe_audio(audio_bytes, filename=file.filename or "audio.wav")

    if not transcript.strip():
        return {
            "transcript": "",
            "action": "unknown",
            "result": {},
            "message": "Could not transcribe audio. Please try again.",
        }

    routing = await asyncio.to_thread(route_command, transcript)
    action = routing.get("action", "unknown")
    params = routing.get("parameters", {})

    result, message = await _execute_action(action, params, access_token)

    return {
        "transcript": transcript,
        "action": action,
        "result": result,
        "message": message,
        "routing_confidence": routing.get("confidence", 0),
    }


VOICE_CHAT_SYSTEM_PROMPT = (
    "You are SaturdAI, a friendly and concise voice assistant. "
    "The user is speaking to you through a voice interface. "
    "Keep responses brief (1-3 sentences) and conversational. "
    "Do not use markdown, bullet points, or formatting since your response will be spoken aloud. "
    "Be warm, helpful, and natural."
)


class VoiceChatResponse(BaseModel):
    transcript: str
    response_text: str
    audio_base64: str
    audio_format: str
    duration_ms: float


@router.post("/voice-chat")
async def agent_voice_chat(
    file: UploadFile = File(...),
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    user: Annotated[User, Depends(require_current_user)] = None,
) -> VoiceChatResponse:
    """Voice chat: STT -> LLM conversation -> TTS. Returns transcript, response text, and audio."""
    started_at = time.monotonic()

    audio_bytes = await file.read()

    try:
        transcript = await transcribe_audio(audio_bytes, filename=file.filename or "audio.wav")
    except Exception:
        logger.exception("STT failed")
        raise HTTPException(status_code=502, detail="Speech-to-text failed")

    if not transcript.strip():
        raise HTTPException(status_code=422, detail="Could not transcribe audio. Please try again.")

    try:
        response_text = await asyncio.to_thread(
            call_llm,
            VOICE_CHAT_SYSTEM_PROMPT,
            transcript,
            300,
        )
    except Exception:
        logger.exception("LLM call failed")
        raise HTTPException(status_code=502, detail="AI response generation failed")

    try:
        response_audio = await synthesize_speech(response_text)
    except Exception:
        logger.exception("TTS failed")
        raise HTTPException(status_code=502, detail="Text-to-speech synthesis failed")

    audio_base64 = base64.b64encode(response_audio).decode("ascii")
    elapsed_ms = (time.monotonic() - started_at) * 1000

    return VoiceChatResponse(
        transcript=transcript,
        response_text=response_text,
        audio_base64=audio_base64,
        audio_format="wav",
        duration_ms=round(elapsed_ms, 1),
    )
