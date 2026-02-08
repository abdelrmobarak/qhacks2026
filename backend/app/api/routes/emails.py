"""Email endpoints: recent emails, TLDR digest, reply generation & sending."""

from __future__ import annotations

import asyncio
import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import require_current_user
from app.db import get_db
from app.db.models import EmailCategoryCache, User
from app.services.gmail import (
    fetch_message,
    fetch_messages,
    list_messages,
    send_reply,
)
from app.services.token_manager import get_valid_access_token
from app.services.agents.email_agent import (
    categorize_emails,
    create_tldr_digest,
    generate_reply,
)

logger = logging.getLogger(__name__)

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
        "is_automated": msg.is_automated_sender,
    }


@router.get("/recent")
async def get_recent_emails(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_current_user)],
    limit: int = Query(default=20, le=50),
):
    """Fetch and categorize recent inbox emails."""
    access_token = await get_valid_access_token(user, db)
    message_refs = await list_messages(access_token, query="in:inbox newer_than:7d", max_results=limit)
    message_ids = [m["id"] for m in message_refs if isinstance(m, dict) and "id" in m]

    if not message_ids:
        return {"emails": []}

    messages = await fetch_messages(access_token, message_ids, include_body=True)
    email_dicts = [_format_gmail_message(m) for m in messages]

    cached_rows = (
        await db.execute(
            select(EmailCategoryCache).where(
                EmailCategoryCache.user_id == user.id,
                EmailCategoryCache.gmail_message_id.in_(message_ids),
            )
        )
    ).scalars().all()

    cached_by_id: dict[str, EmailCategoryCache] = {
        row.gmail_message_id: row for row in cached_rows
    }

    uncached_emails = [
        email_dict for email_dict in email_dicts
        if email_dict["message_id"] not in cached_by_id
    ]

    fresh_categories: dict[str, dict] = {}
    if uncached_emails:
        logger.info("Categorizing %d uncached emails (skipping %d cached)", len(uncached_emails), len(cached_by_id))
        categorized_new = await asyncio.to_thread(categorize_emails, uncached_emails)
        for email_item in categorized_new:
            message_id = email_item.get("message_id", "")
            fresh_categories[message_id] = email_item
            db.add(EmailCategoryCache(
                user_id=user.id,
                gmail_message_id=message_id,
                category=email_item.get("category", "informational"),
                priority=email_item.get("priority", 5),
                category_reason=email_item.get("category_reason", ""),
            ))
        await db.commit()
    else:
        logger.info("All %d emails served from cache", len(email_dicts))

    output = []
    for email_dict in email_dicts:
        message_id = email_dict["message_id"]
        if message_id in fresh_categories:
            output.append(fresh_categories[message_id])
        elif message_id in cached_by_id:
            cached_row = cached_by_id[message_id]
            output.append({
                **email_dict,
                "category": cached_row.category,
                "priority": cached_row.priority,
                "category_reason": cached_row.category_reason or "",
            })
        else:
            output.append({**email_dict, "category": "informational", "priority": 5, "category_reason": ""})

    return {"emails": output}


@router.get("/tldr")
async def get_tldr_digest(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_current_user)],
):
    """Generate a TLDR digest of important recent emails."""
    access_token = await get_valid_access_token(user, db)
    message_refs = await list_messages(
        access_token,
        query="in:inbox newer_than:3d -category:promotions",
        max_results=30,
    )
    message_ids = [m["id"] for m in message_refs if isinstance(m, dict) and "id" in m]

    if not message_ids:
        return {"summary": "No recent emails.", "highlights": []}

    messages = await fetch_messages(access_token, message_ids, include_body=True)
    email_dicts = [
        _format_gmail_message(m)
        for m in messages
        if not m.is_automated_sender
    ]

    digest = await asyncio.to_thread(create_tldr_digest, email_dicts)
    return digest


class ReplyRequest(BaseModel):
    message_id: str
    thread_id: Optional[str] = None
    to: str
    subject: str
    body: str = ""
    generate: bool = False


@router.post("/reply")
async def handle_reply(
    request: ReplyRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_current_user)],
):
    """Generate a reply suggestion (generate=true) or send a reply."""
    access_token = await get_valid_access_token(user, db)

    if request.generate:
        original = await fetch_message(access_token, request.message_id, include_body=True)
        if not original:
            return {"error": "Message not found"}
        email_data = _format_gmail_message(original)
        suggestion = await asyncio.to_thread(generate_reply, email_data, user.name or user.email)
        return {"generated": True, "suggestion": suggestion}

    # Send the reply
    result = await send_reply(
        access_token,
        to=request.to,
        subject=request.subject,
        body=request.body,
        in_reply_to=request.message_id,
        thread_id=request.thread_id,
    )
    return {"sent": True, "message_id": result.get("id")}
