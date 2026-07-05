"""AC-003-02: `ontology/resource.py`'s pure lookup logic (triples, kind,
label, outgoing/incoming edges) against a fake Turtle snapshot -- isolated
from real Oxigraph, which `tests/integration/test_ontology.py` covers.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from weave_backend.ontology import resource as resource_lookup

GRAPH_IRI = "urn:weave:tenant:t1:ws:ws-1:v0.1.0"
SUBJECT = "https://weave.io/tenant/t1/ws/ws-1/process/onboard-customer"
TARGET = "https://weave.io/tenant/t1/ws/ws-1/activity/collect-docs"

TURTLE = f"""
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

<{SUBJECT}> rdf:type <https://weave.io/ontology/Process> ;
    rdfs:label "Onboard customer" ;
    <https://weave.io/ontology/hasStep> <{TARGET}> .

<{TARGET}> rdf:type <https://weave.io/ontology/Activity> .
"""


async def test_lookup_resource_returns_kind_label_and_outgoing_edge() -> None:
    with patch.object(
        resource_lookup, "fetch_graph_turtle", AsyncMock(return_value=TURTLE)
    ):
        result = await resource_lookup.lookup_resource(GRAPH_IRI, SUBJECT)

    assert result is not None
    assert result.iri == SUBJECT
    assert result.kind == "Process"
    assert result.label == "Onboard customer"
    assert {(e.predicate, e.other) for e in result.outgoing} == {
        ("https://weave.io/ontology/hasStep", TARGET)
    }
    assert result.incoming == []


async def test_lookup_resource_returns_incoming_edge_for_target() -> None:
    with patch.object(
        resource_lookup, "fetch_graph_turtle", AsyncMock(return_value=TURTLE)
    ):
        result = await resource_lookup.lookup_resource(GRAPH_IRI, TARGET)

    assert result is not None
    assert result.kind == "Activity"
    assert {(e.predicate, e.other) for e in result.incoming} == {
        ("https://weave.io/ontology/hasStep", SUBJECT)
    }
    assert result.outgoing == []


async def test_lookup_resource_falls_back_to_local_name_when_no_label() -> None:
    """`TARGET` has no `rdfs:label` of its own -- label falls back to the
    IRI's own local name (last path segment), not the kind's.
    """
    with patch.object(
        resource_lookup, "fetch_graph_turtle", AsyncMock(return_value=TURTLE)
    ):
        result = await resource_lookup.lookup_resource(GRAPH_IRI, TARGET)

    assert result is not None
    assert result.label == "collect-docs"


async def test_lookup_resource_returns_none_when_iri_has_no_triples() -> None:
    """AC-003-02 + implementation hint: a foreign-tenant IRI (or any IRI with
    zero triples in this graph) 404s -- not a 403 -- because the graph itself
    is already tenant-scoped by the time this function runs.
    """
    with patch.object(
        resource_lookup, "fetch_graph_turtle", AsyncMock(return_value=TURTLE)
    ):
        result = await resource_lookup.lookup_resource(
            GRAPH_IRI, "https://weave.io/tenant/other/ws/x/process/ghost"
        )

    assert result is None


async def test_lookup_resource_handles_empty_graph() -> None:
    """A version whose graph was never written returns "" from
    `fetch_graph_turtle` (Graph Store Protocol 404 -- treated as empty)."""
    with patch.object(resource_lookup, "fetch_graph_turtle", AsyncMock(return_value="")):
        result = await resource_lookup.lookup_resource(GRAPH_IRI, SUBJECT)

    assert result is None
