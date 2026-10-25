import os
from collections.abc import Generator
from typing import Any

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

# Load the project-root .env when running locally from the backend directory.
# Existing process environment variables take precedence over values in the file.
load_dotenv()


def get_database_url() -> str:
    """Retrieve and normalize the DATABASE_URL to use psycopg2 driver."""
    url = os.getenv("DATABASE_URL", "").strip()
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif url.startswith("postgresql://") and not url.startswith("postgresql+"):
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url


_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


def get_engine() -> Engine | None:
    """Singleton getter for SQLAlchemy engine."""
    global _engine
    if _engine is None:
        db_url = get_database_url()
        if db_url:
            _engine = create_engine(db_url, pool_pre_ping=True)
    return _engine


def get_session_factory() -> sessionmaker[Session] | None:
    """Singleton getter for SQLAlchemy sessionmaker."""
    global _session_factory
    if _session_factory is None:
        engine = get_engine()
        if engine is not None:
            _session_factory = sessionmaker(
                autocommit=False, autoflush=False, bind=engine
            )
    return _session_factory


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency for obtaining a database session."""
    session_factory = get_session_factory()
    if session_factory is None:
        raise RuntimeError("DATABASE_URL is not configured.")
    db = session_factory()
    try:
        yield db
    finally:
        db.close()


def init_db() -> bool:
    """Initialize database tables for models."""
    engine = get_engine()
    if engine is None:
        return False
    try:
        from app.models import Base

        Base.metadata.create_all(bind=engine)
        return True
    except Exception:
        return False


def check_database_connection() -> dict[str, Any]:
    """Verify database connectivity by executing SELECT 1 using SQLAlchemy."""
    db_url = get_database_url()
    if not db_url:
        return {
            "connected": False,
            "error": "DATABASE_URL environment variable is not configured.",
        }

    try:
        engine = get_engine()
        if engine is None:
            engine = create_engine(db_url, pool_pre_ping=True)
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1")).scalar()
            if result == 1:
                return {
                    "connected": True,
                    "detail": "SELECT 1 executed successfully against PostgreSQL",
                }
            return {
                "connected": False,
                "error": f"Unexpected query scalar result: {result}",
            }
    except SQLAlchemyError as err:
        return {
            "connected": False,
            "error": str(err),
        }
    except Exception as err:
        return {
            "connected": False,
            "error": str(err),
        }
