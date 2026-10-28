# Supply Chain X – Autonomous Supply Chain Crisis Manager
## Module: Agentic AI Crisis Manager (Member 1)

This module implements the **Agentic AI Crisis Manager** for Supply Chain X. When a supplier suddenly fails, stock runs critically low, port bottlenecks occur, or demand surges, this engine coordinates five specialized domain agents, computes operational and financial blast radius, formulates a cost- and time-optimal recovery plan, enforces human-in-the-loop governance, and verifies simulated recovery prior to any action.

---

## 1. Quick Start & Execution Commands

### Environment Setup
Python 3.11+ with Pydantic v2 and Pytest:
```bash
# Verify Python version
python3 --version

# Run full test suite (56 tests across all modules)
pytest -v

# Run the live interactive Hackathon demonstration script
python3 backend/agents/demo.py
```

### Run Specific Test Modules
```bash
# Orchestration pipeline and failure cases (10 tests)
pytest backend/agents/tests/test_crisis_manager.py -v

# Specialist agents: Detection, Impact, Supplier, Inventory, Logistics (27 tests)
pytest backend/agents/tests/test_specialist_agents.py -v

# Pydantic v2 schemas and validation constraints (19 tests)
pytest backend/agents/tests/test_schemas.py -v
```

---

## 2. Multi-Agent Architecture & 11-Step Workflow

```
                             [Operational Alert / Telemetry Stream]
                                               │
                                               ▼
                              ┌───────────────────────────────────┐
                              │ Step 1 & 2: Detection Agent       │ (Rule-based, 24h Deduplication)
                              └─────────────────┬─────────────────┘
                                                │ CrisisEvent
                                                ▼
                              ┌───────────────────────────────────┐
                              │ Step 3: Impact Assessment Agent   │ (Days-to-stockout, Customer Orders)
                              └─────────────────┬─────────────────┘
                                                │ ImpactAssessment
                                                ▼
                              ┌───────────────────────────────────┐
                              │     Crisis Manager Orchestrator   │
                              └─────────────────┬─────────────────┘
                                                │
                 ┌──────────────────────────────┼──────────────────────────────┐
                 ▼                              ▼                              ▼
      ┌─────────────────────┐        ┌─────────────────────┐        ┌─────────────────────┐
      │ Step 4: Supplier    │        │ Step 5: Inventory   │        │ Step 6: Logistics   │
      │ - Reliability floor │        │ - Safety stock hold │        │ - Multi-modal costs │
      │ - Lead time checks  │        │ - Depot transfers   │        │ - Weight & SLA caps │
      │ - Candidate ranking │        │ - Shortfall summary │        │ - Gap disclosure    │
      └──────────┬──────────┘        └──────────┬──────────┘        └──────────┬──────────┘
                 │                              │                              │
                 └──────────────────────────────┼──────────────────────────────┘
                                                ▼
                              ┌───────────────────────────────────┐
                              │ Step 7: Optimization Engine (M4)  │ (Deterministic Fallback Solver)
                              └─────────────────┬─────────────────┘
                                                ▼
                              ┌───────────────────────────────────┐
                              │ Step 8: Trade-off Synthesis       │ (Strategic Narrative Rationale)
                              └─────────────────┬─────────────────┘
                                                ▼
                              ┌───────────────────────────────────┐
                              │ Step 9: Governance Gatekeeper     │ (Cost & Lead-time Policy Checks)
                              └─────────────────┬─────────────────┘
                                                ▼
                              ┌───────────────────────────────────┐
                              │ Step 10: Plan Synthesis & Store   │ (Submitted to Member 2 Backend)
                              └─────────────────┬─────────────────┘
                                                │
                        ┌───────────────────────┴───────────────────────┐
                        │                                               │
              [Approval Required]                             [Simulation Ready]
                        ▼                                               ▼
            ┌───────────────────────┐                                   │
            │  ApprovalRequest (UI) │                                   │
            │  Manager Approval     │                                   │
            └───────────┬───────────┘                                   │
                        │ Approved                                      │
                        └───────────────────────┬───────────────────────┘
                                                ▼
                              ┌───────────────────────────────────┐
                              │ Step 11: Recovery Monitor Verify  │ (Digital Twin Simulator Verification)
                              │ RecoveryResult (Truthful Metrics) │
                              └───────────────────────────────────┘
```

