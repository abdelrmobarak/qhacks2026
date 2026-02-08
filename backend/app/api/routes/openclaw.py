from __future__ import annotations

import asyncio
import secrets
from datetime import datetime
from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes import calendar_routes, emails, todos
from app.core.env import load_settings
from app.db import get_db
from app.db.models import User
from app.services.gmail import fetch_message, send_reply
from app.services.token_manager import get_valid_access_token
from app.services.agents.email_agent import generate_reply

router = APIRouter()
settings = load_settings()


def _is_localhost(request: Request) -> bool:
    if request.client is None:
        return False
    return request.client.host in ("127.0.0.1", "::1")


def _normalize_email_category(category: str) -> str:
    return category.strip().lower().replace("-", "_").replace(" ", "_")


async def require_openclaw_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    authorization: Annotated[Optional[str], Header()] = None,
) -> User:
    if not _is_localhost(request):
        raise HTTPException(status_code=403, detail="OpenClaw bridge is only available on localhost")

    if not settings.openclaw_api_key:
        raise HTTPException(status_code=503, detail="OPENCLAW_API_KEY is not configured on the backend")

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization: Bearer <OPENCLAW_API_KEY>")

    provided_api_key = authorization.removeprefix("Bearer ").strip()
    if not secrets.compare_digest(provided_api_key, settings.openclaw_api_key):
        raise HTTPException(status_code=401, detail="Invalid OpenClaw API key")

    if not settings.openclaw_user_email:
        raise HTTPException(status_code=503, detail="OPENCLAW_USER_EMAIL is not configured on the backend")

    result = await db.execute(select(User).where(User.email == settings.openclaw_user_email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=404,
            detail=(
                "OpenClaw user not found. Sign in once via the app OAuth flow to create the user, "
                "or update OPENCLAW_USER_EMAIL."
            ),
        )

    return user


@router.get("/health")
async def openclaw_health(
    _: Annotated[User, Depends(require_openclaw_user)],
) -> dict[str, str]:
    return {"status": "ok"}


@router.post("/emails/tldr")
async def openclaw_emails_tldr(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_openclaw_user)],
) -> dict:
    return await emails.get_tldr_digest(db=db, user=user)


class OpenClawInboxListRequest(BaseModel):
    category: Optional[str] = None
    limit: int = Field(default=20, ge=1, le=50)


@router.post("/inbox/list")
async def openclaw_inbox_list(
    body: OpenClawInboxListRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_openclaw_user)],
) -> dict:
    result = await emails.get_recent_emails(db=db, user=user, limit=body.limit)

    category = _normalize_email_category(body.category or "")
    if not category:
        return result

    emails_list = result.get("emails", [])
    filtered = [
        email_item
        for email_item in emails_list
        if _normalize_email_category(str(email_item.get("category", ""))) == category
    ]
    return {"emails": filtered}


class OpenClawDraftReplyRequest(BaseModel):
    message_id: str


@router.post("/reply/draft")
async def openclaw_reply_draft(
    body: OpenClawDraftReplyRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_openclaw_user)],
) -> dict:
    access_token = await get_valid_access_token(user, db)
    original = await fetch_message(access_token, body.message_id, include_body=True)
    if not original:
        raise HTTPException(status_code=404, detail="Message not found")

    email_data = emails._format_gmail_message(original)
    suggestion = await asyncio.to_thread(generate_reply, email_data, user.name or user.email)
    return {"generated": True, "suggestion": suggestion}


class OpenClawSendReplyRequest(BaseModel):
    message_id: str
    thread_id: Optional[str] = None
    to: str
    subject: str
    body: str


@router.post("/reply/send")
async def openclaw_reply_send(
    body: OpenClawSendReplyRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_openclaw_user)],
) -> dict:
    access_token = await get_valid_access_token(user, db)
    result = await send_reply(
        access_token,
        to=body.to,
        subject=body.subject,
        body=body.body,
        in_reply_to=body.message_id,
        thread_id=body.thread_id,
    )
    return {"sent": True, "message_id": result.get("id")}


class OpenClawCalendarCreateRequest(BaseModel):
    summary: str
    start: datetime
    end: datetime
    description: Optional[str] = None
    location: Optional[str] = None


@router.post("/calendar/create")
async def openclaw_calendar_create(
    body: OpenClawCalendarCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_openclaw_user)],
) -> dict:
    request = calendar_routes.CreateEventRequest(
        summary=body.summary,
        start=body.start,
        end=body.end,
        description=body.description,
        location=body.location,
    )
    return await calendar_routes.create_calendar_event(request=request, db=db, user=user)


@router.get("/tasks/list")
async def openclaw_tasks_list(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_openclaw_user)],
) -> list[todos.TodoResponse]:
    return await todos.get_todos(db=db, user=user)


class OpenClawTaskCompleteRequest(BaseModel):
    completed: bool = True


@router.patch("/tasks/{todo_id}")
async def openclaw_tasks_update(
    todo_id: UUID,
    body: OpenClawTaskCompleteRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_openclaw_user)],
) -> todos.TodoResponse:
    request = todos.TodoUpdateRequest(completed=body.completed)
    return await todos.update_todo(todo_id=todo_id, body=request, db=db, user=user)
