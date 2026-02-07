from fastapi import APIRouter

from app.routes.health_routes import router as health_router

api_router = APIRouter(prefix="/api")

api_router.include_router(health_router)
