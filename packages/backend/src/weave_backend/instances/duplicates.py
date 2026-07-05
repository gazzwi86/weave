"""AC-005-04: pre-dispatch duplicate check.

Surfaces the existing IRI and lets the caller choose to edit it instead
(HITL) rather than silently landing in `graph_ops._apply_add_node`'s own
same-label+kind auto-merge, which stays untouched here -- it still runs for
every other CE-WRITE-1 caller (NL authoring, imports). The instances router
calls this *before* ever building an `AddNodeOp`, so a detected duplicate
never reaches the shared pipeline at all.
"""

from __future__ import annotations

from rdflib import Graph

from weave_backend.operations.graph_ops import find_existing_by_label_kind
from weave_backend.rdf.oxigraph_client import fetch_graph_turtle


async def find_duplicate_iri(named_graph_iri: str, kind: str, label: str) -> str | None:
    turtle = await fetch_graph_turtle(named_graph_iri)
    graph = Graph()
    if turtle:
        graph.parse(data=turtle, format="turtle")
    existing = find_existing_by_label_kind(graph, kind, label)
    return str(existing) if existing is not None else None
