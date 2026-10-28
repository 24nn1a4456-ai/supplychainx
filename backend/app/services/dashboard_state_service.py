import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any
from sqlalchemy.orm import Session
from app.db.models import DashboardStateModel

# Load initial state from seed JSON template if present
_SEED_PATH = Path(__file__).resolve().parents[4] / "supply-chain-x" / ".supply_chain_x_db.json"
if not _SEED_PATH.is_file():
    _SEED_PATH = Path(__file__).resolve().parents[5] / "supply-chain-x" / ".supply_chain_x_db.json"


def load_initial_seed_data() -> Dict[str, Any]:
    if _SEED_PATH.is_file():
        try:
            with open(_SEED_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "suppliers" in data and "warehouses" in data:
                    return data
        except Exception:
            pass
    # Minimal fallback seed
    return {
        "suppliers": [],
        "warehouses": [],
        "inventory": [],
        "inventoryMovements": [],
        "customerOrders": [],
        "productionLines": [],
        "shipments": [],
        "crises": [],
        "agentRuns": [],
        "recoveryPlans": [],
        "verifications": [],
        "auditLogs": []
    }


def get_dashboard_state(db: Session) -> Dict[str, Any]:
    row = db.query(DashboardStateModel).filter(DashboardStateModel.id == "primary").first()
    if row is None:
        initial_data = load_initial_seed_data()
        row = DashboardStateModel(id="primary", state_json=initial_data)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row.state_json


def save_dashboard_state(db: Session, state: Dict[str, Any]) -> Dict[str, Any]:
    row = db.query(DashboardStateModel).filter(DashboardStateModel.id == "primary").first()
    if row is None:
        row = DashboardStateModel(id="primary", state_json=state)
        db.add(row)
    else:
        row.state_json = state
    db.commit()
    db.refresh(row)
    return row.state_json


def reset_dashboard_state(db: Session) -> Dict[str, Any]:
    seed = load_initial_seed_data()
    # Normalize baseline state: ensure all suppliers are active operational baseline
    for sup in seed.get("suppliers", []):
        sup["operationalStatus"] = "active"
        sup.pop("outageReason", None)
        sup.pop("outageRemainingDays", None)
    for inv in seed.get("inventory", []):
        if inv.get("sku") == "MCU-9021":
            inv["coverageDays"] = 5.2
            inv["onHandQuantity"] = 7800
    now = datetime.now(timezone.utc).isoformat()
    seed.setdefault("auditLogs", []).insert(0, {
        "id": f"aud-{int(time.time() * 1000)}",
        "timestamp": now,
        "actor": "System Admin",
        "role": "Crisis Manager",
        "action": "DEMO_RESET",
        "category": "system",
        "details": "Database reset to clean baseline operational state. Disrupted suppliers restored."
    })
    row = db.query(DashboardStateModel).filter(DashboardStateModel.id == "primary").first()
    if row is None:
        row = DashboardStateModel(id="primary", state_json=seed)
        db.add(row)
    else:
        row.state_json = seed
    db.commit()
    db.refresh(row)
    return row.state_json


