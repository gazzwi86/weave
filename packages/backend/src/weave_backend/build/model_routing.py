"""AC-6: PDAC role -> model routing (BE-TASK-006, build-engine EPIC-011).

Layers on `ai/router.py`'s tier -> model table (`ai/config.py`) rather than
redefining model IDs -- `ALLOWED_MODELS` is derived from the same
`MODEL_ROUTING_TABLE`, so a model id can never be "confirmed" in one place
and "allowed" in another.
"""

from __future__ import annotations

from weave_backend.ai.config import MODEL_ROUTING_TABLE

#: PLAN is judgement-heavy/low-volume (fable); DELEGATE/ASSESS/CODIFY are
#: generation/volume work (sonnet) -- CLAUDE.md Stack section, mirrored
#: from the task brief's `MODEL_ROUTING` table.
ROLE_TIER: dict[str, str] = {
    "plan": "fable",
    "delegate": "sonnet",
    "assess": "sonnet",
    "codify": "sonnet",
}

#: Never a hand-copied model-id set -- derived from the one place
#: `ai/router.py` already trusts, so the two can't silently drift apart.
ALLOWED_MODELS: frozenset[str] = frozenset(MODEL_ROUTING_TABLE.values())


class ModelRoutingError(Exception):
    """AC-6: `role` maps to no tier, or the resolved model id isn't in
    `ALLOWED_MODELS` -- the orchestrator halts the task rather than ever
    silently invoking an unapproved or fallback model.
    """

    def __init__(self, role: str) -> None:
        super().__init__(f"no valid model for role {role!r}")
        self.role = role


def resolve_model(role: str) -> dict[str, str]:
    """AC-6: `{"provider": "anthropic", "model": ...}` for a PDAC role, or
    raise `ModelRoutingError` -- never returns a model outside
    `ALLOWED_MODELS`.
    """
    tier = ROLE_TIER.get(role)
    model_id = MODEL_ROUTING_TABLE.get(tier) if tier else None
    if model_id is None or model_id not in ALLOWED_MODELS:
        raise ModelRoutingError(role)
    return {"provider": "anthropic", "model": model_id}
