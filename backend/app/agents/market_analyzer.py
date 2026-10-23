import json
import os
from typing import Any


def _derive_fallback_market_insights(
    name: str,
    price: float,
    category: str | None,
    target_audience: str | None,
    selling_points: list[str] | None,
    keywords: list[str] | None,
) -> dict[str, Any]:
    """Generate deterministic market analysis heuristics when API key is unavailable."""
    tier = (
        "Budget-Friendly"
        if price < 25
        else "Mid-Tier Value"
        if price <= 100
        else "Premium / Luxury"
    )

    triggers = [
        "High quality-to-price ratio compared to alternative market brands",
        "Durability and reliable daily performance for regular use",
        "Modern aesthetic design suitable for both home and workplace",
    ]

    edge = (
        f"Delivers premium {category or 'product'} functionality at an accessible "
        f"{tier} price point."
    )

    platform_strategies = {
        "shopee": {
            "focus": "Keywords & Value",
            "angle": "Highlight discount vouchers, specifications, and fast delivery.",
        },
        "tiktok": {
            "focus": "Visual Hook & Urgency",
            "angle": "Showcase immediate problem-solving utility in short videos.",
        },
        "lazada": {
            "focus": "Trust & Quality Assurance",
            "angle": "Emphasize genuine materials, ratings, and customer satisfaction.",
        },
    }

    summary = (
        f"Positioned in {tier} tier. Target audience ({target_audience or 'shoppers'}) "
        f"responds best to durability, price transparency, and multi-channel marketing."
    )

    return {
        "price_tier": tier,
        "buyer_triggers": triggers,
        "competitive_edge": edge,
        "platform_strategies": platform_strategies,
        "summary": summary,
    }


def run_market_analyzer_agent(
    product_data: dict[str, Any],
    analysis_data: dict[str, Any],
) -> dict[str, Any]:
    """Execute Agent 2 (Market Analysis Agent).

    Combines product specs and Agent 1 profile into actionable marketing angles.
    """
    name = product_data.get("name", "Product")
    price = float(product_data.get("price", 0.0))
    category = analysis_data.get("category")
    target_audience = analysis_data.get("target_audience")
    selling_points = analysis_data.get("selling_points") or []
    keywords = analysis_data.get("suggested_keywords") or []

    fallback = _derive_fallback_market_insights(
        name=name,
        price=price,
        category=category,
        target_audience=target_audience,
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
            "You are an e-commerce market analyst (Agent 2).\n"
            "Analyze the product and profile to extract buyer triggers, "
            "competitive edge, and platform strategies (Shopee, TikTok, Lazada).\n\n"
            f"Product: {name}\n"
            f"Price: ${price:.2f}\n"
            f"Category: {category}\n"
            f"Target Audience: {target_audience}\n"
            f"Selling Points: {selling_points}\n"
            f"Keywords: {keywords}\n\n"
            "Return a strict JSON object with these keys:\n"
            "- price_tier: str\n"
            "- buyer_triggers: list[str] (3 key purchase motivators)\n"
            "- competitive_edge: str\n"
            "- platform_strategies: dict (keys: 'shopee', 'tiktok', 'lazada')\n"
            "- summary: str"
        )

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a market strategist returning JSON only.",
                },
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
        )

        content = response.choices[0].message.content or "{}"
        parsed = json.loads(content)

        return {
            "price_tier": parsed.get("price_tier") or fallback["price_tier"],
            "buyer_triggers": (
                parsed.get("buyer_triggers") or fallback["buyer_triggers"]
            ),
            "competitive_edge": (
                parsed.get("competitive_edge") or fallback["competitive_edge"]
            ),
            "platform_strategies": (
                parsed.get("platform_strategies") or fallback["platform_strategies"]
            ),
            "summary": parsed.get("summary") or fallback["summary"],
        }
    except Exception:
        return fallback
