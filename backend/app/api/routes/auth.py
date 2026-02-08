from __future__ import annotations

from datetime import datetime, timedelta, timezone
import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.env import load_settings
from app.core.security import (
    create_oauth_state,
    create_session_token,
    encrypt_token,
    generate_session_expiry,
    verify_oauth_state,
    verify_session_token,
)
from app.db import get_db
from app.db.models import Session, User
from app.services.google_oauth import (
    build_auth_url,
    exchange_code_for_tokens,
    get_user_info,
)

router = APIRouter()
settings = load_settings()
logger = logging.getLogger(__name__)

SESSION_COOKIE_NAME = "sandbox_session"


# Response models
class AuthStartResponse(BaseModel):
    auth_url: str


class AuthStatusResponse(BaseModel):
    authenticated: bool
    user: Optional[dict] = None


class LogoutResponse(BaseModel):
    success: bool


# Dependencies
async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    session_cookie: Annotated[Optional[str], Cookie(alias=SESSION_COOKIE_NAME)] = None,
    x_session_token: Annotated[Optional[str], Header()] = None,
) -> Optional[User]:
    """Get the current authenticated user from session cookie or X-Session-Token header."""
    token = session_cookie or x_session_token
    if not token:
        return None

    session_id = verify_session_token(
        token,
        settings.session_secret,
        settings.session_max_age_seconds,
    )

    if not session_id:
        return None

    try:
        result = await db.execute(
            select(Session)
            .where(Session.id == session_id)
            .where(Session.expires_at > datetime.now(timezone.utc))
        )
        session = result.scalar_one_or_none()

        if not session:
            return None

        result = await db.execute(select(User).where(User.id == session.user_id))
        return result.scalar_one_or_none()
    except Exception:
        logger.exception("Failed to resolve current user from session")
        return None


async def require_current_user(
    user: Annotated[Optional[User], Depends(get_current_user)],
) -> User:
    """Require an authenticated user."""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


@router.post("/google/start", response_model=AuthStartResponse)
async def google_start() -> AuthStartResponse:
    """Start the Google OAuth flow. Returns the authorization URL to redirect to."""
    missing: list[str] = []
    if not settings.google_oauth_client_id:
        missing.append("GOOGLE_OAUTH_CLIENT_ID")
    if not settings.google_oauth_client_secret:
        missing.append("GOOGLE_OAUTH_CLIENT_SECRET")

    if missing:
        raise HTTPException(
            status_code=503,
            detail=f"Google OAuth not configured (missing: {', '.join(missing)})",
        )

    state = create_oauth_state(settings.oauth_state_secret)
    auth_url = build_auth_url(state)

    return AuthStartResponse(auth_url=auth_url)


@router.get("/google/callback")
async def google_callback(
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    code: str = Query(...),
    state: str = Query(...),
    error: Optional[str] = Query(None),
    playground_return: Annotated[Optional[str], Cookie(alias="_playground_return")] = None,
) -> dict:
    """Handle the Google OAuth callback."""
    # Check for errors from Google
    if error:
        raise HTTPException(status_code=400, detail=f"OAuth error: {error}")

    # Verify state
    if not verify_oauth_state(state, settings.oauth_state_secret):
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    # Exchange code for tokens
    try:
        tokens = await exchange_code_for_tokens(code)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Token exchange failed: {str(e)}")

    # Get user info
    try:
        user_info = await get_user_info(tokens.access_token)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to get user info: {str(e)}")

    # Find or create user
    result = await db.execute(select(User).where(User.email == user_info.email))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email=user_info.email,
            name=user_info.name,
        )
        db.add(user)
        await db.flush()

    # Store persistent tokens on user for ongoing API access
    user.refresh_token_encrypted = (
        encrypt_token(tokens.refresh_token) if tokens.refresh_token else user.refresh_token_encrypted
    )
    user.access_token_encrypted = encrypt_token(tokens.access_token)
    user.token_expiry = datetime.now(timezone.utc) + timedelta(seconds=tokens.expires_in)
    await db.flush()

    # Create session
    session = Session(
        user_id=user.id,
        expires_at=generate_session_expiry(days=7),
    )
    db.add(session)
    await db.commit()

    # Set session cookie
    session_token = create_session_token(session.id, settings.session_secret)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        httponly=True,
        secure=settings.env != "development",
        samesite="lax",
        max_age=settings.session_max_age_seconds,
    )

    frontend_url = settings.cors_origins[0] if settings.cors_origins else "http://localhost:5173"
    redirect_url = f"{frontend_url}/auth/callback?token={session_token}"

    response.status_code = 302
    response.headers["Location"] = redirect_url

    return {"status": "success", "redirect": redirect_url}


@router.get("/status", response_model=AuthStatusResponse)
async def auth_status(
    user: Annotated[Optional[User], Depends(get_current_user)],
) -> AuthStatusResponse:
    """Check authentication status."""
    if not user:
        return AuthStatusResponse(authenticated=False)

    return AuthStatusResponse(
        authenticated=True,
        user={"id": str(user.id), "email": user.email, "name": user.name},
    )


@router.post("/logout", response_model=LogoutResponse)
async def logout(
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[Optional[User], Depends(get_current_user)],
    session_cookie: Annotated[Optional[str], Cookie(alias=SESSION_COOKIE_NAME)] = None,
) -> LogoutResponse:
    """Log out the current user by deleting their session."""
    if session_cookie:
        session_id = verify_session_token(
            session_cookie,
            settings.session_secret,
            settings.session_max_age_seconds,
        )
        if session_id:
            # Delete session from DB
            result = await db.execute(select(Session).where(Session.id == session_id))
            session = result.scalar_one_or_none()
            if session:
                await db.delete(session)
                await db.commit()

    # Clear cookie
    response.delete_cookie(SESSION_COOKIE_NAME)

    return LogoutResponse(success=True)
