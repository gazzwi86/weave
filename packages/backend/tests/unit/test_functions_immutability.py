"""CE-V1-TASK-009 AC-009-04: request-only classification of ops that touch a
`weave:Function` signature -- no graph fetch (mirrors the existing
`PublishedTargetError` fast-reject path, which must never fetch a graph
before rejecting -- see `test_operations_pipeline_published_target.py`).
"""

from __future__ import annotations

from weave_backend.functions.immutability import (
    existing_signature_edit_targets,
    touches_function_signature,
)
from weave_backend.schemas.operations import AddEdgeOp, AddNodeOp, Op, UpdateNodeOp


def test_add_edge_with_bound_kind_predicate_touches_signature() -> None:
    ops = [
        AddEdgeOp(op="add_edge", subject_ref="fn1", predicate="boundKind", object_ref="Activity")
    ]

    assert touches_function_signature(ops) is True


def test_add_edge_with_has_parameter_predicate_touches_signature() -> None:
    ops = [AddEdgeOp(op="add_edge", subject_ref="fn1", predicate="hasParameter", object_ref="p1")]

    assert touches_function_signature(ops) is True


def test_add_edge_with_has_return_predicate_touches_signature() -> None:
    ops = [AddEdgeOp(op="add_edge", subject_ref="fn1", predicate="hasReturn", object_ref="p1")]

    assert touches_function_signature(ops) is True


def test_add_node_with_function_kind_touches_signature() -> None:
    ops = [AddNodeOp(op="add_node", ref="fn1", kind="Function", label="reorderStock")]

    assert touches_function_signature(ops) is True


def test_add_edge_with_unrelated_predicate_does_not_touch_signature() -> None:
    ops = [AddEdgeOp(op="add_edge", subject_ref="a1", predicate="relatesTo", object_ref="a2")]

    assert touches_function_signature(ops) is False


def test_update_node_label_only_does_not_touch_signature() -> None:
    """`UpdateNodeOp` carries no `kind`, so a label/description edit is
    never classified as signature-touching -- consistent with the pipeline
    fast-reject path never needing a graph fetch to decide.
    """
    ops = [
        UpdateNodeOp(op="update_node", iri="urn:weave:instances:fn-1", properties={"label": "x"})
    ]

    assert touches_function_signature(ops) is False


def test_absolute_iri_predicate_is_recognised_same_as_short_name() -> None:
    ops = [
        AddEdgeOp(
            op="add_edge",
            subject_ref="fn1",
            predicate="https://weave.io/ontology/hasParameter",
            object_ref="p1",
        )
    ]

    assert touches_function_signature(ops) is True


def test_existing_signature_edit_targets_excludes_a_node_created_in_the_same_batch() -> None:
    """A brand-new function (its `AddNodeOp.ref` resolved locally) is not an
    in-place edit of anything -- AC-009-01 (defining a function) must never
    trip AC-009-04's immutability gate.
    """
    ops: list[Op] = [
        AddNodeOp(op="add_node", ref="fn1", kind="Function", label="reorderStock"),
        AddEdgeOp(op="add_edge", subject_ref="fn1", predicate="boundKind", object_ref="Activity"),
    ]

    assert existing_signature_edit_targets(ops) == set()


def test_existing_signature_edit_targets_includes_a_real_iri_not_in_this_batch() -> None:
    """`subject_ref` naming a real, pre-existing IRI (not a local ref from
    this same request) against a signature predicate is a candidate
    in-place edit -- whether it's actually a *published* function is a
    graph question the pipeline resolves separately.
    """
    ops = [
        AddEdgeOp(
            op="add_edge",
            subject_ref="https://weave.io/instances/fn-reorderStock",
            predicate="boundKind",
            object_ref="Activity",
        )
    ]

    assert existing_signature_edit_targets(ops) == {"https://weave.io/instances/fn-reorderStock"}


def test_existing_signature_edit_targets_ignores_non_signature_predicates() -> None:
    ops = [
        AddEdgeOp(
            op="add_edge",
            subject_ref="https://weave.io/instances/fn-reorderStock",
            predicate="relatesTo",
            object_ref="a2",
        )
    ]

    assert existing_signature_edit_targets(ops) == set()
