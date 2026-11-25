"""Agent 1 validation gates and the X-Simulate-AI-Failure demo switch."""

import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.agents.product_analyzer import run_product_analysis_agent
from app.config import settings
from app.database import get_db
from app.limiter import limiter
from app.main import app
from app.models import Base

test_engine = create_engine(
    "sqlite:///:memory:",
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


class FakeClient:
    """Stands in for openai.OpenAI with a scripted list of responses."""

    def __init__(self, *responses):
        self._responses = list(responses)
        self.calls = 0
        self.chat = SimpleNamespace(completions=self)

    def create(self, **kwargs):
        self.calls += 1
        content = self._responses.pop(0)
        if isinstance(content, Exception):
            raise content
        message = SimpleNamespace(content=content)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


CANDLE = {
    "name": "Lavender Soy Candle",
    "price": 250.0,
    "quantity": 40,
    "materials": "soy wax, lavender essential oil",
    "features": "150g, hand poured, cotton wick",
}


def profile_payload(**overrides):
    payload = {
        "category": "Home & Living",
        "target_audience": "Gift shoppers and home decorators",
        "selling_points": ["Hand poured soy wax", "Lavender essential oil scent"],
        "suggested_keywords": ["lavender candle", "soy candle"],
        "raw_summary": "A hand poured lavender soy candle with a cotton wick.",
    }
    payload.update(overrides)
    return json.dumps(payload)


# --------------------------------------------------------------------------
# Agent 1 validation gates
# --------------------------------------------------------------------------


def test_agent1_accepts_grounded_profile():
    fake = FakeClient(profile_payload())
    result = run_product_analysis_agent(CANDLE, client=fake)
    assert result["source"] == "ai"
    assert result["category"] == "Home & Living"
    assert [e["outcome"] for e in result["validation_events"]] == ["accepted"]
    assert fake.calls == 1


def test_agent1_retries_when_output_invents_a_claim():
    fabricated = profile_payload(
        selling_points=["Hand poured soy wax", "FDA approved and waterproof"]
    )
    fake = FakeClient(fabricated, profile_payload())
    result = run_product_analysis_agent(CANDLE, client=fake)
    outcomes = [e["outcome"] for e in result["validation_events"]]
    assert outcomes == ["rejected", "accepted"]
    assert "claims" in result["validation_events"][0]["gates"]
    assert result["source"] == "ai"


def test_agent1_rejects_material_keywords_and_falls_back():
    bad = profile_payload(suggested_keywords=["zinc", "iron"])
    fake = FakeClient(bad, bad)
    result = run_product_analysis_agent(CANDLE, client=fake)
    assert result["source"] == "heuristic"
    assert [e["outcome"] for e in result["validation_events"]] == [
        "rejected",
        "rejected",
    ]
    assert "zinc" not in result["suggested_keywords"]


def test_agent1_falls_back_on_malformed_json():
    fake = FakeClient("not json", '{"category": "x"}')
    result = run_product_analysis_agent(CANDLE, client=fake)
    assert result["source"] == "heuristic"
    assert result["category"]  # deterministic profile still complete
    assert all(e["gates"] == ["schema"] for e in result["validation_events"])


def test_agent1_without_key_is_logged_as_skipped():
    result = run_product_analysis_agent(CANDLE)
    assert result["source"] == "heuristic"
    assert result["validation_events"][0]["outcome"] == "skipped"


# --------------------------------------------------------------------------
# X-Simulate-AI-Failure
# --------------------------------------------------------------------------


def _create_product():
    res = client.post("/api/products", json=CANDLE)
    assert res.status_code == 201
    return res.json()["id"]


@pytest.fixture
def simulation_enabled(monkeypatch):
    monkeypatch.setattr(settings, "allow_ai_failure_simulation", True)


def test_simulation_rejected_when_disabled(monkeypatch):
    monkeypatch.setattr(settings, "allow_ai_failure_simulation", False)
    pid = _create_product()
    res = client.post(
        f"/api/products/{pid}/full-pipeline",
        headers={"X-Simulate-AI-Failure": "api_error"},
    )
    assert res.status_code == 403


def test_simulation_rejects_unknown_mode(simulation_enabled):
    pid = _create_product()
    res = client.post(
        f"/api/products/{pid}/full-pipeline",
        headers={"X-Simulate-AI-Failure": "explode"},
    )
    assert res.status_code == 400


@pytest.mark.parametrize(
    ("mode", "stage"), [("api_error", "API_ERROR"), ("bad_output", "VALIDATE_REJECT")]
)
def test_simulated_failure_falls_back_gracefully(simulation_enabled, mode, stage):
    pid = _create_product()
    res = client.post(
        f"/api/products/{pid}/full-pipeline",
        headers={"X-Simulate-AI-Failure": mode},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "completed"
    assert len(body["product"]["listings"]) == 3

    stages_by_agent = {}
    for log in body["logs"]:
        stages_by_agent.setdefault(log["agent"][:7], set()).add(log["stage"])
    for agent in ("Agent 1", "Agent 2", "Agent 3"):
        assert stage in stages_by_agent[agent], (agent, stages_by_agent[agent])
        assert "FALLBACK_USED" in stages_by_agent[agent], agent
