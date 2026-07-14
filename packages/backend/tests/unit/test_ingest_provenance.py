"""CE-V1-TASK-012 unit tests: ingest prov:Activity shape (AC-001-01/-02).

Mocks the Oxigraph HTTP boundary (`append_graph`) directly -- no docker --
and parses the Turtle handed to it back into an rdflib graph so assertions
are triple-level, never string-matched (same convention as
`test_operations_provenance.py`).
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from rdflib import RDF, Graph, URIRef
from rdflib.namespace import PROV

from weave_backend.operations import ingest_provenance

NAMED_GRAPH = "urn:weave:tenant:t1:ws:w1"
ARTEFACT_IRI = "urn:weave:instances:artefact-abc123"
EXTRACTOR_IRI = "urn:weave:instances:extractor-fixture"
ACTIVITY_IRI = "urn:weave:instances:activity-xyz"

FULL_CONTEXT = {
    "source_system": "SharePoint",
    "owner": "finance-team",
    "date_of_truth": "2026-01-01",
    "sensitivity": "internal",
    "context": "quarterly close process doc",
}


async def _start_and_parse(
    monkeypatch: pytest.MonkeyPatch, *, context: dict[str, str]
) -> Graph:
    append_spy = AsyncMock()
    monkeypatch.setattr(ingest_provenance, "append_graph", append_spy)

    await ingest_provenance.start_ingest_activity(
        NAMED_GRAPH,
        activity_iri=ACTIVITY_IRI,
        extractor_iri=EXTRACTOR_IRI,
        artefact_iri=ARTEFACT_IRI,
        context=context,
    )

    append_spy.assert_called_once()
    turtle = append_spy.call_args.args[1]
    graph = Graph()
    graph.parse(data=turtle, format="turtle")
    return graph


async def test_ingest_activity_records_context_annotations_when_present(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    graph = await _start_and_parse(monkeypatch, context=FULL_CONTEXT)
    activity = URIRef(ACTIVITY_IRI)

    assert (activity, RDF.type, PROV.Activity) in graph
    assert (URIRef(EXTRACTOR_IRI), RDF.type, PROV.SoftwareAgent) in graph
    assert (activity, PROV.wasAssociatedWith, URIRef(EXTRACTOR_IRI)) in graph
    assert (activity, PROV.used, URIRef(ARTEFACT_IRI)) in graph
    assert next(graph.objects(activity, PROV.startedAtTime))

    for key, predicate in ingest_provenance.CONTEXT_PREDICATES.items():
        assert str(next(graph.objects(activity, predicate))) == FULL_CONTEXT[key]


async def test_ingest_activity_is_system_only_when_context_skipped(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    graph = await _start_and_parse(monkeypatch, context={})
    activity = URIRef(ACTIVITY_IRI)

    assert (activity, RDF.type, PROV.Activity) in graph
    assert (activity, PROV.wasAssociatedWith, URIRef(EXTRACTOR_IRI)) in graph
    for predicate in ingest_provenance.CONTEXT_PREDICATES.values():
        assert len(list(graph.objects(activity, predicate))) == 0
