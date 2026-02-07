from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import (
    agent,
    auth,
    billing,
    calendar_routes,
    crm,
    emails,
    health,
    privacy,
    snapshot,
    subscriptions,
    wrapped,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(snapshot.router, prefix="/snapshot", tags=["snapshot"])
api_router.include_router(wrapped.router, tags=["wrapped"])
api_router.include_router(crm.router, prefix="/crm", tags=["crm"])
api_router.include_router(billing.router, prefix="/billing", tags=["billing"])
api_router.include_router(privacy.router, prefix="/v1", tags=["privacy"])
api_router.include_router(emails.router, prefix="/emails", tags=["emails"])
api_router.include_router(subscriptions.router, prefix="/subscriptions", tags=["subscriptions"])
api_router.include_router(calendar_routes.router, prefix="/calendar", tags=["calendar"])
api_router.include_router(agent.router, prefix="/agent", tags=["agent"])
