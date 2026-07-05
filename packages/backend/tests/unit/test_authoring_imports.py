"""TASK-004 unit tests: Turtle import -> CE-WRITE-1 op-batch planning
(AC-004-10/-11/-12/-13).
"""

from __future__ import annotations

from weave_backend.authoring.imports import plan_import
from weave_backend.schemas.operations import AddEdgeOp, AddNodeOp

TURTLE = """
@prefix weave: <https://weave.io/ontology/> .
@prefix inst: <https://weave.io/instances/> .

inst:onboarding a weave:Process ;
    weave:label "Customer Onboarding" ;
    weave:hasActivity inst:review-application .

inst:review-application a weave:Activity ;
    weave:label "Review Application" .

inst:unrecognised a weave:NotABpmoKind ;
    weave:label "Mystery Thing" .
"""


def test_plan_import_groups_add_node_ops_by_bpmo_kind() -> None:
    plan = plan_import(TURTLE, existing_class_iris=set())

    assert set(plan.ops_by_kind) == {"Process", "Activity"}
    process_ops = [op for op in plan.ops_by_kind["Process"] if isinstance(op, AddNodeOp)]
    assert len(process_ops) == 1
    assert process_ops[0].label == "Customer Onboarding"


def test_plan_import_flags_kinds_outside_bpmo_enumeration() -> None:
    plan = plan_import(TURTLE, existing_class_iris=set())

    assert plan.unknown_kinds == {"NotABpmoKind"}


def test_plan_import_translates_object_property_to_add_edge() -> None:
    plan = plan_import(TURTLE, existing_class_iris=set())

    edge_ops = [op for op in plan.ops_by_kind["Process"] if isinstance(op, AddEdgeOp)]
    assert len(edge_ops) == 1
    assert edge_ops[0].predicate == "https://weave.io/ontology/hasActivity"


def test_plan_import_flags_collision_and_excludes_it_from_new_nodes() -> None:
    plan = plan_import(
        TURTLE, existing_class_iris={"https://weave.io/instances/onboarding"}
    )

    assert plan.collision_iris == ["https://weave.io/instances/onboarding"]
    assert plan.needs_collision_decision is True
    process_labels = [
        op.label for op in plan.ops_by_kind.get("Process", []) if isinstance(op, AddNodeOp)
    ]
    assert "Customer Onboarding" not in process_labels


def test_plan_import_collision_updates_use_update_node_for_overwrite() -> None:
    plan = plan_import(
        TURTLE, existing_class_iris={"https://weave.io/instances/onboarding"}
    )

    updates = plan.collision_updates()
    assert len(updates) == 1
    assert updates[0].iri == "https://weave.io/instances/onboarding"
    assert updates[0].op == "update_node"


def test_plan_import_with_no_collisions_needs_no_decision() -> None:
    plan = plan_import(TURTLE, existing_class_iris=set())
    assert plan.needs_collision_decision is False
    assert plan.collision_updates() == []
