"""Daily report endpoint."""

from __future__ import annotations

import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import require_current_user
from app.db import get_db
from app.db.models import Todo, User
from app.services.gmail import fetch_messages, list_messages
from app.services.token_manager import get_valid_access_token
from app.services.agents.email_agent import categorize_emails, generate_daily_report

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


@router.get("/daily")
async def get_daily_report(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_current_user)],
) -> dict:
    """Generate a daily report from recent emails and todos."""
    access_token = await get_valid_access_token(user, db)

    message_refs = await list_messages(
        access_token, query="in:inbox newer_than:1d", max_results=50
    )
    msg_ids = [m["id"] for m in message_refs if isinstance(m, dict) and "id" in m]

    if msg_ids:
        messages = await fetch_messages(access_token, msg_ids, include_body=True)
        email_dicts = [_format_gmail_message(m) for m in messages]
        categorized = await asyncio.to_thread(categorize_emails, email_dicts)
    else:
        categorized = []

    todo_result = await db.execute(
        select(Todo)
        .where(Todo.user_id == user.id)
        .order_by(Todo.priority, Todo.created_at.desc())
    )
    todos = [
        {
            "text": todo.text,
            "completed": todo.completed,
            "source": todo.source,
            "priority": todo.priority,
        }
        for todo in todo_result.scalars().all()
    ]

    report = await asyncio.to_thread(generate_daily_report, categorized, todos)
    return report
