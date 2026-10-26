import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.agents.listing_generator import (
    _derive_fallback_listings,
    run_listing_generator_agent,
)
from app.agents.market_analyzer import (
    _derive_fallback_market_insights,
    price_tier,
    run_market_analyzer_agent,
)
from app.agents.validation import scan_claims, unsupported_claims
from app.database import get_db
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
    yield
    Base.metadata.drop_all(bind=test_engine)
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def no_live_api(monkeypatch):
    """Guarantee the suite never bills a real OpenAI key, locally or in CI."""
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)


client = TestClient(app)


# --------------------------------------------------------------------------
# Fixtures and fakes
# --------------------------------------------------------------------------


class FakeCompletions:
    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        content = self._responses.pop(0)
        if isinstance(content, Exception):
            raise content
        message = SimpleNamespace(content=content)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


class FakeClient:
    """Stands in for openai.OpenAI with a scripted list of responses."""

    def __init__(self, *responses):
        self.completions = FakeCompletions(responses)
        self.chat = SimpleNamespace(completions=self.completions)

    @property
    def call_count(self):
        return len(self.completions.calls)


PRODUCT = {
    "name": "Lavender Soy Candle",
    "price": 250.0,
    "quantity": 40,
    "materials": "soy wax, lavender essential oil",
    "features": "150g, hand poured, cotton wick",
}

PROFILE = {
    "category": "Home & Lifestyle",
    "target_audience": "Gift shoppers and home decorators",
    "selling_points": [
        "Hand poured soy wax candle",
        "Lavender essential oil scent",
        "150g size with cotton wick",
    ],
    "suggested_keywords": ["candle", "lavender", "soy", "handpoured"],
}


def valid_market_payload(tier="Budget-Friendly"):
    return json.dumps(
        {
            "price_tier": tier,
            "price_rationale": (
                "Entry pricing suits shoppers buying small gifts on impulse."
            ),
            "priority_points": [
                {
                    "point": "Hand poured soy wax",
                    "source_index": 0,
                    "platforms": ["shopee", "lazada"],
                },
                {
                    "point": "Lavender essential oil scent",
                    "source_index": 1,
                    "platforms": ["tiktok"],
                },
            ],
            "buyer_objections": [
                {
                    "objection": "Shopper cannot judge scent strength online.",
                    "response": "Reference the listed essential oil and the 150g size.",
                },
                {
                    "objection": "Shopper is unsure it works as a gift.",
                    "response": "Write for gift shoppers using the listed details.",
                },
            ],
            "platform_strategies": {
                "shopee": {
                    "focus": "Search match",
                    "angle": "Open with the product name and listed size.",
                    "tone": "Informative",
                    "keyword_emphasis": ["candle", "lavender"],
                },
                "tiktok": {
                    "focus": "Visual hook",
                    "angle": "Show the candle being lit and named.",
                    "tone": "Casual",
                    "keyword_emphasis": ["lavender"],
                },
                "lazada": {
                    "focus": "Specification detail",
                    "angle": "List the size, wick and wax in a scannable block.",
                    "tone": "Neutral",
                    "keyword_emphasis": ["soy", "candle"],
                },
            },
        }
    )


def fabricated_market_payload():
    payload = json.loads(valid_market_payload())
    payload["buyer_objections"][0]["response"] = (
        "Reassure buyers with our 7-day replacement guarantee."
    )
    return json.dumps(payload)


def _listing(platform, tags):
    return {
        "platform": platform,
        "title": "Lavender Soy Candle - hand poured 150g",
        "description": (
            "Hand poured soy wax candle scented with lavender essential oil. "
            "150g with a cotton wick. Priced at 250.00."
        ),
        "bullet_points": [
            "Hand poured soy wax candle",
            "Lavender essential oil scent",
        ],
        "hashtags": tags,
        "call_to_action": "Check the listed details and add to cart.",
    }


def valid_listing_payload():
    return json.dumps(
        {
            "listings": [
                _listing("shopee", ["#candle", "#lavender", "#shopeeph"]),
                _listing("tiktok", ["#candle", "#lavender", "#fyp"]),
                _listing("lazada", ["#soy", "#candle", "#lazadaph"]),
            ]
        }
    )


