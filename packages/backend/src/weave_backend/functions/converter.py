"""CE-FUNCTION-1 (AC-009-03/-07): SHACL-subset -> JSON-Schema converter.

ADR-009 Decision 1: this is a *signature subset* of SHACL, not a general
translator -- one dispatch table (Implementation Hints), and any property
constraint outside that table is rejected at definition time rather than
silently dropped (the exact drift the round-trip contract test exists to
catch).
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from rdflib import Graph, Namespace, URIRef
from rdflib.collection import Collection
from rdflib.namespace import XSD

SH = Namespace("http://www.w3.org/ns/shacl#")


class UnsupportedShaclConstructError(Exception):
    """A signature shape's property uses a SHACL construct outside the
    supported subset. Raised at definition time (never at read time) so a
    converter gap never lets the JSON Schema silently accept nodes the
    SHACL shape would reject.
    """


#: sh:datatype -> (json_type, format|None). Anything else in the same
#: xsd: namespace is out of the signature subset -- fail closed, don't guess.
_DATATYPE_MAP: dict[URIRef, tuple[str, str | None]] = {
    XSD.string: ("string", None),
    XSD.integer: ("integer", None),
    XSD.boolean: ("boolean", None),
    XSD.decimal: ("number", None),
    XSD.double: ("number", None),
    XSD.float: ("number", None),
    XSD.dateTime: ("string", "date-time"),
    XSD.date: ("string", "date"),
}

#: Metadata predicates on a `sh:PropertyShape` that describe/select the
#: constraint rather than constrain a value -- never folded, never flagged
#: unsupported. `sh:minCount`/`sh:maxCount` are handled separately
#: (`_fold_property_shape`) since array-wrapping needs both together.
_STRUCTURAL_PREDICATES = {SH.path, SH.name, SH.message, SH.severity, SH.minCount, SH.maxCount}

_Folder = Callable[[Graph, Any, dict[str, Any]], None]


def _fold_datatype(_graph: Graph, value: Any, fragment: dict[str, Any]) -> None:
    datatype = URIRef(str(value))
    if datatype not in _DATATYPE_MAP:
        raise UnsupportedShaclConstructError(f"sh:datatype {datatype} not in signature subset")
    json_type, fmt = _DATATYPE_MAP[datatype]
    fragment["type"] = json_type
    if fmt is not None:
        fragment["format"] = fmt


def _fold_in(graph: Graph, value: Any, fragment: dict[str, Any]) -> None:
    fragment["enum"] = [str(item) for item in Collection(graph, value)]


def _fold_pattern(_graph: Graph, value: Any, fragment: dict[str, Any]) -> None:
    fragment["pattern"] = str(value)


def _fold_min_length(_graph: Graph, value: Any, fragment: dict[str, Any]) -> None:
    fragment["minLength"] = int(value)


def _fold_max_length(_graph: Graph, value: Any, fragment: dict[str, Any]) -> None:
    fragment["maxLength"] = int(value)


#: The one dispatch table (Implementation Hints) -- table-driven tests
#: mirror this 1:1.
_CONSTRUCT_FOLDERS: dict[URIRef, _Folder] = {
    SH.datatype: _fold_datatype,
    SH["in"]: _fold_in,
    SH.pattern: _fold_pattern,
    SH.minLength: _fold_min_length,
    SH.maxLength: _fold_max_length,
}


def _wrap_cardinality(
    fragment: dict[str, Any], *, min_count: Any, max_count: Any
) -> dict[str, Any]:
    if max_count is None or int(max_count) <= 1:
        return fragment
    wrapped: dict[str, Any] = {"type": "array", "items": fragment}
    if min_count is not None:
        wrapped["minItems"] = int(min_count)
    wrapped["maxItems"] = int(max_count)
    return wrapped


def _fold_property_shape(graph: Graph, prop: URIRef) -> tuple[str, dict[str, Any], bool]:
    path = graph.value(prop, SH.path)
    if path is None:
        raise UnsupportedShaclConstructError(f"property shape {prop} has no sh:path")
    local_name = str(path).rsplit("#", 1)[-1].rsplit("/", 1)[-1]

    fragment: dict[str, Any] = {}
    for _subject, predicate, value in graph.triples((prop, None, None)):
        predicate_iri = URIRef(str(predicate))
        if predicate_iri in _STRUCTURAL_PREDICATES:
            continue
        folder = _CONSTRUCT_FOLDERS.get(predicate_iri)
        if folder is None:
            raise UnsupportedShaclConstructError(
                f"unsupported SHACL construct {predicate} on {prop}"
            )
        folder(graph, value, fragment)

    min_count = graph.value(prop, SH.minCount)
    max_count = graph.value(prop, SH.maxCount)
    fragment = _wrap_cardinality(fragment, min_count=min_count, max_count=max_count)
    required = min_count is not None and int(str(min_count)) >= 1
    return local_name, fragment, required


def to_json_schema(graph: Graph, kind_iri: str, shape_iri: str | None) -> dict[str, Any]:
    """AC-009-01/-03: every param/return schema carries the grounding
    `iri`/`kind` pair regardless of shape; an optional `sh:NodeShape` folds
    supported constraints on top (never silently drops one -- unsupported
    constructs raise `UnsupportedShaclConstructError` instead).
    """
    schema: dict[str, Any] = {
        "type": "object",
        "properties": {
            "iri": {"type": "string", "format": "iri"},
            "kind": {"const": kind_iri},
        },
        "required": ["iri", "kind"],
    }
    if shape_iri is None:
        return schema

    shape = URIRef(shape_iri)
    for prop in graph.objects(shape, SH.property):
        name, fragment, required = _fold_property_shape(graph, URIRef(str(prop)))
        schema["properties"][name] = fragment
        if required:
            schema["required"].append(name)
    return schema
