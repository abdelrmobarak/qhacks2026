from fastapi import APIRouter

from app.controllers.health_controller import check_health
from app.models.health import HealthResponse

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("", response_model=HealthResponse)
def health_check():
    return check_health()
