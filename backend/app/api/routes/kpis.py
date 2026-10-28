from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import KPIModel
from app.schemas.supply_chain import KPISchema

router = APIRouter(tags=["KPIs"])


@router.get("/kpis", response_model=KPISchema)
def get_kpis(db: Session = Depends(get_db)):
    """Retrieve global supply chain resiliency and operational KPIs."""
    kpi = db.query(KPIModel).order_by(KPIModel.id.desc()).first()
    if not kpi:
        raise HTTPException(status_code=404, detail="KPI telemetry not calibrated.")

    return KPISchema(
        resiliency_index=kpi.resiliency_index,
        resiliency_delta=kpi.resiliency_delta,
        active_fleet_volume_teu=kpi.active_fleet_volume_teu,
        active_convoys_count=kpi.active_convoys_count,
        on_time_delivery_rate=kpi.on_time_delivery_rate,
        delivery_rate_delta=kpi.delivery_rate_delta,
        critical_alerts_count=kpi.critical_alerts_count,
        active_mitigations_count=kpi.active_mitigations_count,
        carbon_efficiency_score=kpi.carbon_efficiency_score
    )
