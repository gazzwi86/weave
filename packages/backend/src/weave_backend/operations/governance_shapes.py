"""CE-TASK-005: the sole writer to a tenant's governance shapes graph
(ADR-024). Deliberately does not route through `operations/pipeline.py`'s
`apply_operations_request`/`Op` vocabulary -- see ADR-024 for why that
doesn't fit a `sh:NodeShape`'s blank-node structure or the shapes graph's
tenant-wide, directly-mutable (not workspace-versioned) shape.

Reuses the same primitives `pipeline.py::_commit` already relies on for
non-instance-data graph writes: `append_graph` (additive, never
`load_graph`'s replace-whole-graph), the PROV-O writer, the audit outbox,
and the shapes-version bump (AC-005-02 cross-worker cache invalidation).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from rdflib import Graph

from weave_backend.audit.emitter import AuditEvent
from weave_backend.operations.outbox import enqueue
from weave_backend.operations.provenance import write_shape_activity
from weave_backend.operations.shacl import bump_shapes_version, tenant_shapes_graph_iri
from weave_backend.rdf.oxigraph_client import append_graph

if TYPE_CHECKING:
    import asyncpg

    from weave_backend.operations.shacl import RedisLike

#: Caller-asserted role IRI (like `write_activity`'s human actor_iri) for
#: the AI generator when `ai_generated=True` -- not a real principal, a
#: fixed PROV-O agent identity for "the LLM produced this candidate".
_AI_GENERATOR_IRI = "https://weave.io/instances/agent-claude-sonnet-5"


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
    """Appends `request.shape_graph`'s triples to the tenant's governance
    shapes graph, PROV-O-stamps the commit (AC-005-01), audits it, and
    bumps the shapes version so every worker's next validation sees it
    (AC-005-02). Returns the PROV-O activity IRI.
    """
    graph_iri = tenant_shapes_graph_iri(request.tenant_id)
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
