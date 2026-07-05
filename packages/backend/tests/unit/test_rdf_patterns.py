"""CE-TASK-007 unit tests: the `coverage_gap_process` named stored query
(AC-007-12/-13) -- pure SPARQL-logic proof against an in-memory rdflib
`Dataset`, no Oxigraph/docker required. The query text itself is exactly
what `GET /api/sparql?pattern=coverage_gap_process` sends to Oxigraph (see
`routers/sparql.py`), so this is a real proof of the query's correctness,
not a mock.
"""

from __future__ import annotations

from typing import cast

from rdflib import RDF, Dataset, Literal, Namespace, URIRef
from rdflib.query import ResultRow
from rdflib.term import Node

from weave_backend.rdf.patterns import NAMED_PATTERNS, ZERO_ROW_MESSAGES

WEAVE = Namespace("https://weave.io/ontology/")
GRAPH = URIRef("https://weave.io/graphs/test")


def _dataset_with(*triples: tuple[Node, Node, Node]) -> Dataset:
    ds = Dataset()
    graph = ds.graph(GRAPH)
    for triple in triples:
        graph.add(triple)
    return ds


def test_coverage_gap_process_flags_a_step_with_no_actor_or_system() -> None:
    process = URIRef("https://weave.io/instances/process-1")
    step = URIRef("https://weave.io/instances/step-1")
    ds = _dataset_with(
        (process, RDF.type, WEAVE.Process),
        (process, WEAVE.hasStep, step),
        (step, WEAVE.label, Literal("Approve invoice", datatype="http://www.w3.org/2001/XMLSchema#string")),
    )

    rows = list(ds.query(NAMED_PATTERNS["coverage_gap_process"]))

    assert len(rows) == 1
    row = cast(ResultRow, rows[0]).asdict()
    assert str(row["process_iri"]) == str(process)
    assert str(row["step_iri"]) == str(step)
    assert str(row["step_label"]) == "Approve invoice"
    assert str(row["gap_reason"]) == "No actor or system assigned"


def test_coverage_gap_process_returns_no_rows_when_every_step_is_covered() -> None:
    process = URIRef("https://weave.io/instances/process-2")
    step = URIRef("https://weave.io/instances/step-2")
    actor = URIRef("https://weave.io/instances/actor-1")
    ds = _dataset_with(
        (process, RDF.type, WEAVE.Process),
        (process, WEAVE.hasStep, step),
        (step, WEAVE.label, Literal("Ship order", datatype="http://www.w3.org/2001/XMLSchema#string")),
        (step, WEAVE.performedBy, actor),
    )

    rows = list(ds.query(NAMED_PATTERNS["coverage_gap_process"]))

    assert rows == []


def test_coverage_gap_process_step_covered_by_system_is_not_a_gap() -> None:
    """`supportedBy` (system coverage) satisfies the FILTER NOT EXISTS just
    as `performedBy` (actor coverage) does -- either is sufficient.
    """
    process = URIRef("https://weave.io/instances/process-3")
    step = URIRef("https://weave.io/instances/step-3")
    system = URIRef("https://weave.io/instances/system-1")
    ds = _dataset_with(
        (process, RDF.type, WEAVE.Process),
        (process, WEAVE.hasStep, step),
        (step, WEAVE.label, Literal("Reconcile", datatype="http://www.w3.org/2001/XMLSchema#string")),
        (step, WEAVE.supportedBy, system),
    )

    rows = list(ds.query(NAMED_PATTERNS["coverage_gap_process"]))

    assert rows == []


def test_zero_row_messages_has_a_coverage_gap_entry() -> None:
    assert ZERO_ROW_MESSAGES["coverage_gap_process"] == "No coverage gaps found"