### The 11-Step Orchestration Lifecycle
1. **Receive and Validate**: Validates the incoming crisis payload against strict Pydantic schemas.
2. **Confirm Detection**: Evaluates operational telemetry against explicit threshold rules and dedupes repeated alarms within a 24h sliding window.
3. **Assess Impact**: Deterministically calculates component inventory, burn rates, days-to-stockout, revenue exposure, and delayed customer sales orders.
4. **Evaluate Suppliers**: Disqualifies unreliable or capacity-constrained vendors; computes composite score ranking.
5. **Evaluate Inventory**: Identifies transferable depot stocks while strictly preserving safety stock buffers (`reallocatable <= available - safety_stock`).
6. **Evaluate Logistics**: Analyzes multi-modal freight corridors (Air Freight, Expedited Truck, Standard Truck) under payload weight and lead-time constraints.
7. **Solve Recovery**: Dispatches validated candidates to Member 4's MILP optimizer. If unavailable, seamlessly engages the deterministic fallback solver.
8. **Synthesize Trade-Offs**: Formulates an executive strategic trade-off narrative explaining why specific inventory and supplier choices were prioritized.
9. **Evaluate Governance**: Evaluates autonomous expenditure caps (`$10,000.00` default) and maximum recovery time limits. Creates an `ApprovalRequest` if thresholds are exceeded.
10. **Synthesize & Submit Plan**: Persists the structured `RecoveryPlan` into Member 2's backend plan repository with status `PENDING_APPROVAL` or `READY_FOR_SIMULATION`.
11. **Verify Outcome**: After authorization, requests digital twin simulation execution from Member 4 and validates physical demand coverage and lead-time slack.

---

## 3. Specialist Agents Summary

| Agent | Module | Input Schema | Output Schema | Key Rule / Invariant |
| :--- | :--- | :--- | :--- | :--- |
| **Agent 1: Detection** | `detection_agent.py` | `TelemetrySignal` | `DetectionResult` | 24-hour sliding window deduplication; rule-based trigger |
| **Agent 2: Impact** | `impact_agent.py` | `ImpactAssessmentInput` | `ImpactAssessmentResult` | Pure Python calculations; no LLM-generated math |
| **Agent 3: Supplier** | `supplier_agent.py` | `SupplierEvaluationInput` | `SupplierEvaluationResult` | Excludes failing vendor; reliability floor >= 0.70 |
| **Agent 4: Inventory** | `inventory_agent.py` | `InventoryRecoveryInput` | `InventoryRecoveryResult` | Strict safety stock preservation: `reallocatable <= stock - safety` |
| **Agent 5: Logistics** | `logistics_agent.py` | `LogisticsRecoveryInput` | `LogisticsRecoveryResult` | Explicit warnings for missing telemetry; modal SLA checks |

---

## 4. Public Interfaces for Teammates

### Interfaces for Member 2 (Backend & Database)
Exposed in `backend/agents/crisis_manager.py`:

