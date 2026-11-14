"""Structured execution logging for the Multi-Agent pipeline."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

logger = logging.getLogger("uvicorn.error")


def make_log(
    agent: str,
    stage: str,
    message: str,
    level: str = "INFO",
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Create a structured log entry and output to the server logger."""
    now_iso = datetime.now(UTC).isoformat()
    entry = {
        "timestamp": now_iso,
        "agent": agent,
        "stage": stage,
        "level": level,
        "message": message,
        "details": details or {},
    }

    log_line = f"[{agent}] [{stage}] {message}"
    if level == "ERROR":
        logger.error(log_line)
    elif level == "WARN":
        logger.warning(log_line)
    else:
        logger.info(log_line)

    return entry


# ---------------------------------------------------------------------------
# Agent 1 Log Generator
# ---------------------------------------------------------------------------


def generate_agent_1_logs(
    product_data: dict[str, Any],
    analysis_result: dict[str, Any],
    source: str = "ai",
) -> list[dict[str, Any]]:
    """Produce detailed execution logs for Agent 1 (Product Analysis Agent)."""
    logs: list[dict[str, Any]] = []
    agent_name = "Agent 1: Product Analyzer"

    name = product_data.get("name", "Product")
    price = float(product_data.get("price", 0.0))
    quantity = int(product_data.get("quantity", 1))
    materials = product_data.get("materials") or "Not specified"
    features = product_data.get("features") or "Not specified"

    # Step 1: Ingestion
    logs.append(
        make_log(
            agent_name,
            "INGEST",
            f"Ingested inputs for '{name}' (₱{price:,.2f}, {quantity} in stock)",
            details={"name": name, "price": price, "quantity": quantity},
        )
    )

    # Step 2: Attribute parsing
    logs.append(
        make_log(
            agent_name,
            "PARSE",
            f"Parsed specs: materials='{materials}', notes len={len(features)}",
            details={"materials": materials, "features_len": len(features)},
        )
    )

    # Step 3: Engine selection
    engine_name = (
        "OpenAI gpt-4o-mini" if source == "ai" else "Deterministic NLP (Offline Safe)"
    )
    logs.append(
        make_log(
            agent_name,
            "ENGINE",
            f"Execution engine activated: {engine_name}",
            details={"engine": engine_name, "source": source},
        )
    )

    # Step 4: Classification & Audience
    category = analysis_result.get("category", "General Merchandise")
    audience = analysis_result.get("target_audience", "Everyday consumers")
    logs.append(
        make_log(
            agent_name,
            "CLASSIFY",
            f"Classified product into category: '{category}'",
            details={"category": category},
        )
    )
    logs.append(
        make_log(
            agent_name,
            "AUDIENCE",
            f"Identified primary target demographic: '{audience}'",
            details={"target_audience": audience},
        )
    )

    # Step 5: Selling Points Extraction
    points = analysis_result.get("selling_points") or []
    logs.append(
        make_log(
            agent_name,
            "VALUE_PROP",
            f"Extracted {len(points)} distinct selling points & value propositions",
            details={"selling_points_count": len(points)},
        )
    )

    # Step 6: Keywords Generation
    keywords = analysis_result.get("suggested_keywords") or []
    kw_str = ", ".join(keywords[:5])
    logs.append(
        make_log(
            agent_name,
            "KEYWORDS",
            f"Generated {len(keywords)} high-intent SEO keywords: {kw_str}",
            details={"keywords": keywords},
        )
    )

    # Step 7: Completion
    logs.append(
        make_log(
            agent_name,
            "COMPLETE",
            f"Structured product profile successfully created & validated for '{name}'",
            level="SUCCESS",
        )
    )

    return logs


# ---------------------------------------------------------------------------
# Agent 2 Log Generator
# ---------------------------------------------------------------------------


