import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.agents.product_analyzer import (
    _derive_fallback_profile,
    run_product_analysis_agent,
)
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


def test_create_and_get_product():
    """Verify creating a product and fetching it by ID."""
    payload = {
        "name": "Ergonomic Memory Foam Mousepad",
        "price": 24.99,
        "quantity": 50,
        "materials": "Memory foam, non-slip rubber base",
        "features": "Wrist support, waterproof coating, reinforced edges",
    }
    create_res = client.post("/api/products", json=payload)
    assert create_res.status_code == 201
    data = create_res.json()
    assert data["name"] == payload["name"]
    assert data["status"] == "draft"
    product_id = data["id"]

    # Fetch product by ID
    get_res = client.get(f"/api/products/{product_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == product_id


def test_list_products():
    """Verify listing all created products."""
    client.post(
        "/api/products",
        json={"name": "Gaming Keyboard", "price": 89.99, "quantity": 10},
    )
    client.post(
        "/api/products",
        json={"name": "Office Desk Lamp", "price": 34.50, "quantity": 15},
    )

    list_res = client.get("/api/products")
    assert list_res.status_code == 200
    data = list_res.json()
    assert data["total"] == 2
    assert len(data["products"]) == 2


def test_get_nonexistent_product():
    """Verify 404 response for invalid product IDs."""
    res = client.get("/api/products/99999")
    assert res.status_code == 404


def test_update_product_changes_only_sent_fields():
    """PATCH updates the given fields and leaves the rest untouched."""
    created = client.post(
        "/api/products",
        json={
            "name": "Canvas Tote",
            "price": 150.0,
            "quantity": 10,
            "materials": "Cotton canvas",
            "features": "Inner pocket",
        },
    ).json()

    res = client.patch(
        f"/api/products/{created['id']}",
        json={"price": 175.5, "features": "  Inner pocket, zip top  "},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["price"] == 175.5
    assert data["features"] == "Inner pocket, zip top"
    assert data["name"] == "Canvas Tote"
    assert data["materials"] == "Cotton canvas"

    # Persisted, not just echoed back
    assert client.get(f"/api/products/{created['id']}").json()["price"] == 175.5


def test_update_product_validation_and_missing():
    created = client.post(
        "/api/products", json={"name": "Mug", "price": 99.0, "quantity": 3}
    ).json()
    pid = created["id"]

    assert client.patch(f"/api/products/{pid}", json={"price": 0}).status_code == 422
    assert client.patch(f"/api/products/{pid}", json={"name": ""}).status_code == 422
    assert client.patch(f"/api/products/{pid}", json={"name": "   "}).status_code == 422
    assert client.patch(f"/api/products/{pid}", json={"name": None}).status_code == 422
    assert client.patch("/api/products/99999", json={"price": 5}).status_code == 404


def test_create_product_rejects_oversized_features():
    """Features over 2000 characters are rejected before reaching the agents."""
    base = {"name": "Desk Organizer", "price": 199.0, "quantity": 5}

    ok = client.post("/api/products", json={**base, "features": "x" * 2000})
    assert ok.status_code == 201

    too_long = client.post("/api/products", json={**base, "features": "x" * 2001})
    assert too_long.status_code == 422


def test_trigger_product_analysis_agent():
    """Verify Agent 1 executes and stores structured analysis."""
    create_res = client.post(
        "/api/products",
        json={
            "name": "Vintage Leather Messenger Bag",
            "price": 119.00,
            "quantity": 20,
            "materials": "Full-grain cowhide leather, brass hardware",
            "features": "Padded laptop sleeve, adjustable strap, multiple pockets",
        },
    )
    product_id = create_res.json()["id"]

    # Trigger Agent 1
    analyze_res = client.post(f"/api/products/{product_id}/analyze")
    assert analyze_res.status_code == 200
    data = analyze_res.json()
    assert data["status"] == "analyzed"
    assert data["analysis"] is not None
    assert "category" in data["analysis"]
    assert "target_audience" in data["analysis"]
    assert "selling_points" in data["analysis"]
    assert len(data["analysis"]["selling_points"]) >= 1


def test_product_analyzer_fallback_logic():
    """Verify Agent 1 fallback produces complete structured profile without API."""
    profile = _derive_fallback_profile(
        name="Cotton Graphic T-Shirt",
        price=19.99,
        quantity=100,
        materials="100% combed cotton",
        features="Breathable fabric, double-stitched hem, preshrunk",
    )
    assert profile["category"] == "Fashion & Apparel"
    assert "key_specifications" in profile
    assert len(profile["selling_points"]) >= 3
    assert len(profile["suggested_keywords"]) >= 1


def test_run_product_analysis_agent_fallback_mode():
    """Verify run_product_analysis_agent uses deterministic fallback safely."""
    result = run_product_analysis_agent(
        {
            "name": "Wireless Noise Cancelling Earbuds",
            "price": 59.99,
            "quantity": 40,
            "materials": "ABS plastic, silicone tips",
            "features": "Bluetooth 5.3, 30-hour battery life, IPX5 water resistant",
        }
    )
    assert result["category"] == "Audio & Headphones"
    assert "target_audience" in result
    assert "raw_summary" in result
