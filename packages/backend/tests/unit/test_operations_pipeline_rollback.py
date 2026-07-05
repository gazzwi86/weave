"""CE-TASK-001 unit tests: rollback/atomicity guarantee (AC-001-10).

Mocks the Oxigraph HTTP boundary directly (no docker) -- proves a failure
at each stage of clone->apply->validate->commit either never touches the
working graph, or fails *before* the working-graph PUT (which
`pipeline._commit` always issues last).
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from weave_backend.operations import metrics as ops_metrics
from weave_backend.operations import pipeline
from weave_backend.schemas.operations import (
    AddEdgeOp,
    AddNodeOp,
    ApplyRequest,
    ApplyResponse,
    ViolationsResponse,
)

WORKING_GRAPH = "urn:weave:tenant:t1:ws:w1"
CANARY_TURTLE = (
    '<https://weave.io/instances/pre-existing> <https://weave.io/ontology/label> "untouched" .'
)


@pytest.fixture
def ctx() -> pipeline.ApplyContext:
    return pipeline.ApplyContext(
        tenant_id="t1", workspace_id="w1", named_graph_iri=WORKING_GRAPH, conn=AsyncMock()
    )


def _invalid_request() -> ApplyRequest:
    # Process with a label but no performedBy -- trips ProcessShape's
    # `performedBy` Violation; which rule fires doesn't matter for this test.
    return ApplyRequest(
        operations=[AddNodeOp(op="add_node", ref="p1", kind="Process", label="Invoicing")],
        actor="urn:weave:principal:test",
    )


def _valid_request() -> ApplyRequest:
    return ApplyRequest(
        operations=[
            AddNodeOp(op="add_node", ref="a1", kind="Actor", label="Billing Team"),
            AddNodeOp(op="add_node", ref="p1", kind="Process", label="Invoicing"),
            AddEdgeOp(op="add_edge", subject_ref="p1", predicate="performedBy", object_ref="a1"),
        ],
        actor="urn:weave:principal:test",
    )


async def test_warning_only_batch_commits_with_advisories_populated(
    monkeypatch: pytest.MonkeyPatch, ctx: pipeline.ApplyContext
) -> None:
    """AC-001-03, direct: `validate_graph` severity classification is unit-
    tested in `test_operations_shacl.py`, but nothing previously proved the
    *pipeline* actually commits a Warning/Info-only batch and surfaces the
    advisories in the response, rather than treating any non-empty result
    list as blocking."""
    monkeypatch.setattr(pipeline, "fetch_graph_turtle", AsyncMock(return_value=""))
    monkeypatch.setattr(pipeline, "load_graph", AsyncMock())
    monkeypatch.setattr(
        pipeline, "mint_version", AsyncMock(return_value=(f"{WORKING_GRAPH}:v0.1.0", "0.1.0"))
    )
    monkeypatch.setattr(
        pipeline, "write_activity", AsyncMock(return_value="urn:weave:instances:activity-1")
    )
    monkeypatch.setattr(ops_metrics, "emit_mutation_outcome_metric", AsyncMock())
    monkeypatch.setattr(pipeline, "default_audit_emitter", AsyncMock())

    request = ApplyRequest(
        # Activity with a label but no description -- Warning only, no Violation.
        operations=[AddNodeOp(op="add_node", ref="a1", kind="Activity", label="Send invoice")],
        actor="urn:weave:principal:test",
    )

    result = await pipeline.apply_operations_request(ctx, request, redis_client=None)

    assert isinstance(result, ApplyResponse)
    assert result.advisories
    assert result.advisories[0].severity == "Warning"


async def test_mixed_violation_and_warning_batch_still_blocks_commit(
    monkeypatch: pytest.MonkeyPatch, ctx: pipeline.ApplyContext
) -> None:
    """QA edge case: a batch that would ALSO trip an advisory Warning must
    still 422 (discard the scratch graph) if it trips even one Violation --
    the presence of a Warning must never demote a Violation to "advisory
    only, commit anyway" (AC-001-02 wins over AC-001-03 when both fire)."""
    monkeypatch.setattr(pipeline, "fetch_graph_turtle", AsyncMock(return_value=""))
    load_graph_spy = AsyncMock()
    monkeypatch.setattr(pipeline, "load_graph", load_graph_spy)
    monkeypatch.setattr(ops_metrics, "emit_mutation_outcome_metric", AsyncMock())

    request = ApplyRequest(
        operations=[
            # Process with no `performedBy` -- Violation.
            AddNodeOp(op="add_node", ref="p1", kind="Process", label="Invoicing"),
            # Activity with no description -- Warning only.
            AddNodeOp(op="add_node", ref="a1", kind="Activity", label="Send invoice"),
        ],
        actor="urn:weave:principal:test",
    )

    result = await pipeline.apply_operations_request(ctx, request, redis_client=None)

    assert isinstance(result, ViolationsResponse)
    load_graph_spy.assert_not_called()


