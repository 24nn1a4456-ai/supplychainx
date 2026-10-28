"""
services.py — Business services for approval workflow, digital twin, and audit.

Enforces all state-transition rules in the backend.
"""
from __future__ import annotations

import json
import uuid
from typing import Dict, List, Optional, Any

from sqlalchemy.orm import Session

from backend.models import (
    RecoveryPlanRecord, ApprovalRecord, SimulationRecord,
    AuditEvent, InventoryRecord, WarehouseRecord, SupplierRecord,
    DisruptionRecord,
)


# ───────────────────── Approval Service ─────────────────────────────

class ApprovalService:
    """
    Backend-enforced approval workflow.

    States: pending → approved | rejected
    Rules:
      - Only pending plans can be approved or rejected
      - Infeasible plans cannot be approved
      - Every transition creates an audit event
      - Re-approval of already-approved plan returns current state
    """

    @staticmethod
    def approve(plan_id: str, db: Session, reviewer: str = "demo_user",
                comment: Optional[str] = None) -> Dict[str, Any]:
        plan = db.get(RecoveryPlanRecord, plan_id)
        if not plan:
            return {"error": "Plan not found", "status_code": 404}

        if plan.status == "approved":
            return {"plan_id": plan_id, "status": "approved",
                    "message": "Plan already approved", "status_code": 200}

        if plan.status == "rejected":
            return {"error": "Cannot approve a rejected plan", "status_code": 409}

        if plan.status == "executed":
            return {"error": "Cannot approve an already-executed plan", "status_code": 409}

        if plan.status != "pending":
            return {"error": f"Cannot approve plan in state '{plan.status}'", "status_code": 409}

        if not plan.is_feasible:
            return {"error": "Cannot approve infeasible plan. Manual intervention required.",
                    "status_code": 422}

        # Approve
        plan.status = "approved"
        approval = ApprovalRecord(
            plan_id=plan_id,
            status="approved",
            reviewer=reviewer,
            comment=comment or "Approved for simulation",
        )
        db.add(approval)
        db.add(AuditEvent(
            event_type="plan_approved",
            entity_id=plan_id,
            actor=reviewer,
            details_json=json.dumps({
                "plan_id": plan_id,
                "reviewer": reviewer,
                "comment": comment,
                "solver_type": plan.solver_type,
                "total_cost": plan.total_cost,
            }),
        ))
        db.commit()

        return {"plan_id": plan_id, "status": "approved",
                "message": "Plan approved for simulation", "status_code": 200}

    @staticmethod
    def reject(plan_id: str, db: Session, reviewer: str = "demo_user",
               comment: Optional[str] = None) -> Dict[str, Any]:
        plan = db.get(RecoveryPlanRecord, plan_id)
        if not plan:
            return {"error": "Plan not found", "status_code": 404}

        if plan.status == "rejected":
            return {"plan_id": plan_id, "status": "rejected",
                    "message": "Plan already rejected", "status_code": 200}

        if plan.status not in ("pending", "approved"):
            return {"error": f"Cannot reject plan in state '{plan.status}'", "status_code": 409}

        plan.status = "rejected"
        approval = ApprovalRecord(
            plan_id=plan_id,
            status="rejected",
            reviewer=reviewer,
            comment=comment or "Rejected",
        )
        db.add(approval)
        db.add(AuditEvent(
            event_type="plan_rejected",
            entity_id=plan_id,
            actor=reviewer,
            details_json=json.dumps({
                "plan_id": plan_id, "reviewer": reviewer, "comment": comment,
            }),
        ))
        db.commit()

        return {"plan_id": plan_id, "status": "rejected",
                "message": "Plan rejected", "status_code": 200}


# ───────────────────── Digital Twin Service ─────────────────────────

