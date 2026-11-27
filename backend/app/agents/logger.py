"""Structured execution logging for the Multi-Agent pipeline."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from app.config import settings

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
# Validation event rendering
# ---------------------------------------------------------------------------

GATE_LABELS = {
    "schema": "schema gate",
    "claims": "claims gate",
    "grounding": "grounding checks",
}


def render_validation_logs(
    agent_name: str,
    events: list[dict[str, Any]] | None,
    used_fallback: bool,
) -> list[dict[str, Any]]:
    """Turn recorded validation events into log entries.

    These describe what the backend actually did to the model's response.
    Nothing here is inferred from the final result: a retry that succeeded
    still shows the attempt that was rejected and why.
    """
    logs: list[dict[str, Any]] = []
    events = events or []

    if not events:
        logs.append(
            make_log(
                agent_name,
                "VALIDATE_NONE",
                "No validation events recorded for this run",
                level="WARN",
            )
        )
        return logs

    for event in events:
        attempt = event.get("attempt", 0)
        outcome = event.get("outcome")

        if outcome == "skipped":
            logs.append(
                make_log(
                    agent_name,
                    "VALIDATE_SKIP",
                    f"Validation gates not exercised ({event.get('reason', 'n/a')}); "
                    "deterministic fallback used instead",
                    details={"reason": event.get("reason")},
                )
            )
        elif outcome == "accepted":
            logs.append(
                make_log(
                    agent_name,
                    "VALIDATE_PASS",
                    f"Attempt {attempt} accepted: schema, claims and grounding "
                    "checks all passed",
                    level="SUCCESS",
                    details={"attempt": attempt},
                )
            )
        elif outcome == "rejected":
            violations = event.get("violations") or []
            gates = ", ".join(GATE_LABELS.get(g, g) for g in (event.get("gates") or []))
            first = violations[0] if violations else "unspecified violation"
            extra = f" (+{len(violations) - 1} more)" if len(violations) > 1 else ""
            logs.append(
                make_log(
                    agent_name,
                    "VALIDATE_REJECT",
                    f"Attempt {attempt} rejected by {gates or 'validator'}: "
                    f"{first}{extra}",
                    level="WARN",
                    details={"attempt": attempt, "violations": violations},
                )
            )
        elif outcome == "api_error":
            logs.append(
                make_log(
                    agent_name,
                    "API_ERROR",
                    f"Attempt {attempt} failed before validation: "
                    f"{event.get('error', 'unknown error')}",
                    level="ERROR",
                    details={"attempt": attempt},
                )
            )

    rejected = sum(1 for e in events if e.get("outcome") == "rejected")
    if rejected and not used_fallback:
        logs.append(
            make_log(
                agent_name,
                "RETRY_RECOVERED",
                f"Model output corrected after {rejected} rejected "
                f"attempt{'s' if rejected > 1 else ''}; validated output stored",
                level="SUCCESS",
                details={"rejected_attempts": rejected},
            )
        )
    elif used_fallback and rejected:
        logs.append(
            make_log(
                agent_name,
                "FALLBACK_USED",
                f"All {rejected} attempts rejected; deterministic fallback "
                "substituted so no ungrounded claim is stored",
                level="WARN",
                details={"rejected_attempts": rejected},
            )
        )
    elif used_fallback and any(e.get("outcome") == "api_error" for e in events):
        logs.append(
            make_log(
                agent_name,
                "FALLBACK_USED",
                "AI provider unavailable; deterministic fallback substituted so "
                "the pipeline still completes",
                level="WARN",
                details={"reason": "api_error"},
            )
        )

    return logs


# ---------------------------------------------------------------------------
# Agent 1 Log Generator
# ---------------------------------------------------------------------------


# Display names for log messages. .title() would print "Tiktok" (B24).
PLATFORM_LABELS = {"shopee": "Shopee", "tiktok": "TikTok", "lazada": "Lazada"}


def generate_agent_1_logs(
    product_data: dict[str, Any],
    analysis_result: dict[str, Any],
    source: str | None = None,
) -> list[dict[str, Any]]:
    """Produce detailed execution logs for Agent 1 (Product Analysis Agent)."""
    logs: list[dict[str, Any]] = []
    source = source or analysis_result.get("source", "heuristic")
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
            f"Read product details for '{name}' (₱{price:,.2f}, {quantity} in stock)",
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
        f"OpenAI {settings.openai_model}"
        if source == "ai"
        else "Deterministic NLP (Offline Safe)"
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

    # Step 7: Validation gates, as actually executed
    logs.extend(
        render_validation_logs(
            agent_name,
            analysis_result.get("validation_events"),
            used_fallback=source != "ai",
        )
    )

    # Step 8: Completion
    logs.append(
        make_log(
            agent_name,
            "COMPLETE",
            f"Structured product profile created for '{name}' (Engine: {source})",
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
            f"Read the product profile for '{name}' ({points_count} selling points)",
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
                f"{PLATFORM_LABELS.get(plat, plat.title())} strategy: "
                f"focus='{focus}', tone='{tone}'",
                details=strat,
            )
        )

    # Step 6: Validation gates, as actually executed
    logs.extend(
        render_validation_logs(
            agent_name,
            market_result.get("validation_events"),
            used_fallback=source != "ai",
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
            f"Read the product profile and channel strategy for '{name}'",
        )
    )

    # Step 2: Synthesis per channel
    for listing in listings_result:
        key = listing.get("platform", "marketplace")
        plat = PLATFORM_LABELS.get(key, key.title())
        title = listing.get("title", "")
        bullets = listing.get("bullet_points") or []
        tags = listing.get("hashtags") or []
        source = listing.get("source", "ai")

        logs.append(
            make_log(
                agent_name,
                f"GENERATE_{key.upper()}",
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

    # Step 3: Validation gates, as actually executed
    has_fallback = any(item.get("source") != "ai" for item in listings_result)
    events = next(
        (
            item.get("validation_events")
            for item in listings_result
            if item.get("validation_events")
        ),
        None,
    )
    logs.extend(render_validation_logs(agent_name, events, used_fallback=has_fallback))

    # Step 4: Completion. Fallback listings were never checked, so say so (B4).
    if has_fallback:
        summary = "Listings generated for Shopee, TikTok, and Lazada using the template"
    else:
        summary = "Listings generated and verified for Shopee, TikTok, and Lazada"
    logs.append(
        make_log(
            agent_name,
            "COMPLETE",
            summary,
            level="SUCCESS",
        )
    )

    return logs
