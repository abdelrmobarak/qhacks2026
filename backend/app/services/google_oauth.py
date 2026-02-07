from __future__ import annotations

from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlencode

import httpx

from app.core.env import load_settings

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"


@dataclass
class GoogleTokens:
    access_token: str
    refresh_token: Optional[str]
    expires_in: int
    token_type: str
    scope: str


@dataclass
class GoogleUserInfo:
    id: str
    email: str
    name: Optional[str]
    picture: Optional[str]


def build_auth_url(state: str) -> str:
    """Build the Google OAuth authorization URL."""
    settings = load_settings()

    params = {
        "client_id": settings.google_oauth_client_id,
        "redirect_uri": settings.google_oauth_redirect_uri,
        "response_type": "code",
        "scope": " ".join(settings.google_oauth_scopes),
        "state": state,
        "access_type": "offline",
        "prompt": "consent",  # Force consent to get refresh token
    }

    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


async def exchange_code_for_tokens(code: str) -> GoogleTokens:
    """Exchange authorization code for access and refresh tokens."""
    settings = load_settings()

    data = {
        "client_id": settings.google_oauth_client_id,
        "client_secret": settings.google_oauth_client_secret,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": settings.google_oauth_redirect_uri,
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(GOOGLE_TOKEN_URL, data=data)
        response.raise_for_status()
        token_data = response.json()

    return GoogleTokens(
        access_token=token_data["access_token"],
        refresh_token=token_data.get("refresh_token"),
        expires_in=token_data["expires_in"],
        token_type=token_data["token_type"],
        scope=token_data["scope"],
    )


async def refresh_access_token(refresh_token: str) -> GoogleTokens:
    """Refresh an expired access token."""
    settings = load_settings()

    data = {
        "client_id": settings.google_oauth_client_id,
        "client_secret": settings.google_oauth_client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(GOOGLE_TOKEN_URL, data=data)
        response.raise_for_status()
        token_data = response.json()

    return GoogleTokens(
        access_token=token_data["access_token"],
        refresh_token=refresh_token,  # Refresh token stays the same
        expires_in=token_data["expires_in"],
        token_type=token_data["token_type"],
        scope=token_data.get("scope", ""),
    )


async def get_user_info(access_token: str) -> GoogleUserInfo:
    """Fetch user info from Google."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        response.raise_for_status()
        data = response.json()

    return GoogleUserInfo(
        id=data["id"],
        email=data["email"],
        name=data.get("name"),
        picture=data.get("picture"),
    )


async def revoke_token(token: str) -> bool:
    """Revoke a Google OAuth token."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                GOOGLE_REVOKE_URL,
                params={"token": token},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            return response.status_code == 200
    except Exception:
        return False
