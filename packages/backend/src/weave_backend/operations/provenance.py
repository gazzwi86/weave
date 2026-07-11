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

from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Literal as LiteralType
from uuid import uuid4

from rdflib import RDF, BNode, Graph, Literal, Namespace, URIRef
from rdflib.namespace import PROV, XSD

from weave_backend.rdf.oxigraph_client import append_graph

INSTANCES = Namespace("https://weave.io/instances/")
WEAVE = Namespace("https://weave.io/ontology/")

ActorType = LiteralType["human", "agent"]


@dataclass(frozen=True)
class Actor:
    iri: str
    type: ActorType


@dataclass(frozen=True)
class ActivityExtra:
    """CE-V1-TASK-012 AC-001-05: extra attribution an ingest accept layers
    onto its commit activity -- see `write_activity`'s `extra` param.

    `activity_iri`, when given, is an activity that already exists (started
    earlier by the ingest worker -- `operations.ingest_provenance
    .start_ingest_activity`); `write_activity` reuses it instead of minting
    a fresh one, so `RDF.type`/`startedAtTime` are not re-added -- a second,
    later `startedAtTime` literal for the same activity would be a genuine
    (not just idempotent) duplicate.

    `extra_used_iris`/`extra_agent_iri`: the extractor agent and the source
    artefact, attributed on top of the human approver and the source graph
    version.
    """

    activity_iri: str | None = None
    extra_used_iris: Sequence[str] = field(default_factory=tuple)
    extra_agent_iri: str | None = None
    extra_agent_type: ActorType = "agent"


def prov_graph_iri(named_graph_iri: str) -> str:
    return f"{named_graph_iri}:prov"


async def write_activity(
    *,
    named_graph_iri: str,
    actor: Actor,
    generated_iri: str,
    used_iri: str,
    extra: ActivityExtra | None = None,
) -> str:
    extra = extra or ActivityExtra()
    activity = (
        URIRef(extra.activity_iri) if extra.activity_iri else INSTANCES[f"activity-{uuid4().hex}"]
    )
    now = Literal(datetime.now(UTC).isoformat(), datatype=XSD.dateTime)
    actor_ref = URIRef(actor.iri)

    graph = Graph()
    if extra.activity_iri is None:
        graph.add((activity, RDF.type, PROV.Activity))
        graph.add((activity, PROV.startedAtTime, now))
    graph.add((actor_ref, RDF.type, PROV.SoftwareAgent if actor.type == "agent" else PROV.Person))
    graph.add((activity, PROV.wasAssociatedWith, actor_ref))
    if actor.type != "agent":
        # AC-002-05: never fabricate an IRI -- there is no separate approving
        # human to reference when an agent is the actor, so `wasStartedBy` is
        # only emitted for the human-actor case (ADR-002).
        graph.add((activity, PROV.wasStartedBy, actor_ref))
    graph.add((activity, PROV.generated, URIRef(generated_iri)))
    graph.add((activity, PROV.used, URIRef(used_iri)))
    for extra_used in extra.extra_used_iris:
        graph.add((activity, PROV.used, URIRef(extra_used)))
    if extra.extra_agent_iri:
        extra_agent = URIRef(extra.extra_agent_iri)
        agent_class = PROV.SoftwareAgent if extra.extra_agent_type == "agent" else PROV.Person
        graph.add((extra_agent, RDF.type, agent_class))
        graph.add((activity, PROV.wasAssociatedWith, extra_agent))
    graph.add((activity, PROV.endedAtTime, now))

    await append_graph(prov_graph_iri(named_graph_iri), graph.serialize(format="turtle"))
    return str(activity)


async def write_shape_activity(
    *,
    shapes_graph_iri: str,
    approver_iri: str,
    generator_iri: str | None,
    generated_iri: str,
) -> str:
    """CE-TASK-005 (AC-005-01): `write_activity`'s single-actor model can't
    express "LLM generated it, human approved it" -- two actors, two
    distinct roles. `generator_iri=None` is the self-authored case (a human
    submits raw SHACL with no AI step): approver only, same shape as
    `write_activity`'s human-actor branch.
    """
    activity_iri = INSTANCES[f"activity-{uuid4().hex}"]
    now = Literal(datetime.now(UTC).isoformat(), datatype=XSD.dateTime)
    approver = URIRef(approver_iri)

    graph = Graph()
    graph.add((activity_iri, RDF.type, PROV.Activity))
    graph.add((approver, RDF.type, PROV.Person))
    graph.add((activity_iri, PROV.wasAssociatedWith, approver))
    graph.add((activity_iri, PROV.wasStartedBy, approver))

    if generator_iri is not None:
        generator = URIRef(generator_iri)
        graph.add((generator, RDF.type, PROV.SoftwareAgent))
        graph.add((activity_iri, PROV.wasAssociatedWith, generator))
        association = BNode()
        graph.add((activity_iri, PROV.qualifiedAssociation, association))
        graph.add((association, RDF.type, PROV.Association))
        graph.add((association, PROV.agent, generator))
        graph.add((association, PROV.hadRole, WEAVE.generator))

    graph.add((activity_iri, PROV.generated, URIRef(generated_iri)))
    graph.add((activity_iri, PROV.startedAtTime, now))
    graph.add((activity_iri, PROV.endedAtTime, now))

    await append_graph(prov_graph_iri(shapes_graph_iri), graph.serialize(format="turtle"))
    return str(activity_iri)

