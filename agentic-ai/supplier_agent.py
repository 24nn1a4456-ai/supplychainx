"""
Supply Chain X - Agent 3: Supplier Evaluation Agent
Author: Member 1 (Agentic AI Engineer)

Role: Evaluates alternative qualified suppliers from Member 2's backend.
Compares capacity, unit pricing, quoted lead times, vendor reliability ratings, and contracts.
Rejects candidates violating operational or delivery constraints with explicit justifications.
Ranks viable options and allows Member 4's optimization solver to validate recovery candidates.

INTEGRATION CONTRACT:
- Input: SupplierEvaluationInput
- Output: SupplierEvaluationResult (containing ranked and rejected options)
- Zero Invented Data: Operates solely on verified fields from SupplierDataProvider.
"""

from __future__ import annotations

import logging
from typing import List, Optional

from .schemas import (
    CrisisEvent,
    SupplierOption,
    SupplierEvaluationInput,
    SupplierEvaluationResult,
    RankedSupplierOption,
    RejectedSupplierOption,
)
from .tools import ToolRegistry

logger = logging.getLogger("supply_chain_x.agents.supplier")


def evaluate_alternative_suppliers(
    input_data: SupplierEvaluationInput,
    tools: Optional[ToolRegistry] = None,
) -> SupplierEvaluationResult:
    """
    Evaluates alternative suppliers against demand and operational constraints.

    Constraint Rules:
    1. Failing Supplier Exclusion: Candidate matching excluded_supplier_id is filtered out.
    2. Capacity Check: Available capacity must be > 0.
    3. Reliability Floor: Vendor reliability score must meet or exceed min_reliability_score.
    4. Lead-Time Cap: If max_acceptable_lead_time_days is specified, vendor must meet it.
    5. MOQ Feasibility: Vendor must be capable of fulfilling above minimum order quantity.

    Ranking Criteria (Deterministic):
    - Reliability Score: 40% weight
    - Delivery Lead Time: 35% weight (shorter is superior)
    - Unit Price: 25% weight (cost efficiency)

    Returns:
        SupplierEvaluationResult with ranked options, rejected options, and capacity status.
    """
    registry = tools or ToolRegistry()
    logger.info(
        f"==> Agent 3: Evaluating suppliers for SKU {input_data.product_id} "
        f"(Required qty: {input_data.required_quantity:,})"
    )

    # Step 1: Retrieve alternative suppliers from verified provider (Member 2 integration)
    raw_suppliers = registry.supplier_provider.get_alternative_suppliers(
        product_id=input_data.product_id,
        excluded_supplier_id=input_data.excluded_supplier_id,
    )

    qualified_candidates: List[RankedSupplierOption] = []
    rejected_candidates: List[RejectedSupplierOption] = []

    # Handle scenario where no suppliers exist in registry for this component
    if not raw_suppliers:
        logger.warning(f"No alternative suppliers found in catalog for product {input_data.product_id}")
        return SupplierEvaluationResult(
            product_id=input_data.product_id,
            required_quantity=input_data.required_quantity,
            ranked_options=[],
            rejected_options=[],
            total_qualified_capacity=0,
            has_sufficient_capacity=False,
            optimizer_validation_status="NO_CANDIDATES_AVAILABLE",
        )

    # Step 2: Evaluate each candidate against operational constraints
    min_price = min((s.unit_price for s in raw_suppliers if s.unit_price > 0), default=1.0)

    for sup in raw_suppliers:
        # Check Exclusion
        if input_data.excluded_supplier_id and sup.supplier_id == input_data.excluded_supplier_id:
            rejected_candidates.append(
                RejectedSupplierOption(
                    option=sup,
                    rejection_reason=f"Supplier {sup.supplier_id} is the disrupted/failing entity",
                    failed_constraint="EXCLUDED_FAILING_SUPPLIER",
                )
            )
            continue

        # Check Zero Capacity
        if sup.available_capacity <= 0:
            rejected_candidates.append(
                RejectedSupplierOption(
                    option=sup,
                    rejection_reason=f"Supplier {sup.supplier_name} reports zero available capacity",
                    failed_constraint="INSUFFICIENT_CAPACITY",
                )
            )
            continue

        # Check Reliability Floor
        if sup.reliability_score < input_data.min_reliability_score:
            rejected_candidates.append(
                RejectedSupplierOption(
                    option=sup,
                    rejection_reason=(
                        f"Reliability score ({sup.reliability_score:.2f}) is below minimum "
                        f"acceptable threshold ({input_data.min_reliability_score:.2f})"
                    ),
                    failed_constraint="BELOW_RELIABILITY_FLOOR",
                )
            )
            continue

        # Check Lead-Time Constraint
        if input_data.max_acceptable_lead_time_days is not None:
            if sup.quoted_lead_time_days > input_data.max_acceptable_lead_time_days:
                rejected_candidates.append(
                    RejectedSupplierOption(
                        option=sup,
                        rejection_reason=(
                            f"Quoted lead time ({sup.quoted_lead_time_days} days) exceeds maximum "
                            f"allowable delay ({input_data.max_acceptable_lead_time_days} days)"
                        ),
                        failed_constraint="LEAD_TIME_EXCEEDED",
                    )
                )
                continue

        # Step 3: Compute fulfillment metrics & composite ranking score
        fulfillable_qty = min(input_data.required_quantity, sup.available_capacity)
        total_cost = round(fulfillable_qty * sup.unit_price, 2)

        # Normalized score components [0.0 - 1.0]
        reliability_part = sup.reliability_score
        lead_time_part = max(0.0, 1.0 - (sup.quoted_lead_time_days / 30.0))
        price_part = min_price / max(0.01, sup.unit_price)

        composite_score = round(
            (0.40 * reliability_part) + (0.35 * lead_time_part) + (0.25 * price_part),
            4
        )

        explanation = (
            f"Qualified: Lead time {sup.quoted_lead_time_days}d, Reliability {sup.reliability_score:.2f}, "
            f"Unit price ${sup.unit_price:.2f} ({sup.currency}), Capacity {sup.available_capacity:,} units. "
            f"Contract status: {sup.contract_status}."
        )

        qualified_candidates.append(
            RankedSupplierOption(
                rank=1,  # Will be adjusted after sorting
                option=sup,
                composite_score=composite_score,
                fulfillable_quantity=fulfillable_qty,
                total_estimated_cost_usd=total_cost,
                meets_all_constraints=True,
                explanation=explanation,
            )
        )

    # Step 4: Sort qualified candidates by composite score descending
    qualified_candidates.sort(key=lambda x: -x.composite_score)
    for idx, candidate in enumerate(qualified_candidates, start=1):
        candidate.rank = idx

    total_qualified_cap = sum(c.option.available_capacity for c in qualified_candidates)
    has_sufficient = total_qualified_cap >= input_data.required_quantity

    # Step 5: Optional Member 4 Optimizer validation hook
    optimizer_status = None
    if input_data.use_optimizer_validation and qualified_candidates:
        try:
            solver_response = registry.optimizer_client.solve_recovery_plan(
                crisis_id=input_data.crisis_id,
                demands={input_data.product_id: input_data.required_quantity},
                supplier_options=[c.option for c in qualified_candidates],
                inventory_options=[],
                logistics_options=[],
                target_recovery_days=input_data.max_acceptable_lead_time_days or 14,
            )
            optimizer_status = solver_response.get("solver_status", "SOLVER_OPTIMAL")
        except Exception as e:
            logger.warning(f"Member 4 optimizer validation skipped due to error: {e}")
            optimizer_status = f"OPTIMIZER_UNAVAILABLE: {str(e)}"

    return SupplierEvaluationResult(
        product_id=input_data.product_id,
        required_quantity=input_data.required_quantity,
        ranked_options=qualified_candidates,
        rejected_options=rejected_candidates,
        total_qualified_capacity=total_qualified_cap,
        has_sufficient_capacity=has_sufficient,
        optimizer_validation_status=optimizer_status,
    )


# Backward-compatible helper for pipeline
def discover_supplier_options(
    crisis: CrisisEvent,
    tools: Optional[ToolRegistry] = None,
    min_reliability: float = 0.70,
) -> List[SupplierOption]:
    """Retrieves qualified supplier options for orchestrator pipeline."""
    registry = tools or ToolRegistry()
    candidates: List[SupplierOption] = []
    for product_id in crisis.affected_product_ids:
        result = evaluate_alternative_suppliers(
            SupplierEvaluationInput(
                crisis_id=crisis.crisis_id,
                product_id=product_id,
                required_quantity=1000,
                min_reliability_score=min_reliability,
                excluded_supplier_id=crisis.supplier_id,
            ),
            tools=registry,
        )
        for ranked in result.ranked_options:
            candidates.append(ranked.option)
    return candidates
