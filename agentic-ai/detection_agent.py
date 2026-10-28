"""
Supply Chain X - Agent 1: Crisis Detection Agent
Author: Member 1 (Agentic AI Engineer)

Role: Ingests operational alerts and telemetry (supplier outages, low stock,
shipment delays, demand changes). Uses deterministic rule-based evaluation to identify
crises, prevents duplicate incidents, and outputs structured CrisisEvent models.

INTEGRATION CONTRACT:
- Input: TelemetrySignal
- Output: DetectionResult (containing validated CrisisEvent if detected)
- Safe: No mutating writes, duplicate-suppressed.
"""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Set, Tuple

from .schemas import (
    CrisisEvent,
    CrisisType,
    SeverityLevel,
    CrisisStatus,
    SignalType,
    TelemetrySignal,
    DetectionResult,
)

logger = logging.getLogger("supply_chain_x.agents.detection")


class IncidentDeduplicator:
    """
    Maintains active disruption fingerprints to prevent duplicate crisis incidents
    from being generated for repeated alarms within a sliding time window (default 24h).
    """

    def __init__(self, window_hours: int = 24):
        self.window = timedelta(hours=window_hours)
        # Fingerprint -> (creation_timestamp, crisis_id)
        self._active_fingerprints: Dict[str, Tuple[datetime, str]] = {}

    def compute_fingerprint(self, signal: TelemetrySignal) -> str:
        """Generates deterministic sha256 fingerprint for entity, signal type, and products."""
        prods = "-".join(sorted(signal.product_ids))
        raw_key = f"{signal.signal_type.value}:{signal.entity_id}:{prods}"
        return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()[:16]

    def is_duplicate(self, signal: TelemetrySignal, now: Optional[datetime] = None) -> Tuple[bool, Optional[str]]:
        """
        Checks if signal matches an existing active incident within the time window.
        Returns (is_duplicate, existing_crisis_id).
        """
        current_time = now or datetime.now(timezone.utc)
        fingerprint = self.compute_fingerprint(signal)

        # Evict expired fingerprints
        expired_keys = [
            k for k, (ts, _) in self._active_fingerprints.items()
            if (current_time - ts) > self.window
        ]
        for k in expired_keys:
            del self._active_fingerprints[k]

        if fingerprint in self._active_fingerprints:
            _, existing_id = self._active_fingerprints[fingerprint]
            return True, existing_id

        return False, None

    def register(self, signal: TelemetrySignal, crisis_id: str, now: Optional[datetime] = None) -> None:
        """Registers a newly detected crisis event into the deduplication cache."""
        current_time = now or datetime.now(timezone.utc)
        fingerprint = self.compute_fingerprint(signal)
        self._active_fingerprints[fingerprint] = (current_time, crisis_id)

    def clear(self) -> None:
        """Resets deduplication store (primarily for isolated test fixtures)."""
        self._active_fingerprints.clear()


# Global default deduplicator instance for standard runtime
_DEFAULT_DEDUPLICATOR = IncidentDeduplicator()


def get_default_deduplicator() -> IncidentDeduplicator:
    """Access default global deduplicator instance."""
    return _DEFAULT_DEDUPLICATOR


