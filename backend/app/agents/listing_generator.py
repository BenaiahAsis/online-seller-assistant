"""Agent 3 - Listing Generation Agent. Writes copy from Agent 1 and Agent 2."""

from __future__ import annotations

import os
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from app.agents.validation import (
    PLACEHOLDER_KEYS,
    build_corpus,
    call_agent,
    grounded,
)

PLATFORMS = ("shopee", "tiktok", "lazada")
MODEL = "gpt-4o-mini"
CURRENCY = "\u20b1"

CHANNEL_TAGS = {
    "shopee": ("shopeeph", "shopeefinds", "shopee"),
    "tiktok": ("fyp", "foryou", "tiktokshopph"),
    "lazada": ("lazadaph", "lazadafinds", "lazada"),
}


# ===========================================================================
# Output contract
# ===========================================================================


class PlatformListing(BaseModel):
    platform: Literal["shopee", "tiktok", "lazada"]
    title: str = Field(min_length=10, max_length=255)
    description: str = Field(min_length=40, max_length=3000)
    bullet_points: list[str] = Field(min_length=2, max_length=6)
    hashtags: list[str] = Field(min_length=3, max_length=10)
    call_to_action: str = Field(min_length=5, max_length=255)


class ListingBundle(BaseModel):
    listings: list[PlatformListing] = Field(min_length=3, max_length=3)

    @model_validator(mode="after")
    def _one_per_platform(self) -> ListingBundle:
        seen = [item.platform for item in self.listings]
        if sorted(seen) != sorted(PLATFORMS):
            raise ValueError(f"listings must cover {list(PLATFORMS)}, got {seen}")
        return self


SYSTEM = (
    "You are Agent 3, the Listing Generation Agent. Agent 1 supplied the "
    "product facts and Agent 2 the channel strategy. Write marketplace copy "
    "using only what they gave you. Rephrase and arrange freely, but never "
    "add a product fact, benefit, policy or statistic. Return JSON only."
)


# ===========================================================================
# Fallback
# ===========================================================================


def _tags(keywords: list[str], platform: str, limit: int = 4) -> list[str]:
    tokens: list[str] = []
    for term in keywords:
        token = "".join(c for c in str(term).lower() if c.isalnum())
        if token and token not in tokens:
            tokens.append(token)
        if len(tokens) >= limit:
            break
    tokens += [t for t in CHANNEL_TAGS[platform][:2] if t not in tokens]
    return [f"#{t}" for t in tokens]


def _derive_fallback_listings(
    name: str,
    price: float,
    materials: str | None,
    features: str | None,
    category: str | None,
    selling_points: list[str] | None,
    keywords: list[str] | None,
) -> list[dict[str, Any]]:
    specs = [f"Price: {CURRENCY}{price:,.2f}"]
    if category:
        specs.append(f"Category: {category}")
    if materials:
        specs.append(f"Materials: {materials}")
    if features:
        specs.append(f"Details: {features}")

    bullets = [str(p) for p in (selling_points or []) if str(p).strip()][:4]
    if len(bullets) < 2:
        bullets += specs
    bullets = bullets[:4]

    terms = [str(k) for k in (keywords or []) if str(k).strip()]
    if not terms:
        terms = [w for w in name.lower().split() if len(w) > 3][:3]

    spec_block = "\n".join(specs)
    bullet_block = "\n".join(f"- {b}" for b in bullets)
    note = "All details above come from the seller's product information."

    return [
        {
            "platform": "shopee",
            "title": f"{name} - {category or 'Product Listing'}"[:255],
            "description": (
                f"{name}\n\n{spec_block}\n\nWhat the seller lists:\n"
                f"{bullet_block}\n\n{note}"
            ),
            "bullet_points": bullets,
            "hashtags": _tags(terms, "shopee"),
            "call_to_action": "Check the specifications and add to cart.",
            "source": "heuristic",
        },
        {
            "platform": "tiktok",
            "title": f"{name} - what it is and what it costs"[:255],
            "description": (
                f"{name} - here is what it actually is.\n\n{bullet_block}\n\n"
                f"Priced at {CURRENCY}{price:,.2f}. {note}"
            ),
            "bullet_points": bullets[:3],
            "hashtags": _tags(terms, "tiktok", limit=3),
            "call_to_action": "Tap the basket to see the full details.",
            "source": "heuristic",
        },
        {
            "platform": "lazada",
            "title": f"{name} - {category or 'Product'} specifications"[:255],
            "description": (
                f"{name}\n\nSpecifications\n{spec_block}\n\nListed features\n"
                f"{bullet_block}\n\n{note}"
            ),
            "bullet_points": bullets,
            "hashtags": _tags(terms, "lazada"),
            "call_to_action": "Add to cart to review the full specifications.",
            "source": "heuristic",
        },
    ]


