"""
Supply Chain X - Agent 5: Logistics Recovery Agent
Author: Member 1 (Agentic AI Engineer)

Role: Evaluates multi-modal transportation options (Air, Expedited Truck, Rail, Ocean)
connecting disrupted supply origins to manufacturing destinations.
Compares transit lead times, freight surcharges, and cargo capacity.
Strictly identifies missing data (e.g. unknown weight capacity, unverified traffic)
rather than hallucinating transit times or carrier rates.

INTEGRATION CONTRACT:
- Input: LogisticsRecoveryInput
- Output: LogisticsRecoveryResult (containing evaluated carrier options & warnings)
- Zero Invention: Unverified traffic or missing telemetry is explicitly flagged.
"""

from __future__ import annotations

import logging
from typing import List, Optional, Dict, Any

from .schemas import (
    LogisticsOption,
    LogisticsRecoveryInput,
    LogisticsRecoveryResult,
    EvaluatedLogisticsOption,
)
from .tools import ToolRegistry
from app.api.routes.weather_service import evaluate_corridor_weather_sync

logger = logging.getLogger("supply_chain_x.agents.logistics")


def evaluate_logistics_recovery(
    input_data: LogisticsRecoveryInput,
    tools: Optional[ToolRegistry] = None,
    corridor_weather_fixtures: Optional[Dict[str, Dict[str, Any]]] = None
) -> LogisticsRecoveryResult:
    """
    Evaluates available freight corridors and carriers between origin and destination.

    Evaluation & Integrity Rules:
    1. Zero Fabrication: If weight limits or emissions are missing, they are flagged in warnings.
    2. Capacity Verification: If cargo_weight_kg is specified and carrier capacity is recorded,
       capacity overrun marks the option infeasible.
    3. Deadline Enforcement: If required_delivery_days is specified, carriers exceeding the SLA
       are marked as failing the delivery deadline.
    4. Meteorological Intelligence: Correlates transit window with OpenWeather forecast/observed data.
       High/severe weather penalties reduce feasibility or lower ranking for weather-vulnerable transport modes.
       If forecast data is unavailable, falls back to deterministic behavior without fabricating delays.
    5. Categorized Recommendations: Distinguishes fastest, lowest cost, and balanced weather-aware recommendation.

    Returns:
        LogisticsRecoveryResult with evaluated options, warnings, and recommendation.
    """
    registry = tools or ToolRegistry()
    logger.info(
        f"==> Agent 5: Evaluating logistics corridors from '{input_data.origin}' to '{input_data.destination}'"
    )

    # Step 1: Query verified freight options from TMS connector
    available_corridors = registry.logistics_provider.get_freight_options(
        origin=input_data.origin,
        destination=input_data.destination,
    )

    missing_warnings: List[str] = []
    evaluated_options: List[EvaluatedLogisticsOption] = []

    if not available_corridors:
        logger.warning(f"No freight corridors returned between {input_data.origin} and {input_data.destination}")
        return LogisticsRecoveryResult(
            origin=input_data.origin,
            destination=input_data.destination,
            evaluated_options=[],
            recommended_option=None,
            fastest_option=None,
            lowest_cost_option=None,
            missing_information_warnings=["No transportation carriers found for route in TMS"],
            has_viable_option=False,
        )

    for corridor in available_corridors:
        notes: List[str] = []
        is_feasible = True
        capacity_verified = corridor.max_weight_capacity_kg is not None

        # Check missing information on carrier
        if corridor.max_weight_capacity_kg is None:
            missing_warnings.append(
                f"Cargo weight capacity unspecified for carrier {corridor.carrier_name} ({corridor.carrier_id})"
            )
            notes.append("Unverified weight capacity")

        if corridor.co2_emission_estimate_kg is None:
            missing_warnings.append(
                f"Carbon footprint estimate unavailable for carrier {corridor.carrier_name}"
            )

        # Check weight constraint
        if input_data.cargo_weight_kg is not None and corridor.max_weight_capacity_kg is not None:
            if input_data.cargo_weight_kg > corridor.max_weight_capacity_kg:
                is_feasible = False
                notes.append(
                    f"Cargo weight ({input_data.cargo_weight_kg:,.0f} kg) exceeds carrier limit "
                    f"({corridor.max_weight_capacity_kg:,.0f} kg)"
                )

        # Check delivery deadline constraint
        meets_deadline = True
        if input_data.required_delivery_days is not None:
            if corridor.transit_time_days > input_data.required_delivery_days:
                meets_deadline = False
                is_feasible = False
                notes.append(
                    f"Transit time ({corridor.transit_time_days}d) breaches deadline "
                    f"({input_data.required_delivery_days}d)"
                )
            else:
                notes.append(f"Meets deadline ({corridor.transit_time_days}d <= {input_data.required_delivery_days}d)")

        # Step 2: Meteorological evaluation along route for expected transit window
        weather_fixture = None
        if corridor_weather_fixtures and corridor.option_id in corridor_weather_fixtures:
            weather_fixture = corridor_weather_fixtures[corridor.option_id]

        weather_eval = evaluate_corridor_weather_sync(
            origin=corridor.origin,
            destination=corridor.destination,
            transit_days=corridor.transit_time_days,
            corridor_id=corridor.option_id,
            injected_weather=weather_fixture
        )

        # Severe weather impact check: Air freight or ocean routes with severe convective activity/typhoons
        if weather_eval.weather_risk_level == "severe":
            # Severe weather grounds air transport or suspends port departures
            is_feasible = False
            notes.append(f"INOPERABLE: {weather_eval.route_impact_explanation}")
        elif weather_eval.weather_risk_level in ["high", "moderate"]:
            notes.append(f"Weather alert ({weather_eval.weather_risk_level.upper()}): {weather_eval.weather_summary}")
        else:
            notes.append(f"Weather: {weather_eval.weather_summary} (nominal)")

        if is_feasible and not notes:
            notes.append("Fully compliant with operational route constraints")

        completeness_flag = bool(capacity_verified and corridor.expedited_fee > 0 and corridor.transit_time_days > 0)

        evaluated_options.append(
            EvaluatedLogisticsOption(
                option=corridor,
                is_feasible=is_feasible,
                total_freight_cost=corridor.expedited_fee,
                transit_time_days=corridor.transit_time_days,
                meets_deadline=meets_deadline,
                capacity_verified=capacity_verified,
                data_completeness_flag=completeness_flag,
                evaluation_notes="; ".join(notes),
                weather_risk_score=weather_eval.weather_risk_score,
                weather_risk_level=weather_eval.weather_risk_level,
                weather_explanation=weather_eval.route_impact_explanation,
                weather_data_source=weather_eval.data_source,
                is_forecast_used=weather_eval.is_forecast_used
            )
        )

    # Step 3: Determine recommendations among feasible corridors incorporating weather risk
    feasible_options = [eo for eo in evaluated_options if eo.is_feasible]

    fastest_option: Optional[LogisticsOption] = None
    lowest_cost_option: Optional[LogisticsOption] = None
    recommended_option: Optional[LogisticsOption] = None
    recommended_score: Optional[float] = None
    recommended_level: Optional[str] = None
    recommended_explanation: Optional[str] = None

    if feasible_options:
        # Fastest: min transit_time_days (with lowest weather risk as tie-breaker)
        fastest_eval = min(feasible_options, key=lambda x: (x.transit_time_days, x.weather_risk_score, x.total_freight_cost))
        fastest_option = fastest_eval.option

        # Lowest Cost: min total_freight_cost (with lowest weather risk as tie-breaker)
        lowest_eval = min(feasible_options, key=lambda x: (x.total_freight_cost, x.weather_risk_score, x.transit_time_days))
        lowest_cost_option = lowest_eval.option

        # Recommended:
        # If required_delivery_days <= 3 days, priority is speed + weather safety (air charter)
        # Otherwise, balanced evaluation of lead time, cost, and weather risk
        if input_data.required_delivery_days and input_data.required_delivery_days <= 3:
            # Pick fastest feasible option with lowest weather risk
            best_eval = min(feasible_options, key=lambda x: (x.transit_time_days, x.weather_risk_score, x.total_freight_cost))
        else:
            # For emergency buffer recovery, air freight is preferred if transit is <= 2 days and weather is safe
            air_options = [eo for eo in feasible_options if eo.transit_time_days <= 2 and eo.weather_risk_level in ["low", "moderate"]]
            if air_options:
                best_eval = min(air_options, key=lambda x: (x.weather_risk_score, x.total_freight_cost))
            else:
                max_cost = max(eo.total_freight_cost for eo in feasible_options) or 1.0
                max_time = max(eo.transit_time_days for eo in feasible_options) or 1.0

                def score_option(eo: EvaluatedLogisticsOption) -> float:
                    cost_norm = 1.0 - (eo.total_freight_cost / max_cost)
                    time_norm = 1.0 - (eo.transit_time_days / max_time)
                    weather_norm = 1.0 - (eo.weather_risk_score / 100.0)
                    return (time_norm * 0.45) + (cost_norm * 0.35) + (weather_norm * 0.20)

                best_eval = max(feasible_options, key=score_option)

        recommended_option = best_eval.option
        recommended_score = best_eval.weather_risk_score
        recommended_level = best_eval.weather_risk_level
        recommended_explanation = best_eval.weather_explanation
    elif evaluated_options:
        # If no option meets all strict constraints, highlight lowest risk or closest option
        fastest_option = min(evaluated_options, key=lambda x: x.transit_time_days).option
        lowest_cost_option = min(evaluated_options, key=lambda x: x.total_freight_cost).option
        recommended_option = None

    has_viable = len(feasible_options) > 0

    return LogisticsRecoveryResult(
        origin=input_data.origin,
        destination=input_data.destination,
        evaluated_options=evaluated_options,
        recommended_option=recommended_option,
        fastest_option=fastest_option,
        lowest_cost_option=lowest_cost_option,
        recommended_weather_score=recommended_score,
        recommended_weather_level=recommended_level,
        recommended_weather_explanation=recommended_explanation,
        missing_information_warnings=list(dict.fromkeys(missing_warnings)),
        has_viable_option=has_viable,
    )


# Backward-compatible helper for pipeline
def discover_logistics_options(
    origin: str,
    destination: str,
    tools: Optional[ToolRegistry] = None,
) -> List[LogisticsOption]:
    """Retrieves viable logistics options for orchestrator pipeline."""
    result = evaluate_logistics_recovery(
        LogisticsRecoveryInput(origin=origin, destination=destination),
        tools=tools,
    )
    return [eo.option for eo in result.evaluated_options if eo.is_feasible]
