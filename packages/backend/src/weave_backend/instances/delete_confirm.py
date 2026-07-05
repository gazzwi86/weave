"""AC-005-07/-10: pre-delete confirmation preview.

Lists every dependent (outgoing + incoming) *relationship* edge on the
target IRI in the current draft graph, so the caller can see what will be
affected before it commits to a `delete_node` dispatch. The shared pipeline
(`operations/graph_ops.py::_apply_delete_node`) already removes every
outgoing AND incoming triple at the application layer, and the SHACL
re-validation that follows (`operations/pipeline.py::_apply_uncached`)
already 422s -- without committing -- if that cascade leaves a
SHACL-required relationship dangling (AC-005-08). This module adds no new
mutation behaviour; it only computes the human-facing preview of what that
existing cascade is about to touch.
"""

from __future__ import annotations

from dataclasses import dataclass

from rdflib import RDF, Graph, URIRef


@dataclass(frozen=True)
class Edge:
    predicate: str
    other: str


@dataclass(frozen=True)
class DependentEdges:
    outgoing: list[Edge]
    incoming: list[Edge]


def dependent_edges(graph: Graph, iri: str) -> DependentEdges:
    """Relationship edges only -- `rdf:type` (structural) and literal-valued
    triples (e.g. `weave:label`) are excluded, since neither is a
    "dependent" edge a caller needs to be warned about.
    """
    subject = URIRef(iri)
    outgoing = [
        Edge(predicate=str(p), other=str(o))
        for _s, p, o in graph.triples((subject, None, None))
        if p != RDF.type and isinstance(o, URIRef)
    ]
    incoming = [
        Edge(predicate=str(p), other=str(s))
        for s, p, _o in graph.triples((None, None, subject))
    ]
    return DependentEdges(outgoing=outgoing, incoming=incoming)
