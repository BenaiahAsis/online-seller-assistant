"""Agent 2 - Market Analysis Agent. Channel strategy only, no product facts."""

from __future__ import annotations

import os
from typing import Any

from pydantic import BaseModel, Field

from app.agents.validation import (
    PLACEHOLDER_KEYS,
    build_corpus,
    call_agent,
    grounded,
)

PLATFORMS = ("shopee", "tiktok", "lazada")
MODEL = "gpt-4o-mini"
CURRENCY = "\u20b1"
BUDGET_MAX = 500.0
MID_MAX = 2500.0


def price_tier(price: float) -> str:
    if price < BUDGET_MAX:
        return "Budget-Friendly"
    if price <= MID_MAX:
        return "Mid-Tier Value"
    return "Premium"


# ===========================================================================
# Output contract
# ===========================================================================


class PriorityPoint(BaseModel):
    point: str = Field(max_length=160)
    source_index: int = Field(ge=0)
    platforms: list[str] = Field(min_length=1, max_length=3)


class BuyerObjection(BaseModel):
    objection: str = Field(max_length=200)
    response: str = Field(max_length=300)


class PlatformStrategy(BaseModel):
    focus: str = Field(max_length=80)
    angle: str = Field(max_length=300)
    tone: str = Field(max_length=80)
    keyword_emphasis: list[str] = Field(min_length=1, max_length=5)


class PlatformStrategies(BaseModel):
    shopee: PlatformStrategy
    tiktok: PlatformStrategy
    lazada: PlatformStrategy


class MarketAnalysis(BaseModel):
    price_tier: str = Field(max_length=40)
    price_rationale: str = Field(max_length=300)
    priority_points: list[PriorityPoint] = Field(min_length=2, max_length=5)
    buyer_objections: list[BuyerObjection] = Field(min_length=2, max_length=4)
    platform_strategies: PlatformStrategies


SYSTEM = (
    "You are Agent 2, the Market Analysis Agent. Agent 1 already categorised "
    "the product and extracted its selling points and keywords. Do not repeat "
    "or extend that work. Produce channel strategy only: ranking, objections "
    "and per-platform positioning. Never state a product fact you were not "
    "given. Return JSON only."
)


# ===========================================================================
# Fallback
# ===========================================================================


def _derive_fallback_market_insights(
    name: str,
    price: float,
    category: str | None,
    target_audience: str | None,
    selling_points: list[str] | None,
    keywords: list[str] | None,
) -> dict[str, Any]:
    points = [str(p) for p in (selling_points or []) if str(p).strip()][:5]
    terms = [str(k) for k in (keywords or []) if str(k).strip()]
    if not terms:
        terms = [w for w in name.lower().split() if len(w) > 3][:3] or ["online"]

    ranked = [
        {
            "point": text,
            "source_index": index,
            "platforms": ["tiktok"] if index % 2 else ["shopee", "lazada"],
        }
        for index, text in enumerate(points)
    ]
    while len(ranked) < 2:
        ranked.append(
            {
                "point": f"Listed at {CURRENCY}{price:,.2f}",
                "source_index": 0,
                "platforms": ["shopee", "lazada"],
            }
        )

    tier = price_tier(price)
    audience = target_audience or "the buyers named in the product profile"

    analysis = MarketAnalysis.model_validate(
        {
            "price_tier": tier,
            "price_rationale": (
                f"At {CURRENCY}{price:,.2f} the product sits in the {tier} "
                f"band for {category or 'its category'}."
            ),
            "priority_points": ranked,
            "buyer_objections": [
                {
                    "objection": "Buyer cannot tell whether the price is justified.",
                    "response": "Lead with the materials the seller listed.",
                },
                {
                    "objection": "Buyer does not know if the item suits their need.",
                    "response": f"Write for {audience} using only the listed details.",
                },
            ],
            "platform_strategies": {
                "shopee": {
                    "focus": "Search match",
                    "angle": "Open with the product name and listed specifications.",
                    "tone": "Informative and direct",
                    "keyword_emphasis": terms[:3],
                },
                "tiktok": {
                    "focus": "Visual hook",
                    "angle": "Open with the most useful listed detail, shown in use.",
                    "tone": "Casual and conversational",
                    "keyword_emphasis": terms[:2],
                },
                "lazada": {
                    "focus": "Specification detail",
                    "angle": "Present the listed specifications in a scannable block.",
                    "tone": "Neutral and factual",
                    "keyword_emphasis": terms[:3],
                },
            },
        }
    )
    payload = analysis.model_dump()
    payload["source"] = "heuristic"
    return payload