def detect_crisis_from_signal(
    signal: TelemetrySignal,
    deduplicator: Optional[IncidentDeduplicator] = None,
) -> DetectionResult:
    """
    Evaluates an operational telemetry signal against explicit domain rules.

    Supported Signal Types & Rules:
    1. SUPPLIER_OUTAGE: Facility fire, bankruptcy, shutdown, or force majeure notices.
    2. LOW_STOCK: Warehouse inventory below safety buffer or zero stockout.
    3. SHIPMENT_DELAY: Transit delay exceeding allowable buffer (>= 3 days).
    4. DEMAND_SPIKE: Order intake surge exceeding baseline by >= 25%.

    Returns DetectionResult with structured CrisisEvent when criteria are met.
    """
    dedup = deduplicator if deduplicator is not None else _DEFAULT_DEDUPLICATOR

    # Validate essential input structure
    if not signal.product_ids:
        return DetectionResult(
            crisis_detected=False,
            is_duplicate=False,
            reason="Invalid signal: affected product_ids list cannot be empty",
        )

    if not signal.entity_id or not signal.entity_id.strip():
        return DetectionResult(
            crisis_detected=False,
            is_duplicate=False,
            reason="Invalid signal: entity_id cannot be blank",
        )

    # Step 1: Duplicate check
    is_dup, existing_crisis_id = dedup.is_duplicate(signal)
    if is_dup:
        logger.warning(
            f"Duplicate operational signal received for entity {signal.entity_id} "
            f"({signal.signal_type.value}). Matching active crisis: {existing_crisis_id}"
        )
        return DetectionResult(
            crisis_detected=False,
            crisis_event=None,
            is_duplicate=True,
            reason=f"Duplicate signal suppressed: identical incident already active as {existing_crisis_id}",
        )

    # Step 2: Explicit domain rule evaluations
    crisis_event: Optional[CrisisEvent] = None
    rule_name: Optional[str] = None
    reason: str = ""

    # RULE 1: SUPPLIER OUTAGE
    if signal.signal_type == SignalType.SUPPLIER_OUTAGE:
        outage_type = str(signal.data.get("outage_reason", "FACTORY_SHUTDOWN")).upper()
        estimated_downtime = int(signal.data.get("estimated_downtime_days", 14))

        if "FIRE" in outage_type:
            event_type = CrisisType.FACTORY_FIRE
            severity = SeverityLevel.CRITICAL
        elif "BANKRUPT" in outage_type:
            event_type = CrisisType.SUPPLIER_BANKRUPTCY
            severity = SeverityLevel.CRITICAL
        elif estimated_downtime >= 30:
            event_type = CrisisType.CAPACITY_SHUTDOWN
            severity = SeverityLevel.CRITICAL
        else:
            event_type = CrisisType.CAPACITY_SHUTDOWN
            severity = SeverityLevel.HIGH

        rule_name = "RULE_SUPPLIER_OUTAGE_TRIGGER"
        crisis_id = f"CR-SUP-{int(signal.timestamp.timestamp())}"
        description = (
            f"Supplier outage at {signal.entity_id}: {outage_type}. "
            f"Projected downtime: {estimated_downtime} days. Disrupted products: {', '.join(signal.product_ids)}"
        )
        crisis_event = CrisisEvent(
            crisis_id=crisis_id,
            event_type=event_type,
            severity=severity,
            affected_product_ids=signal.product_ids,
            created_at=signal.timestamp,
            status=CrisisStatus.DETECTED,
            supplier_id=signal.entity_id,
            supplier_name=signal.data.get("supplier_name"),
            description=description,
            source=signal.source,
            raw_payload=signal.data,
        )
        reason = f"Supplier outage confirmed with estimated downtime of {estimated_downtime} days."

    # RULE 2: LOW STOCK (CRITICAL BUFFER BREACH)
    elif signal.signal_type == SignalType.LOW_STOCK:
        current_stock = int(signal.data.get("current_stock", 0))
        safety_stock = int(signal.data.get("safety_stock", 0))
        critical_threshold = int(signal.data.get("critical_threshold", safety_stock // 2))

        # Check if stock has breached safety threshold
        if current_stock <= critical_threshold:
            if current_stock == 0:
                severity = SeverityLevel.CRITICAL
                status_desc = "Complete zero-inventory stockout"
            else:
                severity = SeverityLevel.HIGH
                status_desc = f"Stock level ({current_stock:,} units) below critical threshold ({critical_threshold:,})"

            rule_name = "RULE_INVENTORY_BUFFER_EXHAUSTION"
            crisis_id = f"CR-INV-{int(signal.timestamp.timestamp())}"
            description = (
                f"Severe inventory shortfall at {signal.entity_id} for {', '.join(signal.product_ids)}: "
                f"{status_desc} (Safety stock target: {safety_stock:,})"
            )
            crisis_event = CrisisEvent(
                crisis_id=crisis_id,
                event_type=CrisisType.RAW_MATERIAL_SHORTAGE,
                severity=severity,
                affected_product_ids=signal.product_ids,
                created_at=signal.timestamp,
                status=CrisisStatus.DETECTED,
                facility_id=signal.entity_id,
                description=description,
                source=signal.source,
                raw_payload=signal.data,
            )
            reason = f"Stock ({current_stock}) breached critical safety reserve ({critical_threshold})."
        else:
            return DetectionResult(
                crisis_detected=False,
                is_duplicate=False,
                reason=f"Current stock ({current_stock}) is above critical threshold ({critical_threshold}); no crisis declared.",
            )

    # RULE 3: SHIPMENT DELAY
    elif signal.signal_type == SignalType.SHIPMENT_DELAY:
        delay_days = int(signal.data.get("delay_days", 0))
        is_port_blockade = bool(signal.data.get("port_congestion") or signal.data.get("is_blockade"))

        # Rule: Delays >= 3 days or blockades qualify as crises
        if delay_days >= 3 or is_port_blockade:
            if delay_days >= 14 or is_port_blockade:
                severity = SeverityLevel.HIGH
                event_type = CrisisType.TRANSPORT_BLOCKADE
            elif delay_days >= 7:
                severity = SeverityLevel.MEDIUM
                event_type = CrisisType.TRANSPORT_BLOCKADE
            else:
                severity = SeverityLevel.LOW
                event_type = CrisisType.TRANSPORT_BLOCKADE

            rule_name = "RULE_LOGISTICS_DELAY_THRESHOLD"
            crisis_id = f"CR-LOG-{int(signal.timestamp.timestamp())}"
            description = (
                f"Inbound shipment delay on shipment {signal.entity_id}: {delay_days} days overdue. "
                f"{'Port blockade / severe congestion active.' if is_port_blockade else ''} "
                f"Impacts SKU(s): {', '.join(signal.product_ids)}"
            )
            crisis_event = CrisisEvent(
                crisis_id=crisis_id,
                event_type=event_type,
                severity=severity,
                affected_product_ids=signal.product_ids,
                created_at=signal.timestamp,
                status=CrisisStatus.DETECTED,
                description=description,
                source=signal.source,
                raw_payload=signal.data,
            )
            reason = f"Shipment delayed by {delay_days} days exceeding 3-day tolerance."
        else:
            return DetectionResult(
                crisis_detected=False,
                is_duplicate=False,
                reason=f"Shipment delay of {delay_days} days is within normal operating variance (< 3 days).",
            )

    # RULE 4: SUDDEN DEMAND SPIKE
    elif signal.signal_type == SignalType.DEMAND_SPIKE:
        baseline_demand = float(signal.data.get("baseline_demand_units", 1000.0))
        current_demand = float(signal.data.get("current_demand_units", 1000.0))
        surge_ratio = current_demand / baseline_demand if baseline_demand > 0 else 1.0
        surge_percent = (surge_ratio - 1.0) * 100.0

        # Rule: Demand surge >= 25% triggers operational reallocation
        if surge_percent >= 25.0:
            if surge_percent >= 75.0:
                severity = SeverityLevel.HIGH
            elif surge_percent >= 50.0:
                severity = SeverityLevel.MEDIUM
            else:
                severity = SeverityLevel.LOW

            rule_name = "RULE_DEMAND_SURGE_THRESHOLD"
            crisis_id = f"CR-DMD-{int(signal.timestamp.timestamp())}"
            description = (
                f"Abrupt demand spike on {', '.join(signal.product_ids)}: "
                f"+{surge_percent:.1f}% over baseline ({current_demand:,.0f} vs {baseline_demand:,.0f} units)"
            )
            crisis_event = CrisisEvent(
                crisis_id=crisis_id,
                event_type=CrisisType.RAW_MATERIAL_SHORTAGE,
                severity=severity,
                affected_product_ids=signal.product_ids,
                created_at=signal.timestamp,
                status=CrisisStatus.DETECTED,
                facility_id=signal.entity_id,
                description=description,
                source=signal.source,
                raw_payload=signal.data,
            )
            reason = f"Demand surge of +{surge_percent:.1f}% exceeded the 25% tolerance threshold."
        else:
            return DetectionResult(
                crisis_detected=False,
                is_duplicate=False,
                reason=f"Demand variation (+{surge_percent:.1f}%) is within standard forecasting threshold (< 25%).",
            )

    else:
        return DetectionResult(
            crisis_detected=False,
            is_duplicate=False,
            reason=f"Signal type {signal.signal_type.value} did not match any operational disruption rules.",
        )

    # Register into deduplication cache if crisis event generated
    if crisis_event:
        dedup.register(signal, crisis_event.crisis_id, signal.timestamp)
        logger.info(f"Crisis successfully declared: {crisis_event.crisis_id} ({crisis_event.severity.value}) via {rule_name}")
        return DetectionResult(
            crisis_detected=True,
            crisis_event=crisis_event,
            is_duplicate=False,
            detection_rule=rule_name,
            reason=reason,
        )

    return DetectionResult(crisis_detected=False, is_duplicate=False, reason="No disruption criteria satisfied")
