"""PROV-O activity record for CE-WRITE-1/CE-TASK-002 (AC-002-01, AC-002-05).

Every successful mutation commit appends one `prov:Activity` to the tenant's
prov graph (`{named_graph_iri}:prov`), recording who did it (`wasAssociatedWith`),
what it produced (`generated`) from what (`used`), and -- for a human actor --
who started it. There is no LLM-agent-initiated mutation flow yet (TASK-004/
006), so `actor_type="agent"` support is modelled per PROV-O ready for that
case but not yet exercised end-to-end: see ADR-002.

Written via `append_graph` (POST/merge), never `load_graph` (PUT/replace) --
provenance is append-only.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal as LiteralType
from uuid import uuid4

from rdflib import RDF, Graph, Literal, Namespace, URIRef
from rdflib.namespace import PROV, XSD

from weave_backend.rdf.oxigraph_client import append_graph

INSTANCES = Namespace("https://weave.io/instances/")

ActorType = LiteralType["human", "agent"]


def prov_graph_iri(named_graph_iri: str) -> str:
    return f"{named_graph_iri}:prov"


async def write_activity(
    *,
    named_graph_iri: str,
    actor_iri: str,
    actor_type: ActorType,
    generated_iri: str,
    used_iri: str,
) -> str:
    activity_iri = INSTANCES[f"activity-{uuid4().hex}"]
    now = Literal(datetime.now(UTC).isoformat(), datatype=XSD.dateTime)
    actor = URIRef(actor_iri)

    graph = Graph()
    graph.add((activity_iri, RDF.type, PROV.Activity))
    graph.add((actor, RDF.type, PROV.SoftwareAgent if actor_type == "agent" else PROV.Person))
    graph.add((activity_iri, PROV.wasAssociatedWith, actor))
    if actor_type != "agent":
        # AC-002-05: never fabricate an IRI -- there is no separate approving
        # human to reference when an agent is the actor, so `wasStartedBy` is
        # only emitted for the human-actor case (ADR-002).
        graph.add((activity_iri, PROV.wasStartedBy, actor))
    graph.add((activity_iri, PROV.generated, URIRef(generated_iri)))
    graph.add((activity_iri, PROV.used, URIRef(used_iri)))
    graph.add((activity_iri, PROV.startedAtTime, now))
    graph.add((activity_iri, PROV.endedAtTime, now))

    await append_graph(prov_graph_iri(named_graph_iri), graph.serialize(format="turtle"))
    return str(activity_iri)
