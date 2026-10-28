from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.db.models import InventoryTelemetryModel
from app.schemas.supply_chain import InventoryTelemetrySchema, TopSKUItem

router = APIRouter(tags=["Inventory"])


@router.get("/inventory", response_model=List[InventoryTelemetrySchema])
def get_inventory(db: Session = Depends(get_db)):
    """Retrieve regional buffer depot stock levels, runaways, and critical SKUs."""
    items = db.query(InventoryTelemetryModel).all()
    return [
        InventoryTelemetrySchema(
            hub_id=item.hub_id,
            hub_name=item.hub_name,
            region=item.region,
            current_stock_units=item.current_stock_units,
            max_stock_units=item.max_stock_units,
            stockout_risk_days=item.stockout_risk_days,
            health_status=item.health_status,
            top_skus=[TopSKUItem(**sku) for sku in item.top_skus]
        )
        for item in items
    ]
