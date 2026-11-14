"""Tests for rate limiting on listing generation endpoints."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import get_db
from app.limiter import limiter
from app.main import app
from app.models import Base

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
    limiter.reset()
    yield
    limiter.reset()
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=test_engine)


client = TestClient(app)


def _create_product():
    payload = {
        "name": "Wireless Earbuds",
        "price": 30.0,
        "quantity": 5,
        "materials": "plastic, silicone",
        "features": "Noise cancelling, fast charging",
    }
    res = client.post("/api/products", json=payload)
    assert res.status_code == 201
    return res.json()["id"]


def test_generate_listings_rate_limit_5_per_minute():
    product_id = _create_product()
    # First 5 requests should succeed
    for _ in range(5):
        res = client.post(f"/api/products/{product_id}/generate-listings")
        assert res.status_code == 200

    # 6th request from the same IP must be rejected with 429 Too Many Requests
    blocked_res = client.post(f"/api/products/{product_id}/generate-listings")
    assert blocked_res.status_code == 429
    assert "Rate limit exceeded" in blocked_res.json().get("error", "")


def test_full_pipeline_rate_limit_5_per_minute():
    product_id = _create_product()
    # First 5 requests should succeed
    for _ in range(5):
        res = client.post(f"/api/products/{product_id}/full-pipeline")
        assert res.status_code == 200

    # 6th request from the same IP must be rejected with 429 Too Many Requests
    blocked_res = client.post(f"/api/products/{product_id}/full-pipeline")
    assert blocked_res.status_code == 429
    assert "Rate limit exceeded" in blocked_res.json().get("error", "")
