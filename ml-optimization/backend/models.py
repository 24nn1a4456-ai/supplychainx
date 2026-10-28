"""
models.py — SQLAlchemy ORM models for Supply Chain X.

All seeded data is synthetic. No real supplier/customer information.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text,
    Enum as SAEnum,
)
from sqlalchemy.orm import relationship

from .database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ─────────────────────────── Reference Data ───────────────────────────

class SupplierRecord(Base):
    __tablename__ = "suppliers"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    material = Column(String, nullable=False)
    capacity = Column(Integer, nullable=False, default=0)
    lead_time_days = Column(Float, nullable=False, default=3.0)
    unit_cost = Column(Float, nullable=False, default=10.0)
    transport_cost = Column(Float, nullable=False, default=0.0)
    reliability_score = Column(Float, nullable=False, default=0.8)
    is_available = Column(Boolean, nullable=False, default=True)
    is_primary = Column(Boolean, nullable=False, default=False)
    is_synthetic = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=_now)


class InventoryRecord(Base):
    __tablename__ = "inventory"

    id = Column(String, primary_key=True, default=_uuid)
    material_id = Column(String, nullable=False)
    warehouse_id = Column(String, ForeignKey("warehouses.id"), nullable=False)
    current_qty = Column(Integer, nullable=False, default=0)
    safety_stock = Column(Integer, nullable=False, default=0)
    daily_demand = Column(Integer, nullable=False, default=10)
    reorder_threshold = Column(Integer, nullable=False, default=20)
    is_synthetic = Column(Boolean, nullable=False, default=True)
    updated_at = Column(DateTime, default=_now, onupdate=_now)


class WarehouseRecord(Base):
    __tablename__ = "warehouses"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    location = Column(String, nullable=False, default="Unknown")
    capacity = Column(Integer, nullable=False, default=1000)
    transfer_cost = Column(Float, nullable=False, default=3.0)
    transfer_lead_days = Column(Float, nullable=False, default=1.0)
    is_operational = Column(Boolean, nullable=False, default=True)
    is_synthetic = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=_now)


# ─────────────────────────── Disruptions ──────────────────────────────

class DisruptionRecord(Base):
    __tablename__ = "disruptions"

    id = Column(String, primary_key=True, default=_uuid)
    type = Column(String, nullable=False)  # supplier_outage, shipment_delay, etc.
    description = Column(Text, nullable=False, default="")
    severity = Column(String, nullable=False, default="HIGH")  # LOW/MEDIUM/HIGH/CRITICAL
    affected_supplier_id = Column(String, nullable=True)
    affected_warehouse_id = Column(String, nullable=True)
    affected_material = Column(String, nullable=True)
    start_day = Column(Integer, nullable=False, default=0)
    detected_day = Column(Integer, nullable=True)
    duration_days = Column(Integer, nullable=False, default=5)
    status = Column(String, nullable=False, default="detected")  # detected, analyzing, resolved
    scenario_name = Column(String, nullable=True)  # links to simulator scenario
    analysis_result = Column(Text, nullable=True)  # JSON: agent analysis results
    is_synthetic = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=_now)


# ─────────────────────────── Recovery Plans ───────────────────────────

class RecoveryPlanRecord(Base):
    __tablename__ = "recovery_plans"

    id = Column(String, primary_key=True, default=_uuid)
    disruption_id = Column(String, ForeignKey("disruptions.id"), nullable=False)
    actions_json = Column(Text, nullable=False, default="[]")  # serialized actions
    solver_status = Column(String, nullable=False, default="UNKNOWN")
    solver_type = Column(String, nullable=False, default="unknown")
    total_cost = Column(Float, nullable=False, default=0.0)
    procurement_cost = Column(Float, nullable=False, default=0.0)
    delay_penalty = Column(Float, nullable=False, default=0.0)
    is_feasible = Column(Boolean, nullable=False, default=False)
    kpi_json = Column(Text, nullable=True)  # serialized KPIs
    agent_results_json = Column(Text, nullable=True)  # agent findings
    fulfilled_json = Column(Text, nullable=True)  # {component: qty}
    violated_constraints = Column(Text, nullable=True)  # JSON list
    status = Column(String, nullable=False, default="pending")  # pending, approved, rejected, executed
    is_synthetic = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=_now)

    @property
    def actions(self):
        return json.loads(self.actions_json) if self.actions_json else []

    @property
    def kpis(self):
        return json.loads(self.kpi_json) if self.kpi_json else {}

    @property
    def fulfilled(self):
        return json.loads(self.fulfilled_json) if self.fulfilled_json else {}


# ─────────────────────────── Approvals ────────────────────────────────

class ApprovalRecord(Base):
    __tablename__ = "approvals"

    id = Column(String, primary_key=True, default=_uuid)
    plan_id = Column(String, ForeignKey("recovery_plans.id"), nullable=False)
    status = Column(String, nullable=False, default="pending")  # pending, approved, rejected
    reviewer = Column(String, nullable=False, default="demo_user")
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_now)


# ─────────────────────────── Simulation ───────────────────────────────

class SimulationRecord(Base):
    __tablename__ = "simulations"

    id = Column(String, primary_key=True, default=_uuid)
    plan_id = Column(String, ForeignKey("recovery_plans.id"), nullable=False, unique=True)
    before_state_json = Column(Text, nullable=False, default="{}")
    after_state_json = Column(Text, nullable=False, default="{}")
    actions_applied_json = Column(Text, nullable=False, default="[]")
    result_status = Column(String, nullable=False, default="completed")  # completed, failed
    idempotency_key = Column(String, nullable=False, unique=True)
    is_synthetic = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=_now)


# ─────────────────────────── Audit Trail ──────────────────────────────

class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(String, primary_key=True, default=_uuid)
    event_type = Column(String, nullable=False)  # disruption_created, plan_generated, approved, rejected, simulated
    entity_id = Column(String, nullable=False)
    actor = Column(String, nullable=False, default="system")
    details_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_now)