class DigitalTwinService:
    """
    Deterministic, in-memory simulation of recovery plan execution.

    Rules:
      - Only approved, feasible plans can be simulated
      - Idempotent: repeating the same plan_id returns the original result
      - Snapshots before/after state
      - Creates audit events
      - All changes are SIMULATED (no real operations)
    """

    @staticmethod
    def execute(plan_id: str, db: Session) -> Dict[str, Any]:
        plan = db.get(RecoveryPlanRecord, plan_id)
        if not plan:
            return {"error": "Plan not found", "status_code": 404}

        # Idempotency check — already executed?
        existing_sim = db.query(SimulationRecord).filter(
            SimulationRecord.plan_id == plan_id
        ).first()
        if existing_sim:
            return {
                "simulation_id": existing_sim.id,
                "plan_id": plan_id,
                "status": "already_executed",
                "message": "This plan has already been simulated. Returning original result.",
                "before_state": json.loads(existing_sim.before_state_json),
                "after_state": json.loads(existing_sim.after_state_json),
                "actions_applied": json.loads(existing_sim.actions_applied_json),
                "status_code": 200,
            }

        # State checks
        if plan.status != "approved":
            msg = {
                "pending": "Plan must be approved before simulation",
                "rejected": "Cannot simulate a rejected plan",
            }.get(plan.status, f"Cannot simulate plan in state '{plan.status}'")
            return {"error": msg, "status_code": 409}

        if not plan.is_feasible:
            return {"error": "Cannot simulate infeasible plan", "status_code": 422}

        # ── Snapshot BEFORE state ──
        before_state = _snapshot_state(db)

        # ── Apply simulated actions ──
        actions = plan.actions  # deserialized from JSON
        applied_actions = []

        for action in actions:
            source_id = action.get("source_id", "")
            quantity = action.get("quantity", 0)
            component = action.get("component_id", "")

            # Update inventory (simulated)
            if source_id.startswith("WH-"):
                inv = db.query(InventoryRecord).filter(
                    InventoryRecord.warehouse_id == source_id,
                    InventoryRecord.material_id == component,
                ).first()
                if inv:
                    old_qty = inv.current_qty
                    inv.current_qty = max(0, inv.current_qty - quantity)
                    applied_actions.append({
                        "type": "warehouse_transfer",
                        "source": source_id,
                        "component": component,
                        "quantity": quantity,
                        "old_qty": old_qty,
                        "new_qty": inv.current_qty,
                        "simulated": True,
                    })
            elif source_id.startswith("SUP-"):
                # Supplier purchase — reduce available capacity in this simulation
                sup = db.get(SupplierRecord, source_id)
                if sup:
                    old_cap = sup.capacity
                    sup.capacity = max(0, sup.capacity - quantity)
                    applied_actions.append({
                        "type": "supplier_purchase",
                        "source": source_id,
                        "component": component,
                        "quantity": quantity,
                        "old_capacity": old_cap,
                        "new_capacity": sup.capacity,
                        "cost": action.get("subtotal", 0),
                        "simulated": True,
                        "note": "SIMULATION ONLY — no real purchase made",
                    })

        # ── Snapshot AFTER state ──
        after_state = _snapshot_state(db)

        # ── Store simulation record ──
        idempotency_key = f"sim-{plan_id}"
        sim = SimulationRecord(
            plan_id=plan_id,
            before_state_json=json.dumps(before_state),
            after_state_json=json.dumps(after_state),
            actions_applied_json=json.dumps(applied_actions),
            result_status="completed",
            idempotency_key=idempotency_key,
        )
        db.add(sim)
        db.flush()  # ensure sim.id is populated

        # Update plan status
        plan.status = "executed"

        # Audit
        db.add(AuditEvent(
            event_type="plan_simulated",
            entity_id=plan_id,
            actor="digital_twin",
            details_json=json.dumps({
                "simulation_id": sim.id,
                "plan_id": plan_id,
                "actions_applied": len(applied_actions),
                "total_cost": plan.total_cost,
                "note": "SIMULATION ONLY — no real operations performed",
            }),
        ))

        db.commit()

        return {
            "simulation_id": sim.id,
            "plan_id": plan_id,
            "status": "completed",
            "message": "SIMULATION ONLY — recovery plan applied to simulated state",
            "before_state": before_state,
            "after_state": after_state,
            "actions_applied": applied_actions,
            "status_code": 200,
        }


def _snapshot_state(db: Session) -> Dict[str, Any]:
    """Capture current inventory and supplier state for before/after comparison."""
    inventory = db.query(InventoryRecord).all()
    suppliers = db.query(SupplierRecord).all()

    return {
        "inventory": [
            {
                "id": inv.id,
                "material_id": inv.material_id,
                "warehouse_id": inv.warehouse_id,
                "current_qty": inv.current_qty,
                "safety_stock": inv.safety_stock,
            }
            for inv in inventory
        ],
        "suppliers": [
            {
                "id": s.id,
                "name": s.name,
                "material": s.material,
                "capacity": s.capacity,
                "is_available": s.is_available,
            }
            for s in suppliers
        ],
        "snapshot_note": "Synthetic demo data — SIMULATION ONLY",
    }
