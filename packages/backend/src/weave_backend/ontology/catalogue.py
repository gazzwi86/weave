"""AC-003-01: `GET /api/ontology/types` kind/relationship catalogue,
introspected live from the cached SHACL shapes graph (never a hand-copied
list -- `.claude/rules/ontology-standards.md`). A `sh:property` with
`sh:datatype` is a literal attribute; one with no `sh:datatype` (typically
carrying `sh:class`) is a relationship to another kind.
"""

from __future__ import annotations

from dataclasses import dataclass

from rdflib import Graph
from rdflib.namespace import SH
from rdflib.term import Node

from weave_backend.operations.shacl import shapes_graph

_SEVERITY_LABELS = {
    str(SH.Violation): "Violation",
    str(SH.Warning): "Warning",
    str(SH.Info): "Info",
}


@dataclass(frozen=True)
class PropertyShape:
    path: str
    name: str
    is_relationship: bool
    min_count: int | None
    max_count: int | None
    severity: str


@dataclass(frozen=True)
class Kind:
    iri: str
    label: str
    properties: list[PropertyShape]


def _local_name(iri: str) -> str:
    return iri.rsplit("#", 1)[-1].rsplit("/", 1)[-1]


def _severity_label(graph: Graph, prop_node: Node) -> str:
    severity = graph.value(prop_node, SH.severity)
    return _SEVERITY_LABELS.get(str(severity), "Unknown") if severity is not None else "Unknown"


def _count(graph: Graph, prop_node: Node, predicate: Node) -> int | None:
    value = graph.value(prop_node, predicate)
    return int(str(value)) if value is not None else None


def _property_shape(graph: Graph, prop_node: Node) -> PropertyShape:
    path = graph.value(prop_node, SH.path)
    path_iri = str(path)
    name = graph.value(prop_node, SH.name)
    return PropertyShape(
        path=path_iri,
        name=str(name) if name is not None else _local_name(path_iri),
        is_relationship=graph.value(prop_node, SH.datatype) is None,
        min_count=_count(graph, prop_node, SH.minCount),
        max_count=_count(graph, prop_node, SH.maxCount),
        severity=_severity_label(graph, prop_node),
    )


def list_kinds() -> list[Kind]:
    """One entry per `sh:NodeShape`/`sh:targetClass` pair in the cached
    framework shapes graph.
    """
    graph = shapes_graph()
    kinds = []
    for shape_node in graph.subjects(SH.targetClass, None):
        target_class = graph.value(shape_node, SH.targetClass)
        iri = str(target_class)
        properties = [
            _property_shape(graph, prop_node)
            for prop_node in graph.objects(shape_node, SH.property)
        ]
        kinds.append(Kind(iri=iri, label=_local_name(iri), properties=properties))
    return kinds


def list_relationships(kinds: list[Kind]) -> list[PropertyShape]:
    """Relationship properties across all kinds, deduplicated by path."""
    seen: dict[str, PropertyShape] = {}
    for kind in kinds:
        for prop in kind.properties:
            if prop.is_relationship:
                seen.setdefault(prop.path, prop)
    return list(seen.values())
