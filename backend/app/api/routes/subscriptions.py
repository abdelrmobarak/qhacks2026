"""Subscription tracking endpoints."""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import require_current_user
from app.db import get_db
from app.db.models import EmailCategoryCache, SubscriptionCache, User
from app.services.gmail import fetch_messages, list_messages
from app.services.token_manager import get_valid_access_token
from app.services.agents.email_agent import categorize_emails, detect_subscriptions

logger = logging.getLogger(__name__)

SUBSCRIPTION_CACHE_TTL = timedelta(hours=6)

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
    cached_row = (
        await db.execute(
            select(SubscriptionCache).where(SubscriptionCache.user_id == user.id)
        )
    ).scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if cached_row and (now - cached_row.cached_at) < SUBSCRIPTION_CACHE_TTL:
        logger.info("Returning cached subscriptions for user %s", user.id)
        return {"subscriptions": json.loads(cached_row.result_json)}

    access_token = await get_valid_access_token(user, db)

    already_tagged_rows = (
        await db.execute(
            select(EmailCategoryCache).where(
                EmailCategoryCache.user_id == user.id,
                EmailCategoryCache.category == "subscription",
            )
        )
    ).scalars().all()
    tagged_ids = {row.gmail_message_id for row in already_tagged_rows}

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
    keyword_ids = {m["id"] for m in message_refs if isinstance(m, dict) and "id" in m}

    all_message_ids = list(tagged_ids | keyword_ids)

    if not all_message_ids:
        return {"subscriptions": []}

    messages = await fetch_messages(access_token, all_message_ids, include_body=True)
    email_dicts = [_format_gmail_message(m) for m in messages]

    fetched_ids = [email_dict["message_id"] for email_dict in email_dicts]
    cached_category_rows = (
        await db.execute(
            select(EmailCategoryCache).where(
                EmailCategoryCache.user_id == user.id,
                EmailCategoryCache.gmail_message_id.in_(fetched_ids),
            )
        )
    ).scalars().all()

    cached_by_id: dict[str, EmailCategoryCache] = {
        row.gmail_message_id: row for row in cached_category_rows
    }

    uncached_emails = [
        email_dict for email_dict in email_dicts
        if email_dict["message_id"] not in cached_by_id
    ]

    fresh_categories: dict[str, dict] = {}
    if uncached_emails:
        logger.info("Categorizing %d emails for subscription detection", len(uncached_emails))
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

    subscription_emails = []
    for email_dict in email_dicts:
        message_id = email_dict["message_id"]
        if message_id in fresh_categories:
            if fresh_categories[message_id].get("category") == "subscription":
                subscription_emails.append(fresh_categories[message_id])
        elif message_id in cached_by_id:
            if cached_by_id[message_id].category == "subscription":
                subscription_emails.append(email_dict)

    if not subscription_emails:
        return {"subscriptions": []}

    subscriptions = await asyncio.to_thread(detect_subscriptions, subscription_emails)

    result_json = json.dumps(subscriptions)
    if cached_row:
        cached_row.result_json = result_json
        cached_row.cached_at = now
    else:
        db.add(SubscriptionCache(
            user_id=user.id,
            result_json=result_json,
            cached_at=now,
        ))
    await db.commit()

    return {"subscriptions": subscriptions}
