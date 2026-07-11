"""Applies CE-WRITE-1 `Op`s to an in-memory rdflib `Graph` (AC-001-05/-06).

All ops in a batch apply to the same graph in order; SHACL validates the
result afterwards (never interleaved -- see `shacl.py`).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from rdflib import RDF, XSD, Graph, Literal, Namespace, URIRef
from rdflib.namespace import SH
from rdflib.term import Node

from weave_backend.operations.shacl import shapes_graph
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


class InvalidLiteralError(Exception):
    """A property value's lexical form doesn't parse as its SHACL-declared
    `sh:datatype` (e.g. `"not-a-date"` for `weave:effectiveDate`'s
    `xsd:date`) -- a clean, catchable validation error instead of an
    uncaught rdflib parser exception surfacing as a 500. Callers map this
    to a 400, mirroring `authoring/bpmo.py`'s `InvalidBpmoKindError`.
    """

    def __init__(self, datatype: str, value: Any) -> None:
        self.datatype = datatype
        self.value = value
        super().__init__(f"value {value!r} is not a valid {datatype}")


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


def _property_datatype(kind_iri: Node, predicate: URIRef) -> URIRef | None:
    """Looks up `predicate`'s `sh:datatype` on whichever `NodeShape` targets
    `kind_iri`, e.g. `weave:BrandStandardShape` declares `sh:datatype
    xsd:date` on `weave:effectiveDate`. Returns `None` when the shape
    declares no datatype (or none applies) -- callers keep the current
    `xsd:string` fallback in that case, so untyped properties are
    unaffected by this lookup.
    """
    shapes = shapes_graph()
    for node_shape in shapes.subjects(SH.targetClass, kind_iri):
        for prop_shape in shapes.objects(node_shape, SH.property):
            if shapes.value(prop_shape, SH.path) == predicate:
                datatype = shapes.value(prop_shape, SH.datatype)
                if datatype is not None:
                    return URIRef(str(datatype))
    return None


def _to_literal(value: Any, datatype: URIRef | None = None) -> Any:
    """`rdflib.Literal(str)` does not auto-infer `xsd:string` (unlike
    int/float/bool, which do) -- so string values need the datatype set
    explicitly to satisfy `sh:datatype xsd:string` shape constraints.

    A non-string `datatype` (resolved from the active shape via
    `_property_datatype`, e.g. `xsd:date`) coerces the literal to that
    type instead -- validated via rdflib's own `Literal.ill_typed`
    well-formedness check, so a malformed value raises
    `InvalidLiteralError` rather than silently minting an unparseable
    literal that only fails much later, opaquely, at SHACL validation.
    `ill_typed` is `None` (not `True`/`False`) for a datatype rdflib
    doesn't recognise -- treated as "can't tell, so allow it" rather than
    rejecting every value for that property.
    """
    if datatype is not None and datatype != XSD.string:
        literal = Literal(str(value), datatype=datatype, normalize=False)
        if literal.ill_typed:
            raise InvalidLiteralError(str(datatype), value)
        return literal
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
    kind_iri = _expand(op.kind)
    graph.add((subject, RDF.type, kind_iri))
    graph.add((subject, WEAVE.label, _to_literal(op.label)))
    for key, value in op.properties.items():
        predicate = _expand(key)
        datatype = _property_datatype(kind_iri, predicate)
        graph.add((subject, predicate, _to_literal(value, datatype)))
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
    kind_iri = graph.value(subject, RDF.type)
    for key, value in op.properties.items():
        predicate = _expand(key)
        datatype = _property_datatype(kind_iri, predicate) if kind_iri is not None else None
        graph.remove((subject, predicate, None))
        graph.add((subject, predicate, _to_literal(value, datatype)))


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
