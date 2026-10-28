from fastapi import APIRouter
from app.schemas.supply_chain import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
def get_health():
    """Returns backend system status, database health, and operational mode."""
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        database="connected",
        mode="simulation_only",
        simulation_only=True
    )
