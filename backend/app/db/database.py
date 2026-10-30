import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# Normalize postgres:// to postgresql+psycopg2:// for SQLAlchemy compatibility
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

# For SQLite: ensure the directory for the DB file exists
if "sqlite" in db_url:
    # Extract the file path from sqlite:///path/to/file.db
    sqlite_path = db_url.replace("sqlite:////", "/").replace("sqlite:///", "")
    if sqlite_path and sqlite_path != ":memory:":
        db_dir = os.path.dirname(os.path.abspath(sqlite_path))
        os.makedirs(db_dir, exist_ok=True)

# SQLite specific connect_args to allow multi-threaded access
connect_args = {"check_same_thread": False} if "sqlite" in db_url else {}

engine = create_engine(
    db_url,
    connect_args=connect_args,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