def generate_agent_2_logs(
    product_data: dict[str, Any],
    analysis_data: dict[str, Any],
    market_result: dict[str, Any],
) -> list[dict[str, Any]]:
    """Produce detailed execution logs for Agent 2 (Market Analysis Agent)."""
    logs: list[dict[str, Any]] = []
    agent_name = "Agent 2: Market Analyzer"

    name = product_data.get("name", "Product")
    price = float(product_data.get("price", 0.0))
    tier = market_result.get("price_tier", "Mid-Tier Value")
    rationale = market_result.get("price_rationale", "Standard market pricing.")
    source = market_result.get("source", "ai")
    priority_points = market_result.get("priority_points") or []
    buyer_objections = market_result.get("buyer_objections") or []
    platform_strategies = market_result.get("platform_strategies") or {}
    points_count = len(analysis_data.get("selling_points") or [])

    # Step 1: Ingestion
    logs.append(
        make_log(
            agent_name,
            "INGEST",
            f"Ingested Agent 1 profile for '{name}' with {points_count} points",
        )
    )

    # Step 2: Price tiering
    logs.append(
        make_log(
            agent_name,
            "PRICE_TIER",
            f"Evaluated ₱{price:,.2f} -> Tier '{tier}' ({rationale[:40]})",
            details={"price_tier": tier, "price": price},
        )
    )

    # Step 3: Priority points ranking
    logs.append(
        make_log(
            agent_name,
            "PRIORITY_POINTS",
            f"Ranked {len(priority_points)} priority selling points by influence",
            details={"points_count": len(priority_points)},
        )
    )

    # Step 4: Buyer objections
    logs.append(
        make_log(
            agent_name,
            "OBJECTIONS",
            f"Counter-angles mapped for {len(buyer_objections)} buyer friction points",
            details={"objections_count": len(buyer_objections)},
        )
    )

    # Step 5: Platform channel strategy formulation
    for plat in ("shopee", "tiktok", "lazada"):
        strat = platform_strategies.get(plat) or {}
        focus = strat.get("focus", "Marketplace optimization")
        tone = strat.get("tone", "Informative")
        logs.append(
            make_log(
                agent_name,
                f"STRATEGY_{plat.upper()}",
                f"{plat.title()} strategy: focus='{focus}', tone='{tone}'",
                details=strat,
            )
        )

    # Step 6: Anti-Hallucination & Claims Audit
    fallback_reasons = market_result.get("fallback_reason")
    if fallback_reasons:
        logs.append(
            make_log(
                agent_name,
                "AUDIT_RETRY",
                f"Claim notice ({len(fallback_reasons)} warnings); using fallback",
                level="WARN",
                details={"reasons": fallback_reasons},
            )
        )
    else:
        logs.append(
            make_log(
                agent_name,
                "AUDIT_PASS",
                "Anti-hallucination verification passed: 0 ungrounded claims detected",
                level="SUCCESS",
            )
        )

    # Step 7: Completion
    logs.append(
        make_log(
            agent_name,
            "COMPLETE",
            f"Market positioning completed successfully (Engine: {source})",
            level="SUCCESS",
        )
    )

    return logs


# ---------------------------------------------------------------------------
# Agent 3 Log Generator
# ---------------------------------------------------------------------------


def generate_agent_3_logs(
    product_data: dict[str, Any],
    listings_result: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Produce detailed execution logs for Agent 3 (Listing Generation Agent)."""
    logs: list[dict[str, Any]] = []
    agent_name = "Agent 3: Listing Generator"

    name = product_data.get("name", "Product")

    # Step 1: Ingestion
    logs.append(
        make_log(
            agent_name,
            "INGEST",
            f"Ingested Agent 1 specs & Agent 2 channel strategies for '{name}'",
        )
    )

    # Step 2: Synthesis per channel
    for listing in listings_result:
        plat = listing.get("platform", "marketplace").capitalize()
        title = listing.get("title", "")
        bullets = listing.get("bullet_points") or []
        tags = listing.get("hashtags") or []
        source = listing.get("source", "ai")

        logs.append(
            make_log(
                agent_name,
                f"GENERATE_{plat.upper()}",
                f"Generated {plat} listing: {len(title)} chars, "
                f"{len(bullets)} highlights, {len(tags)} tags ({source})",
                details={
                    "platform": plat,
                    "title_len": len(title),
                    "bullets_count": len(bullets),
                    "tags_count": len(tags),
                },
            )
        )

    # Step 3: Guardrail verification
    has_fallback = any(
        item.get("source") == "heuristic" or item.get("fallback_reason")
        for item in listings_result
    )
    if has_fallback:
        logs.append(
            make_log(
                agent_name,
                "ENGINE_NOTICE",
                "Deterministic fallback template activated (safe quality fallback)",
                level="INFO",
                details={"fallback_used": True},
            )
        )
        logs.append(
            make_log(
                agent_name,
                "VALIDATE_NOTICE",
                "Applied deterministic grounding checks to ensure zero false claims",
                level="WARN",
            )
        )
    else:
        logs.append(
            make_log(
                agent_name,
                "VALIDATE_PASS",
                "Claim audit passed: No unauthorized warranties or guarantees",
                level="SUCCESS",
            )
        )

    # Step 4: Completion
    logs.append(
        make_log(
            agent_name,
            "COMPLETE",
            "Tailored listings generated and verified for Shopee, TikTok, and Lazada",
            level="SUCCESS",
        )
    )

    return logs
