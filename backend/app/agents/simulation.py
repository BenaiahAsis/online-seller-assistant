"""Stand-in AI clients that simulate provider failures for demos and tests.

Enabled only when ALLOW_AI_FAILURE_SIMULATION=true. A request then opts in
with the header ``X-Simulate-AI-Failure: api_error`` or ``bad_output``. The
agents receive one of these clients instead of the real OpenAI client, so the
normal validation, retry and fallback code paths run unchanged.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

SIMULATION_MODES = ("api_error", "bad_output")

# Not valid for any agent's schema, and full of claims the seller never made,
# so the schema gate rejects it on every attempt.
BAD_OUTPUT = (
    '{"note": "Sure! Here is your listing: FDA approved, 100% guaranteed, '
    'best seller, free shipping", "listing": '
)


class _SimulatedCompletions:
    def __init__(self, mode: str):
        self.mode = mode
        self.calls = 0

    def create(self, **kwargs: Any) -> Any:
        self.calls += 1
        if self.mode == "api_error":
            raise ConnectionError(
                "Simulated AI provider outage (X-Simulate-AI-Failure: api_error)"
            )
        message = SimpleNamespace(content=BAD_OUTPUT)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


class SimulatedFailureClient:
    """Duck-types the parts of ``openai.OpenAI`` the agents use."""

    def __init__(self, mode: str):
        if mode not in SIMULATION_MODES:
            raise ValueError(f"Unknown simulation mode: {mode}")
        self.mode = mode
        self.chat = SimpleNamespace(completions=_SimulatedCompletions(mode))
