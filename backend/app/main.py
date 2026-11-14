import logging
import os
from contextlib import asynccontextmanager
from typing import Annotated, Any

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.agents import (
    generate_agent_1_logs,
    generate_agent_2_logs,
    generate_agent_3_logs,
    run_listing_generator_agent,
    run_market_analyzer_agent,
    run_product_analysis_agent,
)
from app.config import settings
from app.database import check_database_connection, get_db, init_db
from app.limiter import limiter
from app.models import Product, ProductAnalysis, ProductListing
from app.schemas import (
    FullPipelineResponse,
    ListingUpdate,
    ProductCreate,
    ProductListingResponse,
    ProductListResponse,
    ProductResponse,
)

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on server start
    init_db()
    yield


app = FastAPI(
    title=settings.app_name,
    description="Backend API service for Online Seller Assistant",
    version=settings.app_version,
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Parse CORS origins from environment variable (comma-separated), defaulting to http://localhost:5173
cors_origins_env = os.getenv("CORS_ORIGINS", "http://localhost:5173")
allowed_origins = [
    origin.strip() for origin in cors_origins_env.split(",") if origin.strip()
]
if not allowed_origins:
    allowed_origins = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
    ]


@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    """Catch unhandled exceptions inside the CORS wrapper.

    Ensures Access-Control-Allow-Origin headers are always attached.
    """
    try:
        return await call_next(request)
    except (RateLimitExceeded, HTTPException):
        raise
    except Exception as exc:
        logger.error(
            f"Unhandled server error on {request.method} {request.url.path}: {exc}",
            exc_info=True,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "Internal Server Error",
                "detail": str(exc),
                "type": type(exc).__name__,
            },
        )


# Enable CORS for frontend clients (added AFTER custom middleware so CORS
# wraps all responses including 500 errors)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Fallback exception handler for ASGI errors."""
    if isinstance(exc, (HTTPException, RateLimitExceeded)):
        raise exc
    logger.error(
        f"Unhandled server error on {request.method} {request.url.path}: {exc}",
        exc_info=True,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal Server Error",
            "detail": str(exc),
            "type": type(exc).__name__,
        },
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
    """Keep-alive friendly health check endpoint running SELECT 1 against PostgreSQL."""
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
    stmt = (
        select(Product)
        .options(
            selectinload(Product.analysis),
            selectinload(Product.listings),
        )
        .order_by(Product.created_at.desc())
    )
    items = list(db.scalars(stmt).all())
    return ProductListResponse(products=items, total=len(items))


