"""CE-TASK-005 unit tests: NL -> candidate SHACL shape (AC-005-01/-05), and
the raw-SHACL editing path that stays live independent of the AI (AC-005-05,
AC-005-07). Mirrors `test_authoring_nl_parser.py`'s stub-provider pattern.
"""

from __future__ import annotations

import json

import pytest
from rdflib.namespace import SH

from weave_backend.ai.providers import ModelProvider
from weave_backend.authoring.shapes import (
    ShapeGenerationError,
    generate_candidate_shape,
    parse_raw_shape,
    shape_subject_iri,
)


class _StubProvider(ModelProvider):
    def __init__(self, response: str) -> None:
        self._response = response

    def complete(self, model_id: str, prompt: str, **kwargs: object) -> str:
        return self._response


def _candidate_json(*, target_class: str = "Process", path: str = "performedBy") -> str:
    return json.dumps(
        {
            "target_class": target_class,
            "properties": [
                {
                    "path": path,
                    "min_count": 1,
                    "severity": "Violation",
                    "message": "Process must name an owner.",
                }
            ],
        }
    )


def test_generate_candidate_shape_builds_valid_node_shape() -> None:
    provider = _StubProvider(_candidate_json())

    graph = generate_candidate_shape("Every Process must name an owner", provider=provider)

    shapes = list(graph.subjects(predicate=None, object=SH.NodeShape))
    assert len(shapes) == 1
    props = list(graph.objects(shapes[0], SH.property))
    assert len(props) == 1
    assert (props[0], SH.minCount, None) in graph or graph.value(props[0], SH.minCount) is not None


def test_generate_candidate_shape_strips_markdown_fences() -> None:
    provider = _StubProvider(f"```json\n{_candidate_json()}\n```")

    graph = generate_candidate_shape("Every Process must name an owner", provider=provider)

    assert len(list(graph.subjects(predicate=None, object=SH.NodeShape))) == 1


def test_generate_candidate_shape_rejects_invalid_json() -> None:
    provider = _StubProvider("not json")

    with pytest.raises(ShapeGenerationError):
        generate_candidate_shape("garbage in", provider=provider)


def test_generate_candidate_shape_rejects_unknown_bpmo_kind() -> None:
    provider = _StubProvider(_candidate_json(target_class="NotARealKind"))

    with pytest.raises(ShapeGenerationError):
        generate_candidate_shape("rule about a fake kind", provider=provider)


def test_generate_candidate_shape_rejects_unknown_predicate() -> None:
    provider = _StubProvider(_candidate_json(path="totallyMadeUpPredicate"))

    with pytest.raises(ShapeGenerationError):
        generate_candidate_shape("rule about a fake predicate", provider=provider)


def test_generate_candidate_shape_rejects_missing_required_fields() -> None:
    provider = _StubProvider(json.dumps({"target_class": "Process"}))

    with pytest.raises(ShapeGenerationError):
        generate_candidate_shape("incomplete rule", provider=provider)


_VALID_TURTLE = """
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix weave: <https://weave.io/ontology/> .
@prefix ex: <https://weave.io/instances/> .

ex:shape-owner-required a sh:NodeShape ;
    sh:targetClass weave:Process ;
    sh:property [
        sh:path weave:performedBy ;
        sh:minCount 1 ;
        sh:severity sh:Violation ;
        sh:message "Process must name an owner." ;
    ] .
"""


def test_parse_raw_shape_accepts_valid_turtle() -> None:
    graph = parse_raw_shape(_VALID_TURTLE)

    assert shape_subject_iri(graph) == "https://weave.io/instances/shape-owner-required"


def test_parse_raw_shape_rejects_invalid_turtle_syntax() -> None:
    with pytest.raises(ShapeGenerationError):
        parse_raw_shape("this is not { turtle at all")


def test_parse_raw_shape_rejects_unknown_predicate() -> None:
    bad = _VALID_TURTLE.replace("weave:performedBy", "weave:totallyMadeUpPredicate")

    with pytest.raises(ShapeGenerationError):
        parse_raw_shape(bad)


def test_parse_raw_shape_rejects_shape_with_no_target() -> None:
    no_target = """
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix ex: <https://weave.io/instances/> .

    ex:shape-no-target a sh:NodeShape ;
        sh:property [ sh:path ex:whatever ] .
    """

    with pytest.raises(ShapeGenerationError):
        parse_raw_shape(no_target)


def test_shape_subject_iri_rejects_blank_node_top_shape() -> None:
    blank_shape = """
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix weave: <https://weave.io/ontology/> .

    [] a sh:NodeShape ;
        sh:targetClass weave:Process ;
        sh:property [ sh:path weave:performedBy ] .
    """
    graph = parse_raw_shape(blank_shape)

    with pytest.raises(ShapeGenerationError):
        shape_subject_iri(graph)
