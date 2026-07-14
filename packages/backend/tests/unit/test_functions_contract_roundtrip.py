"""CE-V1-TASK-009 AC-009-07: round-trip contract test -- the JSON Schema
`functions/converter.to_json_schema` derives from a `weave:Function`
parameter's `sh:NodeShape` must accept *exactly* the same node set the
SHACL shape itself accepts. Cross-checked against `pyshacl` (the same
engine CE-WRITE-1 validates with, `operations/shacl.py`) rather than just
asserting the JSON Schema's own opinion, so a converter gap that silently
drops a constraint (ADR-009's named drift risk) shows up as a genuine
verdict mismatch, not merely a hand-written expectation.
"""

from __future__ import annotations

from typing import Any

import jsonschema
import pytest
from pyshacl import validate as shacl_validate
from rdflib import RDF, XSD, Graph, Literal, Namespace, URIRef

from weave_backend.functions.converter import to_json_schema

WEAVE = Namespace("https://weave.io/ontology/")
SH = Namespace("http://www.w3.org/ns/shacl#")

FN = URIRef("https://weave.io/instances/fn-reorderStock")
PARAM = URIRef("https://weave.io/instances/param-qty")
SHAPE = URIRef("https://weave.io/ontology/shapes/QtyShape")
PROP = URIRef("https://weave.io/ontology/shapes/QtyShape-value")
QTY_KIND = "https://weave.io/ontology/Quantity"


def _seeded_function_graph() -> Graph:
    """A `weave:Function` with one parameter whose `sh:NodeShape` requires
    `weave:value` to be an `xsd:integer`, length-free -- narrow enough for a
    single-constraint round trip, wide enough to exercise `sh:datatype` +
    `sh:minCount`/`sh:maxCount` together (the pseudocode's two named
    dispatch-table entries most likely to drift independently).
    """
    graph = Graph()
    graph.add((FN, RDF.type, WEAVE.Function))
    graph.add((FN, WEAVE.label, Literal("reorderStock", datatype=XSD.string)))
    graph.add((FN, WEAVE.boundKind, WEAVE.Activity))
    graph.add((FN, WEAVE.hasParameter, PARAM))
    graph.add((PARAM, WEAVE.paramOrder, Literal(0)))
    graph.add((PARAM, WEAVE.paramKind, Literal(QTY_KIND, datatype=XSD.string)))
    graph.add((PARAM, WEAVE.paramShape, Literal(str(SHAPE), datatype=XSD.string)))
    graph.add((SHAPE, RDF.type, SH.NodeShape))
    graph.add((SHAPE, SH.property, PROP))
    graph.add((PROP, SH.path, WEAVE.value))
    graph.add((PROP, SH.datatype, XSD.integer))
    graph.add((PROP, SH.minCount, Literal(1)))
    graph.add((PROP, SH.maxCount, Literal(1)))
    return graph


def _derived_schema() -> dict[str, Any]:
    graph = _seeded_function_graph()
    return to_json_schema(graph, QTY_KIND, str(SHAPE))


def _shacl_conforms(*, value_triple: tuple[URIRef, URIRef, Literal] | None) -> bool:
    """Runs the *same* shape (as a standalone SHACL shapes graph, `sh:targetNode`
    scoped to one focus node) against a single data node, mirroring
    `operations/shacl.py`'s `inference='none'` call exactly.
    """
    shapes_graph = Graph()
    node = URIRef("https://weave.io/instances/param-qty-fixture")
    shapes_graph.add((SHAPE, RDF.type, SH.NodeShape))
    shapes_graph.add((SHAPE, SH.targetNode, node))
    shapes_graph.add((SHAPE, SH.property, PROP))
    shapes_graph.add((PROP, SH.path, WEAVE.value))
    shapes_graph.add((PROP, SH.datatype, XSD.integer))
    shapes_graph.add((PROP, SH.minCount, Literal(1)))
    shapes_graph.add((PROP, SH.maxCount, Literal(1)))

    data_graph = Graph()
    if value_triple is not None:
        data_graph.add(value_triple)

    conforms, _results_graph, _text = shacl_validate(
        data_graph, shacl_graph=shapes_graph, inference="none"
    )
    return bool(conforms)


def _fixture_node() -> URIRef:
    return URIRef("https://weave.io/instances/param-qty-fixture")


def test_positive_fixture_is_accepted_by_both_json_schema_and_shacl() -> None:
    schema = _derived_schema()
    instance = {"iri": str(_fixture_node()), "kind": QTY_KIND, "value": 5}

    jsonschema.validate(instance, schema)  # must not raise
    assert _shacl_conforms(value_triple=(_fixture_node(), WEAVE.value, Literal(5))) is True


def test_negative_fixture_missing_required_value_is_rejected_by_both() -> None:
    schema = _derived_schema()
    instance = {"iri": str(_fixture_node()), "kind": QTY_KIND}

    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(instance, schema)
    assert _shacl_conforms(value_triple=None) is False


def test_negative_fixture_wrong_datatype_is_rejected_by_both() -> None:
    schema = _derived_schema()
    instance = {"iri": str(_fixture_node()), "kind": QTY_KIND, "value": "not-an-integer"}

    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(instance, schema)
    assert (
        _shacl_conforms(value_triple=(_fixture_node(), WEAVE.value, Literal("not-an-integer")))
        is False
    )


def test_grounding_only_param_with_no_shape_accepts_iri_and_kind_alone() -> None:
    """A param with no `paramShape` (grounding-only) derives the base
    `{iri, kind}` schema (converter's degenerate case) -- any extra field on
    the node is still accepted (JSON Schema has no `additionalProperties`
    restriction here, matching SHACL's own open-world default).
    """
    graph = _seeded_function_graph()
    schema = to_json_schema(graph, "https://weave.io/ontology/Activity", None)

    jsonschema.validate(
        {"iri": "https://weave.io/instances/actor-1", "kind": "https://weave.io/ontology/Activity"},
        schema,
    )
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate({"kind": "https://weave.io/ontology/Activity"}, schema)
