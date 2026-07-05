"""BE-TASK-002: the Architect agent's two-pass drafting flow (FR-018
AC-1/AC-6). ``claude-fable-5`` drafts the brief grounded in the BPMO
context; ``claude-sonnet-5`` runs a structural validation pass. Both model
IDs are named constants routed through ``ai.router.route`` -- never a
runtime variable (Implementation Hints) -- so an unregistered tier halts
brief generation instead of silently drafting with the wrong model.
"""

from __future__ import annotations

import json

from weave_backend.ai.providers import ModelProvider
from weave_backend.ai.router import route

_DRAFT_TIER = "fable"
_VALIDATION_TIER = "sonnet"


class ModelRoutingMiss(Exception):
    """Raised when ``_DRAFT_TIER``/``_VALIDATION_TIER`` don't resolve to a
    registered model -- brief generation halts rather than falling back to
    an unconfirmed model.
    """

    def __init__(self, tier: str) -> None:
        super().__init__(f"unregistered model tier: {tier!r}")
        self.tier = tier


def _route_or_halt(tier: str, prompt: str, provider: ModelProvider | None) -> str:
    try:
        return route(tier, prompt, provider=provider)
    except ValueError as exc:
        raise ModelRoutingMiss(tier) from exc


def draft_brief_document(
    task_description: str,
    bpmo_context: dict[str, object],
    dep_summaries: list[str],
    *,
    provider: ModelProvider | None = None,
) -> dict[str, object]:
    """Draft a raw (unvalidated) task-brief document. Callers must run the
    result through ``TaskBrief.model_validate()`` before persisting it --
    never store raw LLM output directly.
    """
    draft_prompt = json.dumps(
        {
            "task_description": task_description,
            "bpmo_context": bpmo_context,
            "dep_summaries": dep_summaries,
        }
    )
    raw_draft = _route_or_halt(_DRAFT_TIER, draft_prompt, provider)
    draft: dict[str, object] = json.loads(raw_draft)

    # Sonnet structural pass (AC-6): required for every brief, informational
    # only -- the fable-drafted JSON above remains the persisted content.
    _route_or_halt(_VALIDATION_TIER, raw_draft, provider)

    return draft
