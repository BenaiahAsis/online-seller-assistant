"""Agent 3 - Listing Generation Agent. Writes copy from Agent 1 and Agent 2."""

from __future__ import annotations

import os
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from app.agents.product_analyzer import split_seller_notes
from app.agents.validation import (
    PLACEHOLDER_KEYS,
    build_corpus,
    call_agent,
    events_to_reasons,
    grounded,
    skipped_event,
    words,
)
from app.config import settings

PLATFORMS = ("shopee", "tiktok", "lazada")
MODEL = settings.openai_model
CURRENCY = "\u20b1"

FORBIDDEN_TAG_WORDS = {
    "aluminum",
    "zinc",
    "iron",
    "steel",
    "glass",
    "plastic",
    "metal",
    "rubber",
    "silicone",
    "copper",
    "free",
    "bought",
    "item",
    "most",
    "deal",
    "best",
    "cheap",
}

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


def build_fallback_titles(
    name: str,
    category: str | None,
    materials: str | None,
    features: str | None,
) -> dict[str, str]:
    feats = [
        f
        for f in split_seller_notes(features)
        if "most bought" not in f.lower() and "best seller" not in f.lower()
    ]
    perk = feats[0] if feats else ""
    # The seller's first listed material, as written: splitting it into words
    # turned "High-density memory foam" into "High & Density".
    material = (materials or "").split(",")[0].strip()

    # Titles use only seller facts: no "Durable", "Premium", "Official" or
    # "Bonus" the seller never claimed (B17).
    # 1. Shopee: search title, name plus the first seller point
    shopee_title = " | ".join(part for part in (name, perk or category) if part)
    if len(shopee_title) > 115:
        shopee_title = shopee_title[:115]

    # 2. TikTok: short hook that names the product
    tiktok_title = f"Check out the {name}" + (f": {perk}" if perk else "")
    if len(tiktok_title) > 100:
        tiktok_title = tiktok_title[:100]

    # 3. Lazada: name, material and first point
    lazada_title = " - ".join(part for part in (name, material, perk) if part)
    if len(lazada_title) > 120:
        lazada_title = lazada_title[:120]

    return {
        "shopee": shopee_title,
        "tiktok": tiktok_title,
        "lazada": lazada_title,
    }


def _tags(keywords: list[str], platform: str, limit: int = 4) -> list[str]:
    tokens: list[str] = []
    for term in keywords:
        clean_term = str(term).lower().strip()
        if clean_term in FORBIDDEN_TAG_WORDS:
            continue
        token = "".join(c for c in clean_term if c.isalnum())
        if token and token not in tokens and token not in FORBIDDEN_TAG_WORDS:
            tokens.append(token)
        if len(tokens) >= limit:
            break
    for ch_tag in CHANNEL_TAGS[platform][:2]:
        if ch_tag not in tokens and len(tokens) < 6:
            tokens.append(ch_tag)
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
    titles = build_fallback_titles(name, category, materials, features)
    clean_bullets = [
        str(p)
        for p in (selling_points or [])
        if str(p).strip() and "all details above" not in str(p).lower()
    ][:5]

    if not clean_bullets:
        if materials:
            clean_bullets.append(f"Made with {materials}")
        clean_bullets.append(f"Listed at {CURRENCY}{price:,.2f}")

    terms = [
        str(k)
        for k in (keywords or [])
        if str(k).strip() and str(k).lower().strip() not in FORBIDDEN_TAG_WORDS
    ]
    if not terms:
        terms = [
            w
            for w in name.lower().split()
            if len(w) > 3 and w not in FORBIDDEN_TAG_WORDS
        ][:3] or ["smartfinds"]

    specs = [
        f"• Product: {name}",
        f"• Price: {CURRENCY}{price:,.2f}",
    ]
    if category:
        specs.append(f"• Category: {category}")
    if materials:
        specs.append(f"• Materials: {materials}")
    spec_block = "\n".join(specs)
    highlights_block = "\n".join(f"✨ {b}" for b in clean_bullets)

    # Descriptions restate the seller's details only. No shipping speed,
    # delivery coverage, vouchers, stock urgency or quality claims (B17).
    shopee_desc = (
        f"{name}\n\n"
        f"KEY HIGHLIGHTS:\n{highlights_block}\n\n"
        f"PRODUCT SPECIFICATIONS:\n{spec_block}"
    )
    shopee_cta = "Add to cart now."

    tiktok_desc = (
        f"Here's the {name} 👀\n\n{highlights_block}\n\nPrice: {CURRENCY}{price:,.2f}"
    )
    tiktok_cta = "Tap the yellow basket to order."

    lazada_desc = (
        f"{name}\n\n"
        f"PRODUCT FEATURES:\n{highlights_block}\n\n"
        f"SPECIFICATION DETAILS:\n{spec_block}"
    )
    lazada_cta = "Add to cart now."

    return [
        {
            "platform": "shopee",
            "title": titles["shopee"],
            "description": shopee_desc,
            "bullet_points": clean_bullets,
            "hashtags": _tags(terms, "shopee"),
            "call_to_action": shopee_cta,
            "source": "heuristic",
        },
        {
            "platform": "tiktok",
            "title": titles["tiktok"],
            "description": tiktok_desc,
            "bullet_points": clean_bullets[:3],
            "hashtags": _tags(terms, "tiktok", limit=3),
            "call_to_action": tiktok_cta,
            "source": "heuristic",
        },
        {
            "platform": "lazada",
            "title": titles["lazada"],
            "description": lazada_desc,
            "bullet_points": clean_bullets,
            "hashtags": _tags(terms, "lazada"),
            "call_to_action": lazada_cta,
            "source": "heuristic",
        },
    ]