def fabricated_listing_payload():
    payload = json.loads(valid_listing_payload())
    payload["listings"][0]["description"] += " 100% brand new and guaranteed authentic."
    return json.dumps(payload)


MARKET_CONTEXT = json.loads(valid_market_payload())


# --------------------------------------------------------------------------
# Claims gate
# --------------------------------------------------------------------------


def test_claims_gate_flags_invented_warranty():
    corpus = "lavender soy candle 150g cotton wick"
    hits = unsupported_claims(
        "Backed by a 7-day replacement guarantee and 100% brand new.", corpus
    )
    labels = " ".join(hits)
    assert "policy claim" in labels
    assert "condition" in labels


def test_claims_gate_allows_seller_supplied_warranty():
    corpus = "wireless keyboard with a 1 year warranty from the seller"
    assert unsupported_claims("Includes a 1 year warranty.", corpus) == []


def test_claims_gate_flags_comparative_claims():
    corpus = "lavender soy candle 150g"
    assert unsupported_claims("Burns better than other candles.", corpus)


# --------------------------------------------------------------------------
# Agent 2 - market analysis
# --------------------------------------------------------------------------


def test_price_tier_uses_peso_bands_by_default():
    assert price_tier(250.0) == "Budget-Friendly"
    assert price_tier(1499.0) == "Mid-Tier Value"
    assert price_tier(7999.0) == "Premium"


def test_market_fallback_is_claim_free_and_has_no_agent_one_fields():
    insights = _derive_fallback_market_insights(
        name=PRODUCT["name"],
        price=PRODUCT["price"],
        category=PROFILE["category"],
        target_audience=PROFILE["target_audience"],
        selling_points=PROFILE["selling_points"],
        keywords=PROFILE["suggested_keywords"],
    )

    assert insights["price_tier"] == "Budget-Friendly"
    assert insights["source"] == "heuristic"
    assert len(insights["priority_points"]) >= 2
    assert set(insights["platform_strategies"]) == {"shopee", "tiktok", "lazada"}

    # Agent 1 owns these; Agent 2 must no longer emit them.
    for removed in (
        "buyer_triggers",
        "competitive_edge",
        "summary",
        "target_audience",
        "selling_points",
        "suggested_keywords",
    ):
        assert removed not in insights

    corpus = " ".join(
        [
            PRODUCT["name"],
            PRODUCT["materials"],
            PRODUCT["features"],
            PROFILE["category"],
            PROFILE["target_audience"],
            *PROFILE["selling_points"],
        ]
    ).lower()
    assert scan_claims(insights, corpus) == []


def test_market_agent_accepts_valid_model_output():
    fake = FakeClient(valid_market_payload())
    result = run_market_analyzer_agent(PRODUCT, PROFILE, client=fake)

    assert result["source"] == "ai"
    assert fake.call_count == 1
    assert [p["source_index"] for p in result["priority_points"]] == [0, 1]


def test_market_agent_retries_once_when_output_fabricates_a_guarantee():
    fake = FakeClient(fabricated_market_payload(), valid_market_payload())
    result = run_market_analyzer_agent(PRODUCT, PROFILE, client=fake)

    assert fake.call_count == 2
    assert result["source"] == "ai"

    retry_prompt = fake.completions.calls[1]["messages"][-1]["content"]
    assert "rejected" in retry_prompt
    assert "policy claim" in retry_prompt


def test_market_agent_rejects_price_tier_the_backend_did_not_compute():
    wrong = valid_market_payload(tier="Premium")
    fake = FakeClient(wrong, wrong)
    result = run_market_analyzer_agent(PRODUCT, PROFILE, client=fake)

    assert fake.call_count == 2
    assert result["source"] == "heuristic"
    assert any("price_tier" in reason for reason in result["fallback_reason"])


def test_market_agent_falls_back_after_two_failures():
    fake = FakeClient("{}", "{}")
    result = run_market_analyzer_agent(PRODUCT, PROFILE, client=fake)

    assert result["source"] == "heuristic"
    assert len(result["fallback_reason"]) == 2


