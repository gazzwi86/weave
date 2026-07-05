"""TASK-004 unit tests: OWL restriction + disjointness op builders and
conflict detection (AC-004-06/-07/-08).
"""

from __future__ import annotations

import pytest

from weave_backend.authoring.restrictions import (
    RestrictionConflictError,
    build_disjoint_with_ops,
    build_min_cardinality_ops,
)
from weave_backend.schemas.operations import AddEdgeOp, AddNodeOp

PROCESS_IRI = "https://weave.io/instances/process-1"
DATA_ASSET_IRI = "https://weave.io/instances/dataasset-1"
HAS_ACTIVITY = "https://weave.io/ontology/hasActivity"


def test_min_cardinality_builds_owl_restriction_and_subclass_edge() -> None:
    ops = build_min_cardinality_ops(PROCESS_IRI, HAS_ACTIVITY, 1)

    assert len(ops) == 2
    node_op, edge_op = ops
    assert isinstance(node_op, AddNodeOp)
    assert node_op.kind == "http://www.w3.org/2002/07/owl#Restriction"
    assert node_op.properties["http://www.w3.org/2002/07/owl#onProperty"] == HAS_ACTIVITY
    assert node_op.properties["http://www.w3.org/2002/07/owl#minCardinality"] == 1

    assert isinstance(edge_op, AddEdgeOp)
    assert edge_op.subject_ref == PROCESS_IRI
    assert edge_op.predicate == "http://www.w3.org/2000/01/rdf-schema#subClassOf"
    assert edge_op.object_ref == node_op.ref


def test_min_cardinality_conflicts_with_lower_existing_max_cardinality() -> None:
    with pytest.raises(RestrictionConflictError):
        build_min_cardinality_ops(PROCESS_IRI, HAS_ACTIVITY, 2, existing_max_count=1)


def test_min_cardinality_allows_consistent_existing_max_cardinality() -> None:
    ops = build_min_cardinality_ops(PROCESS_IRI, HAS_ACTIVITY, 1, existing_max_count=3)
    assert len(ops) == 2


def test_disjoint_with_asserts_owl_disjoint_with_edge() -> None:
    ops = build_disjoint_with_ops(PROCESS_IRI, DATA_ASSET_IRI)

    assert ops == [
        AddEdgeOp(
            op="add_edge",
            subject_ref=PROCESS_IRI,
            predicate="http://www.w3.org/2002/07/owl#disjointWith",
            object_ref=DATA_ASSET_IRI,
        )
    ]
