from app.config.settings import settings


def get_health_status() -> dict:
    return {
        "status": "healthy",
        "version": settings.app_version,
    }