# ===========================================================================
# Validation checks
# ===========================================================================


def _make_checks(points: list[str], keywords: list[str], tier: str):
    allowed = {k.lower() for k in keywords}

    def checks(analysis: MarketAnalysis) -> list[str]:
        problems = []

        if analysis.price_tier != tier:
            problems.append(f"price_tier must be '{tier}', got '{analysis.price_tier}'")

        for i, item in enumerate(analysis.priority_points):
            bad = [p for p in item.platforms if p not in PLATFORMS]
            if bad:
                problems.append(f"priority_points.{i}.platforms has invalid {bad}")
            if not points:
                continue
            if item.source_index >= len(points):
                problems.append(f"priority_points.{i}.source_index out of range")
            elif not grounded(item.point, [points[item.source_index]]):
                problems.append(
                    f"priority_points.{i}.point must restate Agent 1 point "
                    f"{item.source_index}, not introduce a new one"
                )

        for platform in PLATFORMS:
            strategy = getattr(analysis.platform_strategies, platform)
            for term in strategy.keyword_emphasis:
                if term.lower() not in allowed:
                    problems.append(
                        f"{platform}.keyword_emphasis '{term}' is not an "
                        "Agent 1 keyword"
                    )

        return problems

    return checks


# ===========================================================================
# Entry point
# ===========================================================================


def _client() -> Any | None:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key or key in PLACEHOLDER_KEYS:
        return None
    from openai import OpenAI

    return OpenAI(api_key=key)


def run_market_analyzer_agent(
    product_data: dict[str, Any],
    analysis_data: dict[str, Any],
    client: Any | None = None,
) -> dict[str, Any]:
    name = str(product_data.get("name", "Product"))
    price = float(product_data.get("price", 0.0))
    category = analysis_data.get("category")
    audience = analysis_data.get("target_audience")
    points = [str(p) for p in (analysis_data.get("selling_points") or [])]
    keywords = [str(k) for k in (analysis_data.get("suggested_keywords") or [])]

    fallback = _derive_fallback_market_insights(
        name, price, category, audience, points, keywords
    )

    client = client or _client()
    if client is None:
        fallback["fallback_reason"] = ["no OPENAI_API_KEY configured"]
        return fallback

    tier = price_tier(price)
    corpus = build_corpus(
        name,
        product_data.get("materials"),
        product_data.get("features"),
        category,
        audience,
        points,
        keywords,
    )
    numbered = "\n".join(f"  [{i}] {t}" for i, t in enumerate(points)) or "  (none)"

    prompt = (
        "Agent 1 produced this profile. Treat it as fact and do not add to it.\n\n"
        f"Product: {name}\n"
        f"Price: {CURRENCY}{price:,.2f}\n"
        f"Category: {category or 'unspecified'}\n"
        f"Target audience: {audience or 'unspecified'}\n"
        f"Selling points:\n{numbered}\n"
        f"Keywords: {', '.join(keywords) or '(none)'}\n"
        f"Price tier computed by the backend: {tier}\n\n"
        f"- price_tier: echo exactly '{tier}'.\n"
        "- price_rationale: one sentence on what that tier means.\n"
        "- priority_points: 2 to 5 entries, each reusing a numbered selling "
        "point with its source_index, ranked by persuasive weight.\n"
        "- buyer_objections: 2 to 4 hesitations plus the angle to answer "
        "them. Internal notes, not copy.\n"
        "- platform_strategies: shopee, tiktok and lazada, with "
        "keyword_emphasis drawn from the keywords above.\n\n"
        "Never mention warranties, authenticity, certifications, package "
        "contents, product condition, shipping or other products."
    )

    analysis, errors = call_agent(
        client=client,
        model=MODEL,
        system=SYSTEM,
        prompt=prompt,
        schema_model=MarketAnalysis,
        corpus=corpus,
        temperature=0.2,
        max_tokens=900,
        checks=_make_checks(points, keywords, tier),
    )

    if analysis is None:
        fallback["fallback_reason"] = errors
        return fallback

    payload = analysis.model_dump()
    payload["source"] = "ai"
    return payload
