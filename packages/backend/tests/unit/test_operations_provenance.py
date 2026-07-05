"""CE-TASK-002 unit tests: PROV-O activity shape (AC-002-01, AC-002-05).

Mocks the Oxigraph HTTP boundary (`append_graph`) directly -- no docker --
and parses the Turtle it was handed with rdflib so the assertions are
triple-level, never string-matched (same convention as CE-TASK-001).
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from rdflib import RDF, Graph, URIRef
from rdflib.namespace import PROV

from weave_backend.operations import provenance

NAMED_GRAPH = "urn:weave:tenant:t1:ws:w1"
HUMAN_IRI = "urn:weave:principal:user:u-real"
AGENT_IRI = "urn:weave:principal:agent:abc123"
GENERATED_IRI = f"{NAMED_GRAPH}:v0.1.1"
USED_IRI = f"{NAMED_GRAPH}:v0.1.0"


async def _write_and_parse(
    monkeypatch: pytest.MonkeyPatch, *, actor_iri: str, actor_type: provenance.ActorType
) -> tuple[Graph, str]:
    append_spy = AsyncMock()
    monkeypatch.setattr(provenance, "append_graph", append_spy)

    activity_iri = await provenance.write_activity(
        named_graph_iri=NAMED_GRAPH,
        generated_iri=GENERATED_IRI,
        used_iri=USED_IRI,
        actor_iri=actor_iri,
        actor_type=actor_type,
    )

    append_spy.assert_called_once()
    turtle = append_spy.call_args.args[1]
    graph = Graph()
    graph.parse(data=turtle, format="turtle")
    return graph, activity_iri


async def test_human_activity_records_full_prov_o_set(monkeypatch: pytest.MonkeyPatch) -> None:
    graph, activity_iri = await _write_and_parse(
        monkeypatch, actor_iri=HUMAN_IRI, actor_type="human"
    )
    activity = URIRef(activity_iri)

    assert (activity, RDF.type, PROV.Activity) in graph
    assert (URIRef(HUMAN_IRI), RDF.type, PROV.Person) in graph
    assert (activity, PROV.wasAssociatedWith, URIRef(HUMAN_IRI)) in graph
    # M1: no separate LLM-agent flow reaches this pipeline yet -- the same
    # human both performed and started the activity (ADR-002).
    assert (activity, PROV.wasStartedBy, URIRef(HUMAN_IRI)) in graph
    assert (activity, PROV.generated, URIRef(GENERATED_IRI)) in graph
    assert (activity, PROV.used, URIRef(USED_IRI)) in graph
    assert next(graph.objects(activity, PROV.startedAtTime))
    assert next(graph.objects(activity, PROV.endedAtTime))


async def test_agent_activity_is_a_software_agent_and_omits_started_by(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AC-002-05: never fabricate an IRI -- an agent-executed activity has no
    separate approving human at this call site, so `wasStartedBy` is omitted
    rather than fabricated as a duplicate of the agent itself.
    """
    graph, activity_iri = await _write_and_parse(
        monkeypatch, actor_iri=AGENT_IRI, actor_type="agent"
    )
    activity = URIRef(activity_iri)

    assert (URIRef(AGENT_IRI), RDF.type, PROV.SoftwareAgent) in graph
    assert (activity, PROV.wasAssociatedWith, URIRef(AGENT_IRI)) in graph
    assert (activity, PROV.wasStartedBy, URIRef(AGENT_IRI)) not in graph
    assert len(list(graph.objects(activity, PROV.wasStartedBy))) == 0