# ===========================================================================
# Validation checks
# ===========================================================================


def _make_checks(
    sources: list[str], keywords: list[str], corpus: str = "", name: str = ""
):
    # Agent 1's keywords are usually multi-word phrases ("lumbar support
    # cushion") while hashtags are shortened forms of them ("#lumbarsupport").
    # Grounding is therefore checked per word, not against the whole phrase.
    allowed_words = {
        word
        for word in words(corpus) | words(" ".join(keywords)) | words(" ".join(sources))
        if word not in FORBIDDEN_TAG_WORDS
    }
    tokens = {
        "".join(c for c in str(k).lower() if c.isalnum())
        for k in keywords
        if str(k) and str(k).lower().strip() not in FORBIDDEN_TAG_WORDS
    }

    name_words = words(name)

    def checks(bundle: ListingBundle) -> list[str]:
        problems = []
        for listing in bundle.listings:
            if name_words and not (words(listing.title) & name_words):
                problems.append(
                    f"{listing.platform}.title must include the product name "
                    f"('{name}'), got '{listing.title}'"
                )
            combined_text = f"{listing.title} {listing.description}".lower()
            if (
                "all details above come from" in combined_text
                or "what the seller lists" in combined_text
            ):
                problems.append(
                    f"{listing.platform} contains prohibited system meta-text"
                )

            for i, bullet in enumerate(listing.bullet_points):
                if not grounded(bullet, sources, allow_general_terms=True):
                    problems.append(
                        f"{listing.platform}.bullet_points.{i} is not in the "
                        f"product data: '{bullet}'"
                    )

            for tag in listing.hashtags:
                clean_tag = tag.lstrip("#").lower()
                if clean_tag in FORBIDDEN_TAG_WORDS:
                    problems.append(
                        f"{listing.platform}.hashtags contains forbidden "
                        f"material/fluff hashtag '{tag}'"
                    )
                    continue
                token = "".join(c for c in tag.lower() if c.isalnum())
                if token in CHANNEL_TAGS[listing.platform]:
                    continue
                if any(word in token for word in allowed_words):
                    continue
                if any(t and token in t for t in tokens):
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

    base_url = settings.openai_base_url.strip() or None
    return OpenAI(api_key=key, base_url=base_url)


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
        skipped = skipped_event("no OPENAI_API_KEY configured")
        for listing in fallback:
            listing["validation_events"] = skipped
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
        "the verified material below.\n\n"
        f"Product: {name}\n"
        f"Price: {CURRENCY}{price:,.2f}\n"
        f"Category: {category or 'unspecified'}\n"
        f"Materials: {materials or 'not supplied'}\n"
        f"Seller notes: {features or 'not supplied'}\n\n"
        f"Selling points ranked by Agent 2:\n{numbered}\n\n"
        f"Price tier: {market.get('price_tier', 'unspecified')}\n"
        f"Channel strategy:\n{_strategy_brief(market)}\n\n"
        f"Approved keywords: {', '.join(keywords) or '(none)'}\n\n"
        "STRICT PLATFORM INSTRUCTIONS:\n"
        "1. TITLES:\n"
        "   - Shopee: Keyword-rich search title under 120 chars.\n"
        "   - TikTok: Short punchy hook that still names the product.\n"
        "   - Lazada: Clean trust title highlighting materials/features.\n"
        "   - NEVER use titles like '{name} - {category} specifications'.\n"
        "2. DESCRIPTIONS:\n"
        "   - Write genuine sales copy with hook, highlights, and specs.\n"
        "   - NEVER include meta-text like 'All details above come from'.\n"
        "3. CALL TO ACTION:\n"
        "   - Shopee: Vouchers or add to cart.\n"
        "   - TikTok: Tap basket before stock runs out.\n"
        "   - Lazada: Fast delivery and checkout.\n"
        "4. HASHTAGS:\n"
        "   - Draw ONLY from approved keywords and channel tags.\n"
        "   - NEVER use standalone materials (e.g. #zinc, #iron) or #free.\n"
        "5. GUARDRAILS:\n"
        "   - Never invent warranties, certifications, or medical claims.\n"
    )

    bundle, events = call_agent(
        client=client,
        model=MODEL,
        system=SYSTEM,
        prompt=prompt,
        schema_model=ListingBundle,
        corpus=corpus,
        temperature=0.6,
        max_tokens=3500,
        checks=_make_checks(sources, keywords, corpus, name),
    )

    if bundle is None:
        reasons = events_to_reasons(events)
        for listing in fallback:
            listing["fallback_reason"] = reasons
            listing["validation_events"] = events
        return fallback

    results = []
    for listing in bundle.listings:
        payload = listing.model_dump()
        payload["source"] = "ai"
        payload["validation_events"] = events
        results.append(payload)
    return results
