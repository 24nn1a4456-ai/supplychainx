# Supply Chain X — Hackathon Demo Guide & Runbook

Welcome to **Supply Chain X: Agentic AI Crisis Manager with Real-Time Meteorological Intelligence**.  
This runbook provides the exact steps, system commands, UI button names, stage-by-stage expectations, troubleshooting procedures, and a 3-minute presentation script.

---

## 1. Quick Launch & Environment Setup

### Prerequisites
- Python 3.11+ (with virtual environment at ackend/.venv)
- Node.js 18+ & npm
- Valid OPENWEATHER_API_KEY in ackend/.env (optional; system falls back gracefully to deterministic telemetry if absent)

### Step 1: Start Backend API Server
In a terminal at c:\Users\anuhy\Desktop\Frontend\backend:
`powershell
# Activate virtual environment and start FastAPI
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
`
- **Health Check:** http://127.0.0.1:8000/api/health returns {status:ok,database:connected}.
- **API Docs (Swagger):** http://127.0.0.1:8000/docs.

### Step 2: Start Frontend Application
In a second terminal at c:\Users\anuhy\Desktop\Frontend\frontend:
`powershell
# Launch Vite dev server
npm run dev -- --port 5173
`
- **Web App:** Open http://localhost:5173/ in any modern browser (optimized for 1440x900 or 1080p).

---

## 2. Safety & Sandboxing Boundary (Zero Real-World Orders)

> **SIMULATION-ONLY GUARANTEE:** Supply Chain X does **not** dispatch real purchase orders, supplier contracts, bank payments, or carrier bookings. All execution actions operate inside a sandboxed state machine that modifies internal inventory buffers, production line scheduling, and generates immutable cryptographic audit records.

---

## 3. Step-by-Step Demo Sequence & UI Guide

| Step | Section / Modal | Button / Interaction | Expected UI State & Result |
| :---: | :--- | :--- | :--- |
| **1** | Top Header | Click **Reset Demo** (circular reload icon) | Status badge switches to **Baseline (Nominal)**. All 10 multi-echelon nodes render green/blue in the 3D network. Resiliency index calibrated to 96.2%. |
| **2** | Weather Disruption Radar | Scroll to **Global Meteorological Disruptions** | Shows 4 key logistical cities (Austin, Monterrey, Silao, Guadalajara). Displays **LIVE OPENWEATHER** green badge when credentials are valid, or **TELEMETRY SIM** if using fallback telemetry. |
| **3** | Right Rail / Header | Click **Simulate Line Outage** or header **OUTAGE WORKFLOW** | Critical disruption detected at Austin Line 2 (Substation Meltdown / Supplier Starvation). Banner turns red: **STAGE: DETECTED**. Anomaly alert added to Disruption Feed. |
| **4** | Crisis Action Center | Click **Assess Affected Assets ->** | **STAGE: ASSESSING**. Calculates ,000 revenue exposure, 36-hour buffer depletion, starved lines, and SLA impact across Tier-1 retail grids. |
| **5** | Crisis Action Center | Click **3. Evaluate Alternative Suppliers ->** | Multi-agent orchestrator activates. Evaluates Tokyo Precision Optics (alt-supplier), Singapore Buffer Depot, and OpenWeather 5-day corridor forecast. |
| **6** | Crisis Action Center | Click **4. Synthesize Plan & Submit for Approval ->** | **STAGE: AWAITING_APPROVAL**. Policy gate locks execution with amber warning banner. Displays: <br>- **Meteorological Transit Risk:** 42/100 (MODERATE) with openweather_forecast data source.<br>- **Alternative Transport Options:** DHL Priority Air (.5k, 1.5d) vs. FedEx Expedited Ground (.2k, 3.0d) vs. Schneider Standard (.8k, 5.0d). |
| **7** | Gate Policy Test | Click **Reject Plan**, enter reason: *Exceeds budget cap*, confirm | **STAGE: REJECTED**. Execution is strictly locked (**HTTP 403 Forbidden** enforced at API layer). Shows human-in-the-loop governance veto. |
| **8** | Re-Planning | Click **Re-plan Sourcing Options** | Orchestrator regenerates recovery constraints and returns state to **AWAITING_APPROVAL**. |
| **9** | Supervisor Sign-off | Click **Approve Plan** -> Click **Confirm (Approve)** | **STAGE: APPROVED**. Policy gate unlocks. Green verification badge displayed: *Plan Authorized by Operations Lead*. |
| **10** | Sandboxed Execution | Click **Execute Simulated Actions** -> Confirm | **STAGE: EXECUTING -> COMPLETED**. Progress bar steps through 5 actions: expedited purchase order, air charter reservation, production line rebalance, inventory transfer, and customer SLA dispatch. |
| **11** | Governance Audit | Click **5. Audit Timeline** tab in modal | Complete immutable timeline showing all 14 chronological events (Reset, Detection, Assessment, Plan Synthesis, Rejection, Approval, Execution). |

