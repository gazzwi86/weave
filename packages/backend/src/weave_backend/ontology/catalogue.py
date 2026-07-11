"""AC-003-01: `GET /api/ontology/types` kind/relationship catalogue,
introspected live from the cached SHACL shapes graph (never a hand-copied
list -- `.claude/rules/ontology-standards.md`). A `sh:property` with
`sh:datatype` is a literal attribute; one with no `sh:datatype` (typically
carrying `sh:class`) is a relationship to another kind.

`framework.shacl.ttl` also carries framework-level classes that are not
BPMO kinds (e.g. `weave:BrandStandard`/`weave:VoiceRule`, TASK-003
ADR-022) -- `list_kinds` filters to `BPMO_KINDS` so those still validate
at CE-WRITE-1 commit without leaking into this guided-form catalogue.
"""

from __future__ import annotations

from dataclasses import dataclass

from rdflib import Graph, Namespace
from rdflib.namespace import SH, SKOS
from rdflib.term import Node

from weave_backend.authoring.bpmo import BPMO_KINDS
from weave_backend.operations.shacl import shapes_graph

WEAVE = Namespace("https://weave.io/ontology/")

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
    description: str | None


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


def _skos_definition(graph: Graph, target_class: Node | None) -> str | None:
    """AC-011-01/-02/-05: a kind's plain-language description, sourced from
    its `skos:definition` triple on the target class IRI -- `None` when no
    such triple exists (extension kinds get no invented framework-style
    copy, per AC-011-05).
    """
    definition = graph.value(target_class, SKOS.definition)
    return str(definition) if definition is not None else None


def list_kinds() -> list[Kind]:
    """One entry per `sh:NodeShape`/`sh:targetClass` pair in the cached
    framework shapes graph.
    """
    graph = shapes_graph()
    kinds = []
    for shape_node in graph.subjects(SH.targetClass, None):
        target_class = graph.value(shape_node, SH.targetClass)
        iri = str(target_class)
        # AC-004-05 guard against namespace collisions: match the full
        # `weave:` IRI, not just the local name -- EPIC-003's
        # `GlossaryTermShape` targets `skos:Concept`, whose local name
        # ("Concept") collides with the BPMO kind `weave:Concept`.
        if not iri.startswith(WEAVE) or _local_name(iri) not in BPMO_KINDS:
            continue
        properties = [
            _property_shape(graph, prop_node)
            for prop_node in graph.objects(shape_node, SH.property)
        ]
        kinds.append(
            Kind(
                iri=iri,
                label=_local_name(iri),
                properties=properties,
                description=_skos_definition(graph, target_class),
            )
        )
    return kinds


def list_relationships(kinds: list[Kind]) -> list[PropertyShape]:
    """Relationship properties across all kinds, deduplicated by path."""
    seen: dict[str, PropertyShape] = {}
    for kind in kinds:
        for prop in kind.properties:
            if prop.is_relationship:
                seen.setdefault(prop.path, prop)
    return list(seen.values())