# ===========================================================================
# Validation checks
# ===========================================================================


def _make_checks(sources: list[str], keywords: list[str]):
    tokens = {
        "".join(c for c in str(k).lower() if c.isalnum()) for k in keywords if str(k)
    }

    def checks(bundle: ListingBundle) -> list[str]:
        problems = []
        for listing in bundle.listings:
            for i, bullet in enumerate(listing.bullet_points):
                if not grounded(bullet, sources):
                    problems.append(
                        f"{listing.platform}.bullet_points.{i} is not in the "
                        f"product data: '{bullet}'"
                    )
            for tag in listing.hashtags:
                token = "".join(c for c in tag.lower() if c.isalnum())
                if token in CHANNEL_TAGS[listing.platform]:
                    continue
                if any(t and t in token for t in tokens):
                    continue
                problems.append(
                    f"{listing.platform}.hashtags '{tag}' is not an Agent 1 "
                    "keyword or an approved channel tag"
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


def _strategy_brief(market: dict[str, Any]) -> str:
    strategies = market.get("platform_strategies") or {}
    lines = []
    for platform in PLATFORMS:
        entry = strategies.get(platform) or {}
        lines.append(
            f"  {platform}: focus={entry.get('focus', 'n/a')}; "
            f"tone={entry.get('tone', 'n/a')}; angle={entry.get('angle', 'n/a')}"
        )
    return "\n".join(lines)


def run_listing_generator_agent(
    product_data: dict[str, Any],
    analysis_data: dict[str, Any],
    market_data: dict[str, Any] | None = None,
    client: Any | None = None,
) -> list[dict[str, Any]]:
    name = str(product_data.get("name", "Product"))
    price = float(product_data.get("price", 0.0))
    materials = product_data.get("materials")
    features = product_data.get("features")
    category = analysis_data.get("category")
    points = [str(p) for p in (analysis_data.get("selling_points") or [])]
    keywords = [str(k) for k in (analysis_data.get("suggested_keywords") or [])]
    market = market_data or {}

    fallback = _derive_fallback_listings(
        name, price, materials, features, category, points, keywords
    )

    client = client or _client()
    if client is None:
        return fallback

    ranked = [
        str(item.get("point", "")).strip()
        for item in (market.get("priority_points") or [])
        if str(item.get("point", "")).strip()
    ] or points

    sources = [*ranked, *points, name, str(materials or ""), str(features or "")]
    corpus = build_corpus(name, materials, features, category, points, keywords, ranked)
    numbered = "\n".join(f"  {i + 1}. {t}" for i, t in enumerate(ranked)) or "  (none)"

    prompt = (
        "Write one listing each for Shopee, TikTok Shop and Lazada using only "
        "the material below.\n\n"
        f"Product: {name}\n"
        f"Price: {CURRENCY}{price:,.2f}\n"
        f"Category: {category or 'unspecified'}\n"
        f"Materials: {materials or 'not supplied'}\n"
        f"Seller notes: {features or 'not supplied'}\n\n"
        f"Selling points ranked by Agent 2:\n{numbered}\n\n"
        f"Price tier: {market.get('price_tier', 'unspecified')}\n"
        f"Channel strategy:\n{_strategy_brief(market)}\n\n"
        f"Approved keywords: {', '.join(keywords) or '(none)'}\n\n"
        "- Every bullet point must rephrase a ranked selling point above.\n"
        "- Hashtags come from the approved keywords plus at most two channel "
        "tags per platform.\n"
        "- Match each platform's tone and angle.\n"
        "- Never state a warranty, return policy, authenticity, "
        "certification, package contents, product condition, shipping offer, "
        "stock urgency or comparison to another product.\n"
        "- If a detail is not above, leave it out."
    )

    bundle, errors = call_agent(
        client=client,
        model=MODEL,
        system=SYSTEM,
        prompt=prompt,
        schema_model=ListingBundle,
        corpus=corpus,
        temperature=0.6,
        max_tokens=2200,
        checks=_make_checks(sources, keywords),
    )

    if bundle is None:
        for listing in fallback:
            listing["fallback_reason"] = errors
        return fallback

    results = []
    for listing in bundle.listings:
        payload = listing.model_dump()
        payload["source"] = "ai"
        results.append(payload)
    return results
