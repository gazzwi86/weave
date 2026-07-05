"""TASK-004 AC-004-10/-11/-12/-13: Turtle/OWL import -> CE-WRITE-1 op-batch
planning.

Implementation hint: batch per BPMO-kind group, not per triple, to stay
within idempotency-key scope -- `ImportPlan.ops_by_kind` is exactly that
grouping; a caller dispatches one `ApplyRequest` per kind. Collisions are
never silently resolved (AC-004-11): they're listed on the plan and the
caller must supply a decision (`skip` leaves them out entirely; `overwrite`
uses `collision_updates()`, which is `update_node` -- never a fresh
`add_node` -- so the existing resource's other triples survive, matching
AC-004-13's partial-update guarantee).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from rdflib import RDF, Graph, URIRef

from weave_backend.authoring.bpmo import BPMO_KINDS
from weave_backend.schemas.operations import AddEdgeOp, AddNodeOp, Op, UpdateNodeOp

_WEAVE_LABEL = "https://weave.io/ontology/label"
_RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label"
_SKIPPED_PREDICATES = frozenset({str(RDF.type), _WEAVE_LABEL, _RDFS_LABEL})


def _local_kind(rdf_type: URIRef) -> str:
    return str(rdf_type).rsplit("#", 1)[-1].rsplit("/", 1)[-1]


def _label_of(graph: Graph, subject: URIRef) -> str | None:
    for predicate in (_WEAVE_LABEL, _RDFS_LABEL):
        value = graph.value(subject, URIRef(predicate))
        if value is not None:
            return str(value)
    return None


@dataclass
class ImportPlan:
    """One BPMO-kind-group op batch per recognised kind, plus the
    modeller-facing report: unknown kinds are warned (not rejected,
    AC-004-10), collisions are listed for HITL resolution (AC-004-11).
    """

    ops_by_kind: dict[str, list[Op]] = field(default_factory=dict)
    unknown_kinds: set[str] = field(default_factory=set)
    collision_iris: list[str] = field(default_factory=list)
    _collision_labels: dict[str, str] = field(default_factory=dict, repr=False)

    @property
    def needs_collision_decision(self) -> bool:
        return bool(self.collision_iris)

    def collision_updates(self) -> list[UpdateNodeOp]:
        """AC-004-11 overwrite path / AC-004-13 partial-update: refresh only
        the label learned from the import, leaving every other existing
        triple on the resource untouched.
        """
        return [
            UpdateNodeOp(op="update_node", iri=iri, properties={_WEAVE_LABEL: label})
            for iri, label in self._collision_labels.items()
        ]


def plan_import(turtle_data: str, existing_class_iris: set[str]) -> ImportPlan:
    """Parses `turtle_data` and builds an `ImportPlan` against the tenant's
    `existing_class_iris` (from CE-READ-1). Never calls CE-WRITE-1 itself --
    callers dispatch `plan.ops_by_kind` (and, if resolved, `collision_updates()`)
    as separate `ApplyRequest`s per kind.
    """
    graph = Graph()
    graph.parse(data=turtle_data, format="turtle")
    plan = ImportPlan()
    ref_by_subject: dict[str, str] = {}

    typed_subjects: list[tuple[URIRef, URIRef]] = [
        (subject, rdf_type)
        for subject, rdf_type in graph.subject_objects(RDF.type)
        if isinstance(subject, URIRef) and isinstance(rdf_type, URIRef)
    ]

    for subject, rdf_type in typed_subjects:
        subject_iri = str(subject)
        kind = _local_kind(rdf_type)

        if subject_iri in existing_class_iris:
            plan.collision_iris.append(subject_iri)
            label = _label_of(graph, subject)
            if label is not None:
                plan._collision_labels[subject_iri] = label
            continue
        if kind not in BPMO_KINDS:
            plan.unknown_kinds.add(kind)
            continue

        ref = f"import-{len(ref_by_subject)}"
        ref_by_subject[subject_iri] = ref
        plan.ops_by_kind.setdefault(kind, []).append(
            AddNodeOp(
                op="add_node",
                ref=ref,
                kind=kind,
                label=_label_of(graph, subject) or subject_iri,
            )
        )

    for subject, rdf_type in typed_subjects:
        subject_iri = str(subject)
        if subject_iri not in ref_by_subject:
            continue
        kind = _local_kind(rdf_type)
        for predicate, obj in graph.predicate_objects(subject):
            if str(predicate) in _SKIPPED_PREDICATES or not isinstance(obj, URIRef):
                continue
            object_ref = ref_by_subject.get(str(obj), str(obj))
            plan.ops_by_kind[kind].append(
                AddEdgeOp(
                    op="add_edge",
                    subject_ref=ref_by_subject[subject_iri],
                    predicate=str(predicate),
                    object_ref=object_ref,
                )
            )

    return plan
