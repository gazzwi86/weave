"""TASK-003 (ADR-005, EPIC-011): deterministic seed + weighted k-hop BPMO
subgraph retrieval under the 200-node prompt-assembly cap (OQ-11).

Pure scorer -- `neighbours_fn` is an injected paginated `CE-READ-1` read
(ADR-001: no raw SPARQL), stubbed in tests (Law F). No vector store, no
LLM re-rank (ADR-005 Alternatives Considered) -- same-graph/same-seeds
always selects the identical 200 nodes.

`predicate_class`'s "associative" weight is configured (PLAT-SETTINGS-1,
AC-4) but not yet routed to any predicate: the brief supplies only the
structural IRI set (Implementation Hints) and pins the fallback rule for
everything else ("unknown predicate => annotation weight, logged once").
No live associative IRI set exists to hand-copy without violating
`ontology-standards.md`'s "never hand-copy the served kind/predicate list"
rule, so this is a documented ceiling (ADR-005-style "known ceiling, v1.0
upgrade path"), not a blocking gap -- see ADR-021.
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field

import asyncpg

from weave_backend.settings.resolver import SettingNotFound, resolve_setting
from weave_backend.settings.scope import InvalidScopeIri, company_iri

log = logging.getLogger(__name__)

#: PLAT-SETTINGS-1 key -- one JSON object, never a hardcoded weight/hop
#: literal (AC-4), same shape convention as `build/cost.py::RATE_CARD_KEY`.
RETRIEVAL_SETTINGS_KEY = "build.retrieval"

RETRIEVAL_CAP = 200

#: ADR-005 defaults -- the fallback when nothing is configured anywhere in
#: the PLAT-SETTINGS-1 cascade (fail-open to these, not an error: AC-4).
DEFAULT_WEIGHTS: dict[str, float] = {"structural": 1.0, "associative": 0.5, "annotation": 0.1}
DEFAULT_MAX_HOPS = 2

#: Structural BPMO predicates (Implementation Hints, ADR-005) -- keyed by
#: the served predicate IRI (`urn:weave:bpmo:<name>` convention, mirrors
#: `requests/ce_read.py`'s `_TOUCHES_DOMAIN` etc.). A hand-misspelled entry
#: here silently drops to the annotation weight rather than erroring, which
#: is exactly why this set stays small and explicit.
STRUCTURAL_PREDICATES: frozenset[str] = frozenset(
    f"urn:weave:bpmo:{name}"
    for name in (
        "partOf",
        "dependsOn",
        "governedBy",
        "realizes",
        "hasStep",
        "performedBy",
        "consumes",
        "produces",
    )
)

Edge = tuple[str, str, str]  # (src, predicate, dst)

#: Injected paginated CE-READ-1 neighbour read:
#: `async def neighbours_fn(frontier: list[str]) -> list[Edge]`.
#: Production wiring goes through `ce_client` (ADR-001); tests stub this
#: directly (Law F).
NeighboursFn = Callable[[list[str]], Awaitable[list[Edge]]]

_logged_unknown_predicates: set[str] = set()


class SeedSetExceedsCapError(Exception):
    """AC-2/Design Decisions: the seed set alone exceeds the 200-node cap,
    so truncation cannot honour "every seed survives" -- fail loudly
    instead of silently dropping a caller-requested seed.
    """

    def __init__(self, seed_count: int) -> None:
        super().__init__(
            f"seed set alone ({seed_count} IRIs) exceeds the {RETRIEVAL_CAP}-node cap"
        )
        self.seed_count = seed_count


@dataclass(frozen=True)
class RetrievalConfig:
    weights: dict[str, float]
    max_hops: int


@dataclass(frozen=True)
class RetrievalSlice:
    nodes: list[str]
    truncated: bool
    dropped_count: int
    #: Exposed for tests/callers that need the raw score (e.g. debugging a
    #: ranking) -- not itself part of any AC.
    scores: dict[str, float] = field(default_factory=dict)

    @property
    def notice(self) -> str | None:
        """AC-3: the truncation notice a caller appends to the prompt
        preamble -- `None` when nothing was dropped.
        """
        if not self.truncated:
            return None
        return truncation_notice(self.dropped_count)


def truncation_notice(dropped_count: int) -> str:
    return (
        f"[retrieval truncated: {dropped_count} node(s) dropped from this "
        f"{RETRIEVAL_CAP}-node slice. Request an investigator run for "
        "context beyond this slice.]"
    )


def predicate_class(predicate: str) -> str:
    """AC-4: `structural` for the shipped BPMO structural predicate set,
    else `annotation` (fallback) -- logged once per unknown predicate
    (Implementation Hints), never silently re-warned on every occurrence.
    """
    if predicate in STRUCTURAL_PREDICATES:
        return "structural"
    if predicate not in _logged_unknown_predicates:
        _logged_unknown_predicates.add(predicate)
        log.warning("unknown_predicate", extra={"predicate": predicate})
    return "annotation"


async def resolve_retrieval_config(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str
) -> RetrievalConfig:
    """AC-4: cascade-resolve `RETRIEVAL_SETTINGS_KEY`, mirroring
    `build/costs.py::resolve_budget_cap`'s `InvalidScopeIri` ->
    company-scope retry -> defaults fallback (real project IRIs don't
    parse `settings/scope.py`'s cascade grammar -- ADR-013/XT-BE013-1).
    """
    try:
        resolved = await resolve_setting(
            conn, tenant_id=tenant_id, key=RETRIEVAL_SETTINGS_KEY, context_iri=project_iri
        )
        raw = resolved.value
    except InvalidScopeIri:
        try:
            resolved = await resolve_setting(
                conn,
                tenant_id=tenant_id,
                key=RETRIEVAL_SETTINGS_KEY,
                context_iri=company_iri(tenant_id),
            )
            raw = resolved.value
        except SettingNotFound:
            return RetrievalConfig(weights=dict(DEFAULT_WEIGHTS), max_hops=DEFAULT_MAX_HOPS)
    except SettingNotFound:
        return RetrievalConfig(weights=dict(DEFAULT_WEIGHTS), max_hops=DEFAULT_MAX_HOPS)

    return RetrievalConfig(weights=dict(raw["weights"]), max_hops=int(raw["max_hops"]))


async def retrieve_slice(
    *,
    seed_iris: list[str],
    neighbours_fn: NeighboursFn,
    cfg: RetrievalConfig,
    cap: int = RETRIEVAL_CAP,
) -> RetrievalSlice:
    """AC-1/AC-2/AC-3: stable seed + weighted k-hop expansion, cut at
    `cap`. `neighbours_fn(frontier: list[str]) -> Awaitable[list[Edge]]` is
    the injected paginated `CE-READ-1` read.
    """
    unique_seeds = list(dict.fromkeys(seed_iris))
    if len(unique_seeds) > cap:
        raise SeedSetExceedsCapError(len(unique_seeds))

    scores: dict[str, float] = dict.fromkeys(unique_seeds, float("inf"))
    seen: set[str] = set(unique_seeds)
    frontier = unique_seeds

    for hop in range(1, cfg.max_hops + 1):
        if not frontier:
            break
        edges = await neighbours_fn(frontier)
        next_frontier: list[str] = []
        for _src, predicate, dst in edges:
            candidate_score = cfg.weights[predicate_class(predicate)] / (1 + hop)
            if candidate_score > scores.get(dst, 0.0):
                scores[dst] = candidate_score
            if dst not in seen:
                seen.add(dst)
                next_frontier.append(dst)
        frontier = next_frontier

    ranked = sorted(scores.items(), key=lambda kv: (-kv[1], kv[0]))
    kept, dropped = ranked[:cap], ranked[cap:]

    if dropped:
        log.info("retrieval_truncated", extra={"dropped": len(dropped)})

    return RetrievalSlice(
        nodes=[iri for iri, _ in kept],
        truncated=bool(dropped),
        dropped_count=len(dropped),
        scores=scores,
    )
