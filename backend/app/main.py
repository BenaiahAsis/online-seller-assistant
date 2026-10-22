import os
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.product_analyzer import run_product_analysis_agent
from app.database import check_database_connection, get_db, init_db
from app.models import Product, ProductAnalysis
from app.schemas import ProductCreate, ProductListResponse, ProductResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on server start
    init_db()
    yield


app = FastAPI(
    title="Online Seller Assistant API",
    description="Backend API service for Online Seller Assistant",
    version="1.0.0",
    lifespan=lifespan,
)

# Parse CORS origins from environment variable (comma-separated), defaulting to http://localhost:5173
cors_origins_env = os.getenv("CORS_ORIGINS", "http://localhost:5173")
allowed_origins = [
    origin.strip() for origin in cors_origins_env.split(",") if origin.strip()
]
if not allowed_origins:
    allowed_origins = ["http://localhost:5173"]

# Enable CORS for frontend clients (supporting localhost and Vercel domains)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
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


# -------------------------------------------------------------------------
# Product & AI Agent Endpoints
# -------------------------------------------------------------------------


@app.post(
    "/api/products",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Products"],
)
def create_product(payload: ProductCreate, db: Annotated[Session, Depends(get_db)]):
    """Store raw product details submitted by the seller."""
    product = Product(
        name=payload.name,
        price=payload.price,
        quantity=payload.quantity,
        materials=payload.materials,
        features=payload.features,
        status="draft",
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@app.get(
    "/api/products",
    response_model=ProductListResponse,
    tags=["Products"],
)
def list_products(db: Annotated[Session, Depends(get_db)]):
    """List all seller products with their current analysis status."""
    stmt = select(Product).order_by(Product.created_at.desc())
    items = list(db.scalars(stmt).all())
    return ProductListResponse(products=items, total=len(items))


@app.get(
    "/api/products/{product_id}",
    response_model=ProductResponse,
    tags=["Products"],
)
def get_product(product_id: int, db: Annotated[Session, Depends(get_db)]):
    """Retrieve a single product and its structured profile."""
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found.",
        )
    return product


@app.post(
    "/api/products/{product_id}/analyze",
    response_model=ProductResponse,
    tags=["Agents"],
)
def trigger_product_analysis(product_id: int, db: Annotated[Session, Depends(get_db)]):
    """Run Agent 1 (Product Analysis Agent) to structure raw product inputs."""
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found.",
        )

    # Run Agent 1
    input_data = {
        "name": product.name,
        "price": product.price,
        "quantity": product.quantity,
        "materials": product.materials,
        "features": product.features,
    }
    analysis_result = run_product_analysis_agent(input_data)

    if product.analysis:
        # Update existing analysis
        analysis = product.analysis
        analysis.category = analysis_result.get("category")
        analysis.target_audience = analysis_result.get("target_audience")
        analysis.key_specifications = analysis_result.get("key_specifications")
        analysis.selling_points = analysis_result.get("selling_points")
        analysis.suggested_keywords = analysis_result.get("suggested_keywords")
        analysis.raw_summary = analysis_result.get("raw_summary")
    else:
        # Create new analysis record
        analysis = ProductAnalysis(
            product_id=product.id,
            category=analysis_result.get("category"),
            target_audience=analysis_result.get("target_audience"),
            key_specifications=analysis_result.get("key_specifications"),
            selling_points=analysis_result.get("selling_points"),
            suggested_keywords=analysis_result.get("suggested_keywords"),
            raw_summary=analysis_result.get("raw_summary"),
        )
        db.add(analysis)

    product.status = "analyzed"
    db.commit()
    db.refresh(product)
    return product
