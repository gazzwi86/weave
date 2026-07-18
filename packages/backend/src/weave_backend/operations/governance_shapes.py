"""CE-TASK-005/G2/G3: the sole writer to a tenant's governance shapes graph
(ADR-024, extended by ADR-028). Deliberately does not route through
`operations/pipeline.py`'s `apply_operations_request`/`Op` vocabulary --
see ADR-024 for why that doesn't fit a `sh:NodeShape`'s blank-node
structure or the shapes graph's tenant-wide, directly-mutable (not
workspace-versioned) shape.

Reuses the same primitives `pipeline.py::_commit` already relies on for
non-instance-data graph writes: `append_graph` (additive, never
`load_graph`'s replace-whole-graph), the PROV-O writer, the audit outbox,
and the shapes-version bump (AC-005-02 cross-worker cache invalidation).

ADR-028 adds a second write primitive, `run_update` (SPARQL 1.1 Update),
used ONLY for a surgical per-subject retract of a shape IRI's triple
closure (itself + any reachable blank nodes, e.g. `sh:property` children)
-- never a whole-graph replace. `commit_tenant_shape` retracts-then-appends
so re-committing the same shape IRI replaces it instead of stacking
duplicate/conflicting triples (G2); `retire_tenant_shape` retracts with no
re-append (G3). Both funnel through `_retract_shape_subject_closure`, kept
here so this file stays the sole writer to the graph.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import TYPE_CHECKING

from rdflib import RDF, Graph
from rdflib.namespace import SH
from rdflib.term import URIRef

from weave_backend.audit.emitter import AuditEvent
from weave_backend.operations.outbox import enqueue
from weave_backend.operations.provenance import write_shape_activity
from weave_backend.operations.shacl import (
    bump_shapes_version,
    framework_shape_iris,
    tenant_shapes_graph_iri,
)
from weave_backend.rdf.oxigraph_client import append_graph, fetch_graph_ntriples, run_update

if TYPE_CHECKING:
    import asyncpg

    from weave_backend.operations.shacl import RedisLike

#: Caller-asserted role IRI (like `write_activity`'s human actor_iri) for
#: the AI generator when `ai_generated=True` -- not a real principal, a
#: fixed PROV-O agent identity for "the LLM produced this candidate".
_AI_GENERATOR_IRI = "https://weave.io/instances/agent-claude-sonnet-5"

#: SPARQL/Turtle IRIREF forbids these bytes -- `shape_iri` is embedded
#: directly into a hand-built SPARQL Update string (`_retract_shape_subject_
#: closure`), so any of these breaking out of the `<...>` wrapper is a
#: SPARQL-injection vector. Reject up front rather than trust the caller
#: (Law 13: validate untrusted input at the boundary -- `shape_iri` reaches
#: here from a client-echoed shape body on commit and a raw query param on
#: retire).
_FORBIDDEN_IRI_CHARS = re.compile(r'[\x00-\x20<>"{}|^`\\]')


def _validate_iri(value: str) -> None:
    if not value or _FORBIDDEN_IRI_CHARS.search(value):
        raise ValueError(f"not a valid IRI: {value!r}")


#: SHACL constraint nesting bottoms out within a handful of hops in
#: practice (e.g. `framework.shacl.ttl`'s `sh:or` shapes: shape -> sh:or ->
#: a 2-item rdf:list -> each item's own inline `sh:property` blank node, ~5
#: levels) -- but `authoring/shapes.py::parse_raw_shape` only gates
#: target/predicate, not nesting depth, so a hand-authored shape could in
#: principle go deeper. ponytail: fixed hop budget, not a true unbounded
#: closure -- a shape nested deeper than this leaves its own deepest blank
#: nodes un-retracted. Bump if that ever bites: UNION arms (see
#: `_closure_arm`) cost LINEARLY in depth, unlike the nested-OPTIONAL
#: design this replaced (that one cost EXPONENTIALLY in its own query
#: nesting depth alone, independent of data volume -- verified against a
#: real Oxigraph instance: depth 10 took 0.57s, depth 13 took 6.4s, depth
#: 15 OOM-killed the process (exit 137) on a trivial 2-triple-shape graph).
#: The UNION form measured 0.02s at depth 20 on the same graph, so this
#: constant has real headroom, not just an unverified guess.
_MAX_CLOSURE_DEPTH = 20


def _closure_arm(shape_iri: str, depth: int) -> str:
    """One UNION arm: a fixed-length chain of exactly `depth` blank-node
    hops from `shape_iri`, each hop gated `FILTER(isBlank(...))` before the
    next hop is attempted, ending in the `?s ?p ?o` triple this arm deletes
    (depth 0 is `shape_iri`'s own triples). This is the fix for the
    over-deletion bug the original `(!(<any-predicate>))*` property path
    had: a SPARQL property path has no way to filter on node kind
    mid-traversal, so it walked THROUGH named nodes it passed (e.g. a
    linked shape reached via `sh:node`) and kept collecting THAT shape's
    own blank-node children too. Each arm here is its own independent,
    linear chain -- the walk simply never matches past a named node, and
    unlike nesting the depths as `OPTIONAL` inside one one shared query
    tree, UNION-ing independent fixed-length arms doesn't make Oxigraph's
    planner multiply out every combination of "did/didn't descend" at
    every level (the cost blowup that made the `OPTIONAL` design crash).
    """
    lines: list[str] = []
    subject = f"<{shape_iri}>"
    for hop in range(depth):
        predicate, obj = f"?arm{depth}_p{hop}", f"?arm{depth}_o{hop}"
        lines.append(f"{subject} {predicate} {obj} .")
        lines.append(f"FILTER(isBlank({obj}))")
        subject = obj
    lines.append(f"BIND({subject} AS ?s)")
    lines.append("?s ?p ?o .")
    return "\n      ".join(lines)


async def _retract_shape_subject_closure(graph_iri: str, shape_iri: str) -> None:
    """Deletes every triple whose subject is `shape_iri` itself or a blank
    node transitively reachable from it via any predicate (a `sh:NodeShape`
    subject's `sh:property` children are blank nodes; SHACL logical
    constructs like `sh:or` nest further blank nodes under those) -- but
    the walk stops dead the instant it reaches a NAMED node (e.g. another
    shape referenced via `sh:node`/`sh:qualifiedValueShape`), never
    descending into that shape's own blank-node children (see
    `_closure_arm`). A surgical per-subject SPARQL Update, not a
    whole-graph `load_graph` replace -- concurrent edits to a DIFFERENT
    shape in the same tenant graph are untouched (ADR-028).
    """
    _validate_iri(graph_iri)
    _validate_iri(shape_iri)
    arms = "\n    UNION\n".join(
        f"    {{\n      {_closure_arm(shape_iri, depth)}\n    }}"
        for depth in range(_MAX_CLOSURE_DEPTH + 1)
    )
    query = f"""
    DELETE {{ GRAPH <{graph_iri}> {{ ?s ?p ?o }} }}
    WHERE {{
      GRAPH <{graph_iri}> {{
{arms}
      }}
    }}
    """
    await run_update(query)


class ShapeNotFoundError(Exception):
    """G3: `shape_iri` is not a committed shape in this tenant's shapes
    graph (never checked against framework shapes -- that's a 403, not a
    404, see `FrameworkShapeImmutableError`)."""

    def __init__(self, shape_iri: str) -> None:
        super().__init__(f"shape not found in tenant shapes graph: {shape_iri}")
        self.shape_iri = shape_iri


class FrameworkShapeImmutableError(Exception):
    """G3: only tenant-committed shapes retire -- framework shapes ship
    with the engine and are never mutated at runtime."""

    def __init__(self, shape_iri: str) -> None:
        super().__init__(f"framework shapes cannot be retired: {shape_iri}")
        self.shape_iri = shape_iri


@dataclass(frozen=True)
class ShapeCommit:
    """Bundles the shape-commit fields (ruff PLR0913: >5 args) -- mirrors
    `ApplyContext`'s role of grouping a mutation's per-call data.
    """

    tenant_id: str
    approver_iri: str
    shape_graph: Graph
    shape_iri: str
    ai_generated: bool


async def commit_tenant_shape(
    conn: asyncpg.Connection, redis_client: RedisLike, request: ShapeCommit
) -> str:
    """Replaces `request.shape_iri`'s existing triple closure (if any) with
    `request.shape_graph`'s triples in the tenant's governance shapes graph
    (G2: retract-then-append, so re-committing the same shape IRI replaces
    it instead of stacking duplicate/conflicting constraint triples),
    PROV-O-stamps the commit (AC-005-01), audits it, and bumps the shapes
    version so every worker's next validation sees it (AC-005-02). Returns
    the PROV-O activity IRI.
    """
    graph_iri = tenant_shapes_graph_iri(request.tenant_id)
    await _retract_shape_subject_closure(graph_iri, request.shape_iri)
    await append_graph(graph_iri, request.shape_graph.serialize(format="turtle"))

    activity_iri = await write_shape_activity(
        shapes_graph_iri=graph_iri,
        approver_iri=request.approver_iri,
        generator_iri=_AI_GENERATOR_IRI if request.ai_generated else None,
        generated_iri=request.shape_iri,
    )

    await enqueue(
        conn,
        AuditEvent(
            tenant_id=request.tenant_id,
            event_type="governance.shape_committed",
            actor_iri=request.approver_iri,
            subject_iri=request.shape_iri,
            engine="constitution",
            payload={"activity_iri": activity_iri, "ai_generated": request.ai_generated},
        ),
    )

    await bump_shapes_version(redis_client, request.tenant_id)
    return activity_iri


async def _shape_exists_in_tenant_graph(tenant_id: str, shape_iri: str) -> bool:
    """Reuses `fetch_graph_ntriples` + rdflib (the same fetch-and-parse
    pattern `shacl._tenant_shapes_graph` already uses) rather than a second
    SPARQL-text ASK query -- one fewer place embedding `shape_iri` in raw
    query text.
    """
    ntriples = await fetch_graph_ntriples(tenant_shapes_graph_iri(tenant_id))
    if not ntriples:
        return False
    graph = Graph()
    graph.parse(data=ntriples, format="nt")
    return (URIRef(shape_iri), RDF.type, SH.NodeShape) in graph


async def retire_tenant_shape(
    conn: asyncpg.Connection,
    redis_client: RedisLike,
    *,
    tenant_id: str,
    approver_iri: str,
    shape_iri: str,
) -> None:
    """G3: retracts `shape_iri`'s triple closure from the tenant's
    governance shapes graph (no re-append -- unlike `commit_tenant_shape`),
    audits it, and bumps the shapes version (the deletion case `bump_
    shapes_version`'s own docstring calls out). Raises
    `FrameworkShapeImmutableError` (-> 403) for a framework shape --
    checked first, since a framework shape is never in the tenant graph and
    an existence-first check would misreport it as "not found" (404)
    instead of "not retirable" (403). Raises `ShapeNotFoundError` (-> 404)
    if `shape_iri` isn't a tenant-committed shape. No PROV-O activity is
    written for a retire -- the audit event itself carries actor/subject/
    time; there is nothing further generated to attribute.
    """
    _validate_iri(shape_iri)
    if shape_iri in framework_shape_iris():
        raise FrameworkShapeImmutableError(shape_iri)
    if not await _shape_exists_in_tenant_graph(tenant_id, shape_iri):
        raise ShapeNotFoundError(shape_iri)

    graph_iri = tenant_shapes_graph_iri(tenant_id)
    await _retract_shape_subject_closure(graph_iri, shape_iri)

    await enqueue(
        conn,
        AuditEvent(
            tenant_id=tenant_id,
            event_type="governance.shape_retired",
            actor_iri=approver_iri,
            subject_iri=shape_iri,
            engine="constitution",
            payload={},
        ),
    )

    await bump_shapes_version(redis_client, tenant_id)
