"""TASK-009: server-side mirror of `packages/shared/onboarding/content/
exercises.ts` (TASK-003). Kept as a small static registry, not a codegen
step, per ADR-006's "ASK strings are static config, PR-reviewed" -- the
backend needs the *completion* shape (to dispatch the check) and the
*gating* shape (paths/variant) server-side too, since the frontend's own
gating is UI-only and must never be the sole enforcement (AC-009-01/02).

Keep this in sync with `exercises.ts` by hand when either changes -- six
entries, reviewed in the same PR, is cheaper than a cross-language codegen
pipeline for M1.
"""

from __future__ import annotations

from typing import Literal, TypedDict

RolePath = Literal["business", "technical", "compliance", "admin"]

CompletionKind = Literal["sparql_ask", "canvas_state", "nav_signal", "write_commit"]


class Completion(TypedDict, total=False):
    kind: CompletionKind
    ask: str
    state: str
    signal: str


class ExerciseDef(TypedDict):
    paths: tuple[RolePath, ...]
    completion: Completion


_ALL_PATHS: tuple[RolePath, ...] = ("business", "technical", "compliance", "admin")

_UNOWNED_PROCESS_ASK = (
    "PREFIX weave: <https://weave.io/ontology/>\n"
    "ASK { GRAPH ?g { ?p a weave:Process . FILTER NOT EXISTS { ?p weave:performedBy ?a } } }"
)

EXERCISES: dict[str, ExerciseDef] = {
    "CE-01": {
        "paths": _ALL_PATHS,
        "completion": {
            "kind": "nav_signal",
            "signal": "entity-list-viewed,missing-property-viewed",
        },
    },
    "CE-02": {
        "paths": _ALL_PATHS,
        "completion": {
            "kind": "sparql_ask",
            "ask": (
                "PREFIX weave: <https://weave.io/ontology/>\n"
                'ASK { GRAPH ?g { ?s a weave:Class ; weave:label "Outdoor Furniture" } }'
            ),
        },
    },
    "CE-03": {
        "paths": ("technical",),
        "completion": {"kind": "sparql_ask", "ask": _UNOWNED_PROCESS_ASK},
    },
    "CE-03b": {
        "paths": ("business", "compliance", "admin"),
        "completion": {"kind": "sparql_ask", "ask": _UNOWNED_PROCESS_ASK},
    },
    "GE-01": {
        "paths": _ALL_PATHS,
        "completion": {"kind": "canvas_state", "state": "spotlight-active"},
    },
    "GE-02": {
        "paths": _ALL_PATHS,
        "completion": {"kind": "canvas_state", "state": "heatmap-overlay-active"},
    },
}

#: AC-009-01: the read-only sandbox variant locks exercises that write --
#: only CE-02 (add a category) writes; every other M1 exercise is read-only.
WRITE_EXERCISE_IDS = frozenset({"CE-02"})


class GateResult:
    """Why an exercise is or isn't available to this caller right now."""

    def __init__(self, *, available: bool, reason: str | None = None) -> None:
        self.available = available
        self.reason = reason


def gate_exercise(
    exercise_id: str, *, role_path: RolePath, path_variant: Literal["default", "read_only"]
) -> GateResult:
    """AC-009-01/06: server-side gating -- the frontend's own gating is UI
    sugar, never the enforcement (this function is what `check_exercise_
    route` actually trusts).
    """
    exercise = EXERCISES.get(exercise_id)
    if exercise is None:
        return GateResult(available=False, reason="unknown_exercise")
    if role_path not in exercise["paths"]:
        return GateResult(available=False, reason="path_gated")
    if path_variant == "read_only" and exercise_id in WRITE_EXERCISE_IDS:
        return GateResult(available=False, reason="read_only_locked")
    return GateResult(available=True)


def available_exercises(
    *, role_path: RolePath, path_variant: Literal["default", "read_only"]
) -> list[str]:
    """T8: exercise ids `gate_exercise` currently allows this caller to
    check -- `GET /onboarding/state` exposes this so the checklist client
    can skip an exercise it can't complete, instead of POSTing to `/check`
    and taking a 403 (`path_gated` / `read_only_locked`) it could have
    avoided.
    """
    return [
        exercise_id
        for exercise_id in EXERCISES
        if gate_exercise(exercise_id, role_path=role_path, path_variant=path_variant).available
    ]
