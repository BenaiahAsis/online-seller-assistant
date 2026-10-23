import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.agents.listing_generator import _derive_fallback_listings
from app.agents.market_analyzer import _derive_fallback_market_insights
from app.database import get_db
from app.main import app
from app.models import Base

# Setup clean in-memory SQLite database for isolated test execution
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=test_engine)
    app.dependency_overrides[get_db] = override_get_db
    yield
    Base.metadata.drop_all(bind=test_engine)
    app.dependency_overrides.clear()


client = TestClient(app)


def test_market_analyzer_fallback():
    """Verify Agent 2 fallback generates valid market positioning."""
    insights = _derive_fallback_market_insights(
        name="Bamboo Wireless Keyboard",
        price=49.99,
        category="Electronics & Gadgets",
        target_audience="Digital nomads and tech enthusiasts",
        selling_points=["Silent keys", "Eco-friendly wood build"],
        keywords=["keyboard", "wireless", "bamboo"],
    )

    assert insights["price_tier"] == "Mid-Tier Value"
    assert len(insights["buyer_triggers"]) >= 2
    assert "competitive_edge" in insights
    assert "shopee" in insights["platform_strategies"]
    assert "tiktok" in insights["platform_strategies"]


def test_listing_generator_fallback():
    """Verify Agent 3 fallback produces formatted listings for 3 platforms."""
    listings = _derive_fallback_listings(
        name="Bamboo Wireless Keyboard",
        price=49.99,
        materials="Bamboo, ABS plastic",
        features="Bluetooth 5.0, rechargeable battery",
        category="Electronics & Gadgets",
        selling_points=["Rechargeable USB-C", "Silent scissor switches"],
        keywords=["keyboard", "wireless"],
    )

    assert len(listings) == 3
    platforms = {item["platform"] for item in listings}
    assert platforms == {"shopee", "tiktok", "lazada"}

    for item in listings:
        assert len(item["title"]) > 5
        assert len(item["description"]) > 10
        assert len(item["bullet_points"]) >= 1
        assert len(item["hashtags"]) >= 1
        assert "call_to_action" in item


def test_market_analysis_endpoint():
    """Verify POST /api/products/{id}/market-analysis updates product."""
    create_res = client.post(
        "/api/products",
        json={
            "name": "Wireless Charging Pad",
            "price": 19.99,
            "quantity": 100,
            "materials": "Aluminum and tempered glass",
            "features": "Fast 15W Qi charging with LED indicator",
        },
    )
    product_id = create_res.json()["id"]

    # Trigger Agent 2
    res = client.post(f"/api/products/{product_id}/market-analysis")
    assert res.status_code == 200
    data = res.json()
    assert data["analysis"] is not None
    assert data["analysis"]["market_insights"] is not None
    insights = data["analysis"]["market_insights"]
    assert "buyer_triggers" in insights
    assert insights["price_tier"] == "Budget-Friendly"


def test_generate_listings_endpoint():
    """Verify POST /api/products/{id}/generate-listings creates listings."""
    create_res = client.post(
        "/api/products",
        json={
            "name": "Smart Thermal Tumbler",
            "price": 29.50,
            "quantity": 50,
            "materials": "18/8 Stainless Steel",
            "features": "Keeps drinks cold for 24h, hot for 12h",
        },
    )
    product_id = create_res.json()["id"]

    res = client.post(f"/api/products/{product_id}/generate-listings")
    assert res.status_code == 200
    listings = res.json()
    assert len(listings) == 3

    platforms = {item["platform"] for item in listings}
    assert platforms == {"shopee", "tiktok", "lazada"}


def test_full_pipeline_endpoint():
    """Verify POST /api/products/{id}/full-pipeline runs complete pipeline."""
    create_res = client.post(
        "/api/products",
        json={
            "name": "Ergonomic Lumbar Cushion",
            "price": 35.00,
            "quantity": 20,
            "materials": "Memory foam, 3D mesh fabric",
            "features": "Posture correction, adjustable straps",
        },
    )
    product_id = create_res.json()["id"]

    res = client.post(f"/api/products/{product_id}/full-pipeline")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "completed"
    assert body["product"]["status"] == "completed"
    assert body["product"]["analysis"] is not None
    assert body["product"]["analysis"]["market_insights"] is not None

    # Verify listings retrieval endpoint
    list_res = client.get(f"/api/products/{product_id}/listings")
    assert list_res.status_code == 200
    assert len(list_res.json()) == 3
