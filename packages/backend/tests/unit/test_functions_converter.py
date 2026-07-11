"""CE-V1-TASK-009 AC-009-03: SHACL-subset -> JSON-Schema converter.

Table-driven per supported construct (sh:datatype, sh:minCount/maxCount,
sh:in, sh:pattern, sh:min/maxLength); any other constraint predicate on a
signature's property shape is rejected (422 at definition time) rather than
silently dropped -- the exact drift the round-trip contract test exists to
catch (ADR-009 drift mitigation).
"""

from __future__ import annotations

import pytest
from rdflib import RDF, XSD, Graph, Literal, Namespace, URIRef
from rdflib.collection import Collection

from weave_backend.functions.converter import UnsupportedShaclConstructError, to_json_schema

WEAVE = Namespace("https://weave.io/ontology/")
SH = Namespace("http://www.w3.org/ns/shacl#")

KIND_IRI = "https://weave.io/ontology/DataAsset"


def _base_shape(graph: Graph, path: str) -> tuple[URIRef, URIRef]:
    shape = URIRef("https://weave.io/instances/shape-1")
    prop = URIRef("https://weave.io/instances/prop-1")
    graph.add((shape, RDF.type, SH.NodeShape))
    graph.add((shape, SH.property, prop))
    graph.add((prop, SH.path, URIRef(path)))
    return shape, prop


def test_no_shape_iri_returns_base_schema_only() -> None:
    graph = Graph()

    schema = to_json_schema(graph, KIND_IRI, None)

    assert schema == {
        "type": "object",
        "properties": {
            "iri": {"type": "string", "format": "iri"},
            "kind": {"const": KIND_IRI},
        },
        "required": ["iri", "kind"],
    }


@pytest.mark.parametrize(
    ("xsd_datatype", "expected_fragment"),
    [
        (XSD.string, {"type": "string"}),
        (XSD.integer, {"type": "integer"}),
        (XSD.boolean, {"type": "boolean"}),
        (XSD.decimal, {"type": "number"}),
        (XSD.dateTime, {"type": "string", "format": "date-time"}),
    ],
)
def test_datatype_construct_maps_to_json_schema_type(
    xsd_datatype: URIRef, expected_fragment: dict[str, str]
) -> None:
    graph = Graph()
    shape, prop = _base_shape(graph, "https://weave.io/ontology/status")
    graph.add((prop, SH.datatype, xsd_datatype))

    schema = to_json_schema(graph, KIND_IRI, str(shape))

    assert schema["properties"]["status"] == expected_fragment


def test_mincount_marks_property_required() -> None:
    graph = Graph()
    shape, prop = _base_shape(graph, "https://weave.io/ontology/status")
    graph.add((prop, SH.datatype, XSD.string))
    graph.add((prop, SH.minCount, Literal(1)))

    schema = to_json_schema(graph, KIND_IRI, str(shape))

    assert "status" in schema["required"]


def test_maxcount_greater_than_one_wraps_as_array_with_bounds() -> None:
    graph = Graph()
    shape, prop = _base_shape(graph, "https://weave.io/ontology/tag")
    graph.add((prop, SH.datatype, XSD.string))
    graph.add((prop, SH.minCount, Literal(1)))
    graph.add((prop, SH.maxCount, Literal(3)))

    schema = to_json_schema(graph, KIND_IRI, str(shape))

    assert schema["properties"]["tag"] == {
        "type": "array",
        "items": {"type": "string"},
        "minItems": 1,
        "maxItems": 3,
    }


def test_in_construct_maps_to_enum() -> None:
    graph = Graph()
    shape, prop = _base_shape(graph, "https://weave.io/ontology/status")
    list_node = URIRef("https://weave.io/instances/list-1")
    Collection(graph, list_node, [Literal("active"), Literal("pending")])
    graph.add((prop, SH["in"], list_node))

    schema = to_json_schema(graph, KIND_IRI, str(shape))

    assert schema["properties"]["status"]["enum"] == ["active", "pending"]


def test_pattern_construct_maps_to_regex_pattern() -> None:
    graph = Graph()
    shape, prop = _base_shape(graph, "https://weave.io/ontology/sku")
    graph.add((prop, SH.datatype, XSD.string))
    graph.add((prop, SH.pattern, Literal("^[A-Z]{3}-\\d+$")))

    schema = to_json_schema(graph, KIND_IRI, str(shape))

    assert schema["properties"]["sku"]["pattern"] == "^[A-Z]{3}-\\d+$"


def test_min_and_max_length_construct_maps_to_length_bounds() -> None:
    graph = Graph()
    shape, prop = _base_shape(graph, "https://weave.io/ontology/sku")
    graph.add((prop, SH.datatype, XSD.string))
    graph.add((prop, SH.minLength, Literal(3)))
    graph.add((prop, SH.maxLength, Literal(12)))

    schema = to_json_schema(graph, KIND_IRI, str(shape))

    assert schema["properties"]["sku"]["minLength"] == 3
    assert schema["properties"]["sku"]["maxLength"] == 12


def test_unsupported_construct_on_a_signature_shape_raises_422_at_definition_time() -> None:
    """AC-009-03: reject early, never silently drop a constraint from the
    projection -- `sh:class` is real SHACL but outside the signature subset
    this converter supports (ADR-009: not a general SHACL->JSON-Schema
    translator).
    """
    graph = Graph()
    shape, prop = _base_shape(graph, "https://weave.io/ontology/owner")
    graph.add((prop, SH["class"], WEAVE.Actor))

    with pytest.raises(UnsupportedShaclConstructError):
        to_json_schema(graph, KIND_IRI, str(shape))
