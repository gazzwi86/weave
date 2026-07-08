"""CE-TASK-001 unit tests: in-memory graph-op application (AC-001-05/-06)."""

from __future__ import annotations

import pytest
from rdflib import RDF, XSD, Graph, Literal, Namespace, URIRef

from weave_backend.operations.graph_ops import apply_operations
from weave_backend.schemas.operations import (
    AddEdgeOp,
    AddNodeOp,
    DeleteEdgeOp,
    DeleteNodeOp,
    UpdateNodeOp,
)

WEAVE = Namespace("https://weave.io/ontology/")


def test_add_node_mints_a_new_iri_and_sets_type_and_label() -> None:
    graph = Graph()

    result = apply_operations(
        graph, [AddNodeOp(op="add_node", ref="n1", kind="Process", label="Invoicing")]
    )

    assert result.applied_count == 1
    iri = URIRef(result.ref_map["n1"])
    assert (iri, RDF.type, WEAVE.Process) in graph
    assert graph.value(iri, WEAVE.label) == Literal("Invoicing", datatype=XSD.string)


def test_add_node_reconciles_case_insensitive_duplicate_label_and_kind() -> None:
    """AC-001-05: same kind + case-insensitive label reuses the existing node."""
    graph = Graph()
    existing = URIRef("https://weave.io/instances/existing-proc")
    graph.add((existing, RDF.type, WEAVE.Process))
    graph.add((existing, WEAVE.label, Literal("Invoicing", datatype=XSD.string)))

    result = apply_operations(
        graph, [AddNodeOp(op="add_node", ref="n1", kind="Process", label="INVOICING")]
    )

    assert result.applied_count == 1
    assert result.ref_map["n1"] == str(existing)
    # No second node was created.
    assert list(graph.subjects(RDF.type, WEAVE.Process)) == [existing]


def test_add_edge_resolves_local_refs_from_the_same_batch() -> None:
    graph = Graph()

    result = apply_operations(
        graph,
        [
            AddNodeOp(op="add_node", ref="actor1", kind="Actor", label="Billing Team"),
            AddNodeOp(op="add_node", ref="proc1", kind="Process", label="Invoicing"),
            AddEdgeOp(
                op="add_edge", subject_ref="proc1", predicate="performedBy", object_ref="actor1"
            ),
        ],
    )

    assert result.applied_count == 3
    proc_iri = URIRef(result.ref_map["proc1"])
    actor_iri = URIRef(result.ref_map["actor1"])
    assert (proc_iri, WEAVE.performedBy, actor_iri) in graph


def test_update_node_retracts_only_named_predicates() -> None:
    """AC-001-06: naming only `label` in an update must leave `weave:colour`
    and `weave:position` (not named) untouched.
    """
    graph = Graph()
    subject = URIRef("https://weave.io/instances/proc1")
    graph.add((subject, RDF.type, WEAVE.Process))
    graph.add((subject, WEAVE.label, Literal("Old label", datatype=XSD.string)))
    graph.add((subject, WEAVE.colour, Literal("blue", datatype=XSD.string)))
    graph.add((subject, WEAVE.position, Literal("12,34", datatype=XSD.string)))

    apply_operations(
        graph, [UpdateNodeOp(op="update_node", iri=str(subject), properties={"label": "New label"})]
    )

    assert graph.value(subject, WEAVE.label) == Literal("New label", datatype=XSD.string)
    assert graph.value(subject, WEAVE.colour) == Literal("blue", datatype=XSD.string)
    assert graph.value(subject, WEAVE.position) == Literal("12,34", datatype=XSD.string)


def test_update_node_replaces_multi_valued_predicate_cleanly() -> None:
    """A second update to the same named predicate retracts the first value,
    not appends -- proves the retract phase runs before the assert phase.
    """
    graph = Graph()
    subject = URIRef("https://weave.io/instances/proc1")
    graph.add((subject, WEAVE.label, Literal("First", datatype=XSD.string)))

    apply_operations(
        graph, [UpdateNodeOp(op="update_node", iri=str(subject), properties={"label": "Second"})]
    )

    assert list(graph.objects(subject, WEAVE.label)) == [Literal("Second", datatype=XSD.string)]


def test_delete_node_removes_all_triples_mentioning_it() -> None:
    graph = Graph()
    subject = URIRef("https://weave.io/instances/proc1")
    other = URIRef("https://weave.io/instances/actor1")
    graph.add((subject, RDF.type, WEAVE.Process))
    graph.add((subject, WEAVE.performedBy, other))
    graph.add((other, WEAVE.manages, subject))

    apply_operations(graph, [DeleteNodeOp(op="delete_node", iri=str(subject))])

    assert list(graph.triples((subject, None, None))) == []
    assert list(graph.triples((None, None, subject))) == []


def test_delete_edge_removes_only_the_named_triple() -> None:
    graph = Graph()
    subject = URIRef("https://weave.io/instances/proc1")
    actor = URIRef("https://weave.io/instances/actor1")
    graph.add((subject, WEAVE.performedBy, actor))
    graph.add((subject, RDF.type, WEAVE.Process))

    apply_operations(
        graph,
        [
            DeleteEdgeOp(
                op="delete_edge", subject=str(subject), predicate="performedBy", object=str(actor)
            )
        ],
    )

    assert (subject, WEAVE.performedBy, actor) not in graph
    assert (subject, RDF.type, WEAVE.Process) in graph


