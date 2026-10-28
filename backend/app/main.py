from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.database import engine, Base, SessionLocal
from app.db.seed_data import seed_database
from app.db import models  # Ensure all SQLAlchemy models are registered on Base.metadata
from app.api.routes import health, nodes, routes, kpis, inventory, orders, crisis, demo, weather_service
from app.api.routes.dashboard_compatibility import dashboard_router

# Ensure tables are created on module import for TestClient and server startup
Base.metadata.create_all(bind=engine)
with SessionLocal() as db_init:
    seed_database(db_init)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables and seed exist
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_database(db)
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Supply Chain X Autonomous Decision Support & Simulation Backend (Simulation-Only)",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS for Frontend Development (http://localhost:5173 and http://127.0.0.1:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(health.router, prefix=settings.API_V1_STR)
app.include_router(nodes.router, prefix=settings.API_V1_STR)
app.include_router(routes.router, prefix=settings.API_V1_STR)
app.include_router(kpis.router, prefix=settings.API_V1_STR)
app.include_router(inventory.router, prefix=settings.API_V1_STR)
app.include_router(orders.router, prefix=settings.API_V1_STR)
app.include_router(crisis.router, prefix=settings.API_V1_STR)
app.include_router(demo.router, prefix=settings.API_V1_STR)
app.include_router(weather_service.router, prefix=settings.API_V1_STR)
app.include_router(dashboard_router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {
        "system": settings.PROJECT_NAME,
        "status": "online",
        "docs_url": "/docs",
        "simulation_mode": True,
        "disclaimer": "Synthetic simulation only. No real orders or transactions are dispatched."
    }
