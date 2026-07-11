"""CE-TASK-001 unit tests: SHACL evaluator severity handling (AC-001-02/-03).

`validate_graph` must categorise `sh:Violation` separately from
`sh:Warning`/`sh:Info` -- only a Violation blocks a commit.
"""

from __future__ import annotations

from rdflib import RDF, XSD, Graph, Literal, Namespace

from weave_backend.operations.shacl import reset_shapes_cache_for_tests, validate_graph

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


# TASK-003 (EPIC-004): weave:BrandStandard / weave:VoiceRule -- framework
# classes, not BPMO kinds (ADR-022), gated by the same `validate_graph`.


def test_brand_standard_missing_content_type_is_a_violation() -> None:
    """AC-003-02: a BrandStandard missing a required property is rejected."""
    graph = Graph()
    graph.add((EX.brand1, RDF.type, WEAVE.BrandStandard))
    graph.add((EX.brand1, WEAVE.effectiveDate, Literal("2026-07-11", datatype=XSD.date)))
    graph.add((EX.brand1, WEAVE.owner, Literal("Brand Team", datatype=XSD.string)))
    graph.add((EX.brand1, WEAVE.contentBody, Literal('{"primary":"#111"}', datatype=XSD.string)))
    # No weave:contentType -- must trip a Violation.

    results = validate_graph(graph)

    violations = [r for r in results if r.severity == "Violation"]
    assert any(str(EX.brand1) == v.focus_node for v in violations)


def test_brand_standard_without_body_or_source_uri_is_a_violation() -> None:
    """AC-003-02: neither contentBody nor sourceUri present -- sh:or trips."""
    graph = Graph()
    graph.add((EX.brand1, RDF.type, WEAVE.BrandStandard))
    graph.add((EX.brand1, WEAVE.contentType, Literal("color", datatype=XSD.string)))
    graph.add((EX.brand1, WEAVE.effectiveDate, Literal("2026-07-11", datatype=XSD.date)))
    graph.add((EX.brand1, WEAVE.owner, Literal("Brand Team", datatype=XSD.string)))

    results = validate_graph(graph)

    violations = [r for r in results if r.severity == "Violation"]
    assert any(str(EX.brand1) == v.focus_node for v in violations)


def test_brand_standard_with_source_uri_only_conforms() -> None:
    """A logo/asset reference (sourceUri, no contentBody) still satisfies the
    sh:or -- confirms the disjunct isn't accidentally requiring both."""
    graph = Graph()
    graph.add((EX.brand1, RDF.type, WEAVE.BrandStandard))
    graph.add((EX.brand1, WEAVE.contentType, Literal("logo", datatype=XSD.string)))
    graph.add((EX.brand1, WEAVE.effectiveDate, Literal("2026-07-11", datatype=XSD.date)))
    graph.add((EX.brand1, WEAVE.owner, Literal("Brand Team", datatype=XSD.string)))
    graph.add((EX.brand1, WEAVE.sourceUri, Literal("https://cdn.example.com/logo.svg")))

    results = validate_graph(graph)

    assert [r for r in results if r.severity == "Violation"] == []


def test_voice_rule_without_assertion_is_a_violation() -> None:
    """AC-003-05: a human label alone is not a rule -- assertion is
    required, not conventional."""
    graph = Graph()
    graph.add((EX.rule1, RDF.type, WEAVE.VoiceRule))
    graph.add((EX.rule1, WEAVE.ruleId, Literal("no-jargon", datatype=XSD.string)))
    graph.add((EX.rule1, WEAVE.severity, Literal("normal", datatype=XSD.string)))
    # No weave:assertion -- must trip a Violation.

    results = validate_graph(graph)

    violations = [r for r in results if r.severity == "Violation"]
    assert any(str(EX.rule1) == v.focus_node for v in violations)


def test_voice_rule_with_invalid_severity_is_a_violation() -> None:
    graph = Graph()
    graph.add((EX.rule1, RDF.type, WEAVE.VoiceRule))
    graph.add((EX.rule1, WEAVE.ruleId, Literal("no-jargon", datatype=XSD.string)))
    graph.add((EX.rule1, WEAVE.severity, Literal("urgent", datatype=XSD.string)))
    graph.add((EX.rule1, WEAVE.assertion, Literal("max_length(200)", datatype=XSD.string)))

    results = validate_graph(graph)

    violations = [r for r in results if r.severity == "Violation"]
    assert any(str(EX.rule1) == v.focus_node for v in violations)


def test_conforming_voice_rule_has_no_violations() -> None:
    graph = Graph()
    graph.add((EX.rule1, RDF.type, WEAVE.VoiceRule))
    graph.add((EX.rule1, WEAVE.ruleId, Literal("no-jargon", datatype=XSD.string)))
    graph.add((EX.rule1, WEAVE.severity, Literal("critical", datatype=XSD.string)))
    graph.add(
        (EX.rule1, WEAVE.assertion, Literal("forbidden_terms(['synergy'])", datatype=XSD.string))
    )

    results = validate_graph(graph)

    assert [r for r in results if r.severity == "Violation"] == []
