"""Agent 1 - Product Analysis Agent. Categorizes and structures product profiles."""

from __future__ import annotations

import os
import re
from typing import Any

from pydantic import BaseModel, Field

from app.agents.validation import (
    PLACEHOLDER_KEYS,
    build_corpus,
    call_agent,
    events_to_reasons,
    grounded,
    skipped_event,
)
from app.config import settings

MATERIAL_TERMS = {
    "aluminum",
    "zinc",
    "iron",
    "steel",
    "glass",
    "plastic",
    "rubber",
    "silicone",
    "copper",
    "cotton",
    "polyester",
    "nylon",
    "wood",
    "metal",
    "alloy",
    "brass",
    "ceramic",
    "leather",
    "titanium",
    "canvas",
    "resin",
    "acrylic",
}

FLUFF_TERMS = {
    "the",
    "and",
    "for",
    "with",
    "this",
    "that",
    "from",
    "have",
    "item",
    "items",
    "bought",
    "most",
    "best",
    "free",
    "deal",
    "pack",
    "cheap",
    "sale",
    "good",
    "only",
}


def infer_category_and_audience(name: str, corpus: str) -> tuple[str, str]:
    """Infer an exact, specific e-commerce category and target audience."""
    text = f"{name} {corpus}".lower()

    # 1. Wearables & Smartwatches
    if re.search(
        r"\b(?:smartwatch|smart\s*watch|fitness\s*tracker|smart\s*band|"
        r"wrist\s*watch|digital\s*watch|wearable)\b",
        text,
    ):
        return (
            "Wearables & Smartwatches",
            (
                "Budget-conscious students, tech enthusiasts, and active "
                "individuals looking for a stylish everyday smartwatch"
            ),
        )

    # 2. Audio & Headphones
    if re.search(
        r"\b(?:earbud|earbuds|earphone|earphones|headphone|headphones|"
        r"headset|audio|speaker|bluetooth\s*speaker)\b",
        text,
    ):
        return (
            "Audio & Headphones",
            (
                "Music lovers, daily commuters, and remote workers looking "
                "for clear sound and audio convenience"
            ),
        )

    # 3. Computers & Peripherals
    if re.search(
        r"\b(?:keyboard|keyboards|mouse|laptop|laptops|monitor|webcam|"
        r"desktop|pc\s*accessory|trackpad)\b",
        text,
    ):
        return (
            "Computers & Peripherals",
            (
                "Remote professionals, programmers, and students seeking an "
                "efficient, ergonomic desk workspace"
            ),
        )

    # 4. Mobile & Gadget Accessories
    if re.search(
        r"\b(?:phone|charger|power\s*bank|cable|usb|adapter|phone\s*case|"
        r"screen\s*protector|stylus)\b",
        text,
    ):
        return (
            "Mobile & Gadget Accessories",
            (
                "On-the-go mobile users looking for dependable, fast-charging "
                "daily device accessories"
            ),
        )

    # 5. Home & Living
    if re.search(
        r"\b(?:tumbler|tumblers|mug|cup|thermal\s*bottle|water\s*bottle|"
        r"cushion|cushions|pillow|kitchen|lamp|desk|towel|candle|"
        r"furniture|organizer)\b",
        text,
    ):
        return (
            "Home & Living",
            (
                "Homemakers, desk workers, and lifestyle enthusiasts looking "
                "for functional and comfortable essentials"
            ),
        )

    # 6. Fashion & Apparel
    if re.search(
        r"\b(?:shirt|shirts|hoodie|hoodies|dress|dresses|pant|pants|"
        r"jacket|bag|wallet|shoes|cardholder|apparel|clothing)\b",
        text,
    ):
        return (
            "Fashion & Apparel",
            (
                "Style-conscious shoppers seeking comfortable, fashionable, "
                "and versatile everyday clothing"
            ),
        )

    # 7. Beauty & Personal Care
    if re.search(
        r"\b(?:skincare|serum|lotion|soap|cream|cosmetic|perfume|"
        r"fragrance|makeup|shampoo|cleanser)\b",
        text,
    ):
        return (
            "Beauty & Personal Care",
            (
                "Self-care enthusiasts and daily grooming consumers looking "
                "for gentle, effective beauty solutions"
            ),
        )

    # 8. Sports & Fitness
    if re.search(
        r"\b(?:gym|fitness|yoga|cycling|run|running|sport|sports|"
        r"workout|dumbbell|resistance\s*band)\b",
        text,
    ):
        return (
            "Sports & Fitness",
            (
                "Active individuals, gym-goers, and fitness enthusiasts "
                "pursuing health and wellness goals"
            ),
        )

    # Fallback only for genuinely ambiguous names
    return (
        "General Merchandise",
        (
            "Value-conscious consumers seeking dependable, cost-effective "
            "lifestyle products"
        ),
    )


