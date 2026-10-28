"""
database.py — SQLAlchemy engine, session, and Base for Supply Chain X.

Uses SQLite for local demo. All data is synthetic/demo.
"""
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = "sqlite:///supply_chain_x.db"

engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency — yields a DB session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables."""
    Base.metadata.create_all(bind=engine)


def reset_db():
    """Drop and recreate all tables (for tests/demo reset)."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
