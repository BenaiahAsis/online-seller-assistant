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
from app.agents.logger import (
    generate_agent_2_logs,
    generate_agent_3_logs,
)
from app.agents.market_analyzer import (
    _derive_fallback_market_insights,
    price_tier,
    run_market_analyzer_agent,
)
from app.agents.validation import scan_claims, unsupported_claims
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


def test_agent_execution_logs_and_endpoint():
    product_id = _create_product(name="Smart Watch Band", price=350.0)

    # 1. Test Agent 1 logs
    a1_res = client.post(f"/api/products/{product_id}/analyze")
    assert a1_res.status_code == 200
    analysis = a1_res.json()["analysis"]
    assert "execution_logs" in analysis
    a1_logs = analysis["execution_logs"]
    assert len(a1_logs) >= 5
    assert any(log["stage"] == "INGEST" for log in a1_logs)
    assert any("Agent 1" in log["agent"] for log in a1_logs)

    # 2. Test Agent 2 logs added
    a2_res = client.post(f"/api/products/{product_id}/market-analysis")
    assert a2_res.status_code == 200
    a2_logs = a2_res.json()["analysis"]["execution_logs"]
    assert any("Agent 2" in log["agent"] for log in a2_logs)

    # 3. Test Agent 3 logs added
    a3_res = client.post(f"/api/products/{product_id}/generate-listings")
    assert a3_res.status_code == 200

    # 4. Test GET /api/products/{id}/logs endpoint
    logs_res = client.get(f"/api/products/{product_id}/logs")
    assert logs_res.status_code == 200
    all_logs = logs_res.json()
    assert len(all_logs) >= 10
    agent_names = {log["agent"] for log in all_logs}
    assert any("Agent 1" in a for a in agent_names)
    assert any("Agent 2" in a for a in agent_names)
    assert any("Agent 3" in a for a in agent_names)


def test_update_product_listing_endpoint():
    product_id = _create_product(name="Leather Cardholder", price=450.0)
    gen_res = client.post(f"/api/products/{product_id}/generate-listings")
    assert gen_res.status_code == 200
    listing = gen_res.json()[0]
    listing_id = listing["id"]

    patch_res = client.patch(
        f"/api/listings/{listing_id}",
        json={"title": "Customized Handcrafted Cardholder"},
    )
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["title"] == "Customized Handcrafted Cardholder"


# --------------------------------------------------------------------------
# Sprint 4 Pipeline Quality Tests (Requirements a-e)
# --------------------------------------------------------------------------


def test_smartwatch_category_inference():
    """Requirement (a): Category inference for smartwatch.

    Must infer Wearables & Smartwatches.
    """
    from app.agents.product_analyzer import (
        _derive_fallback_profile,
        infer_category_and_audience,
    )

    category, audience = infer_category_and_audience(
        "Smartwatch", "aluminum, zinc iron, glass Free strap, Most bought item"
    )
    assert category == "Wearables & Smartwatches"
    assert "smartwatch" in audience.lower() or "budget" in audience.lower()

    profile = _derive_fallback_profile(
        name="Smartwatch",
        price=20.0,
        quantity=10,
        materials="aluminum, zinc iron, glass",
        features="Free strap, Most bought item",
    )
    assert profile["category"] == "Wearables & Smartwatches"
    assert profile["category"] != "General Merchandise"


def test_zinc_iron_materials_not_in_hashtags():
    """Requirement (b): 'zinc' and 'iron' must never appear as hashtags in listings."""
    from app.agents.listing_generator import _derive_fallback_listings
    from app.agents.product_analyzer import _derive_fallback_profile

    profile = _derive_fallback_profile(
        name="Smartwatch",
        price=20.0,
        quantity=10,
        materials="aluminum, zinc iron, glass",
        features="Free strap, Most bought item",
    )
    listings = _derive_fallback_listings(
        name="Smartwatch",
        price=20.0,
        materials="aluminum, zinc iron, glass",
        features="Free strap, Most bought item",
        category=profile["category"],
        selling_points=profile["selling_points"],
        keywords=profile["suggested_keywords"],
    )

    for listing in listings:
        hashtags_lower = [h.lower() for h in listing["hashtags"]]
        assert "#zinc" not in hashtags_lower
        assert "#iron" not in hashtags_lower
        assert "#aluminum" not in hashtags_lower
        assert "#glass" not in hashtags_lower
        assert "#free" not in hashtags_lower


def test_meta_text_never_appears_in_output():
    """Requirement (c): Meta-text line must never appear in output descriptions."""
    from app.agents.listing_generator import _derive_fallback_listings
    from app.agents.product_analyzer import _derive_fallback_profile

    profile = _derive_fallback_profile(
        name="Smartwatch",
        price=20.0,
        quantity=10,
        materials="aluminum, zinc iron, glass",
        features="Free strap, Most bought item",
    )
    listings = _derive_fallback_listings(
        name="Smartwatch",
        price=20.0,
        materials="aluminum, zinc iron, glass",
        features="Free strap, Most bought item",
        category=profile["category"],
        selling_points=profile["selling_points"],
        keywords=profile["suggested_keywords"],
    )

    banned_meta_phrases = [
        "all details above come from",
        "seller's product information",
        "what the seller lists",
    ]

    for listing in listings:
        desc_lower = listing["description"].lower()
        title_lower = listing["title"].lower()
        for phrase in banned_meta_phrases:
            assert phrase not in desc_lower
            assert phrase not in title_lower


