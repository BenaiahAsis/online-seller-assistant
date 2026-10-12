from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root_endpoint():
    """Verify the root endpoint returns expected service metadata."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "Online Seller Assistant" in data["service"]


def test_health_success():
    """Verify /health returns 200 when SELECT 1 executes successfully."""
    mock_success = {
        "connected": True,
        "detail": "SELECT 1 executed successfully against PostgreSQL",
    }
    with patch("app.main.check_database_connection", return_value=mock_success):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        assert "SELECT 1" in data["detail"]


def test_health_failure():
    """Verify /health returns 503 when the PostgreSQL connection fails."""
    mock_failure = {
        "connected": False,
        "error": "could not connect to server: Connection refused",
    }
    with patch("app.main.check_database_connection", return_value=mock_failure):
        response = client.get("/health")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "unhealthy"
        assert data["database"] == "disconnected"
        assert "Connection refused" in data["error"]


def test_health_missing_database_url():
    """Verify /health handles missing DATABASE_URL gracefully."""
    mock_missing = {
        "connected": False,
        "error": "DATABASE_URL environment variable is not configured.",
    }
    with patch("app.main.check_database_connection", return_value=mock_missing):
        response = client.get("/health")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "unhealthy"
        assert data["database"] == "disconnected"
        assert "DATABASE_URL environment variable is not configured" in data["error"]
