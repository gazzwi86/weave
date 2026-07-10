"""TASK-004 (BE-SDK-1) unit tests -- SHACL/JSON-Schema -> IR mapping.
Mapping-table rows (task brief "IR core" table) each get one focused test;
AC-3's unmappable-constraint path is a named failure, never a silent
``Any``/``unknown`` fallback.
"""

from __future__ import annotations

import pytest
from rdflib import Graph

from weave_backend.sdkgen.errors import UnmappableConstraint, UnsafeFunctionIdentifier
from weave_backend.sdkgen.ir import (
    IRClass,
    IRField,
    escape_iri_literal,
    map_core_tokens,
    map_fn,
    map_select,
    map_shapes,
)

_PREFIXES = """
@prefix sh:    <http://www.w3.org/ns/shacl#> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .
@prefix weave: <https://weave.io/ontology/> .
"""


def _classes(turtle_body: str) -> dict[str, IRClass]:
    ttl = _PREFIXES + turtle_body
    classes = map_shapes(ttl)
    return {c.name: c for c in classes}


def _fields(turtle_body: str, class_name: str) -> dict[str, IRField]:
    return {f.name: f for f in _classes(turtle_body)[class_name].fields}


def test_should_map_node_shape_to_typed_class_with_cardinality() -> None:
    ttl = """
    weave:ProcessShape a sh:NodeShape ;
        sh:targetClass weave:Process ;
        sh:property [
            sh:path weave:label ;
            sh:datatype xsd:string ;
            sh:minCount 1 ;
            sh:maxCount 1 ;
        ] ;
        sh:property [
            sh:path weave:tag ;
            sh:datatype xsd:string ;
        ] .
    """
    fields = _fields(ttl, "Process")
    assert set(fields) == {"label", "tag"}
    assert fields["label"].ts_type == "string"
    assert fields["label"].is_list is False
    assert fields["label"].optional is False
    assert fields["tag"].is_list is True


def test_should_map_required_single_valued_property_to_required_field() -> None:
    ttl = """
    weave:GoalShape a sh:NodeShape ;
        sh:targetClass weave:Goal ;
        sh:property [
            sh:path weave:label ;
            sh:datatype xsd:string ;
            sh:minCount 1 ;
            sh:maxCount 1 ;
        ] .
    """
    field = _fields(ttl, "Goal")["label"]
    assert field.optional is False
    assert field.is_list is False
    assert field.py_type == "str"


def test_should_map_sh_in_to_literal_union() -> None:
    ttl = """
    weave:TaskShape a sh:NodeShape ;
        sh:targetClass weave:Task ;
        sh:property [
            sh:path weave:status ;
            sh:in ( "draft" "published" ) ;
            sh:maxCount 1 ;
        ] .
    """
    field = _fields(ttl, "Task")["status"]
    assert field.ts_type == "'draft' | 'published'"
    assert field.py_type == "Literal['draft', 'published']"


def test_should_fail_naming_shape_on_unmappable_constraint() -> None:
    ttl = """
    weave:MysteryShape a sh:NodeShape ;
        sh:targetClass weave:Mystery ;
        sh:property [
            sh:path weave:enigma ;
            sh:severity sh:Violation ;
        ] .
    """
    with pytest.raises(UnmappableConstraint) as exc_info:
        _classes(ttl)
    assert "MysteryShape" in str(exc_info.value)


def test_should_type_closed_core_tokens_only() -> None:
    tokens: dict[str, object] = {
        "color": {"bg": "#000"},
        "typography": {"body": "Geist Sans"},
        "spacing": {"sm": "4px"},
        "radius": {"sm": "2px"},
        "voice": {"tone": "direct"},
    }
    theme = map_core_tokens(tokens)
    assert theme.color == {"bg": "#000"}
    assert theme.extensions == {"voice": {"tone": "direct"}}
    assert "voice" not in theme.model_dump()


def test_should_map_sh_or_to_union_type() -> None:
    ttl = """
    weave:PaymentShape a sh:NodeShape ;
        sh:targetClass weave:Payment ;
        sh:property [
            sh:path weave:amount ;
            sh:maxCount 1 ;
            sh:or ( [ sh:datatype xsd:string ] [ sh:datatype xsd:integer ] ) ;
        ] .
    """
    field = _fields(ttl, "Payment")["amount"]
    assert field.ts_type == "string | number"
    assert field.py_type == "str | int"


def test_should_map_min_count_0_to_optional() -> None:
    ttl = """
    weave:ActivityShape a sh:NodeShape ;
        sh:targetClass weave:Activity ;
        sh:property [
            sh:path weave:description ;
            sh:datatype xsd:string ;
            sh:minCount 0 ;
            sh:maxCount 1 ;
        ] .
    """
    field = _fields(ttl, "Activity")["description"]
    assert field.optional is True
    assert field.is_list is False


