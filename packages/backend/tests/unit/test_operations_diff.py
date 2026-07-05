"""CE-TASK-002 unit tests: server-computed diff (CE-DIFF-1, AC-002-12/-13).

Pure `rdflib.Graph` in/out -- no Oxigraph, no docker. `compute_diff` (the
Oxigraph-fetching wrapper) is covered by the docker-marked integration
suite instead.
"""

from __future__ import annotations

from rdflib import Graph
from weave_backend.operations.diff import diff_graphs

WEAVE = "https://weave.io/ontology/"
INST = "https://weave.io/instances/"


def _graph(*triples: str) -> Graph:
    graph = Graph()
    if triples:
        graph.parse(data="\n".join(triples), format="turtle")
    return graph


def test_diff_is_empty_when_from_and_to_are_identical() -> None:
    turtle = f'<{INST}p1> <{WEAVE}label> "Invoicing" .'
    graph = _graph(turtle)

    result = diff_graphs(graph, graph)

    assert result.added == []
    assert result.removed == []
    assert result.modified == []


def test_added_node_is_reported_as_added_only() -> None:
    before = _graph()
    after = _graph(f'<{INST}p1> <{WEAVE}label> "Invoicing" .')

    result = diff_graphs(before, after)

    assert len(result.added) == 1
    assert result.added[0].subject == f"{INST}p1"
    assert result.removed == []
    assert result.modified == []


def test_removed_node_is_reported_as_removed_only() -> None:
    before = _graph(f'<{INST}p1> <{WEAVE}label> "Invoicing" .')
    after = _graph()

    result = diff_graphs(before, after)

    assert result.added == []
    assert len(result.removed) == 1
    assert result.modified == []


def test_changed_single_valued_property_is_reported_as_modified_not_added_and_removed() -> None:
    before = _graph(f'<{INST}p1> <{WEAVE}label> "Invoicing" .')
    after = _graph(f'<{INST}p1> <{WEAVE}label> "Invoicing (renamed)" .')

    result = diff_graphs(before, after)

    assert result.added == []
    assert result.removed == []
    assert len(result.modified) == 1
    assert result.modified[0].subject == f"{INST}p1"
    assert result.modified[0].predicate == f"{WEAVE}label"
    assert result.modified[0].before == "Invoicing"
    assert result.modified[0].after == "Invoicing (renamed)"


def test_changed_edge_object_is_reported_as_modified() -> None:
    """AC-002-12: modified must include EDGE modifications, not just literal
    node properties -- a `performedBy` edge's object swapping actor is the
    same "same subject+predicate, differing object" shape.
    """
    before = _graph(f'<{INST}p1> <{WEAVE}performedBy> <{INST}a1> .')
    after = _graph(f'<{INST}p1> <{WEAVE}performedBy> <{INST}a2> .')

    result = diff_graphs(before, after)

    assert result.added == []
    assert result.removed == []
    assert len(result.modified) == 1
    assert result.modified[0].before == f"{INST}a1"
    assert result.modified[0].after == f"{INST}a2"
