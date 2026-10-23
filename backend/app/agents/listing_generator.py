import json
import os
from typing import Any


def _derive_fallback_listings(
    name: str,
    price: float,
    materials: str | None,
    features: str | None,
    category: str | None,
    selling_points: list[str] | None,
    keywords: list[str] | None,
) -> list[dict[str, Any]]:
    """Generate platform-tailored listings deterministically without external API."""
    bullets = selling_points or [
        "Premium quality build and materials",
        "Engineered for daily durability and optimal performance",
        "Modern ergonomic styling suited for any workspace",
    ]
    raw_kw = keywords or ["bestseller", "quality", "newarrival"]

    shopee_title = f"[Ready Stock] {name} - High Performance & Premium Quality"[:120]
    shopee_bullets = bullets[:4]
    shopee_desc = (
        "🔥 READY STOCK | FAST SHIPPING | 100% BRAND NEW\n\n"
        f"Product: {name}\n"
        f"Price: ${price:.2f}\n"
        f"Materials: {materials or 'Standard High-Grade Material'}\n\n"
        "✨ KEY HIGHLIGHTS:\n"
        + "\n".join([f"• {pt}" for pt in shopee_bullets])
        + "\n\n📦 Package Includes:\n"
        f"1x {name}, User Documentation\n\n"
        "✅ 7-Day Replacement Guarantee for Factory Defects"
    )

    tiktok_title = f"The Must-Have {name} Everyone is Talking About! ✨"
    tiktok_bullets = bullets[:3]
    tiktok_desc = (
        f"POV: You upgraded to the {name} and your routine is 10x better! 😍\n\n"
        + "\n".join([f"👉 {pt}" for pt in tiktok_bullets])
        + f"\n\nOnly ${price:.2f}! Limited stock available.\n"
        "Tap the yellow basket to get yours today! 🛒👇"
    )

    lazada_title = (
        f"{name} - Official Store Quality ({category or 'General Merchandise'})"
    )
    lazada_bullets = bullets[:4]
    lazada_desc = (
        "GUARANTEED AUTHENTIC & TESTED BEFORE SHIPPING\n\n"
        f"{name} delivers reliable performance and exceptional value.\n\n"
        "SPECIFICATIONS & FEATURES:\n"
        + "\n".join([f"- {pt}" for pt in lazada_bullets])
        + f"\n- Materials: {materials or 'High-grade commercial build'}\n"
        f"- Detailed Notes: {features or 'Quality-tested componentry'}\n\n"
        "Claim store vouchers before checkout for extra savings!"
    )

    return [
        {
            "platform": "shopee",
            "title": shopee_title,
            "description": shopee_desc,
            "bullet_points": shopee_bullets,
            "hashtags": [f"#{k.replace(' ', '')}" for k in raw_kw[:5]]
            + ["#shopeeph", "#bestseller"],
            "call_to_action": "Order today for fast dispatch! Limited stock.",
        },
        {
            "platform": "tiktok",
            "title": tiktok_title,
            "description": tiktok_desc,
            "bullet_points": tiktok_bullets,
            "hashtags": [f"#{k.replace(' ', '')}" for k in raw_kw[:4]]
            + ["#tiktokmademebuyit", "#techtok", "#fyp"],
            "call_to_action": "Tap the yellow basket before it sells out!",
        },
        {
            "platform": "lazada",
            "title": lazada_title,
            "description": lazada_desc,
            "bullet_points": lazada_bullets,
            "hashtags": [f"#{k.replace(' ', '')}" for k in raw_kw[:5]]
            + ["#lazadaph", "#qualityguaranteed"],
            "call_to_action": "Add to cart now and claim your vouchers at checkout!",
        },
    ]


def run_listing_generator_agent(
    product_data: dict[str, Any],
    analysis_data: dict[str, Any],
    market_data: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Execute Agent 3 (Listing Generation Agent).

    Generates tailored marketplace listings for Shopee, TikTok Shop, and Lazada.
    """
    name = product_data.get("name", "Product")
    price = float(product_data.get("price", 0.0))
    materials = product_data.get("materials")
    features = product_data.get("features")

    category = analysis_data.get("category")
    selling_points = analysis_data.get("selling_points") or []
    keywords = analysis_data.get("suggested_keywords") or []

    fallback = _derive_fallback_listings(
        name=name,
        price=price,
        materials=materials,
        features=features,
        category=category,
        selling_points=selling_points,
        keywords=keywords,
    )

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key or api_key in {"not-set-yet", "mock", "placeholder"}:
        return fallback

    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        prompt = (
            "You are an expert e-commerce copywriter (Agent 3).\n"
            "Generate 3 platform-tailored listings (Shopee, TikTok, Lazada) "
            "based on the product specs and market intelligence.\n\n"
            f"Product: {name}\n"
            f"Price: ${price:.2f}\n"
            f"Materials: {materials}\n"
            f"Features: {features}\n"
            f"Category: {category}\n"
            f"Selling Points: {selling_points}\n"
            f"SEO Keywords: {keywords}\n"
            f"Market Intelligence: {market_data or {}}\n\n"
            "Return JSON object with key 'listings' containing 3 items:\n"
            "- platform: 'shopee' | 'tiktok' | 'lazada'\n"
            "- title: str\n"
            "- description: str\n"
            "- bullet_points: list[str]\n"
            "- hashtags: list[str]\n"
            "- call_to_action: str"
        )

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a copywriter returning valid JSON only.",
                },
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.4,
        )

        content = response.choices[0].message.content or "{}"
        parsed = json.loads(content)
        raw_listings = parsed.get("listings")

        if isinstance(raw_listings, list) and len(raw_listings) >= 3:
            return raw_listings
        return fallback
    except Exception:
        return fallback
