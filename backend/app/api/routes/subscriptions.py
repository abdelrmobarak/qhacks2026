"""Subscription tracking endpoints."""

from __future__ import annotations

import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import require_current_user
from app.db import get_db
from app.db.models import User
from app.services.gmail import fetch_messages, list_messages
from app.services.token_manager import get_valid_access_token
from app.services.agents.email_agent import detect_subscriptions

router = APIRouter()


def _format_gmail_message(msg) -> dict:
    """Convert a GmailMessage dataclass to a dict for the LLM agent."""
    return {
        "message_id": msg.id,
        "thread_id": msg.thread_id,
        "subject": msg.subject or "",
        "from_email": msg.from_email or "",
        "from_name": msg.from_name or "",
        "snippet": msg.snippet or "",
        "body_preview": msg.body_preview or "",
        "date": msg.internal_date.isoformat() if msg.internal_date else "",
    }


@router.get("/")
async def get_subscriptions(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_current_user)],
):
    """Scan emails for subscriptions and billing information."""
    access_token = await get_valid_access_token(user, db)

    # Search for subscription/billing-related emails
    message_refs = await list_messages(
        access_token,
        query=(
            "in:inbox ("
            "subject:subscription OR subject:invoice OR subject:receipt "
            "OR subject:renewal OR subject:billing OR subject:payment "
            "OR subject:\"your order\" OR subject:\"payment confirmation\""
            ") newer_than:90d"
        ),
        max_results=50,
    )
    message_ids = [m["id"] for m in message_refs if isinstance(m, dict) and "id" in m]

    if not message_ids:
        return {"subscriptions": []}

    messages = await fetch_messages(access_token, message_ids, include_body=True)
    email_dicts = [_format_gmail_message(m) for m in messages]

    subscriptions = await asyncio.to_thread(detect_subscriptions, email_dicts)
    return {"subscriptions": subscriptions}
