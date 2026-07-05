"""AC-003-02: `GET /api/ontology/resource/{iri}` -- looks up one resource's
triples + edges inside a specific version's named graph (each committed
version's Turtle snapshot lives at a named graph literally equal to its
`version_iri` -- the same model `operations/diff.py` relies on).
"""

from __future__ import annotations

from dataclasses import dataclass

from rdflib import Graph, URIRef
from rdflib.namespace import RDF

from weave_backend.rdf.oxigraph_client import fetch_graph_turtle


@dataclass(frozen=True)
class Triple:
    subject: str
    predicate: str
    object: str


@dataclass(frozen=True)
class Edge:
    predicate: str
    other: str


@dataclass(frozen=True)
class Resource:
    iri: str
    kind: str | None
    label: str
    triples: list[Triple]
    outgoing: list[Edge]
    incoming: list[Edge]


def _local_name(iri: str) -> str:
    return iri.rsplit("#", 1)[-1].rsplit("/", 1)[-1]


def _outgoing_triples(
    graph: Graph, subject: URIRef
) -> tuple[list[Triple], list[Edge], str | None, str]:
    triples: list[Triple] = []
    edges: list[Edge] = []
    kind: str | None = None
    label = _local_name(str(subject))
    for s, p, o in graph.triples((subject, None, None)):
        triples.append(Triple(subject=str(s), predicate=str(p), object=str(o)))
        if p == RDF.type:
            kind = _local_name(str(o))
        elif _local_name(str(p)) == "label":
            # Matches both `weave:label` (what `graph_ops.py` actually
            # writes for instance data) and `rdfs:label`, without hard-
            # coding either namespace.
            label = str(o)
        elif isinstance(o, URIRef):
            edges.append(Edge(predicate=str(p), other=str(o)))
    return triples, edges, kind, label


def _incoming_triples(graph: Graph, subject: URIRef) -> tuple[list[Triple], list[Edge]]:
    triples: list[Triple] = []
    edges: list[Edge] = []
    for s, p, o in graph.triples((None, None, subject)):
        triples.append(Triple(subject=str(s), predicate=str(p), object=str(o)))
        edges.append(Edge(predicate=str(p), other=str(s)))
    return triples, edges


async def lookup_resource(version_iri: str, iri: str) -> Resource | None:
    """`None` if `iri` has no triples in `version_iri`'s graph at all -- the
    router 404s on that. This also naturally covers foreign-tenant IRIs (they
    never appear in the caller's own graph, so no separate 403 branch is
    needed -- see TASK-003's implementation hint: 404, not 403, on a resource
    from another tenant).
    """
    turtle = await fetch_graph_turtle(version_iri)
    graph = Graph()
    if turtle:
        graph.parse(data=turtle, format="turtle")

    subject = URIRef(iri)
    outgoing_triples, outgoing, kind, label = _outgoing_triples(graph, subject)
    incoming_triples, incoming = _incoming_triples(graph, subject)
    triples = outgoing_triples + incoming_triples

    if not triples:
        return None

    return Resource(
        iri=iri,
        kind=kind,
        label=label,
        triples=triples,
        outgoing=outgoing,
        incoming=incoming,
    )
