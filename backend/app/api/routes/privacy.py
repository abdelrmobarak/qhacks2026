from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import require_current_user, SESSION_COOKIE_NAME
from app.db import get_db
from app.db.models import User

router = APIRouter()


class DeleteResponse(BaseModel):
    deleted: bool


@router.delete("/me", response_model=DeleteResponse)
async def delete_me(
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_current_user)],
) -> DeleteResponse:
    """Delete all user data including sessions."""
    await db.delete(user)
    await db.commit()

    response.delete_cookie(SESSION_COOKIE_NAME)

    return DeleteResponse(deleted=True)
