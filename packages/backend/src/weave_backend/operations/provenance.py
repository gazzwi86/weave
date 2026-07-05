"""Minimal PROV-O activity record for CE-WRITE-1. Full provenance modelling
(lineage across ops, prov:used per-entity) is CE-TASK-002's scope -- this
task only mints an `activity_iri` and writes the minimal PROV-O triple set
the contract requires: an Activity, attributed to its actor, with a time
span.

Written to `{named_graph_iri}:prov`, via `append_graph` (POST/merge), never
`load_graph` (PUT/replace) -- provenance is append-only.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from rdflib import RDF, Graph, Literal, Namespace, URIRef
from rdflib.namespace import PROV, XSD

from weave_backend.rdf.oxigraph_client import append_graph

INSTANCES = Namespace("https://weave.io/instances/")


def prov_graph_iri(named_graph_iri: str) -> str:
    return f"{named_graph_iri}:prov"


async def write_activity(*, named_graph_iri: str, actor_iri: str) -> str:
    activity_iri = INSTANCES[f"activity-{uuid4().hex}"]
    now = Literal(datetime.now(UTC).isoformat(), datatype=XSD.dateTime)

    graph = Graph()
    graph.add((activity_iri, RDF.type, PROV.Activity))
    graph.add((activity_iri, PROV.wasAssociatedWith, URIRef(actor_iri)))
    graph.add((activity_iri, PROV.startedAtTime, now))
    graph.add((activity_iri, PROV.endedAtTime, now))

    await append_graph(prov_graph_iri(named_graph_iri), graph.serialize(format="turtle"))
    return str(activity_iri)
