"""Applies CE-WRITE-1 `Op`s to an in-memory rdflib `Graph` (AC-001-05/-06).

All ops in a batch apply to the same graph in order; SHACL validates the
result afterwards (never interleaved -- see `shacl.py`).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from rdflib import RDF, XSD, Graph, Literal, Namespace, URIRef

from weave_backend.schemas.operations import (
    AddEdgeOp,
    AddNodeOp,
    DeleteEdgeOp,
    DeleteNodeOp,
    Op,
    UpdateNodeOp,
)

WEAVE = Namespace("https://weave.io/ontology/")
INSTANCES = Namespace("https://weave.io/instances/")


def _expand(name: str) -> URIRef:
    """`kind`/`predicate`/property-key values are short BPMO-scoped names by
    default and stay under the `weave:` namespace (unchanged behaviour). A
    value that is already an absolute IRI -- OWL/RDFS vocabulary needed for
    restriction/disjointness authoring, TASK-004 AC-004-06/-07 -- passes
    through untouched instead of being double-prefixed.
    """
    if "://" in name:
        return URIRef(name)
    return WEAVE[name]


@dataclass
class ApplyResult:
    ref_map: dict[str, str] = field(default_factory=dict)
    applied_count: int = 0


def _to_literal(value: Any) -> Any:
    """`rdflib.Literal(str)` does not auto-infer `xsd:string` (unlike
    int/float/bool, which do) -- so string values need the datatype set
    explicitly to satisfy `sh:datatype xsd:string` shape constraints.

    CE-TASK-001 AC-001-02: a `{"value": ..., "lang": ...}` dict is the
    language-tagged-literal marker (`skos:prefLabel`) -- RDF gives a
    language-tagged literal `rdf:langString` automatically, so no
    `sh:datatype` is set here for it.
    """
    if isinstance(value, dict) and "value" in value and "lang" in value:
        return Literal(value["value"], lang=value["lang"])
    if isinstance(value, str):
        return Literal(value, datatype=XSD.string)
    return Literal(value)


def find_existing_by_label_kind(graph: Graph, kind: str, label: str) -> URIRef | None:
    """AC-001-05: case-insensitive label+kind match reuses the existing node.

    Public (CE-TASK-005 AC-005-04): the instances router calls this same
    lookup itself, *before* dispatching to CE-WRITE-1, so it can offer a
    "this already exists, edit instead?" HITL response rather than silently
    landing in the auto-merge branch below.
    """
    kind_class = _expand(kind)
    target = label.casefold()
    for subject in graph.subjects(RDF.type, kind_class):
        existing_label = graph.value(subject, WEAVE.label)
        if existing_label is not None and str(existing_label).casefold() == target:
            return URIRef(str(subject))
    return None


def _apply_add_node(graph: Graph, op: AddNodeOp, ref_map: dict[str, str]) -> None:
    existing = find_existing_by_label_kind(graph, op.kind, op.label)
    if existing is not None:
        ref_map[op.ref] = str(existing)
        return
    # A kind may arrive as a full class IRI (callers are told to reuse
    # known_class_iris) -- mint from its local name, never the whole IRI,
    # or the instance IRI double-prefixes (instances/https://...).
    kind_local = op.kind.rsplit("/", 1)[-1].rsplit("#", 1)[-1]
    subject = INSTANCES[f"{kind_local.lower()}-{uuid4().hex}"]
    graph.add((subject, RDF.type, _expand(op.kind)))
    for extra_type in op.additional_types:
        graph.add((subject, RDF.type, _expand(extra_type)))
    graph.add((subject, WEAVE.label, _to_literal(op.label)))
    for key, value in op.properties.items():
        predicate = _expand(key)
        values = value if isinstance(value, list) else [value]
        for item in values:
            graph.add((subject, predicate, _to_literal(item)))
    ref_map[op.ref] = str(subject)


def _resolve_ref(ref_map: dict[str, str], value: str) -> URIRef:
    return URIRef(ref_map.get(value, value))


def _apply_add_edge(graph: Graph, op: AddEdgeOp, ref_map: dict[str, str]) -> None:
    subject = _resolve_ref(ref_map, op.subject_ref)
    obj = _resolve_ref(ref_map, op.object_ref)
    graph.add((subject, _expand(op.predicate), obj))


def _apply_update_node(graph: Graph, op: UpdateNodeOp) -> None:
    """Retracts only the named predicates, then asserts the new values --
    every other triple on the subject (position, colour, etc.) is left
    untouched (AC-001-06).
    """
    subject = URIRef(op.iri)
    for key, value in op.properties.items():
        predicate = _expand(key)
        graph.remove((subject, predicate, None))
        graph.add((subject, predicate, _to_literal(value)))


def _apply_delete_node(graph: Graph, op: DeleteNodeOp) -> None:
    subject = URIRef(op.iri)
    graph.remove((subject, None, None))
    graph.remove((None, None, subject))


def _apply_delete_edge(graph: Graph, op: DeleteEdgeOp) -> None:
    graph.remove((URIRef(op.subject), _expand(op.predicate), URIRef(op.object)))


def apply_operations(graph: Graph, operations: list[Op]) -> ApplyResult:
    result = ApplyResult()
    for op in operations:
        if isinstance(op, AddNodeOp):
            _apply_add_node(graph, op, result.ref_map)
        elif isinstance(op, AddEdgeOp):
            _apply_add_edge(graph, op, result.ref_map)
        elif isinstance(op, UpdateNodeOp):
            _apply_update_node(graph, op)
        elif isinstance(op, DeleteNodeOp):
            _apply_delete_node(graph, op)
        elif isinstance(op, DeleteEdgeOp):
            _apply_delete_edge(graph, op)
        result.applied_count += 1
    return result
