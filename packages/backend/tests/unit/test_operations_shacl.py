"""CE-TASK-001 unit tests: SHACL evaluator severity handling (AC-001-02/-03).

`validate_graph` must categorise `sh:Violation` separately from
`sh:Warning`/`sh:Info` -- only a Violation blocks a commit.
"""

from __future__ import annotations

from rdflib import RDF, XSD, Graph, Literal, Namespace

from weave_backend.operations.shacl import (
    framework_shape_iris,
    list_rules,
    reset_shapes_cache_for_tests,
    shapes_graph,
    validate_graph,
)

WEAVE = Namespace("https://weave.io/ontology/")
EX = Namespace("https://weave.io/instances/")


def setup_function() -> None:
    reset_shapes_cache_for_tests()


def test_missing_required_label_is_a_violation() -> None:
    graph = Graph()
    graph.add((EX.actor1, RDF.type, WEAVE.Actor))
    graph.add((EX.proc1, RDF.type, WEAVE.Process))
    graph.add((EX.proc1, WEAVE.performedBy, EX.actor1))
    # No weave:label -- must trip ProcessShape's Violation.

    results = validate_graph(graph)

    violations = [r for r in results if r.severity == "Violation"]
    assert any(str(EX.proc1) == v.focus_node for v in violations)


def test_mixed_violation_and_warning_in_same_graph_both_surface() -> None:
    """QA edge case (adversarial): a batch that trips a `sh:Violation` on one
    node AND a `sh:Warning` on an unrelated node must still report both --
    the Violation's presence does not suppress or short-circuit the
    Warning's evaluation. `pipeline._apply_uncached` is what decides a
    422 given the combined list; this test proves `validate_graph` itself
    hands back the full, uncollapsed set."""
    graph = Graph()
    # Process with no `performedBy` -- trips a Violation.
    graph.add((EX.proc1, RDF.type, WEAVE.Process))
    graph.add((EX.proc1, WEAVE.label, Literal("Invoicing", datatype=XSD.string)))
    # Activity with a label but no description -- trips a Warning only.
    graph.add((EX.act1, RDF.type, WEAVE.Activity))
    graph.add((EX.act1, WEAVE.label, Literal("Send invoice", datatype=XSD.string)))

    results = validate_graph(graph)

    severities = {r.severity for r in results}
    assert "Violation" in severities
    assert "Warning" in severities
    violations = [r for r in results if r.severity == "Violation"]
    assert any(str(EX.proc1) == v.focus_node for v in violations)


def test_conforming_graph_has_no_violations() -> None:
    graph = Graph()
    graph.add((EX.actor1, RDF.type, WEAVE.Actor))
    # TASK-004 AC-004-05: ActorShape now requires a label too, same as
    # every other BPMO kind -- a real add_node always sets one.
    graph.add((EX.actor1, WEAVE.label, Literal("Billing Team", datatype=XSD.string)))
    graph.add((EX.proc1, RDF.type, WEAVE.Process))
    graph.add((EX.proc1, WEAVE.label, Literal("Invoicing", datatype=XSD.string)))
    graph.add((EX.proc1, WEAVE.performedBy, EX.actor1))

    results = validate_graph(graph)

    assert [r for r in results if r.severity == "Violation"] == []


def test_missing_activity_description_is_a_warning_not_a_violation() -> None:
    graph = Graph()
    graph.add((EX.act1, RDF.type, WEAVE.Activity))
    graph.add((EX.act1, WEAVE.label, Literal("Do the thing", datatype=XSD.string)))
    # No weave:description -- Warning, not Violation.

    results = validate_graph(graph)

    violations = [r for r in results if r.severity == "Violation"]
    warnings = [r for r in results if r.severity == "Warning"]
    assert violations == []
    assert any(str(EX.act1) == w.focus_node for w in warnings)


def test_goal_without_serving_capability_is_info_not_violation() -> None:
    graph = Graph()
    graph.add((EX.goal1, RDF.type, WEAVE.Goal))
    graph.add((EX.goal1, WEAVE.label, Literal("Grow revenue", datatype=XSD.string)))
    # No weave:servesGoal -- Info, not Violation.

    results = validate_graph(graph)

    violations = [r for r in results if r.severity == "Violation"]
    infos = [r for r in results if r.severity == "Info"]
    assert violations == []
    assert any(str(EX.goal1) == i.focus_node for i in infos)


def test_result_shape_iri_groups_property_violation_under_owning_node_shape() -> None:
    """CE-TASK-006 AC-006-03: a violation on `weave:label` (a blank-node
    `sh:property` child of `weave:ProcessShape`) must report the owning
    NAMED NodeShape as `shape_iri` -- grouping violations under a raw
    blank-node id would never match between two separate queries against
    the shapes graph (the rule catalogue enumeration vs this result)."""
    graph = Graph()
    graph.add((EX.actor1, RDF.type, WEAVE.Actor))
    graph.add((EX.proc1, RDF.type, WEAVE.Process))
    graph.add((EX.proc1, WEAVE.performedBy, EX.actor1))
    # No weave:label -- trips ProcessShape's property-level Violation.

    results = validate_graph(graph)

    violations = [r for r in results if r.severity == "Violation" and r.focus_node == str(EX.proc1)]
    assert violations
    assert all(v.shape_iri == str(WEAVE.ProcessShape) for v in violations)


def test_result_shape_iri_present_for_warning_and_info_severities_too() -> None:
    graph = Graph()
    graph.add((EX.act1, RDF.type, WEAVE.Activity))
    graph.add((EX.act1, WEAVE.label, Literal("Do the thing", datatype=XSD.string)))
    graph.add((EX.goal1, RDF.type, WEAVE.Goal))
    graph.add((EX.goal1, WEAVE.label, Literal("Grow revenue", datatype=XSD.string)))

    results = validate_graph(graph)

    warning = next(r for r in results if r.severity == "Warning" and r.focus_node == str(EX.act1))
    info = next(r for r in results if r.severity == "Info" and r.focus_node == str(EX.goal1))
    assert warning.shape_iri == str(WEAVE.ActivityShape)
    assert info.shape_iri == str(WEAVE.GoalShape)


def test_framework_shape_iris_contains_known_shapes() -> None:
    iris = framework_shape_iris()
    assert str(WEAVE.ProcessShape) in iris
    assert str(WEAVE.ActivityShape) in iris
    assert str(WEAVE.GoalShape) in iris


def test_list_rules_enumerates_every_framework_shape_including_zero_violation_ones() -> None:
    """AC-006-03: the rule list is a catalogue enumeration, not a by-product
    of a violation report -- a shape with zero violations must still
    appear."""
    rules = list_rules(shapes_graph(), tenant_id="t1")

    by_iri = {r.shape_iri: r for r in rules}
    assert str(WEAVE.ProcessShape) in by_iri
    assert str(WEAVE.ActivityShape) in by_iri
    assert str(WEAVE.GoalShape) in by_iri
    assert all(r.origin == "framework" for r in rules)
    # Every framework NodeShape's own required-label property is a
    # Violation -- the rule's own severity is the HIGHEST severity among
    # its property shapes, so this is Violation even for GoalShape, which
    # also carries an Info-severity `servesGoal` property.
    assert by_iri[str(WEAVE.ProcessShape)].severity == "Violation"
    assert by_iri[str(WEAVE.GoalShape)].severity == "Violation"
