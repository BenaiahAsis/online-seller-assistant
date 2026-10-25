"""Shared validation used by Agent 2 and Agent 3."""

from __future__ import annotations

import re
from collections.abc import Callable
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

ModelT = TypeVar("ModelT", bound=BaseModel)

MAX_ATTEMPTS = 2
PLACEHOLDER_KEYS = {"not-set-yet", "mock", "placeholder", "changeme"}


# ===========================================================================
# Claim rules
# ===========================================================================

CLAIM_RULES: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    (
        r"guarantee|warrant(?:y|ies)|refund|replacement|return policy",
        "policy claim",
        ("guarantee", "warrant", "refund", "replacement", "return"),
    ),
    (
        r"authentic|genuine|brand[\s-]*new|100\s*%\s*new",
        "authenticity or condition claim",
        ("authentic", "genuine", "brand new"),
    ),
    (
        r"certified|iso\s*\d+|\bfda\b|ce mark",
        "certification claim",
        ("certif", "iso", "fda", "ce mark"),
    ),
    (
        r"hypoallergenic|non[\s-]*toxic|medical[\s-]*grade|food[\s-]*grade|bpa",
        "health or safety claim",
        ("hypoallergenic", "toxic", "medical", "food grade", "bpa"),
    ),
    (
        r"waterproof|shockproof|scratch[\s-]*proof|heat[\s-]*resistant",
        "durability claim",
        ("waterproof", "shockproof", "scratch", "heat"),
    ),
    (
        r"\bbest\b|#\s*1\b|top[\s-]*rated|award[\s-]*winning|bestsell",
        "superlative or ranking claim",
        ("best", "award", "rated"),
    ),
    (
        r"better than|cheaper than|compared to|unlike other|outperform",
        "comparative claim",
        (),
    ),
    (
        r"free shipping|free delivery|package includes|box contents|limited stock",
        "logistics or stock claim",
        ("free shipping", "free delivery", "package", "includes", "box", "stock"),
    ),
    (
        r"tested before|quality[\s-]*tested|lab[\s-]*tested|inspected",
        "quality assurance claim",
        ("tested", "inspect"),
    ),
)

COMPILED_RULES = tuple((re.compile(p), label, ev) for p, label, ev in CLAIM_RULES)

STRIP_KEYS = frozenset(
    {
        "minLength",
        "maxLength",
        "minItems",
        "maxItems",
        "minimum",
        "maximum",
        "exclusiveMinimum",
        "exclusiveMaximum",
        "pattern",
        "format",
        "default",
        "examples",
    }
)


# ===========================================================================
# Text helpers
# ===========================================================================


def collect_text(payload: Any) -> list[str]:
    if isinstance(payload, str):
        return [payload]
    if isinstance(payload, dict):
        return [t for value in payload.values() for t in collect_text(value)]
    if isinstance(payload, list | tuple):
        return [t for item in payload for t in collect_text(item)]
    return []


def build_corpus(*parts: Any) -> str:
    return " ".join(t for part in parts for t in collect_text(part)).lower()


def words(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", text.lower()) if len(w) >= 4}


def grounded(text: str, sources: list[str]) -> bool:
    found = words(text)
    return bool(found) and any(found & words(source) for source in sources)


# ===========================================================================
# Claims gate
# ===========================================================================


def unsupported_claims(text: str, corpus: str) -> list[str]:
    lowered = text.lower()
    hits = []
    for pattern, label, evidence in COMPILED_RULES:
        match = pattern.search(lowered)
        if match and not any(term in corpus for term in evidence):
            hits.append(f'{label} ("{match.group(0).strip()}")')
    return hits


def scan_claims(payload: Any, corpus: str) -> list[str]:
    found = [c for t in collect_text(payload) for c in unsupported_claims(t, corpus)]
    return sorted(set(found))


# ===========================================================================
# Schema gate
# ===========================================================================


def strict_schema(model: type[BaseModel]) -> dict[str, Any]:
    return _clean(model.model_json_schema())


def _clean(node: Any) -> Any:
    if isinstance(node, dict):
        out = {k: _clean(v) for k, v in node.items() if k not in STRIP_KEYS}
        if out.get("type") == "object":
            out["additionalProperties"] = False
            if out.get("properties"):
                out["required"] = list(out["properties"])
        return out
    if isinstance(node, list):
        return [_clean(item) for item in node]
    return node


# ===========================================================================
# Agent runner
# ===========================================================================


def retry_message(violations: list[str]) -> str:
    listed = "\n".join(f"- {v}" for v in violations)
    return (
        f"The backend validator rejected your response.\n{listed}\n\n"
        "Return corrected JSON only. Never state a fact the seller did not "
        "provide."
    )


def call_agent(
    client: Any,
    model: str,
    system: str,
    prompt: str,
    schema_model: type[ModelT],
    corpus: str,
    temperature: float,
    max_tokens: int,
    checks: Callable[[ModelT], list[str]] | None = None,
) -> tuple[ModelT | None, list[str]]:
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": prompt},
    ]
    schema = strict_schema(schema_model)
    errors: list[str] = []

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": schema_model.__name__,
                        "schema": schema,
                        "strict": True,
                    },
                },
                temperature=temperature,
                max_tokens=max_tokens,
            )
            raw = response.choices[0].message.content or "{}"
        except Exception as exc:
            errors.append(f"attempt {attempt}: API error: {exc}")
            return None, errors

        try:
            result = schema_model.model_validate_json(raw)
        except ValidationError as exc:
            violations = [
                f"{'.'.join(str(p) for p in e['loc']) or 'root'}: {e['msg']}"
                for e in exc.errors()[:6]
            ]
        else:
            violations = scan_claims(result.model_dump(), corpus)
            if checks:
                violations += checks(result)
            if not violations:
                return result, errors

        errors.append(f"attempt {attempt}: {'; '.join(violations)}")
        if attempt < MAX_ATTEMPTS:
            messages.append({"role": "assistant", "content": raw})
            messages.append({"role": "user", "content": retry_message(violations)})

    return None, errors
