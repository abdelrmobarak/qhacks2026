"""Todo CRUD endpoints with LLM-powered generation."""

from __future__ import annotations

import asyncio
from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete as sa_delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import require_current_user
from app.db import get_db
from app.db.models import Todo, User
from app.services.gmail import fetch_messages, list_messages
from app.services.token_manager import get_valid_access_token
from app.services.agents.email_agent import extract_todos

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


class TodoResponse(BaseModel):
    id: UUID
    text: str
    source: Optional[str]
    link: Optional[str]
    priority: int
    completed: bool

    class Config:
        from_attributes = True


class TodoUpdateRequest(BaseModel):
    completed: Optional[bool] = None
    text: Optional[str] = None


@router.get("/")
async def get_todos(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_current_user)],
) -> list[TodoResponse]:
    """Get all todos for the current user."""
    result = await db.execute(
        select(Todo)
        .where(Todo.user_id == user.id)
        .order_by(Todo.completed, Todo.priority, Todo.created_at.desc())
    )
    todos = result.scalars().all()
    return [TodoResponse.model_validate(todo) for todo in todos]


@router.post("/generate")
async def generate_todos(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_current_user)],
) -> list[TodoResponse]:
    """Generate todos from emails via LLM and persist them. Replaces only non-completed todos."""
    access_token = await get_valid_access_token(user, db)

    message_refs = await list_messages(
        access_token, query="in:inbox newer_than:7d -category:promotions", max_results=40
    )
    msg_ids = [m["id"] for m in message_refs if isinstance(m, dict) and "id" in m]

    if not msg_ids:
        return []

    messages = await fetch_messages(access_token, msg_ids, include_body=True)
    email_dicts = [_format_gmail_message(m) for m in messages if not m.is_automated_sender]
    todos_result = await asyncio.to_thread(extract_todos, email_dicts)

    raw_todos = todos_result.get("todos", [])

    await db.execute(
        sa_delete(Todo).where(Todo.user_id == user.id, Todo.completed == False)  # noqa: E712
    )

    new_todos = []
    for raw_todo in raw_todos:
        todo = Todo(
            user_id=user.id,
            text=str(raw_todo.get("text", "")),
            message_id=raw_todo.get("message_id"),
            source=raw_todo.get("source"),
            link=raw_todo.get("link"),
            priority=raw_todo.get("priority", 3),
        )
        db.add(todo)
        new_todos.append(todo)

    await db.commit()

    for todo in new_todos:
        await db.refresh(todo)

    all_result = await db.execute(
        select(Todo)
        .where(Todo.user_id == user.id)
        .order_by(Todo.completed, Todo.priority, Todo.created_at.desc())
    )
    all_todos = all_result.scalars().all()
    return [TodoResponse.model_validate(todo) for todo in all_todos]


@router.patch("/{todo_id}")
async def update_todo(
    todo_id: UUID,
    body: TodoUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_current_user)],
) -> TodoResponse:
    """Update a todo (toggle completion, edit text)."""
    result = await db.execute(
        select(Todo).where(Todo.id == todo_id, Todo.user_id == user.id)
    )
    todo = result.scalar_one_or_none()

    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")

    if body.completed is not None:
        todo.completed = body.completed
    if body.text is not None:
        todo.text = body.text

    await db.commit()
    await db.refresh(todo)
    return TodoResponse.model_validate(todo)


@router.delete("/{todo_id}")
async def delete_todo(
    todo_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_current_user)],
) -> dict:
    """Delete a todo."""
    result = await db.execute(
        select(Todo).where(Todo.id == todo_id, Todo.user_id == user.id)
    )
    todo = result.scalar_one_or_none()

    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")

    await db.delete(todo)
    await db.commit()
    return {"deleted": True}
