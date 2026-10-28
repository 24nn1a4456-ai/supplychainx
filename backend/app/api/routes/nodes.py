from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.db.models import SupplyNodeModel
from app.schemas.supply_chain import SupplyNodeSchema

router = APIRouter(prefix="/network", tags=["Network Nodes"])


@router.get("/nodes", response_model=List[SupplyNodeSchema])
def get_supply_nodes(db: Session = Depends(get_db)):
    """Retrieve all multi-echelon network nodes (suppliers, factories, warehouses, DCs, customers)."""
    nodes = db.query(SupplyNodeModel).all()
    # Map database attributes to schema
    return [
        SupplyNodeSchema(
            id=n.id,
            name=n.name,
            type=n.type,
            status=n.status,
            is_critical_outage=n.is_critical_outage,
            region=n.region,
            location=n.location,
            position_3d=tuple(n.position_3d),
            position_2d=tuple(n.position_2d),
            throughput_per_day=n.throughput_per_day,
            capacity_utilization_pct=n.capacity_utilization_pct,
            inventory_level_pct=n.inventory_level_pct,
            lead_time_days=n.lead_time_days,
            active_shipments_count=n.active_shipments_count,
            primary_product=n.primary_product,
            disruption_cause=n.disruption_cause,
            estimated_recovery_hours=n.estimated_recovery_hours,
            contact_lead=n.contact_lead
        )
        for n in nodes
    ]


@router.get("/suppliers", response_model=List[SupplyNodeSchema])
def get_suppliers(db: Session = Depends(get_db)):
    """Retrieve only supplier echelon nodes."""
    suppliers = db.query(SupplyNodeModel).filter(SupplyNodeModel.type == 'supplier').all()
    return [
        SupplyNodeSchema(
            id=n.id,
            name=n.name,
            type=n.type,
            status=n.status,
            is_critical_outage=n.is_critical_outage,
            region=n.region,
            location=n.location,
            position_3d=tuple(n.position_3d),
            position_2d=tuple(n.position_2d),
            throughput_per_day=n.throughput_per_day,
            capacity_utilization_pct=n.capacity_utilization_pct,
            inventory_level_pct=n.inventory_level_pct,
            lead_time_days=n.lead_time_days,
            active_shipments_count=n.active_shipments_count,
            primary_product=n.primary_product,
            disruption_cause=n.disruption_cause,
            estimated_recovery_hours=n.estimated_recovery_hours,
            contact_lead=n.contact_lead
        )
        for n in suppliers
    ]
