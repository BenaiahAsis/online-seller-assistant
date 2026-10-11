from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database import check_database_connection

app = FastAPI(
    title="Online Seller Assistant API",
    description="Backend API service for Online Seller Assistant",
    version="1.0.0",
)

# Enable CORS for frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {
        "service": "Online Seller Assistant API",
        "status": "online",
        "docs_url": "/docs",
    }


@app.get("/health")
def health_check():
    """Health check endpoint running SELECT 1 against PostgreSQL via DATABASE_URL."""
    db_status = check_database_connection()

    if db_status.get("connected"):
        return {
            "status": "healthy",
            "database": "connected",
            "message": "Backend service and PostgreSQL database are healthy.",
            "detail": db_status.get("detail"),
        }

    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "status": "unhealthy",
            "database": "disconnected",
            "message": "Backend is running, but database check failed.",
            "error": db_status.get("error"),
        },
    )