def test_most_bought_item_flagged():
    """Requirement (d): 'Most bought item' must be flagged as unverified claim."""
    from app.agents.product_analyzer import (
        _derive_fallback_profile,
        detect_unverified_claims,
    )

    flags = detect_unverified_claims("Free strap, Most bought item")
    assert len(flags) >= 1
    assert any("most bought" in f["claim"].lower() for f in flags)
    assert any("popular choice" in f["softened"].lower() for f in flags)

    profile = _derive_fallback_profile(
        name="Smartwatch",
        price=20.0,
        quantity=10,
        materials="aluminum, zinc iron, glass",
        features="Free strap, Most bought item",
    )
    unverified = profile["market_insights"]["unverified_claims"]
    assert any("most bought" in f["claim"].lower() for f in unverified)


def test_fake_claim_fda_approved_blocked():
    """Requirement (e): Fake claims like 'FDA approved' must be blocked."""
    from app.agents.product_analyzer import detect_unverified_claims
    from app.agents.validation import scan_claims

    # In Agent 1 detector
    flags = detect_unverified_claims("FDA approved, 100% waterproof")
    assert any("fda" in f["claim"].lower() for f in flags)

    # In Agent 2/3 validator scanner
    corpus = "smartwatch aluminum glass free strap"
    violations = scan_claims({"bullet": "FDA approved medical device"}, corpus)
    assert any("certification claim" in v for v in violations)


# --------------------------------------------------------------------------
# Execution logs reflect what validation actually did
# --------------------------------------------------------------------------


def _stages(logs):
    return [entry["stage"] for entry in logs]


def test_recovered_retry_is_recorded_not_hidden():
    fake = FakeClient(fabricated_market_payload(), valid_market_payload())
    result = run_market_analyzer_agent(PRODUCT, PROFILE, client=fake)

    events = result["validation_events"]
    assert [e["outcome"] for e in events] == ["rejected", "accepted"]
    assert "claims" in events[0]["gates"]

    logs = generate_agent_2_logs(PRODUCT, PROFILE, result)
    stages = _stages(logs)
    assert "VALIDATE_REJECT" in stages
    assert "VALIDATE_PASS" in stages
    assert "RETRY_RECOVERED" in stages

    # The rejected attempt must never be reported as a clean run.
    text = " ".join(entry["message"] for entry in logs)
    assert "0 ungrounded claims" not in text


def test_first_attempt_success_records_no_rejection():
    fake = FakeClient(valid_market_payload())
    result = run_market_analyzer_agent(PRODUCT, PROFILE, client=fake)

    assert [e["outcome"] for e in result["validation_events"]] == ["accepted"]
    stages = _stages(generate_agent_2_logs(PRODUCT, PROFILE, result))
    assert "VALIDATE_PASS" in stages
    assert "VALIDATE_REJECT" not in stages
    assert "RETRY_RECOVERED" not in stages


def test_exhausted_retries_are_logged_as_fallback():
    fake = FakeClient("{}", "{}")
    result = run_market_analyzer_agent(PRODUCT, PROFILE, client=fake)

    assert result["source"] == "heuristic"
    assert all(e["outcome"] == "rejected" for e in result["validation_events"])

    stages = _stages(generate_agent_2_logs(PRODUCT, PROFILE, result))
    assert stages.count("VALIDATE_REJECT") == 2
    assert "FALLBACK_USED" in stages


def test_api_error_is_logged_as_error():
    fake = FakeClient(RuntimeError("rate limited"))
    result = run_market_analyzer_agent(PRODUCT, PROFILE, client=fake)

    logs = generate_agent_2_logs(PRODUCT, PROFILE, result)
    error_logs = [e for e in logs if e["stage"] == "API_ERROR"]
    assert error_logs and error_logs[0]["level"] == "ERROR"
    assert "rate limited" in error_logs[0]["message"]


def test_missing_key_is_logged_as_skipped_not_passed():
    result = run_market_analyzer_agent(PRODUCT, PROFILE)

    assert result["source"] == "heuristic"
    stages = _stages(generate_agent_2_logs(PRODUCT, PROFILE, result))
    assert "VALIDATE_SKIP" in stages
    assert "VALIDATE_PASS" not in stages


def test_listing_agent_logs_its_own_validation():
    fake = FakeClient(fabricated_listing_payload(), valid_listing_payload())
    listings = run_listing_generator_agent(
        PRODUCT, PROFILE, MARKET_CONTEXT, client=fake
    )

    stages = _stages(generate_agent_3_logs(PRODUCT, listings))
    assert "VALIDATE_REJECT" in stages
    assert "RETRY_RECOVERED" in stages
