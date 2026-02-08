from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.env import load_settings


def _load_env() -> None:
    # Prefer `backend/.env` regardless of where uvicorn is started.
    backend_env = Path(__file__).resolve().parents[1] / ".env"
    repo_root_env = Path(__file__).resolve().parents[2] / ".env"

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


_load_env()
settings = load_settings()

from app.api.router import api_router
from app.middleware.rate_limit import RateLimitMiddleware
from app.services.todo_sync import run_todo_sync_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    sync_task = asyncio.create_task(run_todo_sync_loop())
    yield
    sync_task.cancel()

    from app.db.engine import engine
    await engine.dispose()


app = FastAPI(
    title="SaturdAI API",
    description="Personal AI assistant for email, calendar, and more",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS must wrap other middleware so headers apply to error responses too.
# In Starlette/FastAPI, middleware order is the order added: earlier = outermost.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting (60 requests/min, 1000 requests/hour per client)
app.add_middleware(
    RateLimitMiddleware,
    requests_per_minute=60,
    requests_per_hour=1000,
)

app.include_router(api_router)
