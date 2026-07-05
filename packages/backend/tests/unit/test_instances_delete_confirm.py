"""AC-005-07: the delete-confirm preview must list every dependent edge
(outgoing AND incoming) on the target IRI before the caller commits to the
actual `delete_node` dispatch.
"""

from __future__ import annotations

from rdflib import RDF, Graph, Literal, Namespace

from weave_backend.instances.delete_confirm import dependent_edges

WEAVE = Namespace("https://weave.io/ontology/")
INSTANCES = Namespace("https://weave.io/instances/")


def _graph_with_process_and_actor() -> tuple[Graph, str, str]:
    graph = Graph()
    actor = INSTANCES["actor-1"]
    process = INSTANCES["process-1"]
    graph.add((actor, RDF.type, WEAVE.Actor))
    graph.add((actor, WEAVE.label, Literal("Jess")))
    graph.add((process, RDF.type, WEAVE.Process))
    graph.add((process, WEAVE.label, Literal("Onboarding")))
    graph.add((process, WEAVE.performedBy, actor))
    return graph, str(process), str(actor)


def test_dependent_edges_lists_outgoing_relationships() -> None:
    graph, process_iri, actor_iri = _graph_with_process_and_actor()
    deps = dependent_edges(graph, process_iri)
    assert len(deps.outgoing) == 1
    assert deps.outgoing[0].predicate == str(WEAVE.performedBy)
    assert deps.outgoing[0].other == actor_iri


def test_dependent_edges_lists_incoming_relationships() -> None:
    graph, process_iri, actor_iri = _graph_with_process_and_actor()
    deps = dependent_edges(graph, actor_iri)
    assert len(deps.incoming) == 1
    assert deps.incoming[0].predicate == str(WEAVE.performedBy)
    assert deps.incoming[0].other == process_iri


def test_dependent_edges_excludes_literal_valued_triples() -> None:
    """The `weave:label` triple is a literal, not a relationship -- it must
    never show up as a dependent edge.
    """
    graph, process_iri, _actor_iri = _graph_with_process_and_actor()
    deps = dependent_edges(graph, process_iri)
    predicates = [edge.predicate for edge in deps.outgoing]
    assert str(WEAVE.label) not in predicates


def test_dependent_edges_is_empty_for_an_unreferenced_node() -> None:
    graph = Graph()
    lonely = INSTANCES["lonely-1"]
    graph.add((lonely, RDF.type, WEAVE.Concept))
    graph.add((lonely, WEAVE.label, Literal("Nobody points at me")))
    deps = dependent_edges(graph, str(lonely))
    assert deps.outgoing == []
    assert deps.incoming == []


def test_dependent_edges_ignores_type_triple_as_a_relationship() -> None:
    """`rdf:type` is structural, not a dependent business relationship."""
    graph, process_iri, _actor_iri = _graph_with_process_and_actor()
    deps = dependent_edges(graph, process_iri)
    predicates = [edge.predicate for edge in deps.outgoing]
    assert str(RDF.type) not in predicates