@app.get(
    "/api/products/{product_id}",
    response_model=ProductResponse,
    tags=["Products"],
)
def get_product(product_id: int, db: Annotated[Session, Depends(get_db)]):
    """Retrieve a single product and its structured profile."""
    stmt = (
        select(Product)
        .options(
            selectinload(Product.analysis),
            selectinload(Product.listings),
        )
        .where(Product.id == product_id)
    )
    product = db.scalar(stmt)
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
    agent_1_logs = generate_agent_1_logs(
        input_data,
        analysis_result,
        source="ai" if os.getenv("OPENAI_API_KEY") else "heuristic",
    )

    if product.analysis:
        analysis = product.analysis
        analysis.category = analysis_result.get("category")
        analysis.target_audience = analysis_result.get("target_audience")
        analysis.key_specifications = analysis_result.get("key_specifications")
        analysis.selling_points = analysis_result.get("selling_points")
        analysis.suggested_keywords = analysis_result.get("suggested_keywords")
        analysis.raw_summary = analysis_result.get("raw_summary")
        analysis.execution_logs = agent_1_logs
        current_insights = analysis.market_insights or {}
        analysis.market_insights = {
            **current_insights,
            **(analysis_result.get("market_insights") or {}),
        }
    else:
        analysis = ProductAnalysis(
            product_id=product.id,
            category=analysis_result.get("category"),
            target_audience=analysis_result.get("target_audience"),
            key_specifications=analysis_result.get("key_specifications"),
            selling_points=analysis_result.get("selling_points"),
            suggested_keywords=analysis_result.get("suggested_keywords"),
            raw_summary=analysis_result.get("raw_summary"),
            execution_logs=agent_1_logs,
            market_insights=analysis_result.get("market_insights"),
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
    agent_2_logs = generate_agent_2_logs(product_data, analysis_data, market_result)

    if product.analysis:
        current_insights = product.analysis.market_insights or {}
        product.analysis.market_insights = {
            **current_insights,
            **market_result,
        }
        current_logs = [
            log
            for log in (product.analysis.execution_logs or [])
            if not str(log.get("agent", "")).startswith("Agent 2")
        ]
        product.analysis.execution_logs = current_logs + agent_2_logs

    db.commit()
    db.refresh(product)
    return product


@app.post(
    "/api/products/{product_id}/generate-listings",
    response_model=list[ProductListingResponse],
    tags=["Agents"],
)
@app.post(
    "/api/products/{product_id}/generate-listing",
    response_model=list[ProductListingResponse],
    include_in_schema=False,
)
@app.post(
    "/api/v1/products/{product_id}/generate-listings",
    response_model=list[ProductListingResponse],
    include_in_schema=False,
)
@app.post(
    "/api/v1/products/{product_id}/generate-listing",
    response_model=list[ProductListingResponse],
    include_in_schema=False,
)
@limiter.limit(settings.rate_limit_generate_listing)
def trigger_listing_generation(
    request: Request,
    product_id: int,
    db: Annotated[Session, Depends(get_db)],
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
    agent_3_logs = generate_agent_3_logs(product_data, listings_result)

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

    if product.analysis:
        current_logs = [
            log
            for log in (product.analysis.execution_logs or [])
            if not str(log.get("agent", "")).startswith("Agent 3")
        ]
        product.analysis.execution_logs = current_logs + agent_3_logs

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
@app.post(
    "/api/v1/products/{product_id}/full-pipeline",
    response_model=FullPipelineResponse,
    include_in_schema=False,
)
@limiter.limit(settings.rate_limit_generate_listing)
def trigger_full_pipeline(
    request: Request,
    product_id: int,
    db: Annotated[Session, Depends(get_db)],
):
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
    trigger_listing_generation(request=request, product_id=product_id, db=db)

    db.refresh(product)
    pipeline_logs = (product.analysis.execution_logs or []) if product.analysis else []
    return FullPipelineResponse(
        product=product,
        status="completed",
        message="Full 3-agent pipeline successfully executed.",
        logs=pipeline_logs,
    )


@app.get(
    "/api/products/{product_id}/logs",
    response_model=list[dict[str, Any]],
    tags=["Agents"],
)
def get_product_logs(product_id: int, db: Annotated[Session, Depends(get_db)]):
    """Retrieve full audit and execution logs for all agents on a product."""
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found.",
        )
    return (product.analysis.execution_logs or []) if product.analysis else []


@app.patch(
    "/api/listings/{listing_id}",
    response_model=ProductListingResponse,
    tags=["Listings"],
)
def update_product_listing(
    listing_id: int,
    payload: ListingUpdate,
    db: Annotated[Session, Depends(get_db)],
):
    """Allow sellers to customize title, description, or bullets of a listing."""
    listing = db.get(ProductListing, listing_id)
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Listing with ID {listing_id} not found.",
        )
    if payload.title is not None:
        listing.title = payload.title.strip()
    if payload.description is not None:
        listing.description = payload.description.strip()
    if payload.bullet_points is not None:
        listing.bullet_points = payload.bullet_points
    if payload.hashtags is not None:
        listing.hashtags = payload.hashtags
    if payload.call_to_action is not None:
        listing.call_to_action = payload.call_to_action.strip()

    db.commit()
    db.refresh(listing)
    return listing


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