def derive_search_keywords(
    name: str, category: str, features: str | None = None
) -> list[str]:
    """Generate high-intent buyer search terms without materials or fluff."""
    name_lower = name.lower()

    # Pre-crafted high-intent search terms for common gadget/product types
    if "smartwatch" in name_lower or "smart watch" in name_lower:
        return [
            "smartwatch",
            "smartwatch for android",
            "affordable smartwatch",
            "smartwatch philippines",
            "bluetooth smartwatch",
            "digital watch with strap",
        ]

    if "keyboard" in name_lower:
        return [
            "wireless keyboard",
            "bluetooth keyboard",
            "ergonomic keyboard",
            "bamboo keyboard",
            "rechargeable keyboard",
            "office keyboard",
        ]

    if "tumbler" in name_lower:
        return [
            "insulated tumbler",
            "thermal water bottle",
            "smart tumbler",
            "temperature display tumbler",
            "stainless tumbler",
            "travel tumbler",
        ]

    if "cushion" in name_lower:
        return [
            "lumbar support cushion",
            "memory foam cushion",
            "orthopedic back pillow",
            "chair support cushion",
            "office chair cushion",
            "car seat cushion",
        ]

    # General algorithmic extraction: remove materials and fluff
    raw_words = re.findall(r"\b[a-zA-Z]{3,}\b", f"{name} {features or ''}".lower())
    valid_words = [
        w for w in raw_words if w not in MATERIAL_TERMS and w not in FLUFF_TERMS
    ]
    unique_words = list(dict.fromkeys(valid_words))

    keywords: list[str] = []
    if unique_words:
        keywords.append(" ".join(unique_words[:2]))
        keywords.append(f"{unique_words[0]} philippines")
        keywords.append(f"affordable {unique_words[0]}")
        for w in unique_words[:3]:
            if w not in keywords:
                keywords.append(w)
    else:
        keywords = [name_lower, f"{name_lower} online", "affordable finds"]

    return keywords[:6]


def detect_unverified_claims(features: str | None) -> list[dict[str, str]]:
    """Flag unverified superlatives, certifications, or ranking claims."""
    if not features:
        return []

    flags: list[dict[str, str]] = []
    features_lower = features.lower()

    if re.search(r"\b(?:most\s*bought|most\s*popular|best\s*seller)\b", features_lower):
        flags.append(
            {
                "claim": "Most bought item",
                "reason": "Unverified claim, confirm before publishing",
                "softened": "Popular choice among buyers",
            }
        )
    if re.search(r"\b(?:#\s*1|top[\s-]*rated|award[\s-]*winning)\b", features_lower):
        flags.append(
            {
                "claim": "Superlative ranking",
                "reason": "Unverified superlative claim; soften to customer favorite",
                "softened": "Highly rated by everyday users",
            }
        )
    cert_match = re.search(
        r"\b(fda[\s-]*approved|fda|ce[\s-]*mark|iso\s*\d+)\b", features_lower
    )
    if cert_match:
        matched_str = cert_match.group(0).strip()
        flags.append(
            {
                "claim": f"{matched_str.upper()} claim",
                "reason": (
                    "Unverified certification requires seller authorization proof"
                ),
                "softened": "Quality-crafted design",
            }
        )

    return flags


