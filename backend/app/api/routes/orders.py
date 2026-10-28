from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.db.models import CustomerOrderModel
from app.schemas.supply_chain import CustomerOrderSchema

router = APIRouter(tags=["Orders"])


@router.get("/orders", response_model=List[CustomerOrderSchema])
def get_customer_orders(db: Session = Depends(get_db)):
    """Retrieve active enterprise customer orders with contractual SLA risk tiers."""
    orders = db.query(CustomerOrderModel).all()
    return [
        CustomerOrderSchema(
            order_id=o.order_id,
            customer_name=o.customer_name,
            destination=o.destination,
            volume_units=o.volume_units,
            contract_value_usd=o.contract_value_usd,
            sla_deadline_hours=o.sla_deadline_hours,
            risk_tier=o.risk_tier
        )
        for o in orders
    ]
