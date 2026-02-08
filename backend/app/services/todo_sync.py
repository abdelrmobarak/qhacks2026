"""Background task that periodically syncs todos from new emails."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decrypt_token, encrypt_token
from app.db.engine import async_session_maker
from app.db.models import Todo, User
from app.services.agents.email_agent import extract_todos
from app.services.gmail import fetch_messages, list_messages
from app.services.google_oauth import refresh_access_token

logger = logging.getLogger(__name__)

SYNC_INTERVAL_SECONDS = 15 * 60


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


async def _get_access_token_for_background(user: User, db: AsyncSession) -> str | None:
    """Get a valid access token without raising HTTP exceptions."""
    if user.access_token_encrypted and user.token_expiry:
        if user.token_expiry > datetime.now(timezone.utc) + timedelta(minutes=5):
            token = decrypt_token(user.access_token_encrypted)
            if token:
                return token

    if not user.refresh_token_encrypted:
        return None

    refresh_token = decrypt_token(user.refresh_token_encrypted)
    if not refresh_token:
        return None

    try:
        tokens = await refresh_access_token(refresh_token)
        user.access_token_encrypted = encrypt_token(tokens.access_token)
        user.token_expiry = datetime.now(timezone.utc) + timedelta(seconds=tokens.expires_in)
        await db.commit()
        return tokens.access_token
    except Exception:
        logger.warning("Failed to refresh token for user %s", user.id)
        return None


async def _sync_todos_for_user(user: User, db: AsyncSession) -> None:
    """Fetch new emails for a user and create todos from unseen messages."""
    access_token = await _get_access_token_for_background(user, db)
    if not access_token:
        return

    message_refs = await list_messages(
        access_token, query="in:inbox newer_than:1d -category:promotions", max_results=20
    )
    msg_ids = [m["id"] for m in message_refs if isinstance(m, dict) and "id" in m]
    if not msg_ids:
        return

    existing_result = await db.execute(
        select(Todo.message_id)
        .where(Todo.user_id == user.id, Todo.message_id.isnot(None))
    )
    existing_message_ids = {row[0] for row in existing_result.all()}

    new_msg_ids = [mid for mid in msg_ids if mid not in existing_message_ids]
    if not new_msg_ids:
        return

    messages = await fetch_messages(access_token, new_msg_ids, include_body=True)
    email_dicts = [_format_gmail_message(m) for m in messages if not m.is_automated_sender]
    if not email_dicts:
        return

    todos_result = await asyncio.to_thread(extract_todos, email_dicts)
    raw_todos = todos_result.get("todos", [])

    for raw_todo in raw_todos:
        message_id = raw_todo.get("message_id")
        if message_id and message_id in existing_message_ids:
            continue

        todo = Todo(
            user_id=user.id,
            text=str(raw_todo.get("text", "")),
            message_id=message_id,
            source=raw_todo.get("source"),
            link=raw_todo.get("link"),
            priority=raw_todo.get("priority", 3),
        )
        db.add(todo)

    await db.commit()
    logger.info("Synced %d new todos for user %s", len(raw_todos), user.id)


async def run_todo_sync_loop() -> None:
    """Periodically sync todos for all authenticated users."""
    logger.info("Todo sync background task started (interval=%ds)", SYNC_INTERVAL_SECONDS)

    while True:
        await asyncio.sleep(SYNC_INTERVAL_SECONDS)

        try:
            async with async_session_maker() as db:
                result = await db.execute(
                    select(User).where(User.refresh_token_encrypted.isnot(None))
                )
                users = result.scalars().all()

                for user in users:
                    try:
                        await _sync_todos_for_user(user, db)
                    except Exception:
                        logger.exception("Todo sync failed for user %s", user.id)
        except Exception:
            logger.exception("Todo sync loop iteration failed")
