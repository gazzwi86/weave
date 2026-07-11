"""TASK-010 (E7-S4, ADR-013 M2 descope) unit tests: the
`authority()`/`escalation()`/`coverage_gap()`/competency-question query
builders -- pure SPARQL-logic proofs against an in-memory rdflib `Dataset`,
same style as `test_rdf_patterns.py` (no Oxigraph/docker required).
"""

from __future__ import annotations

from typing import cast

import pytest
from rdflib import RDF, Dataset, Namespace, URIRef
from rdflib.query import ResultRow
from rdflib.term import Node

from weave_backend.rdf.agent_grounding import (
    COMPETENCY_QUESTIONS_FRAMEWORK,
    InvalidActionError,
    InvalidIriError,
    InvalidLinkNameError,
    authority_query,
    coverage_gap_query,
    escalation_query,
)

WEAVE = Namespace("https://weave.io/ontology/")
GRAPH = URIRef("https://weave.io/graphs/test")

ACTOR = "https://weave.io/instances/agent-1"
TARGET = "https://weave.io/instances/process-1"
PROCESS = "https://weave.io/instances/process-2"


def _dataset_with(*triples: tuple[Node, Node, Node]) -> Dataset:
    ds = Dataset()
    graph = ds.graph(GRAPH)
    for triple in triples:
        graph.add(triple)
    return ds


def _rows(ds: Dataset, query: str) -> list[dict[str, object]]:
    return [cast("dict[str, object]", cast(ResultRow, row).asdict()) for row in ds.query(query)]


class TestAuthorityQuery:
    def test_rejects_action_outside_the_base_link_allowlist(self) -> None:
        with pytest.raises(InvalidActionError):
            authority_query(ACTOR, "deletesEverything", TARGET)

    def test_rejects_an_unsafe_actor_iri(self) -> None:
        with pytest.raises(InvalidIriError):
            authority_query('"; DROP GRAPH <urn:x> } #', "performedBy", TARGET)

    def test_modelled_link_returns_one_row_with_no_missing_link(self) -> None:
        ds = _dataset_with(
            (URIRef(TARGET), WEAVE.performedBy, URIRef(ACTOR)),
        )
        rows = _rows(ds, authority_query(ACTOR, "performedBy", TARGET))

        assert len(rows) == 1
        assert str(rows[0]["entity_iri"]) == TARGET
        assert str(rows[0]["source"]) == "modelled"
        assert rows[0].get("missing_link") is None

    def test_absent_link_returns_one_coverage_gap_row(self) -> None:
        ds = _dataset_with((URIRef(TARGET), RDF.type, WEAVE.Process))
        rows = _rows(ds, authority_query(ACTOR, "performedBy", TARGET))

        assert len(rows) == 1
        assert str(rows[0]["entity_iri"]) == TARGET
        assert str(rows[0]["missing_link"]) == "performedBy"
        assert str(rows[0]["source"]) == "coverage_gap"


class TestEscalationQuery:
    def test_rejects_an_unsafe_process_iri(self) -> None:
        with pytest.raises(InvalidIriError):
            escalation_query("not an iri")

    def test_process_with_performed_by_returns_the_actor(self) -> None:
        ds = _dataset_with((URIRef(PROCESS), WEAVE.performedBy, URIRef(ACTOR)))
        rows = _rows(ds, escalation_query(PROCESS))

        assert len(rows) == 1
        assert str(rows[0]["actor_iri"]) == ACTOR
        assert rows[0].get("missing_link") is None

    def test_process_with_no_performed_by_returns_a_coverage_gap_row(self) -> None:
        ds = _dataset_with((URIRef(PROCESS), RDF.type, WEAVE.Process))
        rows = _rows(ds, escalation_query(PROCESS))

        assert len(rows) == 1
        assert rows[0].get("actor_iri") is None
        assert str(rows[0]["missing_link"]) == "performedBy"


class TestCoverageGapQuery:
    def test_rejects_a_non_identifier_kind(self) -> None:
        with pytest.raises(InvalidLinkNameError):
            coverage_gap_query("Process; DROP", ["performedBy"])

    def test_rejects_an_empty_required_links_list(self) -> None:
        with pytest.raises(InvalidLinkNameError):
            coverage_gap_query("Process", [])

    def test_default_invocation_flags_each_missing_link_as_its_own_row(self) -> None:
        process = URIRef("https://weave.io/instances/process-3")
        ds = _dataset_with((process, RDF.type, WEAVE.Process))

        rows = _rows(ds, coverage_gap_query("Process", ["performedBy", "governedBy"]))

        missing = {str(row["missing_link"]) for row in rows}
        assert missing == {"performedBy", "governedBy"}
        assert all(str(row["entity_iri"]) == str(process) for row in rows)

    def test_a_link_that_is_present_is_not_flagged(self) -> None:
        process = URIRef("https://weave.io/instances/process-4")
        actor = URIRef("https://weave.io/instances/actor-9")
        ds = _dataset_with(
            (process, RDF.type, WEAVE.Process),
            (process, WEAVE.performedBy, actor),
        )

        rows = _rows(ds, coverage_gap_query("Process", ["performedBy", "governedBy"]))

        missing = {str(row["missing_link"]) for row in rows}
        assert missing == {"governedBy"}


class TestCompetencyQuestionsFramework:
    def test_returns_a_row_per_relation_present_in_the_graph(self) -> None:
        process = URIRef("https://weave.io/instances/process-5")
        asset = URIRef("https://weave.io/instances/asset-1")
        actor = URIRef("https://weave.io/instances/actor-1")
        policy = URIRef("https://weave.io/instances/policy-1")
        ds = _dataset_with(
            (process, WEAVE.consumes, asset),
            (process, WEAVE.produces, asset),
            (process, WEAVE.performedBy, actor),
            (process, WEAVE.governedBy, policy),
        )

        rows = _rows(ds, COMPETENCY_QUESTIONS_FRAMEWORK)

        relations = {str(row["relation"]) for row in rows}
        assert relations == {"consumes", "produces", "performedBy", "governedBy"}
