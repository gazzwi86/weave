"""TASK-004 AC-004-06/-07/-08: OWL 2 DL restriction + disjointness op
builders, and pre-dispatch conflict detection.

Restrictions are class-level OWL semantics, not SHACL constraints (decision
B3 -- Polikoff rule: SHACL is for data-quality, OWL for class-level
restrictions/disjointness). The op pairs below ride the existing
add_node/add_edge CE-WRITE-1 vocabulary -- `graph_ops._expand()` passes the
absolute OWL/RDFS IRIs used here straight through unscoped.
"""

from __future__ import annotations

from uuid import uuid4

from weave_backend.schemas.operations import AddEdgeOp, AddNodeOp, Op

_OWL = "http://www.w3.org/2002/07/owl#"
_RDFS = "http://www.w3.org/2000/01/rdf-schema#"


class RestrictionConflictError(Exception):
    """Raised when a new restriction would contradict one already committed
    on the same class+property (AC-004-08) -- callers must surface this to
    the modeller before attempting any CE-WRITE-1 dispatch.
    """


def build_min_cardinality_ops(
    class_iri: str,
    property_iri: str,
    min_count: int,
    *,
    existing_max_count: int | None = None,
) -> list[Op]:
    """AC-004-06: "`class_iri` cannot have fewer than `min_count`
    `property_iri`" becomes an `owl:Restriction` node plus the
    `rdfs:subClassOf` edge attaching it to `class_iri`.

    `existing_max_count` is the caller-supplied result of looking up any
    `owl:maxCardinality` restriction already committed on the same
    class+property; a `min_count` that exceeds it is an unsatisfiable
    restriction pair (AC-004-08).
    """
    if existing_max_count is not None and min_count > existing_max_count:
        raise RestrictionConflictError(
            f"minCardinality {min_count} exceeds existing maxCardinality "
            f"{existing_max_count} on {property_iri}"
        )
    ref = f"restriction-{uuid4().hex}"
    return [
        AddNodeOp(
            op="add_node",
            ref=ref,
            kind=f"{_OWL}Restriction",
            label=f"min {min_count} {property_iri}",
            properties={
                f"{_OWL}onProperty": property_iri,
                f"{_OWL}minCardinality": min_count,
            },
        ),
        AddEdgeOp(
            op="add_edge",
            subject_ref=class_iri,
            predicate=f"{_RDFS}subClassOf",
            object_ref=ref,
        ),
    ]


def build_disjoint_with_ops(class_a_iri: str, class_b_iri: str) -> list[Op]:
    """AC-004-07: "A `class_a` and a `class_b` cannot be the same thing"."""
    return [
        AddEdgeOp(
            op="add_edge",
            subject_ref=class_a_iri,
            predicate=f"{_OWL}disjointWith",
            object_ref=class_b_iri,
        )
    ]