```python
# 1. Primary Async Orchestration Interface
async def analyze_crisis(
    crisis_id: str,
    crisis_event: Optional[CrisisEvent] = None,
    destination_facility: str = "Assembly Plant 1, Detroit, MI, USA",
    config: Optional[AgentConfig] = None,
    tools: Optional[ToolRegistry] = None,
) -> RecoveryPlan:
    """Executes Steps 1-10 and returns the synthesized RecoveryPlan."""

# 2. Step 11 Simulation Verification Interface
async def confirm_and_verify_recovery(
    crisis_id: str,
    plan: Optional[RecoveryPlan] = None,
    config: Optional[AgentConfig] = None,
    tools: Optional[ToolRegistry] = None,
) -> RecoveryResult:
    """Requests digital twin simulation from backend and returns verified physical outcome."""

# 3. Governance Gatekeeper (Authorization Sign-Off)
async def authorize_and_execute_simulated_recovery(
    crisis_id: str,
    plan_id: str,
    decision: ApprovalDecision,  # APPROVED or REJECTED
    decided_by: str = "OperationsManager",
    notes: Optional[str] = None,
    tools: Optional[ToolRegistry] = None,
) -> Tuple[bool, Optional[RecoveryResult], str]:
    """
    Enforces authorization gatekeeping.
    If REJECTED: Strictly blocks execution and returns (False, None, reason).
    If APPROVED: Triggers Member 4 simulation and returns (True, sim_result, notes).
    """

# 4. FastAPI Endpoint Bridge
def execute_crisis_resolution_service(
    crisis_payload: Dict[str, Any],
    config: Optional[AgentConfig] = None,
    full_diagnostics: bool = False,
) -> Dict[str, Any]:
    """Synchronous FastAPI / Express route handler returning serialized JSON response."""
```

### Data Provider Contracts (`backend/agents/tools.py`)
Member 2 implements these interfaces to connect the agent engine to real PostgreSQL tables:
- `SupplierDataProvider`: `get_alternative_suppliers(product_id, excluded_supplier_id) -> List[SupplierOption]`
- `InventoryDataProvider`: `get_inventory_options(product_id) -> List[InventoryOption]`
- `LogisticsDataProvider`: `get_freight_options(origin, destination) -> List[LogisticsOption]`
- `OperationsDataProvider`: `get_customer_orders(product_id) -> List[CustomerOrder]`, `get_production_requirements(product_id) -> List[ProductionRequirement]`
- `CrisisEventStore`: `get_crisis_event(crisis_id) -> Optional[CrisisEvent]`, `save_crisis_event(crisis: CrisisEvent) -> None`
- `PlanExecutionService`: `submit_recovery_plan(plan, approval_request)`, `record_approval_decision(plan_id, decision, decided_by)`

### Interfaces for Member 4 (Optimizer & Digital Twin Simulator)
Exposed in `backend/agents/tools.py`:
- `OptimizationEngineClient`: `solve_recovery_plan(crisis_id, demands, supplier_options, inventory_options, logistics_options, target_recovery_days) -> Dict[str, Any]`
- `SimulationEngineClient`: `request_simulated_execution(crisis_id, plan) -> RecoveryResult`

---

## 5. Example Inputs & Outputs

### Input: `CrisisEvent` (Supplier Shutdown)
```json
{
  "crisis_id": "CR-2026-CHIP-SHORTAGE-001",
  "event_type": "CAPACITY_SHUTDOWN",
  "severity": "HIGH",
  "affected_product_ids": ["SKU-MCU-328P"],
  "supplier_id": "VEND-PRIMARY-FAB-09",
  "supplier_name": "Apex Semiconductor Litho Foundry",
  "facility_id": "FAB-CLEANROOM-02",
  "description": "Primary lithography cleanroom halted due to equipment contamination. 5 days estimated downtime.",
  "status": "DETECTED",
  "source": "SUPPLIER_PORTAL"
}
```

