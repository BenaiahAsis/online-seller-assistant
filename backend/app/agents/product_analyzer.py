import json
import os
import re
from typing import Any


def _derive_fallback_profile(
    name: str,
    price: float,
    quantity: int,
    materials: str | None,
    features: str | None,
) -> dict[str, Any]:
    """Generate a clean structured profile without requiring an external API."""
    text_corpus = f"{name} {materials or ''} {features or ''}".lower()

    clothing_terms = [
        "shirt",
        "pant",
        "hoodie",
        "dress",
        "cotton",
        "wear",
        "leather",
        "bag",
    ]
    tech_terms = [
        "phone",
        "usb",
        "charge",
        "laptop",
        "cable",
        "tech",
        "wireless",
        "earbud",
        "bluetooth",
        "audio",
        "headphone",
        "keyboard",
    ]
    home_terms = [
        "kitchen",
        "coffee",
        "cup",
        "home",
        "wood",
        "table",
        "lamp",
        "desk",
    ]
    sports_terms = ["gym", "fit", "run", "sport", "yoga", "ball"]

    if any(k in text_corpus for k in clothing_terms):
        category = "Apparel & Accessories"
        audience = "Everyday shoppers seeking stylish and comfortable items"
    elif any(k in text_corpus for k in tech_terms):
        category = "Electronics & Gadgets"
        audience = "Tech-savvy individuals, students, and digital professionals"
    elif any(k in text_corpus for k in home_terms):
        category = "Home & Kitchen"
        audience = "Homeowners, renters, and lifestyle enthusiasts looking for utility"
    elif any(k in text_corpus for k in sports_terms):
        category = "Sports & Fitness"
        audience = "Active individuals, athletes, and fitness enthusiasts"
    else:
        category = "General Merchandise"
        audience = "Value-conscious consumers seeking dependable quality products"

    # Extract distinct selling points from features or name
    raw_points = [
        p.strip() for p in re.split(r"[,;.\n]+", features or "") if len(p.strip()) > 3
    ]
    if not raw_points:
        raw_points = [
            f"High-quality construction with {materials or 'premium components'}",
            f"Daily reliability at an accessible ${price:.2f} price point",
            "Backed by seller satisfaction and ready-to-ship inventory",
        ]

    # Generate search keywords
    stopwords = {"the", "and", "for", "with", "this", "that"}
    words = [
        w for w in re.findall(r"\b[a-zA-Z]{3,}\b", text_corpus) if w not in stopwords
    ]
    keywords = list(dict.fromkeys(words[:6]))
    if not keywords:
        keywords = ["quality", "premium", "durable", "affordable"]

    return {
        "category": category,
        "target_audience": audience,
        "key_specifications": {
            "listed_price": f"${price:.2f}",
            "available_stock": f"{quantity} units",
            "material_composition": materials or "Standard manufactured grade",
        },
        "selling_points": raw_points[:5],
        "suggested_keywords": keywords,
        "raw_summary": (
            f"{name} is positioned under {category}, tailored for "
            f"{audience.lower()} with key focus on {materials or 'durability'}."
        ),
    }


def run_product_analysis_agent(product_data: dict[str, Any]) -> dict[str, Any]:
    """Execute Agent 1: Product Analysis Agent to organize raw product inputs."""
    name = product_data.get("name", "").strip()
    price = float(product_data.get("price", 0.0))
    quantity = int(product_data.get("quantity", 1))
    materials = product_data.get("materials")
    features = product_data.get("features")

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    fallback = _derive_fallback_profile(name, price, quantity, materials, features)
    if not api_key or api_key in {"not-set-yet", "mock", "placeholder"}:
        return fallback

    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        prompt = (
            "You are the Product Analysis Agent in an e-commerce assistant.\n"
            "Analyze seller details and output a valid JSON object:\n"
            f"- Name: {name}\n"
            f"- Price: ${price:.2f}\n"
            f"- Quantity: {quantity}\n"
            f"- Materials: {materials or 'N/A'}\n"
            f"- Features: {features or 'N/A'}\n\n"
            "Output JSON with keys: category, target_audience, "
            "key_specifications, selling_points, suggested_keywords, raw_summary"
        )

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a product analyst. Output raw JSON.",
                },
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=600,
        )

        content = response.choices[0].message.content or "{}"
        parsed = json.loads(content)
        return {
            "category": parsed.get("category") or fallback["category"],
            "target_audience": (
                parsed.get("target_audience") or fallback["target_audience"]
            ),
            "key_specifications": (
                parsed.get("key_specifications") or fallback["key_specifications"]
            ),
            "selling_points": (
                parsed.get("selling_points") or fallback["selling_points"]
            ),
            "suggested_keywords": (
                parsed.get("suggested_keywords") or fallback["suggested_keywords"]
            ),
            "raw_summary": (parsed.get("raw_summary") or fallback["raw_summary"]),
        }
    except Exception:
        return fallback