async def test_shacl_violation_never_writes_to_oxigraph(
    monkeypatch: pytest.MonkeyPatch, ctx: pipeline.ApplyContext
) -> None:
    monkeypatch.setattr(pipeline, "fetch_graph_turtle", AsyncMock(return_value=""))
    load_graph_spy = AsyncMock()
    monkeypatch.setattr(pipeline, "load_graph", load_graph_spy)
    monkeypatch.setattr(ops_metrics, "emit_mutation_outcome_metric", AsyncMock())

    result = await pipeline.apply_operations_request(ctx, _invalid_request(), redis_client=None)

    assert isinstance(result, ViolationsResponse)
    load_graph_spy.assert_not_called()


async def test_failure_writing_version_snapshot_leaves_working_graph_untouched(
    monkeypatch: pytest.MonkeyPatch, ctx: pipeline.ApplyContext
) -> None:
    monkeypatch.setattr(pipeline, "fetch_graph_turtle", AsyncMock(return_value=CANARY_TURTLE))
    load_graph_spy = AsyncMock(side_effect=ConnectionError("oxigraph unreachable"))
    monkeypatch.setattr(pipeline, "load_graph", load_graph_spy)
    monkeypatch.setattr(
        pipeline, "mint_version", AsyncMock(return_value=(f"{WORKING_GRAPH}:v0.1.0", "0.1.0"))
    )
    monkeypatch.setattr(ops_metrics, "emit_mutation_outcome_metric", AsyncMock())

    with pytest.raises(ConnectionError):
        await pipeline.apply_operations_request(ctx, _valid_request(), redis_client=None)

    load_graph_spy.assert_called_once()
    assert load_graph_spy.call_args.args[0] != WORKING_GRAPH


async def test_failure_promoting_working_graph_leaves_it_at_pre_request_state(
    monkeypatch: pytest.MonkeyPatch, ctx: pipeline.ApplyContext
) -> None:
    load_graph_spy = AsyncMock(side_effect=[None, ConnectionError("oxigraph unreachable")])
    monkeypatch.setattr(pipeline, "fetch_graph_turtle", AsyncMock(return_value=CANARY_TURTLE))
    monkeypatch.setattr(pipeline, "load_graph", load_graph_spy)
    monkeypatch.setattr(
        pipeline, "mint_version", AsyncMock(return_value=(f"{WORKING_GRAPH}:v0.1.0", "0.1.0"))
    )
    monkeypatch.setattr(ops_metrics, "emit_mutation_outcome_metric", AsyncMock())

    with pytest.raises(ConnectionError):
        await pipeline.apply_operations_request(ctx, _valid_request(), redis_client=None)

    assert load_graph_spy.call_count == 2
    first_target = load_graph_spy.call_args_list[0].args[0]
    second_target = load_graph_spy.call_args_list[1].args[0]
    assert first_target != WORKING_GRAPH
    assert second_target == WORKING_GRAPH