### Output: Synthesized `RecoveryPlan`
```json
{
  "plan_id": "PLAN-CR-2026-CHIP-SHORTAGE-001-01",
  "crisis_id": "CR-2026-CHIP-SHORTAGE-001",
  "recommended_actions": [
    {
      "action_id": "ACT-INV-a1f9e012",
      "action_type": "INVENTORY_BUFFER_RELEASE",
      "description": "Reallocate 2,500 units of SKU-MCU-328P from Austin, TX, USA (WH-AUSTIN-01)",
      "required_quantity": 2500,
      "estimated_cost": 875.00,
      "expected_lead_time": 2,
      "approval_requirement": "AUTONOMOUS",
      "status": "PROPOSED",
      "target_entity_id": "WH-AUSTIN-01"
    },
    {
      "action_id": "ACT-INV-b7c3d441",
      "action_type": "INVENTORY_BUFFER_RELEASE",
      "description": "Reallocate 2,700 units of SKU-MCU-328P from Rotterdam, Netherlands (WH-ROTTERDAM-04)",
      "required_quantity": 2700,
      "estimated_cost": 2295.00,
      "expected_lead_time": 4,
      "approval_requirement": "AUTONOMOUS",
      "status": "PROPOSED",
      "target_entity_id": "WH-ROTTERDAM-04"
    },
    {
      "action_id": "ACT-SUP-c8401e52",
      "action_type": "SUPPLIER_REALLOCATION",
      "description": "Purchase 3,050 units of SKU-MCU-328P from backup vendor Nexus Semiconductor Global",
      "required_quantity": 3050,
      "estimated_cost": 13725.00,
      "expected_lead_time": 5,
      "approval_requirement": "OPERATIONS_LEAD",
      "status": "PROPOSED",
      "target_entity_id": "VEND-NEXUS-01"
    },
    {
      "action_id": "ACT-LOG-e921b77a",
      "action_type": "EXPEDITED_LOGISTICS",
      "description": "Engage DHL Express Priority Air for expedited transit from Austin, TX, USA to Assembly Plant 1, Detroit, MI, USA",
      "required_quantity": 8250,
      "estimated_cost": 3800.00,
      "expected_lead_time": 2,
      "approval_requirement": "AUTONOMOUS",
      "status": "PROPOSED",
      "target_entity_id": "CARR-DHL-EXP"
    }
  ],
  "estimated_total_cost": 20695.00,
  "estimated_recovery_time": 5,
  "assumptions": [
    "Warehouse reallocations preserve minimum domestic safety stock buffers",
    "Quoted supplier unit rates fixed for immediate dispatch within 48 hours",
    "Logistics slots booked on priority carrier schedules",
    "Strategic Trade-off Analysis: Prioritized immediate internal warehouse buffer (5,200 units) to bridge the critical stockout window at lowest handling cost. Covered residual shortfall via qualified secondary sourcing."
  ],
  "approval_status": "PENDING_APPROVAL"
}
```

### Output: `ApprovalRequest` Ticket
```json
{
  "request_id": "APPRQ-CR-2026-CHIP-SHORTAGE-001",
  "crisis_id": "CR-2026-CHIP-SHORTAGE-001",
  "plan_id": "PLAN-CR-2026-CHIP-SHORTAGE-001-01",
  "cost_threshold_exceeded": true,
  "lead_time_threshold_exceeded": false,
  "requires_human_approval": true,
  "requested_by": "AgenticCrisisManager",
  "reason": "Estimated plan cost ($20,695.00) exceeds autonomous limit ($10,000.00); Disruption severity is HIGH; Action ACT-SUP-c8401e52 mandates managerial authorization",
  "actions_requiring_approval": ["ACT-SUP-c8401e52"],
  "decision": "PENDING"
}
```

---

## 6. Demonstration Scenario Walkthrough (`demo.py`)

Run the script:
```bash
python3 backend/agents/demo.py
```

### Script Narrative
1. **Scenario Setup**: An automotive electronics manufacturer requires `SKU-MCU-328P` (microcontroller IC) at its Detroit Assembly Plant.
2. **Step 1 (Signal Ingest)**: Primary fab `VEND-PRIMARY-FAB-09` issues a force majeure notification (5-day cleanroom contamination shutdown).
3. **Step 2 (Impact)**: Agent 2 computes 10.3 days of component buffer remaining, flags 2 delayed customer orders (Ford Motor Company tier-1 critical: `$360,000.00`; Bosch Automotive: `$300,000.00`), totaling `$660,000.00` revenue exposure.
4. **Step 3 (Specialist Search)**:
   - Agent 3 qualifies Nexus Semiconductor (`5,000` units @ `$4.50`, 5d lead time, `0.94` reliability) and Pacific Microtech; rejects an unreliable vendor.
   - Agent 4 evaluates secondary warehouse stock: allocates `2,500` units from Austin and `2,700` units from Rotterdam while preserving safety stock floors.
   - Agent 5 evaluates multi-modal corridors (DHL Air Priority, FedEx Expedited Truck, Schneider Standard).