def test_delete_node_of_nonexistent_iri_is_a_no_op_not_an_error() -> None:
    """QA edge case: a `delete_node` naming an IRI with zero triples must
    succeed (idempotent delete), not raise -- `graph.remove` on a pattern
    that matches nothing is a no-op in rdflib, and the batch should still
    report the op as applied.
    """
    graph = Graph()

    result = apply_operations(
        graph, [DeleteNodeOp(op="delete_node", iri="https://weave.io/instances/ghost")]
    )

    assert result.applied_count == 1
    assert len(graph) == 0


def test_add_edge_with_a_ref_never_created_in_the_batch_is_not_silently_dropped() -> None:
    """QA edge case (adversarial): `subject_ref`/`object_ref` that were never
    minted by an `add_node` in the same batch are NOT resolved through
    `ref_map` and NOT rejected -- `_resolve_ref` falls back to treating the
    raw string as an already-existing IRI. A caller's typo in a `ref` name
    therefore produces a dangling edge (a non-IRI-shaped URIRef) instead of
    a loud failure. This documents the current (permissive) behaviour so a
    future change to validate/reject unresolved refs has a test to update
    deliberately, rather than an untested silent gap.
    """
    graph = Graph()

    apply_operations(
        graph,
        [
            AddEdgeOp(
                op="add_edge",
                subject_ref="typo-ref-never-defined",
                predicate="performedBy",
                object_ref="also-never-defined",
            )
        ],
    )

    # No error was raised, and the caller's unresolved ref strings were used
    # verbatim as the edge endpoints -- a dangling, non-namespaced edge.
    dangling = (
        URIRef("typo-ref-never-defined"),
        WEAVE.performedBy,
        URIRef("also-never-defined"),
    )
    assert dangling in graph


def test_add_node_with_empty_kind_or_label_is_rejected_at_the_schema_boundary() -> None:
    """QA edge case: empty `kind`/`label` never reach `apply_operations` --
    `Field(min_length=1)` on `AddNodeOp` rejects them before the pipeline
    ever sees the request (defence-in-depth: schema validation, not just
    graph-op logic, guards against a blank kind/label node)."""
    with pytest.raises(ValueError):
        AddNodeOp(op="add_node", ref="n1", kind="", label="Invoicing")


OWL = Namespace("http://www.w3.org/2002/07/owl#")
RDFS = Namespace("http://www.w3.org/2000/01/rdf-schema#")


def test_add_node_with_absolute_iri_kind_passes_through_unscoped() -> None:
    """TASK-004 AC-004-06: OWL restriction nodes are typed `owl:Restriction`,
    not a WEAVE-namespaced BPMO kind -- an absolute IRI `kind` must not be
    double-prefixed under `weave:`.
    """
    graph = Graph()

    result = apply_operations(
        graph,
        [
            AddNodeOp(
                op="add_node",
                ref="r1",
                kind=str(OWL.Restriction),
                label="hasActivity >= 1",
            )
        ],
    )

    iri = URIRef(result.ref_map["r1"])
    assert (iri, RDF.type, OWL.Restriction) in graph
    assert (iri, RDF.type, WEAVE.Restriction) not in graph


def test_add_node_with_absolute_iri_kind_mints_from_local_name() -> None:
    """An IRI kind (model reused known_class_iris) must mint
    `instances/<localname>-<uuid>`, never `instances/https://...`.
    """
    graph = Graph()

    result = apply_operations(
        graph,
        [
            AddNodeOp(
                op="add_node",
                ref="g1",
                kind="https://weave.io/ontology/Goal",
                label="Banana",
            )
        ],
    )

    minted = result.ref_map["g1"]
    assert minted.startswith("https://weave.io/instances/goal-")
    assert "instances/https" not in minted


def test_add_edge_with_absolute_iri_predicate_passes_through_unscoped() -> None:
    """TASK-004 AC-004-07: `owl:disjointWith` must land as the real OWL
    predicate, not `weave:http://...#disjointWith`.
    """
    graph = Graph()

    apply_operations(
        graph,
        [
            AddNodeOp(op="add_node", ref="p1", kind="Process", label="Onboarding"),
            AddNodeOp(op="add_node", ref="d1", kind="DataAsset", label="Customer Record"),
            AddEdgeOp(
                op="add_edge",
                subject_ref="p1",
                predicate=str(OWL.disjointWith),
                object_ref="d1",
            ),
        ],
    )

    assert any(p == OWL.disjointWith for _, p, _ in graph)


def test_add_node_with_absolute_iri_property_key_passes_through_unscoped() -> None:
    """TASK-004 AC-004-06: `owl:minCardinality` on a restriction node must
    not be forced under the `weave:` namespace.
    """
    graph = Graph()

    result = apply_operations(
        graph,
        [
            AddNodeOp(
                op="add_node",
                ref="r1",
                kind=str(OWL.Restriction),
                label="hasActivity >= 1",
                properties={str(OWL.minCardinality): 1},
            )
        ],
    )

    iri = URIRef(result.ref_map["r1"])
    assert graph.value(iri, OWL.minCardinality) == Literal(1)


def test_update_node_with_absolute_iri_property_key_passes_through_unscoped() -> None:
    graph = Graph()
    subject = URIRef("https://weave.io/instances/restriction-1")
    graph.add((subject, RDF.type, OWL.Restriction))

    apply_operations(
        graph,
        [
            UpdateNodeOp(
                op="update_node",
                iri=str(subject),
                properties={str(OWL.onProperty): str(WEAVE.hasActivity)},
            )
        ],
    )

    assert graph.value(subject, OWL.onProperty) == Literal(
        str(WEAVE.hasActivity), datatype=XSD.string
    )
