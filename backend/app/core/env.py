from __future__ import annotations

import os
from dataclasses import dataclass, field
import base64
import hashlib
from pathlib import Path

try:
    from dotenv import load_dotenv
except Exception:  # pragma: no cover
    load_dotenv = None


def _split_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    env: str
    cors_origins: list[str]

    # Database
    database_url: str

    # Redis (used by rate limiter)
    redis_url: str

    # Secrets
    session_secret: str
    oauth_state_secret: str
    token_encryption_key: str

    # Google OAuth
    google_oauth_client_id: str
    google_oauth_client_secret: str
    google_oauth_redirect_uri: str
    google_oauth_scopes: list[str]

    # LLM
    llm_provider: str
    llm_model: str
    llm_reasoning_effort: str
    openai_api_key: str
    openrouter_api_key: str

    # Gradium (STT)
    gradium_api_key: str

    # Session settings
    session_max_age_seconds: int = field(default=60 * 60 * 24 * 7)  # 7 days


_CACHED_SETTINGS: Settings | None = None
_ENV_LOADED = False


def _load_env_once() -> None:
    """Load env vars from repo files for all entrypoints (api, worker, scripts)."""
    global _ENV_LOADED
    if _ENV_LOADED:
        return
    _ENV_LOADED = True

    if load_dotenv is None:
        return

    backend_env = Path(__file__).resolve().parents[2] / ".env"  # backend/.env
    repo_root_env = Path(__file__).resolve().parents[3] / ".env"  # repo/.env

    if backend_env.exists():
        load_dotenv(backend_env, override=False)

        # In dev, prefer backend/.env over empty shell exports.
        if os.getenv("ENV", "development") == "development":
            if not os.getenv("GOOGLE_OAUTH_CLIENT_ID") or not os.getenv(
                "GOOGLE_OAUTH_CLIENT_SECRET"
            ):
                load_dotenv(backend_env, override=True)

    if repo_root_env.exists():
        load_dotenv(repo_root_env, override=False)


def _derive_fernet_key(seed: str) -> str:
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest).decode("utf-8")


def load_settings() -> Settings:
    _load_env_once()

    global _CACHED_SETTINGS
    if _CACHED_SETTINGS is not None:
        return _CACHED_SETTINGS

    env = os.getenv("ENV", "development")
    cors_origins = _split_csv(
        os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
        )
    )

    session_secret = os.getenv("SESSION_SECRET", "change-me-in-production")
    oauth_state_secret = os.getenv("OAUTH_STATE_SECRET", "change-me-in-production")

    token_encryption_key = os.getenv("TOKEN_ENCRYPTION_KEY", "")
    if not token_encryption_key:
        token_encryption_key = _derive_fernet_key(session_secret)

    settings = Settings(
        env=env,
        cors_origins=cors_origins,
        # Database
        database_url=os.getenv(
            "DATABASE_URL",
            "postgresql+asyncpg://postgres:postgres@localhost:5432/sandbox",
        ),
        # Redis
        redis_url=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
        # Secrets
        session_secret=session_secret,
        oauth_state_secret=oauth_state_secret,
        token_encryption_key=token_encryption_key,
        # Google OAuth
        google_oauth_client_id=os.getenv("GOOGLE_OAUTH_CLIENT_ID", ""),
        google_oauth_client_secret=os.getenv("GOOGLE_OAUTH_CLIENT_SECRET", ""),
        google_oauth_redirect_uri=os.getenv(
            "GOOGLE_OAUTH_REDIRECT_URI", "http://localhost:8000/auth/google/callback"
        ),
        google_oauth_scopes=_split_csv(
            os.getenv(
                "GOOGLE_OAUTH_SCOPES",
                "openid,email,profile,"
                "https://www.googleapis.com/auth/gmail.readonly,"
                "https://www.googleapis.com/auth/gmail.send,"
                "https://www.googleapis.com/auth/calendar.readonly,"
                "https://www.googleapis.com/auth/calendar.events",
            )
        ),
        # LLM
        llm_provider=os.getenv("LLM_PROVIDER", "openai"),
        llm_model=os.getenv("LLM_MODEL", "gpt-4o-mini"),
        llm_reasoning_effort=os.getenv("LLM_REASONING_EFFORT", "medium"),
        openai_api_key=os.getenv("OPENAI_API_KEY", ""),
        openrouter_api_key=os.getenv("OPENROUTER_API_KEY", ""),
        gradium_api_key=os.getenv("GRADIUM_API_KEY", ""),
    )

    _CACHED_SETTINGS = settings
    return settings
