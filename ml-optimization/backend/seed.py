"""
seed.py — Deterministic synthetic seed data for Supply Chain X demo.

All data is SYNTHETIC. No real supplier/customer information.
Seeding is idempotent — running twice produces the same state.
"""
from __future__ import annotations

import json

from sqlalchemy.orm import Session

from .database import init_db, SessionLocal
from .models import (
    SupplierRecord, InventoryRecord, WarehouseRecord,
    DisruptionRecord, AuditEvent,
)


# ─────────────────────── Stable IDs for demo ──────────────────────

SUPPLIERS = [
    {"id": "SUP-ALPHA", "name": "Alpha Electronics (Primary PCB)", "material": "COMP-PCB-01",
     "capacity": 500, "lead_time_days": 3.0, "unit_cost": 15.0, "transport_cost": 0.0,
     "reliability_score": 0.85, "is_primary": True},
    {"id": "SUP-BETA", "name": "Beta Components (Alternative PCB)", "material": "COMP-PCB-01",
     "capacity": 200, "lead_time_days": 6.0, "unit_cost": 18.0, "transport_cost": 1.5,
     "reliability_score": 0.75},
    {"id": "SUP-GAMMA", "name": "Gamma Express (Fast PCB)", "material": "COMP-PCB-01",
     "capacity": 100, "lead_time_days": 3.0, "unit_cost": 22.0, "transport_cost": 2.0,
     "reliability_score": 0.90},
    {"id": "SUP-FAN-X", "name": "Fan Solutions Inc.", "material": "COMP-FAN-02",
     "capacity": 300, "lead_time_days": 4.0, "unit_cost": 8.0, "transport_cost": 1.0,
     "reliability_score": 0.92},
    {"id": "SUP-PSU-Y", "name": "PowerTech Supplies", "material": "COMP-PSU-03",
     "capacity": 250, "lead_time_days": 5.0, "unit_cost": 25.0, "transport_cost": 2.0,
     "reliability_score": 0.88},
]

WAREHOUSES = [
    {"id": "WH-EAST", "name": "East Distribution Center", "location": "Eastern Region",
     "capacity": 2000, "transfer_cost": 3.0, "transfer_lead_days": 1.0},
    {"id": "WH-WEST", "name": "West Distribution Center", "location": "Western Region",
     "capacity": 1500, "transfer_cost": 4.0, "transfer_lead_days": 2.0},
]

INVENTORY = [
    {"id": "INV-PCB-EAST", "material_id": "COMP-PCB-01", "warehouse_id": "WH-EAST",
     "current_qty": 120, "safety_stock": 40, "daily_demand": 30, "reorder_threshold": 60},
    {"id": "INV-PCB-WEST", "material_id": "COMP-PCB-01", "warehouse_id": "WH-WEST",
     "current_qty": 80, "safety_stock": 20, "daily_demand": 15, "reorder_threshold": 40},
    {"id": "INV-FAN-EAST", "material_id": "COMP-FAN-02", "warehouse_id": "WH-EAST",
     "current_qty": 200, "safety_stock": 30, "daily_demand": 20, "reorder_threshold": 50},
    {"id": "INV-PSU-EAST", "material_id": "COMP-PSU-03", "warehouse_id": "WH-EAST",
     "current_qty": 90, "safety_stock": 20, "daily_demand": 10, "reorder_threshold": 30},
]


def seed_database(db: Session) -> dict:
    """
    Insert deterministic synthetic data. Idempotent — skips rows that already exist.
    Returns counts of inserted records.
    """
    counts = {"suppliers": 0, "warehouses": 0, "inventory": 0}

    # Suppliers
    for s in SUPPLIERS:
        if not db.get(SupplierRecord, s["id"]):
            db.add(SupplierRecord(**s, is_synthetic=True))
            counts["suppliers"] += 1

    # Warehouses
    for w in WAREHOUSES:
        if not db.get(WarehouseRecord, w["id"]):
            db.add(WarehouseRecord(**w, is_synthetic=True))
            counts["warehouses"] += 1

    # Inventory
    for inv in INVENTORY:
        if not db.get(InventoryRecord, inv["id"]):
            db.add(InventoryRecord(**inv, is_synthetic=True))
            counts["inventory"] += 1

    db.commit()

    # Audit
    db.add(AuditEvent(
        event_type="database_seeded",
        entity_id="system",
        actor="seed_script",
        details_json=json.dumps({"counts": counts, "note": "All data is SYNTHETIC"}),
    ))
    db.commit()

    return counts


def init_and_seed():
    """Initialize DB and seed — for CLI / app startup."""
    init_db()
    db = SessionLocal()
    try:
        counts = seed_database(db)
        return counts
    finally:
        db.close()