5. **Step 4 (Plan Synthesis)**: Formulates an optimal plan totaling `$20,695.00` over a 5-day recovery window.
6. **Step 5 (Approval Gatekeeping)**: Cost exceeds the `$10,000.00` autonomous threshold. The orchestrator triggers an `ApprovalRequest` and sets status to `PENDING_APPROVAL`. The script proves that attempting to simulate execution prior to authorization is blocked.
7. **Step 6 (Manager Sign-Off)**: Manager role `VP_Operations` records `APPROVED`.
8. **Step 7 (Simulation Verification)**: Member 4's digital twin simulator confirms `VERIFIED_FEASIBLE`: 100% demand coverage restored, `+9.0` days lead-time slack buffer, zero unmitigated residual risks.

---

## 7. Mandatory Failure Cases

The test suite explicitly tests all five failure scenarios required by the specification:

| Failure Test Case | Test Method in `test_crisis_manager.py` | Behavior Verified |
| :--- | :--- | :--- |
| **1. No Backup Supplier** | `test_failure_no_backup_supplier` | Supplier evaluation returns 0 qualified vendors; plan fulfills from inventory buffer and flags unfulfilled demand without inventing vendors. |
| **2. Insufficient Stock** | `test_failure_insufficient_stock` | All warehouses have stock <= safety stock; inventory agent allocates 0 units; system relies on alternative suppliers. |
| **3. Optimizer Crash** | `test_failure_optimization_failure` | Member 4 optimizer raises an exception; system gracefully triggers deterministic fallback, logs the event, and completes plan synthesis. |
| **4. Rejected Approval** | `test_failure_rejected_approval` | Manager rejects approval request; `authorize_and_execute_simulated_recovery` sets plan status to `REJECTED` and strictly blocks execution. |
| **5. Simulation Failure** | `test_failure_failed_simulated_execution` | Digital twin simulator reports physical breakdown; recovery monitor truthfully returns `SIMULATION_FAILED` without claiming false success. |

---

## 8. Verification Record (Tested vs. Unverified)

### What Has Been Fully Tested & Passed
- **56 Automated Tests Passing (100% Pass Rate)**:
  - `backend/agents/tests/test_schemas.py`: 19 tests validating Pydantic models, bounds, and cost consistency rules.
  - `backend/agents/tests/test_specialist_agents.py`: 27 tests validating all 5 specialist agents, data degradation, deduplication, and bounds.
  - `backend/agents/tests/test_crisis_manager.py`: 10 tests validating end-to-end orchestration, idempotency hashing, step audit logging, and all 5 mandatory failure cases.
- **End-to-End Demo Script (`demo.py`)**: Executes cleanly from command line without warnings or exceptions.
- **Strict Calculations**: Mathematical functions for stockout, revenue exposure, and multi-depot safety stock are purely deterministic in Python.
- **Governance Gatekeeping**: Confirmed that execution without authorization is blocked by the orchestrator.

### What Remains Unverified (Teammate Boundary Record)
- **Live Remote Network Endpoints**: Real HTTP network requests to Member 2's remote PostgreSQL container and Member 4's remote MILP solver have not been executed across the network, as their live microservices have not yet been deployed to staging URLs. The module relies on verified typed abstract contracts (`tools.py`) that can be switched to live URLs via `MOCK_DATA_MODE=false`.
- **Production UI State Synchronization**: Real-time WebSocket event pushes to the frontend dashboard depend on Member 2's notification bridge.
