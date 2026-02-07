"""Token manager for persistent OAuth access.

Provides a single function to get a valid access token for a user,
auto-refreshing when expired.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decrypt_token, encrypt_token
from app.db.models import User
from app.services.google_oauth import refresh_access_token


async def get_valid_access_token(user: User, db: AsyncSession) -> str:
    """Get a fresh access token, refreshing via Google OAuth if needed."""
    # Check if current token is still valid (with 5-min buffer)
    if user.access_token_encrypted and user.token_expiry:
        if user.token_expiry > datetime.now(timezone.utc) + timedelta(minutes=5):
            token = decrypt_token(user.access_token_encrypted)
            if token:
                return token

    # Need to refresh
    if not user.refresh_token_encrypted:
        raise HTTPException(status_code=401, detail="No refresh token. Please re-authenticate.")

    refresh_token = decrypt_token(user.refresh_token_encrypted)
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Failed to decrypt refresh token.")

    tokens = await refresh_access_token(refresh_token)
    user.access_token_encrypted = encrypt_token(tokens.access_token)
    user.token_expiry = datetime.now(timezone.utc) + timedelta(seconds=tokens.expires_in)
    await db.commit()
    return tokens.access_token
