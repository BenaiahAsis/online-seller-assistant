import os
from typing import Any, Dict

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError


def get_database_url() -> str:
    """Retrieve and normalize the DATABASE_URL environment variable."""
    url = os.getenv("DATABASE_URL", "").strip()
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url


def check_database_connection() -> Dict[str, Any]:
    """Verify database connectivity by executing SELECT 1 using SQLAlchemy."""
    db_url = get_database_url()
    if not db_url:
        return {
            "connected": False,
            "error": "DATABASE_URL environment variable is not configured.",
        }

    try:
        engine: Engine = create_engine(db_url, pool_pre_ping=True)
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
