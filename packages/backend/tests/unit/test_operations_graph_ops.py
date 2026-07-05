"""CE-TASK-001 unit tests: in-memory graph-op application (AC-001-05/-06)."""

from __future__ import annotations

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