def check_thin_input(
    name: str,
    materials: str | None,
    features: str | None,
    category: str,
) -> list[str]:
    """Return suggested questions if seller input has fewer than ~3 facts."""
    raw_facts = [
        f.strip() for f in re.split(r"[,;.\n]+", features or "") if len(f.strip()) > 3
    ]
    has_materials = bool(materials and len(materials.strip()) > 2)
    facts_count = len(raw_facts) + (1 if has_materials else 0)

    # If 3 or more substantial facts, input is sufficient
    if facts_count >= 3:
        return []

    # Provide targeted questions to help the seller expand their listing
    if "Wearables" in category:
        return [
            "Does it support Bluetooth calling or phone notifications?",
            "Does it track daily steps, heart rate, or sleep?",
            "What is the expected battery life on a single charge?",
            "Is it water-resistant for workouts or daily rain?",
        ]
    if "Audio" in category:
        return [
            "What is the total battery playtime with the charging case?",
            "Does it feature active noise cancellation (ANC) or touch controls?",
            "What is the Bluetooth version and wireless range?",
        ]
    if "Computers" in category or "Mobile" in category:
        return [
            "What operating systems and devices is it compatible with?",
            "What connectivity does it use (Bluetooth, 2.4GHz wireless, USB-C)?",
            "What are the physical dimensions and weight?",
        ]
    return [
        "What are the exact dimensions, weight, or capacity?",
        "What color or style variations are available?",
        "What items are included inside the package?",
    ]


def check_price_sanity(price: float, name: str, category: str) -> str | None:
    """Warn sellers if pricing is implausibly low for the detected product type."""
    name_lower = name.lower()

    if ("smartwatch" in name_lower or "watch" in name_lower) and price < 100.0:
        return (
            f"Price notice: ₱{price:,.2f} is unusually low for a smartwatch "
            "(typical Philippine baseline is ₱350 - ₱3,500). Please verify your price."
        )
    if "laptop" in name_lower and price < 1500.0:
        return f"Price notice: ₱{price:,.2f} is unusually low for a laptop."
    if "phone" in name_lower and price < 800.0:
        return f"Price notice: ₱{price:,.2f} is unusually low for a smartphone."

    return None


def _derive_fallback_profile(
    name: str,
    price: float,
    quantity: int,
    materials: str | None,
    features: str | None,
) -> dict[str, Any]:
    """Generate an accurate, structured profile without requiring an external API."""
    text_corpus = f"{name} {materials or ''} {features or ''}".lower()
    category, audience = infer_category_and_audience(name, text_corpus)
    keywords = derive_search_keywords(name, category, features)
    unverified_claims = detect_unverified_claims(features)
    suggested_questions = check_thin_input(name, materials, features, category)
    price_warning = check_price_sanity(price, name, category)

    # Extract distinct selling points from features or name
    raw_points = [
        p.strip() for p in re.split(r"[,;.\n]+", features or "") if len(p.strip()) > 3
    ]

    # Clean and soften any unverified claims in selling points
    selling_points: list[str] = []
    for pt in raw_points:
        pt_lower = pt.lower()
        if "most bought" in pt_lower or "best seller" in pt_lower:
            selling_points.append("Popular choice among buyers for everyday style")
        elif "free strap" in pt_lower:
            selling_points.append("Includes complementary replacement strap")
        else:
            selling_points.append(pt)

    if not selling_points:
        selling_points = [
            f"Durable construction featuring {materials or 'quality components'}",
            f"Accessible everyday value at ₱{price:,.2f}",
            "Ready-to-ship inventory backed by prompt seller dispatch",
        ]

    raw_summary = (
        f"{name} is positioned under {category}, tailored for "
        f"{audience.lower()} with key focus on "
        f"{materials or 'practical daily utility'}."
    )

    market_insights = {
        "price_warning": price_warning,
        "suggested_questions": suggested_questions,
        "unverified_claims": unverified_claims,
    }

    return {
        "category": category,
        "target_audience": audience,
        "key_specifications": {
            "listed_price": f"₱{price:,.2f}",
            "available_stock": f"{quantity} units",
            "material_composition": materials or "Standard manufactured grade",
        },
        "selling_points": selling_points[:5],
        "suggested_keywords": keywords,
        "raw_summary": raw_summary,
        "market_insights": market_insights,
    }


# ===========================================================================
# Output contract and validation (AI path)
# ===========================================================================


class ProductProfile(BaseModel):
    category: str = Field(min_length=3, max_length=120)
    target_audience: str = Field(min_length=5, max_length=255)
    selling_points: list[str] = Field(min_length=1, max_length=5)
    suggested_keywords: list[str] = Field(min_length=1, max_length=8)
    raw_summary: str = Field(min_length=20, max_length=600)


SYSTEM = (
    "You are Agent 1, the Product Analysis Agent in an e-commerce assistant for "
    "Southeast Asian marketplaces (Shopee, TikTok Shop, Lazada). Organize the "
    "seller's raw details into a structured profile. Use only facts the seller "
    "gave you; never add specifications, certifications, guarantees or claims. "
    "Return JSON only."
)

