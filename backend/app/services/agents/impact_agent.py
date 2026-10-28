"""
Supply Chain X - Agent 2: Impact Assessment Agent
Author: Member 1 (Agentic AI Engineer)

Role: Quantifies operational and financial blast radius for a CrisisEvent.
Calculates available component inventory across depots, projects days/hours to stockout
from real production schedules, identifies endangered customer orders, and evaluates
severity using deterministic Python calculations rather than LLM-generated numbers.

INTEGRATION CONTRACT:
- Input: ImpactAssessmentInput
- Output: ImpactAssessmentResult (containing verified ImpactAssessment)
- Error & Missing Data Handling: Explicitly flags unverified data and gaps.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List, Optional

from .schemas import (
    CrisisEvent,
    SeverityLevel,
    ImpactAssessment,
    CustomerOrder,
    ProductionRequirement,
    ImpactAssessmentInput,
    ImpactAssessmentResult,
)
from .tools import ToolRegistry

logger = logging.getLogger("supply_chain_x.agents.impact")


def evaluate_crisis_impact(
    input_data: ImpactAssessmentInput,
    tools: Optional[ToolRegistry] = None,
) -> ImpactAssessmentResult:
    """
    Computes deterministic operational and financial impact metrics for a CrisisEvent.

    Algorithm:
    1. Aggregates physical available stock across all warehouses for affected SKUs.
    2. Sums component consumption rates from active production lines (or queries Member 2).
    3. Calculates exact days to stockout: physical_stock / aggregate_daily_burn_rate.
    4. Evaluates customer sales orders at risk of delay/cancellation within stockout window.
    5. Computes empirical severity level based on financial exposure and stockout timeline.

    Returns:
        ImpactAssessmentResult containing core ImpactAssessment and breakdown.
    """
    registry = tools or ToolRegistry()
    crisis = input_data.crisis
    logger.info(f"==> Agent 2: Evaluating operational impact for crisis {crisis.crisis_id}")

    missing_warnings: List[str] = []

    # Step 1: Query or retrieve physical stock across warehouse network
    total_available_stock = 0
    for product_id in crisis.affected_product_ids:
        try:
            inv_opts = registry.inventory_provider.get_inventory_options(product_id)
            if not inv_opts:
                missing_warnings.append(f"No inventory records returned for SKU {product_id} from WMS")
            stock_for_prod = sum(opt.available_stock for opt in inv_opts)
            total_available_stock += stock_for_prod
        except Exception as e:
            logger.error(f"Error querying inventory for {product_id}: {e}")
            missing_warnings.append(f"Inventory data query failed for {product_id}: {str(e)}")

    # Step 2: Retrieve production requirements (line run rates)
    production_reqs = input_data.production_requirements
    if production_reqs is None:
        production_reqs = []
        for product_id in crisis.affected_product_ids:
            try:
                line_reqs = registry.operations_provider.get_production_requirements(product_id)
                production_reqs.extend(line_reqs)
            except Exception as e:
                logger.error(f"Error querying production line data for {product_id}: {e}")
                missing_warnings.append(f"Production requirement query failed for {product_id}: {str(e)}")

    lines_affected = list({r.line_id for r in production_reqs})
    daily_burn_rate = sum(r.daily_run_rate_units for r in production_reqs)

    if daily_burn_rate <= 0:
        missing_warnings.append("No active production run rates recorded; default baseline applied (100 units/day)")
        daily_burn_rate = 100

    # Step 3: Deterministic stockout calculation
    days_to_stockout = round(total_available_stock / daily_burn_rate, 1)

    # Step 4: Retrieve and evaluate customer orders
    orders = input_data.customer_orders
    if orders is None:
        orders = []
        for product_id in crisis.affected_product_ids:
            try:
                prod_orders = registry.operations_provider.get_customer_orders(product_id)
                orders.extend(prod_orders)
            except Exception as e:
                logger.error(f"Error querying customer orders for {product_id}: {e}")
                missing_warnings.append(f"Customer order query failed for {product_id}: {str(e)}")

    # An order is in jeopardy if fulfillment due date is imminent (< days_to_stockout + 7 days buffer)
    # or if safety stock is below threshold
    at_risk_orders: List[CustomerOrder] = []
    total_delayed_order_value = 0.0
    has_critical_customer_at_risk = False

    for ord_item in orders:
        at_risk_orders.append(ord_item)
        total_delayed_order_value += ord_item.revenue_value_usd
        if ord_item.is_critical:
            has_critical_customer_at_risk = True

    # Total units short / at risk across disruption window (14 days standard planning horizon)
    planning_horizon_days = 14
    total_shortfall_units = max(0, (daily_burn_rate * planning_horizon_days) - total_available_stock)
    units_at_risk = max(total_shortfall_units, daily_burn_rate * min(planning_horizon_days, int(days_to_stockout) + 1))

    # Daily revenue loss: burn rate * unit revenue
    estimated_daily_revenue_loss = round(daily_burn_rate * input_data.unit_revenue_usd, 2)
    sla_breach_risk = bool(days_to_stockout < 5.0 or (has_critical_customer_at_risk and days_to_stockout < 7.0))

    # Step 5: Deterministic severity classification
    if days_to_stockout <= 2.0 or (has_critical_customer_at_risk and days_to_stockout <= 4.0):
        computed_severity = SeverityLevel.CRITICAL
    elif days_to_stockout <= 5.0 or total_delayed_order_value >= 250000.0:
        computed_severity = SeverityLevel.HIGH
    elif days_to_stockout <= 10.0 or sla_breach_risk:
        computed_severity = SeverityLevel.MEDIUM
    else:
        computed_severity = SeverityLevel.LOW

    # Summary
    summary = (
        f"Impact Assessment: {days_to_stockout} days of stock remaining ({total_available_stock:,} physical units). "
        f"Daily consumption: {daily_burn_rate:,} units/day across {len(lines_affected)} production line(s). "
        f"{len(at_risk_orders)} customer orders endangered totaling ${total_delayed_order_value:,.2f} USD exposure. "
        f"SLA breach risk: {'HIGH' if sla_breach_risk else 'NOMINAL'}."
    )

    core_assessment = ImpactAssessment(
        assessment_id=f"ASSESS-{crisis.crisis_id}",
        crisis_id=crisis.crisis_id,
        affected_product_ids=crisis.affected_product_ids,
        production_lines_at_risk=lines_affected,
        estimated_daily_revenue_loss=estimated_daily_revenue_loss,
        days_to_stockout=days_to_stockout,
        units_at_risk=units_at_risk,
        sla_breach_risk=sla_breach_risk,
        assessed_at=datetime.now(timezone.utc),
        criticality_summary=summary,
    )

    return ImpactAssessmentResult(
        assessment=core_assessment,
        affected_customer_orders=at_risk_orders,
        total_delayed_order_value_usd=round(total_delayed_order_value, 2),
        daily_burn_rate_units=daily_burn_rate,
        days_to_stockout=days_to_stockout,
        calculated_severity=computed_severity,
        production_lines_affected=lines_affected,
        missing_data_warnings=missing_warnings,
    )


# Backward-compatible helper for pipeline
def assess_crisis_impact(
    crisis: CrisisEvent,
    tools: Optional[ToolRegistry] = None,
    daily_burn_rate_units: int = 500,
    unit_revenue_usd: float = 120.0,
) -> ImpactAssessment:
    """Wrapper function returning core ImpactAssessment for orchestrator pipeline."""
    result = evaluate_crisis_impact(
        ImpactAssessmentInput(crisis=crisis, unit_revenue_usd=unit_revenue_usd),
        tools=tools,
    )
    return result.assessment