def test_market_agent_falls_back_when_api_errors():
    fake = FakeClient(RuntimeError("rate limited"))
    result = run_market_analyzer_agent(PRODUCT, PROFILE, client=fake)

    assert result["source"] == "heuristic"
    assert "rate limited" in result["fallback_reason"][0]


# --------------------------------------------------------------------------
# Agent 3 - listing generation
# --------------------------------------------------------------------------


def test_listing_fallback_covers_three_platforms_without_claims():
    listings = _derive_fallback_listings(
        name=PRODUCT["name"],
        price=PRODUCT["price"],
        materials=PRODUCT["materials"],
        features=PRODUCT["features"],
        category=PROFILE["category"],
        selling_points=PROFILE["selling_points"],
        keywords=PROFILE["suggested_keywords"],
    )

    assert {item["platform"] for item in listings} == {"shopee", "tiktok", "lazada"}
    corpus = " ".join(
        [PRODUCT["name"], PRODUCT["materials"], PRODUCT["features"]]
    ).lower()
    for item in listings:
        assert item["source"] == "heuristic"
        assert len(item["bullet_points"]) >= 2
        assert len(item["hashtags"]) >= 3
        assert scan_claims(item, corpus) == []


def test_listing_agent_accepts_valid_model_output():
    fake = FakeClient(valid_listing_payload())
    listings = run_listing_generator_agent(
        PRODUCT, PROFILE, MARKET_CONTEXT, client=fake
    )

    assert fake.call_count == 1
    assert len(listings) == 3
    assert all(item["source"] == "ai" for item in listings)


def test_listing_agent_retries_once_on_fabricated_copy():
    fake = FakeClient(fabricated_listing_payload(), valid_listing_payload())
    listings = run_listing_generator_agent(
        PRODUCT, PROFILE, MARKET_CONTEXT, client=fake
    )

    assert fake.call_count == 2
    assert all(item["source"] == "ai" for item in listings)


def test_listing_agent_rejects_ungrounded_hashtags():
    payload = json.loads(valid_listing_payload())
    payload["listings"][0]["hashtags"] = ["#aromatherapy", "#wellness", "#shopeeph"]
    body = json.dumps(payload)
    fake = FakeClient(body, body)

    listings = run_listing_generator_agent(
        PRODUCT, PROFILE, MARKET_CONTEXT, client=fake
    )

    assert fake.call_count == 2
    assert all(item["source"] == "heuristic" for item in listings)


def test_listing_agent_rejects_missing_platform():
    payload = json.loads(valid_listing_payload())
    payload["listings"][2]["platform"] = "shopee"
    body = json.dumps(payload)
    fake = FakeClient(body, body)

    listings = run_listing_generator_agent(
        PRODUCT, PROFILE, MARKET_CONTEXT, client=fake
    )

    assert all(item["source"] == "heuristic" for item in listings)


# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------


def _create_product(**overrides):
    body = {
        "name": "Wireless Charging Pad",
        "price": 899.0,
        "quantity": 100,
        "materials": "Aluminum and tempered glass",
        "features": "15W charging with LED indicator",
    }
    body.update(overrides)
    return client.post("/api/products", json=body).json()["id"]


def test_market_analysis_endpoint():
    product_id = _create_product()
    res = client.post(f"/api/products/{product_id}/market-analysis")

    assert res.status_code == 200
    insights = res.json()["analysis"]["market_insights"]
    assert insights["price_tier"] == "Mid-Tier Value"
    assert "priority_points" in insights
    assert "platform_strategies" in insights
    assert "buyer_triggers" not in insights


def test_generate_listings_endpoint():
    product_id = _create_product(name="Smart Thermal Tumbler", price=1450.0)
    res = client.post(f"/api/products/{product_id}/generate-listings")

    assert res.status_code == 200
    listings = res.json()
    assert {item["platform"] for item in listings} == {"shopee", "tiktok", "lazada"}


def test_full_pipeline_endpoint():
    product_id = _create_product(name="Ergonomic Lumbar Cushion", price=1799.0)
    res = client.post(f"/api/products/{product_id}/full-pipeline")

    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "completed"
    assert body["product"]["analysis"]["market_insights"] is not None

    list_res = client.get(f"/api/products/{product_id}/listings")
    assert list_res.status_code == 200
    assert len(list_res.json()) == 3