---

## 4. Key Talking Points for Judges

1. **Autonomous Detection + Human Gate:**
   - Autonomous multi-agent solver calculates optimal balance of speed, cost, and risk, but **never dispatches without explicit human approval**.
2. **Weather-Grounded Recovery Decisions:**
   - Real-time OpenWeather 5-day / 3-hour forecast integration prevents routing high-value components into storm or high-wind flight embargoes.
3. **Deterministic Fallback Resilience:**
   - If weather APIs experience outages or rate limits, the system does not fail or hallucinate; it transparently switches to deterministic historical transit curves and explicitly labels the data source.
4. **Immutable Audit Trail:**
   - Every agent assessment, model recommendation, and supervisor veto is recorded with UTC timestamps, actor signatures, and status codes.

---

## 5. Troubleshooting & Frequently Asked Questions

### Backend says Method Not Allowed (405)
- Ensure crisis workflow endpoints (/api/crisis/outage/*) are called via POST, not GET.

### Frontend displays Offline Demo Telemetry Adapter
- Check that the FastAPI server is running on http://127.0.0.1:8000.
- Click the refresh button in the top navigation bar to trigger a live sync.

### Weather Panel shows TELEMETRY SIM instead of LIVE OPENWEATHER
- Verify ackend/.env has OPENWEATHER_API_KEY=your_key_here without extra quotes or spaces.
- Restart the backend Uvicorn process so the environment file is re-read.

### How to reset if the demo gets stuck in a weird state?
- Click the **Reset Demo** button in the top navigation bar or issue:
  `ash
  curl -X POST http://127.0.0.1:8000/api/demo/reset
  `

---

## 6. Three-Minute Presentation Script

**[0:00 - 0:30] The Problem & System Setup**
> *Judges, global supply chain disruptions cost enterprises over .6 trillion annually. When a component supplier experiences a factory shutdown, operations leaders spend 24 to 48 hours manually tracking spreadsheets, calling carriers, and guessing weather delays. 
> We built **Supply Chain X**: an agentic AI crisis manager that detects disruptions in seconds, synthesizes multi-echelon recovery plans, evaluates live meteorological corridor risk, and enforces strict human-in-the-loop governance before any action is taken.*

**[0:30 - 1:00] Detection & Disruption Radar**
> *Here on the dashboard, you see our 10-node supply chain topology spanning Austin, Shenzhen, Tokyo, and Mexico. Down below is our **Global Meteorological Disruption Radar**, ingesting live OpenWeather telemetry for key logistical corridors. 
> Watch as I simulate a critical failure at our primary silicon supplier. Immediately, our Detection Agent flags a Cat-4 typhoon and substation outage. The system shifts into crisis mode.*

**[1:00 - 1:45] Impact Assessment & Weather-Aware Planning**
> *With one click, Agent 2 calculates the blast radius: 36 hours of inventory runway left at our Austin plant, putting ,000 of daily output and Tier-1 customer SLAs at risk. 
> Next, our multi-constraint recovery solver evaluates alternative qualified suppliers in Tokyo and Dresden. Crucially, it queries live OpenWeather 5-day forecasts along the transit corridor. Rather than flying blind, the agent compares priority air against ground options, scoring route weather at 42/100 Moderate and confirming the air corridor is safe for expedited dispatch.*

**[1:45 - 2:20] Safe Approval Gate & Human Oversight**
> *Notice the plan cannot execute autonomously. Our policy engine locks the workflow at AWAITING_APPROVAL. If I reject the plan because costs exceed discretionary thresholds, the system blocks execution with an HTTP 403 Forbidden. The agent cannot bypass human authority. 
> Once we re-evaluate and provide supervisor sign-off, the gate unlocks.*

**[2:20 - 3:00] Simulated Execution & Audit Verification**
> *We click Execute, and the system coordinates 5 automated actions: purchase order diversion, air charter hold, line re-balancing, and proactive customer notifications—all fully sandboxed in simulation. 
> Finally, every single action, rejection, and decision is cryptographically cataloged in our immutable **Audit Timeline** for compliance. 
> Supply Chain X turns 48 hours of crisis firefighting into 90 seconds of audited, weather-intelligent decision making. Thank you!*
