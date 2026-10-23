import os
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents import (
    run_listing_generator_agent,
    run_market_analyzer_agent,
    run_product_analysis_agent,
)
from app.database import check_database_connection, get_db, init_db
from app.models import Product, ProductAnalysis, ProductListing
from app.schemas import (
    FullPipelineResponse,
    ProductCreate,
    ProductListingResponse,
    ProductListResponse,
    ProductResponse,
)


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
# Product & Multi-Agent AI Endpoints
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

    input_data = {
        "name": product.name,
        "price": product.price,
        "quantity": product.quantity,
        "materials": product.materials,
        "features": product.features,
    }
    analysis_result = run_product_analysis_agent(input_data)

    if product.analysis:
        analysis = product.analysis
        analysis.category = analysis_result.get("category")
        analysis.target_audience = analysis_result.get("target_audience")
        analysis.key_specifications = analysis_result.get("key_specifications")
        analysis.selling_points = analysis_result.get("selling_points")
        analysis.suggested_keywords = analysis_result.get("suggested_keywords")
        analysis.raw_summary = analysis_result.get("raw_summary")
    else:
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


@app.post(
    "/api/products/{product_id}/market-analysis",
    response_model=ProductResponse,
    tags=["Agents"],
)
def trigger_market_analysis(product_id: int, db: Annotated[Session, Depends(get_db)]):
    """Run Agent 2 (Market Analysis Agent) using Agent 1's structured output."""
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found.",
        )

    # Ensure Agent 1 has run first
    if not product.analysis:
        trigger_product_analysis(product_id=product_id, db=db)
        db.refresh(product)

    product_data = {
        "name": product.name,
        "price": product.price,
        "materials": product.materials,
        "features": product.features,
    }
    analysis_data = {
        "category": product.analysis.category if product.analysis else None,
        "target_audience": (
            product.analysis.target_audience if product.analysis else None
        ),
        "selling_points": (product.analysis.selling_points if product.analysis else []),
        "suggested_keywords": (
            product.analysis.suggested_keywords if product.analysis else []
        ),
    }

    market_result = run_market_analyzer_agent(product_data, analysis_data)
    if product.analysis:
        product.analysis.market_insights = market_result

    db.commit()
    db.refresh(product)
    return product


@app.post(
    "/api/products/{product_id}/generate-listings",
    response_model=list[ProductListingResponse],
    tags=["Agents"],
)
def trigger_listing_generation(
    product_id: int, db: Annotated[Session, Depends(get_db)]
):
    """Run Agent 3 to create Shopee, TikTok, and Lazada listings."""
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found.",
        )

    # Ensure Agent 1 & Agent 2 have run
    if not product.analysis:
        trigger_product_analysis(product_id=product_id, db=db)
        db.refresh(product)
    if not product.analysis.market_insights:
        trigger_market_analysis(product_id=product_id, db=db)
        db.refresh(product)

    product_data = {
        "name": product.name,
        "price": product.price,
        "materials": product.materials,
        "features": product.features,
    }
    analysis_data = {
        "category": product.analysis.category,
        "selling_points": product.analysis.selling_points or [],
        "suggested_keywords": product.analysis.suggested_keywords or [],
    }
    market_data = product.analysis.market_insights or {}

    listings_result = run_listing_generator_agent(
        product_data, analysis_data, market_data
    )

    # Replace existing listings with freshly generated versions
    stmt = select(ProductListing).where(ProductListing.product_id == product.id)
    existing_listings = db.scalars(stmt).all()
    for item in existing_listings:
        db.delete(item)

    saved_listings: list[ProductListing] = []
    for item in listings_result:
        listing = ProductListing(
            product_id=product.id,
            platform=item.get("platform", "shopee"),
            title=item.get("title", product.name),
            description=item.get("description", ""),
            bullet_points=item.get("bullet_points") or [],
            hashtags=item.get("hashtags") or [],
            call_to_action=item.get("call_to_action"),
        )
        db.add(listing)
        saved_listings.append(listing)

    product.status = "completed"
    db.commit()
    for l_obj in saved_listings:
        db.refresh(l_obj)
    return saved_listings


@app.post(
    "/api/products/{product_id}/full-pipeline",
    response_model=FullPipelineResponse,
    tags=["Agents"],
)
def trigger_full_pipeline(product_id: int, db: Annotated[Session, Depends(get_db)]):
    """Execute the full sequential 3-agent pipeline in a single automated flow."""
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found.",
        )

    # Step 1: Agent 1 (Product Analyzer)
    trigger_product_analysis(product_id=product_id, db=db)

    # Step 2: Agent 2 (Market Analyzer)
    trigger_market_analysis(product_id=product_id, db=db)

    # Step 3: Agent 3 (Listing Generator)
    trigger_listing_generation(product_id=product_id, db=db)

    db.refresh(product)
    return FullPipelineResponse(
        product=product,
        status="completed",
        message="Full 3-agent pipeline successfully executed.",
    )


@app.get(
    "/api/products/{product_id}/listings",
    response_model=list[ProductListingResponse],
    tags=["Listings"],
)
def get_product_listings(product_id: int, db: Annotated[Session, Depends(get_db)]):
    """Fetch all generated marketplace listings for a specific product."""
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found.",
        )
    stmt = select(ProductListing).where(ProductListing.product_id == product_id)
    items = list(db.scalars(stmt).all())
    return items
