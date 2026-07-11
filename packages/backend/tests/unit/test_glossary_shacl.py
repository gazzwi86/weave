"""CE-V1-TASK-001 unit tests: `GlossaryTermShape` (AC-001-04/-07).

Loads the real `framework.shacl.ttl` file via `validate_graph` (same
pattern as `test_operations_shacl.py`) -- no mock shape fixture, the
committed framework graph *is* the fixture.
"""

from __future__ import annotations

from rdflib import RDF, RDFS, XSD, Graph, Literal, Namespace, URIRef

from weave_backend.operations.shacl import reset_shapes_cache_for_tests, validate_graph

SKOS = Namespace("http://www.w3.org/2004/02/skos/core#")
OWL = Namespace("http://www.w3.org/2002/07/owl#")
WEAVE = Namespace("https://weave.io/ontology/")
EX = Namespace("https://weave.io/instances/")


def setup_function() -> None:
    reset_shapes_cache_for_tests()


def _term(subject: URIRef, label: str, lang: str = "en") -> Graph:
    graph = Graph()
    graph.add((subject, RDF.type, SKOS.Concept))
    graph.add((subject, RDF.type, OWL.Class))
    graph.add((subject, SKOS.prefLabel, Literal(label, lang=lang)))
    graph.add((subject, SKOS.definition, Literal(f"{label} definition", datatype=XSD.string)))
    return graph


def test_broader_target_that_is_not_a_glossary_term_is_a_violation() -> None:
    """AC-001-04: a `skos:broader` target must itself be typed
    `skos:Concept` -- a BPMO `Process` node is not a glossary term.
    """
    graph = _term(EX.term1, "Invoice")
    graph.add((EX.proc1, RDF.type, WEAVE.Process))
    graph.add((EX.proc1, WEAVE.label, Literal("Invoicing", datatype=XSD.string)))
    graph.add((EX.term1, SKOS.broader, EX.proc1))

    results = validate_graph(graph)

    violations = [r for r in results if r.severity == "Violation"]
    assert any(
        v.focus_node == str(EX.term1) and v.path == str(SKOS.broader) for v in violations
    )


def test_broader_target_that_is_a_glossary_term_conforms() -> None:
    graph = _term(EX.term1, "Invoice")
    graph += _term(EX.term2, "Financial Document")
    graph.add((EX.term1, SKOS.broader, EX.term2))

    results = validate_graph(graph)

    assert [r for r in results if r.severity == "Violation"] == []


def test_glossary_term_without_owl_class_type_is_a_violation() -> None:
    """AC-001-01: the punning invariant itself is SHACL-checked -- a
    `skos:Concept` node missing the paired `owl:Class` type fails.
    """
    graph = Graph()
    graph.add((EX.term1, RDF.type, SKOS.Concept))
    graph.add((EX.term1, SKOS.prefLabel, Literal("Invoice", lang="en")))
    graph.add((EX.term1, SKOS.definition, Literal("An invoice.", datatype=XSD.string)))

    results = validate_graph(graph)

    violations = [r for r in results if r.severity == "Violation"]
    assert any(v.focus_node == str(EX.term1) and v.path == str(RDF.type) for v in violations)


def test_duplicate_preflabel_in_same_language_names_the_language_in_the_message() -> None:
    """AC-001-03: a second `skos:prefLabel@en` is a Violation whose message
    names the colliding language tag -- `sh:uniqueLang` alone (no custom
    Python duplicate-counting) rejects it, but the raw pySHACL message
    ("More than one String shares the same Language") never names *which*
    language, so `validate_graph` enriches it from the submitted graph.
    """
    graph = _term(EX.term1, "Invoice", lang="en")
    graph.add((EX.term1, SKOS.prefLabel, Literal("Bill", lang="en")))

    results = validate_graph(graph)

    violations = [r for r in results if r.severity == "Violation"]
    pref_label_violations = [v for v in violations if v.path == str(SKOS.prefLabel)]
    assert pref_label_violations
    assert any("en" in v.message for v in pref_label_violations)


def test_inference_none_does_not_derive_owl_class_from_an_rdfs_subclass_axiom() -> None:
    """AC-001-07 (FR-022): with `inference='none'`, an `rdfs:subClassOf`
    axiom that would let RDFS reasoning *derive* `owl:Class` membership for
    every `skos:Concept` must NOT be applied -- the explicit `owl:Class`
    triple is still required. Proves punning-completeness never rides on
    OWL/RDFS entailment.
    """
    graph = Graph()
    graph.add((EX.term1, RDF.type, SKOS.Concept))
    graph.add((EX.term1, SKOS.prefLabel, Literal("Invoice", lang="en")))
    graph.add((EX.term1, SKOS.definition, Literal("An invoice.", datatype=XSD.string)))
    # Would entail (term1, RDF.type, OWL.Class) under RDFS inference --
    # must be inert under inference='none'.
    graph.add((SKOS.Concept, RDFS.subClassOf, OWL.Class))

    results = validate_graph(graph)

    violations = [r for r in results if r.severity == "Violation"]
    assert any(v.focus_node == str(EX.term1) and v.path == str(RDF.type) for v in violations)
