"""TASK-009: `excheck` -- dispatches an exercise's `completion` config to the
named contract signal that actually verifies it (AC-009-03). Every ASK is a
static, PR-reviewed string from `exercises.py` -- never built from request
input (AC-009-02's "no query construction in onboarding").
"""

from __future__ import annotations

from dataclasses import dataclass

from weave_backend.onboarding.exercises import Completion
from weave_backend.rdf.oxigraph_client import run_query

#: The value persisted to `exercise_completion.verified_signal`
#: (`0082_onboarding_state.sql`'s CHECK constraint: ask/write_commit/
#: canvas_state/nav_signal).
_KIND_TO_STORED_SIGNAL = {
    "sparql_ask": "ask",
    "canvas_state": "canvas_state",
    "nav_signal": "nav_signal",
}


class UnsupportedCompletionKindError(Exception):
    """A completion kind with no dispatch logic reached the checker."""


@dataclass(frozen=True)
class CheckOutcome:
    verified: bool
    verified_signal: str


async def check_completion(
    completion: Completion, *, named_graph_iri: str | None, claimed_signals: frozenset[str]
) -> CheckOutcome:
    kind = completion["kind"]
    if kind == "sparql_ask":
        if named_graph_iri is None:
            raise ValueError("sparql_ask check requires a resolved sandbox named_graph_iri")
        result = await run_query(completion["ask"], named_graph_iri)
        verified = bool(result.get("boolean"))
    elif kind == "nav_signal":
        required = {s.strip() for s in completion["signal"].split(",") if s.strip()}
        verified = required.issubset(claimed_signals)
    elif kind == "canvas_state":
        verified = completion["state"] in claimed_signals
    else:
        raise UnsupportedCompletionKindError(kind)
    return CheckOutcome(verified=verified, verified_signal=_KIND_TO_STORED_SIGNAL[kind])
