from app.models.health import HealthResponse
from app.services.health_service import get_health_status


def check_health() -> HealthResponse:
    data = get_health_status()
    return HealthResponse(**data)
