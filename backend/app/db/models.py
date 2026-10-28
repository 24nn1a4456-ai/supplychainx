from sqlalchemy import Column, String, Integer, Float, Boolean, JSON, DateTime, Text
from datetime import datetime, timezone
from app.db.database import Base


class SupplyNodeModel(Base):
    __tablename__ = "supply_nodes"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # supplier, factory, warehouse, distribution_center, customer
    status = Column(String, nullable=False, default="operational")  # operational, delayed, disrupted
    is_critical_outage = Column(Boolean, default=False)
    region = Column(String, nullable=False)
    location = Column(String, nullable=False)
    position_3d = Column(JSON, nullable=False)  # [x, y, z]
    position_2d = Column(JSON, nullable=False)  # [x, y]
    throughput_per_day = Column(Integer, default=0)
    capacity_utilization_pct = Column(Integer, default=0)
    inventory_level_pct = Column(Integer, default=0)
    lead_time_days = Column(Integer, default=0)
    active_shipments_count = Column(Integer, default=0)
    primary_product = Column(String, nullable=False)
    disruption_cause = Column(String, nullable=True)
    estimated_recovery_hours = Column(Integer, nullable=True)
    contact_lead = Column(String, nullable=True)


class SupplyRouteModel(Base):
    __tablename__ = "supply_routes"

    id = Column(String, primary_key=True, index=True)
    source_id = Column(String, nullable=False, index=True)
    target_id = Column(String, nullable=False, index=True)
    state = Column(String, nullable=False, default="normal")  # normal, delayed, disrupted
    cargo_type = Column(String, nullable=False)
    volume_teu = Column(Integer, default=0)
    transit_hours = Column(Integer, default=0)
    transit_progress_pct = Column(Integer, default=0)
    is_rerouted = Column(Boolean, default=False)
    congested_reason = Column(String, nullable=True)


class KPIModel(Base):
    __tablename__ = "kpis"

    id = Column(Integer, primary_key=True, autoincrement=True)
    resiliency_index = Column(Float, nullable=False)
    resiliency_delta = Column(Float, nullable=False)
    active_fleet_volume_teu = Column(Integer, nullable=False)
    active_convoys_count = Column(Integer, nullable=False)
    on_time_delivery_rate = Column(Float, nullable=False)
    delivery_rate_delta = Column(Float, nullable=False)
    critical_alerts_count = Column(Integer, nullable=False)
    active_mitigations_count = Column(Integer, nullable=False)
    carbon_efficiency_score = Column(Float, nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class InventoryTelemetryModel(Base):
    __tablename__ = "inventory_telemetry"

    hub_id = Column(String, primary_key=True, index=True)
    hub_name = Column(String, nullable=False)
    region = Column(String, nullable=False)
    current_stock_units = Column(Integer, nullable=False)
    max_stock_units = Column(Integer, nullable=False)
    stockout_risk_days = Column(Integer, nullable=False)
    health_status = Column(String, nullable=False)  # healthy, warning, critical
    top_skus = Column(JSON, nullable=False)  # list of {sku, units, daysOfSupply}


class CustomerOrderModel(Base):
    __tablename__ = "customer_orders"

    order_id = Column(String, primary_key=True, index=True)
    customer_name = Column(String, nullable=False)
    destination = Column(String, nullable=False)
    volume_units = Column(Integer, nullable=False)
    contract_value_usd = Column(String, nullable=False)
    sla_deadline_hours = Column(Integer, nullable=False)
    risk_tier = Column(String, nullable=False)  # HIGH, CRITICAL, MEDIUM


class AuditLogModel(Base):
    __tablename__ = "audit_events"

    id = Column(String, primary_key=True, index=True)
    timestamp = Column(String, nullable=False)
    stage = Column(String, nullable=False)
    actor = Column(String, nullable=False)
    action = Column(String, nullable=False)
    details = Column(Text, nullable=False)
    status = Column(String, nullable=False)  # SUCCESS, WARNING, REJECTED, SECURITY_BLOCKED
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class CrisisWorkflowStateModel(Base):
    __tablename__ = "crisis_workflow_state"

    id = Column(String, primary_key=True, default="active_crisis")
    stage = Column(String, nullable=False, default="idle")
    timestamp = Column(String, nullable=False)
    selected_supplier_id = Column(String, default="node-sup-1")
    detection_severity = Column(String, default="NONE")
    affected_inventory = Column(JSON, default=list)
    affected_production = Column(JSON, default=list)
    affected_orders = Column(JSON, default=list)
    alternative_suppliers = Column(JSON, default=list)
    warehouse_stock_options = Column(JSON, default=list)
    proposed_plan = Column(JSON, nullable=True)
    is_executing = Column(Boolean, default=False)
    current_executing_action_index = Column(Integer, nullable=True)
    rejection_reason = Column(String, nullable=True)
    error_message = Column(String, nullable=True)
    verification_outcome = Column(String, nullable=True)  # 'Resolved' | 'Partially Resolved' | 'Unresolved'
    verification_evidence = Column(JSON, nullable=True)   # Evidence dictionary from DB re-query
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class DashboardStateModel(Base):
    __tablename__ = "dashboard_state"

    id = Column(String, primary_key=True, default="primary")
    state_json = Column(JSON, nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