CURRENCY = "₱"
BANNED_KEYWORD_TERMS = MATERIAL_TERMS | FLUFF_TERMS


def _make_checks(sources: list[str]):
    def checks(profile: ProductProfile) -> list[str]:
        problems = []
        for i, point in enumerate(profile.selling_points):
            if not grounded(point, sources):
                problems.append(
                    f"selling_points.{i} '{point[:60]}' is not grounded in the "
                    "seller's details"
                )
        for i, keyword in enumerate(profile.suggested_keywords):
            kw = keyword.strip().lower().lstrip("#")
            if kw in BANNED_KEYWORD_TERMS:
                problems.append(
                    f"suggested_keywords.{i} '{keyword}' is a raw material or "
                    "filler word, not a search term"
                )
            elif not grounded(kw, sources, allow_general_terms=False):
                problems.append(
                    f"suggested_keywords.{i} '{keyword}' shares no word with "
                    "the product name, materials or notes"
                )
        return problems

    return checks


def _client() -> Any | None:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key or key in PLACEHOLDER_KEYS:
        return None
    from openai import OpenAI

    base_url = settings.openai_base_url.strip() or None
    return OpenAI(api_key=key, base_url=base_url)


# ===========================================================================
# Entry point
# ===========================================================================


def run_product_analysis_agent(
    product_data: dict[str, Any],
    client: Any | None = None,
) -> dict[str, Any]:
    """Execute Agent 1: structure raw seller input into a product profile.

    The deterministic profile is always computed. When an AI client is
    available, the model's profile must pass the shared schema, claims and
    grounding gates (with one retry) before it replaces the deterministic one.
    """
    name = product_data.get("name", "").strip()
    price = float(product_data.get("price", 0.0))
    quantity = int(product_data.get("quantity", 1))
    materials = product_data.get("materials")
    features = product_data.get("features")

    fallback = _derive_fallback_profile(name, price, quantity, materials, features)
    fallback["source"] = "heuristic"

    client = client or _client()
    if client is None:
        fallback["fallback_reason"] = ["no OPENAI_API_KEY configured"]
        fallback["validation_events"] = skipped_event("no OPENAI_API_KEY configured")
        return fallback

    sources = [name, str(materials or ""), str(features or "")]
    corpus = build_corpus(name, materials, features)
    prompt = (
        "Analyze these seller details:\n"
        f"- Name: {name}\n"
        f"- Price: {CURRENCY}{price:,.2f}\n"
        f"- Quantity: {quantity}\n"
        f"- Materials: {materials or 'N/A'}\n"
        f"- Features / notes: {features or 'N/A'}\n\n"
        "RULES:\n"
        "1. category: a specific retail category (e.g. 'Wearables & Smartwatches', "
        "'Home & Living', 'Audio & Headphones'). Avoid 'General Merchandise' when "
        "the product type is identifiable.\n"
        "2. target_audience: specific to this product type.\n"
        "3. selling_points: 1 to 5 points, each restating something the seller "
        "actually listed. Soften unverified superlatives such as 'Most bought item' "
        "to 'Popular choice among buyers'.\n"
        "4. suggested_keywords: 1 to 8 search terms buyers type, each containing a "
        "word from the product name, materials or notes. Never a standalone raw "
        "material (zinc, iron, aluminum, glass) or filler word ('free', 'best').\n"
        "5. raw_summary: one or two sentences using only the details above."
    )

    profile, events = call_agent(
        client=client,
        model=settings.openai_model,
        system=SYSTEM,
        prompt=prompt,
        schema_model=ProductProfile,
        corpus=corpus,
        temperature=0.2,
        max_tokens=700,
        checks=_make_checks(sources),
    )

    if profile is None:
        fallback["fallback_reason"] = events_to_reasons(events)
        fallback["validation_events"] = events
        return fallback

    return {
        "category": profile.category,
        "target_audience": profile.target_audience,
        "key_specifications": fallback["key_specifications"],
        "selling_points": profile.selling_points,
        "suggested_keywords": profile.suggested_keywords,
        "raw_summary": profile.raw_summary,
        "market_insights": fallback.get("market_insights"),
        "source": "ai",
        "validation_events": events,
    }
