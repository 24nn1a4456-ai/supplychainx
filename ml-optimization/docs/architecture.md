# Supply Chain X — Architecture

## System Overview

Supply Chain X is an Autonomous Supply Chain Crisis Manager that detects disruptions, coordinates specialist AI agents, generates optimal recovery plans via CP-SAT optimization, enforces human approval, and simulates outcomes through a digital twin.

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                   React Dashboard (Vite+TS+Tailwind)     │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│  │Dashboard│ │Disruption│ │ Approval │ │ Digital Twin│  │
│  │Overview │ │ Center   │ │ Center   │ │  Viewer     │  │
│  └────┬────┘ └────┬─────┘ └────┬─────┘ └──────┬──────┘  │
└───────┼──────────┼──────────┼─────────────┼──────────────┘
        │          │          │             │
        ▼          ▼          ▼             ▼
┌──────────────── FastAPI REST API ─────────────────────────┐
│  /api/health  /api/disruptions  /api/plans  /api/audit    │
└───────────────────────┬──────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────┐
│              Crisis Manager (Orchestrator)                │
│                                                          │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐         │
│  │ Supplier │  │ Inventory │  │  Logistics   │         │
│  │  Agent   │  │   Agent   │  │    Agent     │         │
│  └────┬─────┘  └─────┬─────┘  └──────┬───────┘         │
│       │              │               │                   │
│       ▼              ▼               ▼                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │        Engine Adapter (bridge to Member 4)        │   │
│  │  create_disruption → scenario_to_optimizer_inputs │   │
│  │  → plan_recovery → compute_kpis                   │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────┐
│              Member 4 Decision Engine (existing)          │
│  ┌───────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ Simulator │  │ CP-SAT   │  │ Greedy   │  │  KPIs  │ │
│  │ Scenarios │  │ Solver   │  │ Fallback │  │        │ │
│  └───────────┘  └──────────┘  └──────────┘  └────────┘ │
└──────────────────────────────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────┐
│                 Persistence (SQLite)                      │
│  suppliers  inventory  warehouses  disruptions  plans     │
│  approvals  simulations  audit_events                     │
└──────────────────────────────────────────────────────────┘
```

## Call Chain

```
1. User triggers disruption via dashboard
2. POST /api/disruptions → creates DisruptionRecord
3. POST /api/disruptions/{id}/analyze
   → CrisisManager.analyze(disruption)
     → SupplierAgent.assess(disruption)
     → InventoryAgent.assess(disruption)
     → LogisticsAgent.assess(disruption)
     → EngineAdapter.generate_plan(disruption, agent_results)
       → create_disruption(scenario)
       → scenario_to_optimizer_inputs(state)
       → plan_recovery(demands, warehouses, suppliers, config)
       → compute_kpis(approach, state, demands, plan)
     → store RecoveryPlan + KPIs
4. GET /api/plans/{id} → view plan
5. POST /api/plans/{id}/approve → ApprovalRecord
6. POST /api/plans/{id}/simulate → DigitalTwin.execute(plan)
   → validate approved & feasible
   → snapshot before-state
   → apply simulated actions
   → snapshot after-state
   → store SimulationRun + AuditEvent
7. Dashboard reflects actual backend state
```
