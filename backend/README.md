# Supply Chain X Backend (FastAPI + SQLAlchemy + SQLite)

Autonomous Decision Support & Simulation Backend for the Supply Chain X Frontend Command Center.

> **IMPORTANT DISCLAIMER**: This backend operates strictly in **Simulation-Only** mode with synthetic demo data. It never places real orders, contacts external suppliers, books freight, or triggers real-world financial transactions.

---

## 1. Architecture Overview

- **Framework**: FastAPI (Python 3.11+)
- **Database**: SQLite via SQLAlchemy 2.0 ORM
- **Validation**: Pydantic v2 with dual camelCase/snake_case validation aliases
- **Testing**: Pytest with FastAPI TestClient (HTTPX)
- **CORS**: Preconfigured for frontend dev servers (`http://localhost:5173` and `http://127.0.0.1:5173`)

### Project Structure
```
backend/
├── app/
│   ├── api/
│   │   └── routes/
│   │       ├── crisis.py       # GET /api/crisis/audit
│   │       ├── health.py       # GET /api/health
│   │       ├── inventory.py    # GET /api/inventory
│   │       ├── kpis.py         # GET /api/kpis
│   │       ├── nodes.py        # GET /api/network/nodes, /api/network/suppliers
│   │       ├── orders.py       # GET /api/orders
│   │       └── routes.py       # GET /api/network/routes
│   ├── core/
│   │   └── config.py           # Pydantic BaseSettings configuration
│   ├── db/
│   │   ├── database.py         # SQLAlchemy engine, SessionLocal, get_db
│   │   ├── models.py           # SQLAlchemy database models
│   │   └── seed_data.py        # Deterministic synthetic data seeding
│   ├── schemas/
│   │   └── supply_chain.py     # Pydantic schemas mirroring TypeScript frontend types
│   └── main.py                 # FastAPI application and CORS setup
├── tests/
│   └── test_api.py             # Pytest test suite (9 passing tests)
├── .env.example
├── requirements.txt
└── README.md
```

---

## 2. Quickstart & How to Run

### Step 1: Create and Activate Virtual Environment
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### Step 2: Install Dependencies
```powershell
pip install -r requirements.txt
```

### Step 3: Run Database Migrations & Start Uvicorn Server
```powershell
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
The server will automatically initialize `supply_chain.db` and populate it with synthetic seed data matching the frontend's baseline network graph.

- **API Base URL**: `http://127.0.0.1:8000/api`
- **Interactive Swagger Docs**: `http://127.0.0.1:8000/docs`
- **Interactive ReDoc**: `http://127.0.0.1:8000/redoc`

---

## 3. Running Tests
Run the test suite using `pytest`:
```powershell
pytest tests/
```
All 13 test cases validate HTTP 200/400/403 responses, schema integrity, workflow state machine transitions, approval gating, rejection, duplicate execution blocking, and camelCase serialization matching the React TypeScript frontend.

---

## 4. Endpoints Implemented

| Method | Endpoint | Description | Request Body |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Root service descriptor & simulation disclaimer | None |
| `GET` | `/api/health` | Backend status & database connectivity check | None |
| `GET` | `/api/network/nodes` | Multi-echelon supply chain nodes (10 nodes) | None |
| `GET` | `/api/network/suppliers` | Filtered supplier tier nodes | None |
| `GET` | `/api/network/routes` | Active transit lanes & congestion telemetry | None |
| `GET` | `/api/kpis` | Resiliency index, SLA rates, mitigation counts | None |
| `GET` | `/api/inventory` | Regional buffer depot stock & runway metrics | None |
| `GET` | `/api/orders` | Customer orders and contractual SLA risk tiers | None |
| `GET` | `/api/crisis/audit` | Chronological governance and audit events | None |
| `GET` | `/api/crisis/state` | Persisted crisis workflow simulation state | None |
| `POST` | `/api/crisis/outage/start` | Start synthetic supplier outage (`idle` ➔ `detected`) | `{"supplierId": "node-sup-1", "cause": "..."}` |
| `POST` | `/api/crisis/outage/assess` | Assess affected nodes/inventory (`detected` ➔ `assessing`) | None |
| `POST` | `/api/crisis/outage/plan` | Generate rule-based recovery plan (`assessing` ➔ `awaiting_approval`) | None |
| `POST` | `/api/crisis/outage/approve` | Authorize recovery plan (`awaiting_approval` ➔ `approved`) | None |
| `POST` | `/api/crisis/outage/reject` | Deny recovery plan (`awaiting_approval` ➔ `rejected`) | `{"reason": "Budget threshold exceeded"}` |
| `POST` | `/api/crisis/outage/execute` | Simulated execution (`approved` ➔ `executing` ➔ `completed`) | None (Fails with 403 if unapproved) |
| `POST` | `/api/demo/reset` | Restore supply chain to pristine baseline | None |