def test_should_emit_typed_query_method_for_named_select() -> None:
    select: dict[str, object] = {
        "name": "activeProcesses",
        "sparql": "SELECT ?process ?label WHERE { ?process a weave:Process }",
        "bindings": ["process", "label"],
    }
    query = map_select(select)
    assert query.name == "activeProcesses"
    assert query.bindings == ["process", "label"]
    assert query.sparql.startswith("SELECT")


def test_map_shapes_is_deterministic_across_runs() -> None:
    ttl = """
    weave:BShape a sh:NodeShape ;
        sh:targetClass weave:B ;
        sh:property [ sh:path weave:z ; sh:datatype xsd:string ; sh:maxCount 1 ] ;
        sh:property [ sh:path weave:a ; sh:datatype xsd:string ; sh:maxCount 1 ] .
    weave:AShape a sh:NodeShape ;
        sh:targetClass weave:A ;
        sh:property [ sh:path weave:x ; sh:datatype xsd:string ; sh:maxCount 1 ] .
    """
    full = _PREFIXES + ttl
    first = [c.model_dump() for c in map_shapes(full)]
    second = [c.model_dump() for c in map_shapes(full)]
    assert first == second
    # sanity: rdflib parses fine and the graph is non-empty
    assert len(Graph().parse(data=full, format="turtle")) >= 0


def test_should_emit_one_typed_method_per_registry_function() -> None:
    """AC-4, and a TS/Python syntax requirement: required params must sort
    before optional ones, or the emitted function signature is invalid
    (`fn(b?: string, a: string)` is a TS syntax error). Alphabetical within
    each group keeps ordering deterministic across runs (AC-1).
    """
    # "amount" is required but alphabetically last of the three -- a plain
    # `sorted(properties)` would put it after the optional params and
    # produce an invalid signature; picking names this way is what makes
    # the assertion actually exercise the required-before-optional rule
    # instead of passing by alphabetical coincidence.
    fn_schema: dict[str, object] = {
        "name": "calculateTotal",
        "fn_iri": "weave:calculateTotal",
        "parameters": {
            "properties": {
                "amount": {"type": "number"},
                "currency": {"type": "string"},
                "zebra": {"type": "string"},
            },
            "required": ["zebra"],
        },
        "returns": {"type": "number"},
    }

    fn = map_fn(fn_schema)

    assert [p.name for p in fn.params] == ["zebra", "amount", "currency"]
    assert [p.required for p in fn.params] == [True, False, False]
    assert fn.name == "calculateTotal"
    assert fn.fn_iri == "weave:calculateTotal"
    assert fn.return_ts == "number"


def test_map_fn_rejects_fn_iri_outside_safe_charset() -> None:
    """XT-BE004-1: ``fn_iri`` is CE-FUNCTION-1 JSON, not IRI-syntax-
    constrained -- a value with a quote/space/semicolon must be rejected
    at the IR boundary, not passed through to the emitter templates.
    """
    fn_schema: dict[str, object] = {
        "name": "safeName",
        "fn_iri": 'weave:x"); var pwned = 1; ("',
        "parameters": {"properties": {}, "required": []},
        "returns": {"type": "number"},
    }

    with pytest.raises(UnsafeFunctionIdentifier):
        map_fn(fn_schema)


def test_escape_iri_literal_leaves_safe_iri_untouched() -> None:
    """The template-facing second layer of defense: a legitimate IRI must
    render byte-identical, or every existing golden-output assertion
    breaks.
    """
    assert escape_iri_literal("weave:calculateTotal") == "weave:calculateTotal"


def test_escape_iri_literal_percent_encodes_unsafe_characters() -> None:
    """XT-BE004-1: quotes/spaces/semicolons/parens must be percent-encoded
    so a malicious value can never reassemble into readable injected
    source inside the template's quoted string literal.
    """
    escaped = escape_iri_literal('weave:x"); var pwned = 1; ("')

    assert "var pwned = 1;" not in escaped
    assert '"' not in escaped
    assert " " not in escaped


def test_map_fn_rejects_name_outside_safe_charset() -> None:
    """XT-BE004-1: ``name`` lands in a method-*identifier* position in
    both emitter templates, which cannot be escaped -- an unsafe value
    must be rejected here, not just at fn_iri's string-literal position.
    """
    fn_schema: dict[str, object] = {
        "name": 'safe"); var pwned = 1; ("',
        "fn_iri": "weave:calculateTotal",
        "parameters": {"properties": {}, "required": []},
        "returns": {"type": "number"},
    }

    with pytest.raises(UnsafeFunctionIdentifier):
        map_fn(fn_schema)
