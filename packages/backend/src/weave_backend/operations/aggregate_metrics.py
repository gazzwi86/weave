"""CE-METRICS-1 (contracts.md, TASK-007) aggregate computation.

`entity_count_by_kind` is one GROUP BY SELECT against the draft graph, kind
list read in-process from `catalogue.list_kinds()` (AC-007-02 -- the same
source `GET /api/ontology/types` serves, never a hand-copied list).

`draft_published_delta` reuses `diff_graphs`, the M1 internal diff core
(AC-007-04) -- never the CE-DIFF-1 HTTP endpoint (`operations/diff.py`'s
`compute_diff`/`routers/ontology.py`'s `diff_route`), which only accepts two
PUBLISHED version IRIs and can't take the draft as a side.
"""

from __future__ import annotations

from dataclasses import dataclass

import asyncpg
from rdflib import Graph

from weave_backend.ontology import catalogue
from weave_backend.operations import versioning
from weave_backend.operations.diff import diff_graphs
from weave_backend.rdf.oxigraph_client import fetch_graph_turtle, run_query

_COUNT_QUERY = "SELECT ?kind (COUNT(?s) AS ?count) WHERE { ?s a ?kind } GROUP BY ?kind"


@dataclass(frozen=True)
class DeltaCounts:
    added: int
    removed: int
    modified: int


async def entity_count_by_kind(named_graph_iri: str) -> dict[str, int]:
    """AC-007-02/-06: every known BPMO kind defaults to 0 -- an empty graph
    (or one with no instances of some kind) never drops that kind's key.
    """
    kinds = catalogue.list_kinds()
    counts = {kind.label: 0 for kind in kinds}
    label_by_iri = {kind.iri: kind.label for kind in kinds}

    raw = await run_query(_COUNT_QUERY, named_graph_iri)
    for binding in raw.get("results", {}).get("bindings", []):
        label = label_by_iri.get(binding["kind"]["value"])
        if label is not None:
            counts[label] = int(binding["count"]["value"])
    return counts


async def draft_published_delta(
    *, draft_graph_iri: str, latest_published_iri: str | None
) -> DeltaCounts:
    """Implementation Hints pitfall: a never-published tenant
    (`latest_published_iri=None`) diffs the draft against an empty graph, so
    the whole draft counts as `added`.
    """
    before = Graph()
    if latest_published_iri is not None:
        before.parse(data=await fetch_graph_turtle(latest_published_iri), format="turtle")

    after = Graph()
    after.parse(data=await fetch_graph_turtle(draft_graph_iri), format="turtle")

    result = diff_graphs(before, after)
    return DeltaCounts(
        added=len(result.added), removed=len(result.removed), modified=len(result.modified)
    )


async def resolve_latest_version(
    conn: asyncpg.Connection, *, tenant_id: str, workspace_id: str
) -> str | None:
    """Implementation Hints pitfall: `latest_version` is `null` for a
    never-published tenant -- `resolve_version`'s `VersionNotFound` maps to
    `None` here rather than propagating as an error.
    """
    try:
        return await versioning.resolve_version(
            conn, tenant_id=tenant_id, workspace_id=workspace_id, version="latest"
        )
    except versioning.VersionNotFound:
        return None
