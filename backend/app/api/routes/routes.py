from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.db.models import SupplyRouteModel
from app.schemas.supply_chain import SupplyRouteSchema

router = APIRouter(prefix="/network", tags=["Network Routes"])


@router.get("/routes", response_model=List[SupplyRouteSchema])
def get_supply_routes(db: Session = Depends(get_db)):
    """Retrieve all transit routes and live lane states."""
    routes = db.query(SupplyRouteModel).all()
    return [
        SupplyRouteSchema(
            id=r.id,
            source_id=r.source_id,
            target_id=r.target_id,
            state=r.state,
            cargo_type=r.cargo_type,
            volume_teu=r.volume_teu,
            transit_hours=r.transit_hours,
            transit_progress_pct=r.transit_progress_pct,
            is_rerouted=r.is_rerouted,
            congested_reason=r.congested_reason
        )
        for r in routes
    ]
