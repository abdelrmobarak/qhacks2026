from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import (
    agent,
    auth,
    calendar_routes,
    emails,
    health,
    network,
    openclaw,
    privacy,
    reports,
    subscriptions,
    todos,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(privacy.router, prefix="/v1", tags=["privacy"])
api_router.include_router(emails.router, prefix="/emails", tags=["emails"])
api_router.include_router(
    subscriptions.router, prefix="/subscriptions", tags=["subscriptions"]
)
api_router.include_router(
    calendar_routes.router, prefix="/calendar", tags=["calendar"]
)
api_router.include_router(agent.router, prefix="/agent", tags=["agent"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(todos.router, prefix="/todos", tags=["todos"])
api_router.include_router(network.router, prefix="/network", tags=["network"])
api_router.include_router(openclaw.router, prefix="/openclaw", tags=["openclaw"])
