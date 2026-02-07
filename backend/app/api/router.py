from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import auth, billing, crm, health, privacy, snapshot, wrapped

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(snapshot.router, prefix="/snapshot", tags=["snapshot"])
api_router.include_router(wrapped.router, tags=["wrapped"])
api_router.include_router(crm.router, prefix="/crm", tags=["crm"])
api_router.include_router(billing.router, prefix="/billing", tags=["billing"])
api_router.include_router(privacy.router, prefix="/v1", tags=["privacy"])
