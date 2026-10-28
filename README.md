# Supply Chain X — Autonomous Decision Support & Resilience Platform

An autonomous, multi-agent supply chain monitoring, mathematical optimization, and crisis mitigation platform built with **FastAPI**, **React 19**, **Three.js**, **Google OR-Tools (CP-SAT)**, and **Scikit-Learn**.

---

## 🚀 Live Production Deployments & URLs

| Component | Technology | Hosting | Target URL |
| :--- | :--- | :--- | :--- |
| **Integrated Dashboard** | React 19 + TypeScript + Tailwind CSS | Vercel | `https://supply-chain-x-dashboard.vercel.app` *(or custom Vercel domain)* |
| **Original Demo Prototype** | React 19 + Three.js 3D WebGL | Vercel | `https://supply-chain-x-prototype.vercel.app` *(or custom Vercel domain)* |
| **Backend REST API** | FastAPI + SQLite + OR-Tools + ML | Render | `https://supplychainmultiagent.onrender.com` |
| **Interactive API Docs** | OpenAPI / Swagger | Render | `https://supplychainmultiagent.onrender.com/docs` |

---

## 🌟 Architecture & Capabilities

### 1. Multi-Agent Crisis Monitoring Workflow
Interactive state machine with human-in-the-loop Role-Based Access Control (RBAC):
```text
[ 1. Idle ]
    │ (Disruption Event: Substation Meltdown / Harbor Embargo)
    ▼
[ 2. Detected ] ── Anomaly identified, factory starvation countdown initiated
    │ (Proceed to Assess)
    ▼
[ 3. Assessing ] ── Downstream impact quantified: affected lines, buffer runway, at-risk customer orders
    │ (Source Alternatives)
    ▼
[ 4. Planning ] ── Multi-Agent synthesis evaluates qualified alternative suppliers & warehouse buffers
    │ (Synthesize Plan)
    ▼
[ 5. Awaiting Approval ] ── HARD RBAC GATE: Locked. Requires human authorization (Operations Director)
    ├── (Reject) ➔ Re-evaluation / negotiation
    └── (Approve)
          ▼
    [ 6. Approved ] ── Authorization logged immutably in Audit Trail
          │ (Execute)
          ▼
    [ 7. Executing ] ── Dispatches 5 simulated recovery actions (Procurement, Logistics, Production throttling)
          │
          ▼
    [ 8. Completed ] ── Resilience index restored, factory lines saved, SLA penalties averted
```

### 2. Autonomous Multi-Agent Synthesis
8 specialized domain agents collaborate during disruption mitigation:
- **Detection Agent:** Monitors supply node status, buffer drawdowns, and sensor breaches.
- **Impact Assessment Agent:** Computes financial exposure, factory starvation runway, and at-risk Tier-1 customer orders.
- **Supplier Agent:** Ranks alternative qualified vendors by lead time, unit cost, and reliability scores.
- **Inventory Agent:** Scans regional distribution hubs for reallocatable safety buffer stock.
- **Logistics & Weather Agent:** Evaluates transport corridors against real-time meteorological risks (typhoon tracks, gale warnings).
- **Production Agent:** Re-schedules factory lines (e.g., throttling assembly line speed by 25% for 48 hours) to prevent total starvation.
- **Recovery Planning Agent:** Synthesizes candidate multi-action playbooks.
- **Verification Agent:** Verifies post-execution recovery metrics and confirms risk resolution.

### 3. Mathematical Optimization (Google OR-Tools CP-SAT)
Solves a multi-objective Pareto optimization problem:
$$\min \quad w_{\text{cost}} \cdot C_{\text{recovery}} + w_{\text{time}} \cdot T_{\text{lead}} + w_{\text{risk}} \cdot R_{\text{penalty}}$$
Subject to:
- Supplier capacity limits ($\sum q_s \le \text{Capacity}_s$)
- Warehouse safety buffer reserve constraints ($\text{Stock}_w - q_w \ge \text{SafetyReserve}_w$)
- Lead-time SLA thresholds ($T_{\text{transit}} \le T_{\text{target}}$)
- Corridors validated by live meteorological telemetry.

### 4. Machine Learning Subsystem (`ml-optimization/models/`)
Trained on synthetic supply chain dataset artifacts:
- **Delivery Delay Classifier (`delivery_delay_classifier.joblib`):** Gradient boosting classifier predicting binary delay probability and risk categories (`Low`, `Moderate`, `High`).
- **Crisis Risk Classifier (`crisis_risk_classifier.joblib`):** Random Forest / Gradient Boosting model classifying operational risk tiers (`Critical`, `Elevated`, `Normal`).
- **Demand Forecasting Regressor (`demand_forecaster.joblib`):** Experimental regressor estimating component demand with explicit confidence intervals and prominent UI disclosure of synthetic test performance ($R^2 \approx 0.1060$).

### 5. Security & Formula-Injection Hardening (CWE-1236)
- **Spreadsheet Formula Injection Protection:** All CSV import/export paths sanitize fields starting with `=`, `+`, `-`, `@`, `\t`, `\r`, or `\n` by prepending `'` before persistence and export.
- **Strict RBAC Security Gates:** Unauthorized approvals or execution attempts on unapproved plans return `HTTP 403 Forbidden`.
- **Simulation Boundary:** All operations are simulated with zero external financial or physical liability.

---

## 🛠 Local Setup & Running Locally

### 1. Backend (FastAPI)
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
API Documentation will be accessible at: `http://localhost:8000/docs`

### 2. Integrated Dashboard (Frontend)
```powershell
cd frontend
npm install
npm run dev
```
Accessible at: `http://localhost:5173`

### 3. Original Demo Prototype
```powershell
cd prototype
npm install
npm run dev
```
Accessible at: `http://localhost:5174`

---

## 🧪 Testing & Verification

- **Backend Pytest Suite:**
  ```powershell
  cd backend
  pytest tests -v
  ```
  *(70 / 70 tests passed)*

- **Frontend TypeScript & Build Check:**
  ```powershell
  cd frontend
  npx tsc --noEmit
  npm run build
  ```

- **Prototype TypeScript & Build Check:**
  ```powershell
  cd prototype
  npx tsc --noEmit
  npm run build
  ```
