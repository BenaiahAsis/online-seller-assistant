"""Evaluate the three-agent pipeline against a fixed set of products.

Runs every case in eval_set.json through a deployed backend's full pipeline,
then scores the stored result with acceptance checks that do not depend on
exact wording (the model is non-deterministic):

  1. three_listings  - exactly one listing each for shopee, tiktok and lazada
  2. no_new_claims   - no claim in the final listings that the seller did not
                       support (same claim rules the backend uses)
  3. clean_hashtags  - no hashtag is a bare raw material or filler word
  4. grounded_title  - every title reuses a word from the product name

It also records how each agent's AI output went through validation:
accepted first try, recovered after a retry, or fell back to the rule-based
output. Products created by the run are deleted afterwards.

Usage (from backend/):
    python -m evals.run_eval                       # production
    python -m evals.run_eval --base-url http://localhost:8000
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

import httpx

from app.agents.validation import build_corpus, scan_claims, words

DEFAULT_BASE_URL = "https://online-seller-assistant-backend.onrender.com"
HERE = Path(__file__).resolve().parent
PLATFORMS = {"shopee", "tiktok", "lazada"}
BANNED_TAGS = {"zinc", "iron", "aluminum", "glass", "steel", "plastic", "free", "best"}
AGENTS = ("Agent 1", "Agent 2", "Agent 3")
# Full-pipeline is rate limited (5/minute per IP by default).
PAUSE_SECONDS = 13


def agent_outcome(logs: list[dict], agent: str) -> str:
    stages = {log["stage"] for log in logs if log.get("agent", "").startswith(agent)}
    if "FALLBACK_USED" in stages or "VALIDATE_SKIP" in stages:
        return "fallback"
    if "RETRY_RECOVERED" in stages:
        return "recovered"
    if "VALIDATE_PASS" in stages:
        return "first_try"
    return "unknown"


def score(case: dict, body: dict) -> dict:
    product = case["product"]
    listings = body["product"]["listings"]
    corpus = build_corpus(
        product["name"], product.get("materials"), product.get("features")
    )
    name_words = words(product["name"])

    claims = sorted({c for item in listings for c in scan_claims(item, corpus)})
    bad_tags = sorted(
        {
            tag
            for item in listings
            for tag in item.get("hashtags") or []
            if tag.lower().lstrip("#") in BANNED_TAGS
        }
    )
    ungrounded_titles = [
        item["platform"]
        for item in listings
        if not (words(item.get("title", "")) & name_words)
    ]
    checks = {
        "three_listings": {item["platform"] for item in listings} == PLATFORMS
        and len(listings) == 3,
        "no_new_claims": not claims,
        "clean_hashtags": not bad_tags,
        "grounded_title": not ungrounded_titles,
    }
    return {
        "id": case["id"],
        "checks": checks,
        "passed": all(checks.values()),
        "details": {
            "claims": claims,
            "bad_tags": bad_tags,
            "ungrounded_titles": ungrounded_titles,
        },
        "agents": {a: agent_outcome(body.get("logs", []), a) for a in AGENTS},
    }


def run(base_url: str, cases: list[dict], pause: float) -> list[dict]:
    results = []
    with httpx.Client(base_url=base_url, timeout=240) as client:
        client.get("/health")  # wake a sleeping free-tier instance
        for i, case in enumerate(cases, start=1):
            payload = dict(case["product"])
            payload["name"] = f"EVAL - {payload['name']}"
            created = client.post("/api/products", json=payload)
            created.raise_for_status()
            pid = created.json()["id"]
            try:
                res = client.post(f"/api/products/{pid}/full-pipeline")
                if res.status_code != 200:
                    results.append(
                        {"id": case["id"], "passed": False, "error": res.status_code}
                    )
                else:
                    results.append(score(case, res.json()))
            finally:
                client.delete(f"/api/products/{pid}")
            print(
                f"[{i}/{len(cases)}] {case['id']}: "
                f"{'PASS' if results[-1].get('passed') else 'FAIL'}",
                flush=True,
            )
            if i < len(cases):
                time.sleep(pause)
    return results


def summarize(results: list[dict], base_url: str) -> str:
    n = len(results)
    ok = [r for r in results if "checks" in r]
    lines = [
        f"# AI evaluation run — {datetime.now(UTC):%Y-%m-%d %H:%M} UTC",
        "",
        f"Target: `{base_url}`  ·  Cases: {n}  ·  "
        f"Passed all checks: **{sum(r['passed'] for r in results)}/{n}**",
        "",
        "## Acceptance checks",
        "",
        "| Check | Passed |",
        "|---|---|",
    ]
    checks = ("three_listings", "no_new_claims", "clean_hashtags", "grounded_title")
    for check in checks:
        lines.append(f"| {check} | {sum(r['checks'][check] for r in ok)}/{n} |")
    lines += [
        "",
        "## Validation path per agent",
        "",
        "| Agent | Accepted first try | Recovered after retry | Fell back |",
        "|---|---|---|---|",
    ]
    for agent in AGENTS:
        outcomes = [r["agents"][agent] for r in ok]
        lines.append(
            f"| {agent} | {outcomes.count('first_try')} | "
            f"{outcomes.count('recovered')} | {outcomes.count('fallback')} |"
        )
    lines += [
        "",
        "## Per case",
        "",
        "| Case | Result | Agents 1/2/3 | Notes |",
        "|---|---|---|---|",
    ]
    for r in results:
        if "checks" not in r:
            lines.append(f"| {r['id']} | ERROR | - | HTTP {r.get('error')} |")
            continue
        notes = "; ".join(f"{k}: {v}" for k, v in r["details"].items() if v) or "-"
        agents = " / ".join(r["agents"][a] for a in AGENTS)
        verdict = "PASS" if r["passed"] else "FAIL"
        lines.append(f"| {r['id']} | {verdict} | {agents} | {notes} |")
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--limit", type=int, default=None, help="run only N cases")
    parser.add_argument(
        "--pause",
        type=float,
        default=PAUSE_SECONDS,
        help="seconds between cases (production is rate limited)",
    )
    args = parser.parse_args()

    cases = json.loads((HERE / "eval_set.json").read_text(encoding="utf-8"))
    if args.limit:
        cases = cases[: args.limit]

    results = run(args.base_url.rstrip("/"), cases, args.pause)
    report = summarize(results, args.base_url)

    out_dir = HERE / "results"
    out_dir.mkdir(exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%d-%H%M")
    (out_dir / f"{stamp}.md").write_text(report, encoding="utf-8")
    raw = json.dumps(results, indent=2)
    (out_dir / f"{stamp}.json").write_text(raw, encoding="utf-8")
    print(report)
    return 0 if all(r.get("passed") for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())
