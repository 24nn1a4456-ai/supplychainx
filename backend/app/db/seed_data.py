from sqlalchemy.orm import Session
from app.db.models import (
    SupplyNodeModel,
    SupplyRouteModel,
    KPIModel,
    InventoryTelemetryModel,
    CustomerOrderModel,
    AuditLogModel
)


def seed_database(db: Session):
    """Seed SQLite database with deterministic, clearly labeled synthetic supply chain records."""
    if db.query(SupplyNodeModel).first() is not None:
        return  # Already seeded

    # 1. Supply Nodes (10 Multi-echelon Nodes)
    nodes = [
        # Suppliers
        SupplyNodeModel(
            id='node-sup-1',
            name='Apex Silicon Fab 4',
            type='supplier',
            status='disrupted',
            is_critical_outage=True,
            region='Asia-Pacific',
            location='Shenzhen Tech Corridor',
            position_3d=[-6, 3, -1],
            position_2d=[18, 28],
            throughput_per_day=450,
            capacity_utilization_pct=12,
            inventory_level_pct=8,
            lead_time_days=28,
            active_shipments_count=14,
            primary_product='Sub-3nm AI Neural Accelerators',
            disruption_cause='Regional Substation Meltdown & Cat-4 Typhoon Harbor Embargo',
            estimated_recovery_hours=148,
            contact_lead='Dr. Ming Chen (VP Supply Ops)'
        ),
        SupplyNodeModel(
            id='node-sup-2',
            name='Nordic Lithium Core',
            type='supplier',
            status='operational',
            region='Europe-North',
            location='Oslo Battery Cluster',
            position_3d=[-5, 1, 4],
            position_2d=[26, 68],
            throughput_per_day=1200,
            capacity_utilization_pct=88,
            inventory_level_pct=74,
            lead_time_days=8,
            active_shipments_count=32,
            primary_product='High-Density Solid-State Cells',
            contact_lead='Elin Lindqvist'
        ),
        SupplyNodeModel(
            id='node-sup-3',
            name='Tokyo Precision Optics',
            type='supplier',
            status='operational',
            region='Asia-Pacific',
            location='Yokohama High-Tech Park',
            position_3d=[-4, 4, 3],
            position_2d=[24, 35],
            throughput_per_day=950,
            capacity_utilization_pct=92,
            inventory_level_pct=81,
            lead_time_days=5,
            active_shipments_count=21,
            primary_product='EUV Litho Objective Prisms',
            contact_lead='Kenji Sato'
        ),
        # Factories
        SupplyNodeModel(
            id='node-fac-1',
            name='Giga Assembly Complex',
            type='factory',
            status='delayed',
            region='North America',
            location='Austin Cyber Corridor',
            position_3d=[-1, 2, 0],
            position_2d=[44, 48],
            throughput_per_day=2400,
            capacity_utilization_pct=64,
            inventory_level_pct=31,
            lead_time_days=12,
            active_shipments_count=48,
            primary_product='Autonomous Robotics & Server Racks',
            disruption_cause='Sub-assembly Starvation: Missing Apex Neural Wafers',
            estimated_recovery_hours=72,
            contact_lead='Sarah Jenkins (Plant GM)'
        ),
        SupplyNodeModel(
            id='node-fac-2',
            name='Munich Precision Plant',
            type='factory',
            status='operational',
            region='Europe-Central',
            location='Bavaria Tech Hub',
            position_3d=[-1, -1, 3],
            position_2d=[48, 70],
            throughput_per_day=1800,
            capacity_utilization_pct=85,
            inventory_level_pct=68,
            lead_time_days=7,
            active_shipments_count=39,
            primary_product='High-Torque Actuator Units',
            contact_lead='Hans Gruber'
        ),
        # Warehouses
        SupplyNodeModel(
            id='node-wh-1',
            name='Rotterdam Gateway Buffer',
            type='warehouse',
            status='operational',
            region='Europe-West',
            location='Port of Rotterdam',
            position_3d=[2, -2, 2],
            position_2d=[60, 65],
            throughput_per_day=4500,
            capacity_utilization_pct=79,
            inventory_level_pct=82,
            lead_time_days=3,
            active_shipments_count=64,
            primary_product='Staged Raw Materials & Fast-Turn Spares',
            contact_lead='Lars van Dijk'
        ),
        SupplyNodeModel(
            id='node-wh-2',
            name='Singapore Air Cargo Hub',
            type='warehouse',
            status='delayed',
            region='Asia-Pacific',
            location='Changi Logistics Park',
            position_3d=[2, 3, -2],
            position_2d=[58, 22],
            throughput_per_day=5200,
            capacity_utilization_pct=94,
            inventory_level_pct=42,
            lead_time_days=4,
            active_shipments_count=58,
            primary_product='Critical Avionics & Rapid-Dispatch Silicon',
            disruption_cause='Trans-Pacific Air Freight Congestion',
            estimated_recovery_hours=36,
            contact_lead='Tan Wei Ling'
        ),
        # Distribution Centers
        SupplyNodeModel(
            id='node-dc-1',
            name='Chicago Intermodal Terminal',
            type='distribution_center',
            status='operational',
            region='North America',
            location='Illinois Freight Nexus',
            position_3d=[4, 1, 1],
            position_2d=[74, 52],
            throughput_per_day=3800,
            capacity_utilization_pct=72,
            inventory_level_pct=65,
            lead_time_days=2,
            active_shipments_count=42,
            primary_product='Finished Compute Nodes & Power Arrays',
            contact_lead='Marcus Brody'
        ),
        SupplyNodeModel(
            id='node-dc-2',
            name='Dubai Air-Sea Bridge',
            type='distribution_center',
            status='operational',
            region='Middle East',
            location='Jebel Ali Free Zone',
            position_3d=[4, -3, -1],
            position_2d=[72, 38],
            throughput_per_day=3100,
            capacity_utilization_pct=68,
            inventory_level_pct=59,
            lead_time_days=3,
            active_shipments_count=35,
            primary_product='Cross-Continent Subsystem Redistribution',
            contact_lead='Tariq Al-Mansoor'
        ),
        # Customers
        SupplyNodeModel(
            id='node-cust-1',
            name='US Coastal Data Centers',
            type='customer',
            status='delayed',
            region='North America',
            location='Silicon Valley & Virginia Grid',
            position_3d=[7, 0, 0],
            position_2d=[90, 48],
            throughput_per_day=1900,
            capacity_utilization_pct=96,
            inventory_level_pct=24,
            lead_time_days=1,
            active_shipments_count=18,
            primary_product='Hyperscale Cloud Infrastructure',
            disruption_cause='SLA Threat: Line 2 Rack deliveries pending recovery dispatch',
            estimated_recovery_hours=48,
            contact_lead='Enterprise Account Director'
        )
    ]
    db.add_all(nodes)

    # 2. Supply Routes
    routes = [
        SupplyRouteModel(
            id='route-sup1-fac1',
            source_id='node-sup-1',
            target_id='node-fac-1',
            state='disrupted',
            cargo_type='Sub-3nm AI Neural Accelerators',
            volume_teu=450,
            transit_hours=144,
            transit_progress_pct=15,
            congested_reason='Harbor embargo active. Vessel anchored off Shenzhen.'
        ),
        SupplyRouteModel(
            id='route-sup1-wh2',
            source_id='node-sup-1',
            target_id='node-wh-2',
            state='disrupted',
            cargo_type='EUV Micro-Wafers',
            volume_teu=210,
            transit_hours=48,
            transit_progress_pct=8,
            congested_reason='Ground transport feeder road closed by substation outage.'
        ),
        SupplyRouteModel(
            id='route-sup2-fac2',
            source_id='node-sup-2',
            target_id='node-fac-2',
            state='normal',
            cargo_type='Lithium-Ion Cells',
            volume_teu=680,
            transit_hours=36,
            transit_progress_pct=65
        ),
        SupplyRouteModel(
            id='route-sup3-fac1',
            source_id='node-sup-3',
            target_id='node-fac-1',
            state='normal',
            cargo_type='Precision Optics & Sensors',
            volume_teu=320,
            transit_hours=96,
            transit_progress_pct=42
        ),
        SupplyRouteModel(
            id='route-fac1-wh1',
            source_id='node-fac-1',
            target_id='node-wh-1',
            state='delayed',
            cargo_type='Assembled Robotics Pods',
            volume_teu=540,
            transit_hours=120,
            transit_progress_pct=52,
            congested_reason='Downstream assembly throttle due to wafer shortage.'
        ),
        SupplyRouteModel(
            id='route-fac2-wh1',
            source_id='node-fac-2',
            target_id='node-wh-1',
            state='normal',
            cargo_type='High-Torque Drive Units',
            volume_teu=720,
            transit_hours=24,
            transit_progress_pct=80
        ),
        SupplyRouteModel(
            id='route-wh1-dc1',
            source_id='node-wh-1',
            target_id='node-dc-1',
            state='normal',
            cargo_type='Consolidated Server Modules',
            volume_teu=1100,
            transit_hours=168,
            transit_progress_pct=34
        ),
        SupplyRouteModel(
            id='route-wh2-dc2',
            source_id='node-wh-2',
            target_id='node-dc-2',
            state='delayed',
            cargo_type='Air-freight Avionics Arrays',
            volume_teu=430,
            transit_hours=72,
            transit_progress_pct=28,
            congested_reason='Airspace congestion over Southeast corridor.'
        ),
        SupplyRouteModel(
            id='route-dc1-cust1',
            source_id='node-dc-1',
            target_id='node-cust-1',
            state='delayed',
            cargo_type='Hyperscale Cloud Racks',
            volume_teu=850,
            transit_hours=48,
            transit_progress_pct=62,
            congested_reason='Awaiting verified hardware batch from Austin Line 2.'
        ),
        SupplyRouteModel(
            id='route-dc2-cust1',
            source_id='node-dc-2',
            target_id='node-cust-1',
            state='normal',
            cargo_type='Auxiliary Power Inverters',
            volume_teu=390,
            transit_hours=96,
            transit_progress_pct=71
        )
    ]
    db.add_all(routes)

    # 3. KPIs
    kpi = KPIModel(
        resiliency_index=78.4,
        resiliency_delta=-4.2,
        active_fleet_volume_teu=18450,
        active_convoys_count=92,
        on_time_delivery_rate=89.6,
        delivery_rate_delta=-5.8,
        critical_alerts_count=2,
        active_mitigations_count=4,
        carbon_efficiency_score=94.2
    )
    db.add(kpi)

    # 4. Inventory Telemetry
    inventory_items = [
        InventoryTelemetryModel(
            hub_id='hub-na-01',
            hub_name='North America Central Buffer (Chicago)',
            region='North America',
            current_stock_units=28400,
            max_stock_units=35000,
            stockout_risk_days=18,
            health_status='healthy',
            top_skus=[
                {'sku': 'SKU-NEURAL-A1', 'units': 620, 'daysOfSupply': 3},
                {'sku': 'SKU-LOGIC-CORE-8', 'units': 1400, 'daysOfSupply': 6},
                {'sku': 'SKU-POWER-CONV-X', 'units': 4200, 'daysOfSupply': 19}
            ]
        ),
        InventoryTelemetryModel(
            hub_id='hub-eu-01',
            hub_name='Rotterdam Deepwater Depot',
            region='Europe',
            current_stock_units=34200,
            max_stock_units=40000,
            stockout_risk_days=24,
            health_status='healthy',
            top_skus=[
                {'sku': 'SKU-BATTERY-SS4', 'units': 8900, 'daysOfSupply': 31},
                {'sku': 'SKU-DRIVE-TRQ-9', 'units': 5100, 'daysOfSupply': 22}
            ]
        ),
        InventoryTelemetryModel(
            hub_id='hub-apac-01',
            hub_name='Singapore Buffer Depot',
            region='Asia-Pacific',
            current_stock_units=12500,
            max_stock_units=30000,
            stockout_risk_days=6,
            health_status='critical',
            top_skus=[
                {'sku': 'SKU-NEURAL-A1', 'units': 450, 'daysOfSupply': 2},
                {'sku': 'SKU-EUV-OPTICS', 'units': 980, 'daysOfSupply': 7}
            ]
        )
    ]
    db.add_all(inventory_items)

    # 5. Customer Orders
    orders = [
        CustomerOrderModel(
            order_id='ORD-US-8912',
            customer_name='North America Retail Grid',
            destination='US Coastal Tier-1',
            volume_units=1450,
            contract_value_usd='$1,850,000',
            sla_deadline_hours=48,
            risk_tier='CRITICAL'
        ),
        CustomerOrderModel(
            order_id='ORD-EU-4409',
            customer_name='EMEA Enterprise Network',
            destination='Frankfurt Gateway',
            volume_units=820,
            contract_value_usd='$980,000',
            sla_deadline_hours=72,
            risk_tier='HIGH'
        ),
        CustomerOrderModel(
            order_id='ORD-APAC-1092',
            customer_name='Tokyo High-Density Compute',
            destination='Tokyo Bay Hub',
            volume_units=640,
            contract_value_usd='$740,000',
            sla_deadline_hours=96,
            risk_tier='MEDIUM'
        )
    ]
    db.add_all(orders)

    # 6. Baseline Audit Log (check if audit-00 already exists)
    if db.query(AuditLogModel).filter(AuditLogModel.id == 'audit-00').first() is None:
        audit_entry = AuditLogModel(
            id='audit-00',
            timestamp='16:00:00 UTC',
            stage='idle',
            actor='SYSTEM_AUTONOMOUS',
            action='Baseline Telemetry Calibrated',
            details='All 10 multi-echelon network nodes operational. Resiliency index 96.2%. Initialized in synthetic demo mode.',
            status='SUCCESS'
        )
        db.add(audit_entry)

    db.commit()
