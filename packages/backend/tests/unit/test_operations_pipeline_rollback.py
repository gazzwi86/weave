"""CE-TASK-001 unit tests: rollback/atomicity guarantee (AC-001-10).

Mocks the Oxigraph HTTP boundary directly (no docker) -- proves a failure
at any failable step (version-graph snapshot, PROV activity, audit entry)
either never touches the working graph, or fails *before* the
working-graph promotion PUT, which `pipeline._apply_uncached` always
issues last, after `_commit` has run everything failable (PR #20 finding:
audit-emit/write_activity used to run *after* promotion, risking store/
registry divergence on failure).
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any
from unittest.mock import AsyncMock

import pytest

from weave_backend.operations import metrics as ops_metrics
from weave_backend.operations import pipeline
from weave_backend.schemas.operations import (
    AddEdgeOp,
    AddNodeOp,
    ApplyRequest,
    ApplyResponse,
    DeleteEdgeOp,
    DeleteNodeOp,
    UpdateNodeOp,
    ViolationsResponse,
)

WORKING_GRAPH = "urn:weave:tenant:t1:ws:w1"
AUTHENTICATED_PRINCIPAL = "urn:weave:principal:user:u-real"
CANARY_TURTLE = (
    '<https://weave.io/instances/pre-existing> <https://weave.io/ontology/label> "untouched" .'
)


def _stub_violation_event(monkeypatch: pytest.MonkeyPatch) -> None:
    """CE-008 (TASK-008): the SHACL-violation branch now opens its own
    `tenant_connection` to record a `constraint-violated` change event
    (AC-008-02) -- these pre-existing rollback tests don't exercise that
    feed, so give it a fake connection rather than hitting real Postgres.
    """

    @asynccontextmanager
    async def _fake_tenant_connection(_tenant_id: str) -> AsyncIterator[Any]:
        yield AsyncMock()

    monkeypatch.setattr(pipeline, "tenant_connection", _fake_tenant_connection)


@pytest.fixture
def ctx() -> pipeline.ApplyContext:
    return pipeline.ApplyContext(
        tenant_id="t1",
        workspace_id="w1",
        named_graph_iri=WORKING_GRAPH,
        conn=AsyncMock(),
        principal_iri=AUTHENTICATED_PRINCIPAL,
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
    monkeypatch.setattr(pipeline, "fetch_graph_ntriples", AsyncMock(return_value=""))
    monkeypatch.setattr(pipeline, "load_graph", AsyncMock())
    monkeypatch.setattr(
        pipeline, "mint_version", AsyncMock(return_value=(f"{WORKING_GRAPH}:v0.1.0", "0.1.0"))
    )
    monkeypatch.setattr(
        pipeline, "write_activity", AsyncMock(return_value="urn:weave:instances:activity-1")
    )
    monkeypatch.setattr(ops_metrics, "emit_mutation_outcome_metric", AsyncMock())
    monkeypatch.setattr(pipeline, "enqueue", AsyncMock())

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
    monkeypatch.setattr(pipeline, "fetch_graph_ntriples", AsyncMock(return_value=""))
    load_graph_spy = AsyncMock()
    monkeypatch.setattr(pipeline, "load_graph", load_graph_spy)
    monkeypatch.setattr(ops_metrics, "emit_mutation_outcome_metric", AsyncMock())
    _stub_violation_event(monkeypatch)

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
    monkeypatch.setattr(pipeline, "fetch_graph_ntriples", AsyncMock(return_value=""))
    load_graph_spy = AsyncMock()
    monkeypatch.setattr(pipeline, "load_graph", load_graph_spy)
    monkeypatch.setattr(ops_metrics, "emit_mutation_outcome_metric", AsyncMock())
    _stub_violation_event(monkeypatch)

    result = await pipeline.apply_operations_request(ctx, _invalid_request(), redis_client=None)

    assert isinstance(result, ViolationsResponse)
    load_graph_spy.assert_not_called()


async def test_failure_writing_version_snapshot_leaves_working_graph_untouched(
    monkeypatch: pytest.MonkeyPatch, ctx: pipeline.ApplyContext
) -> None:
    monkeypatch.setattr(pipeline, "fetch_graph_ntriples", AsyncMock(return_value=CANARY_TURTLE))
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
    monkeypatch.setattr(pipeline, "fetch_graph_ntriples", AsyncMock(return_value=CANARY_TURTLE))
    monkeypatch.setattr(pipeline, "load_graph", load_graph_spy)
    monkeypatch.setattr(
        pipeline, "mint_version", AsyncMock(return_value=(f"{WORKING_GRAPH}:v0.1.0", "0.1.0"))
    )
    monkeypatch.setattr(
        pipeline, "write_activity", AsyncMock(return_value="urn:weave:instances:activity-1")
    )
    monkeypatch.setattr(pipeline, "enqueue", AsyncMock())
    monkeypatch.setattr(ops_metrics, "emit_mutation_outcome_metric", AsyncMock())

    with pytest.raises(ConnectionError):
        await pipeline.apply_operations_request(ctx, _valid_request(), redis_client=None)

    assert load_graph_spy.call_count == 2
    first_target = load_graph_spy.call_args_list[0].args[0]
    second_target = load_graph_spy.call_args_list[1].args[0]
    assert first_target != WORKING_GRAPH
    assert second_target == WORKING_GRAPH


async def test_failure_writing_prov_activity_leaves_working_graph_unpromoted(
    monkeypatch: pytest.MonkeyPatch, ctx: pipeline.ApplyContext
) -> None:
    """PR #20 finding 7: `write_activity` used to run *after* the
    working-graph promotion PUT -- a failure here would have left the
    mutation live in the working graph with no PROV record and no way to
    roll it back. It must now run, and fail, before promotion is ever
    attempted."""
    load_graph_spy = AsyncMock()
    monkeypatch.setattr(pipeline, "fetch_graph_ntriples", AsyncMock(return_value=CANARY_TURTLE))
    monkeypatch.setattr(pipeline, "load_graph", load_graph_spy)
    monkeypatch.setattr(
        pipeline, "mint_version", AsyncMock(return_value=(f"{WORKING_GRAPH}:v0.1.0", "0.1.0"))
    )
    monkeypatch.setattr(
        pipeline, "write_activity", AsyncMock(side_effect=ConnectionError("oxigraph unreachable"))
    )
    monkeypatch.setattr(ops_metrics, "emit_mutation_outcome_metric", AsyncMock())

    with pytest.raises(ConnectionError):
        await pipeline.apply_operations_request(ctx, _valid_request(), redis_client=None)

    # Only the version-graph snapshot PUT happened; promotion never ran.
    load_graph_spy.assert_called_once()
    assert load_graph_spy.call_args.args[0] != WORKING_GRAPH


async def test_failure_enqueueing_audit_event_leaves_working_graph_unpromoted(
    monkeypatch: pytest.MonkeyPatch, ctx: pipeline.ApplyContext
) -> None:
    """CE-TASK-002 (ADR-002): the success path's audit write is now a cheap,
    same-transaction outbox insert, not the real hash-chain emit -- but it
    must still run, and fail, before promotion (AC-001-10 unchanged)."""
    load_graph_spy = AsyncMock()
    monkeypatch.setattr(pipeline, "fetch_graph_ntriples", AsyncMock(return_value=CANARY_TURTLE))
    monkeypatch.setattr(pipeline, "load_graph", load_graph_spy)
    monkeypatch.setattr(
        pipeline, "mint_version", AsyncMock(return_value=(f"{WORKING_GRAPH}:v0.1.0", "0.1.0"))
    )
    monkeypatch.setattr(
        pipeline, "write_activity", AsyncMock(return_value="urn:weave:instances:activity-1")
    )
    monkeypatch.setattr(
        pipeline, "enqueue", AsyncMock(side_effect=ConnectionError("outbox insert failed"))
    )
    monkeypatch.setattr(ops_metrics, "emit_mutation_outcome_metric", AsyncMock())

    with pytest.raises(ConnectionError):
        await pipeline.apply_operations_request(ctx, _valid_request(), redis_client=None)

    load_graph_spy.assert_called_once()
    assert load_graph_spy.call_args.args[0] != WORKING_GRAPH


async def test_recorded_actor_is_the_authenticated_principal_not_the_claimed_one(
    monkeypatch: pytest.MonkeyPatch, ctx: pipeline.ApplyContext
) -> None:
    """PR #20 finding 1 (spoofable attribution): `ApplyRequest.actor` is a
    client-supplied body field -- a caller could name anyone as `actor`.
    PROV attribution and the audit entry must record the JWT-authenticated
    principal (`ctx.principal_iri`) instead; the claimed actor is only kept
    as secondary context in the audit payload.
    """
    monkeypatch.setattr(pipeline, "fetch_graph_ntriples", AsyncMock(return_value=""))
    monkeypatch.setattr(pipeline, "load_graph", AsyncMock())
    monkeypatch.setattr(
        pipeline, "mint_version", AsyncMock(return_value=(f"{WORKING_GRAPH}:v0.1.0", "0.1.0"))
    )
    write_activity_spy = AsyncMock(return_value="urn:weave:instances:activity-1")
    monkeypatch.setattr(pipeline, "write_activity", write_activity_spy)
    monkeypatch.setattr(ops_metrics, "emit_mutation_outcome_metric", AsyncMock())
    enqueue_spy = AsyncMock()
    monkeypatch.setattr(pipeline, "enqueue", enqueue_spy)

    request = ApplyRequest(
        operations=[AddNodeOp(op="add_node", ref="a1", kind="Actor", label="Billing Team")],
        actor="urn:weave:principal:spoofed-someone-else",
    )

    await pipeline.apply_operations_request(ctx, request, redis_client=None)

    assert write_activity_spy.call_args.kwargs["actor"].iri == AUTHENTICATED_PRINCIPAL
    emitted_event = enqueue_spy.call_args.args[1]
    assert emitted_event.actor_iri == AUTHENTICATED_PRINCIPAL
    assert emitted_event.payload["claimed_actor_iri"] == "urn:weave:principal:spoofed-someone-else"


async def test_operations_applied_payload_carries_kind_counts_for_a_mixed_batch(
    monkeypatch: pytest.MonkeyPatch, ctx: pipeline.ApplyContext
) -> None:
    """G5 (audit card A): `operations.applied` previously carried no entity
    kind, so a "model edits by kind" dashboard card was unbuildable even
    client-side. `kind_counts` is derived straight from the request's ops --
    `add_node` ops bucket by `op.kind`; `add_edge`/`delete_edge` bucket under
    "edges". `update_node`/`delete_node` carry no kind on the wire (only an
    `iri`), so they're not counted -- narrower than "every op", but the
    audit-card ask ("edits by kind") only needs kind-bearing ops.
    """
    monkeypatch.setattr(pipeline, "fetch_graph_ntriples", AsyncMock(return_value=""))
    monkeypatch.setattr(pipeline, "load_graph", AsyncMock())
    monkeypatch.setattr(
        pipeline, "mint_version", AsyncMock(return_value=(f"{WORKING_GRAPH}:v0.1.0", "0.1.0"))
    )
    monkeypatch.setattr(
        pipeline, "write_activity", AsyncMock(return_value="urn:weave:instances:activity-1")
    )
    monkeypatch.setattr(ops_metrics, "emit_mutation_outcome_metric", AsyncMock())
    enqueue_spy = AsyncMock()
    monkeypatch.setattr(pipeline, "enqueue", enqueue_spy)

    request = ApplyRequest(
        operations=[
            AddNodeOp(op="add_node", ref="a1", kind="Actor", label="Billing Team"),
            AddNodeOp(op="add_node", ref="a2", kind="Actor", label="Support Team"),
            AddNodeOp(op="add_node", ref="p1", kind="Process", label="Invoicing"),
            AddEdgeOp(op="add_edge", subject_ref="p1", predicate="performedBy", object_ref="a1"),
            DeleteEdgeOp(
                op="delete_edge",
                subject="urn:weave:instances:p0",
                predicate="performedBy",
                object="urn:weave:instances:a0",
            ),
            UpdateNodeOp(op="update_node", iri="urn:weave:instances:a1", properties={}),
            DeleteNodeOp(op="delete_node", iri="urn:weave:instances:stale"),
        ],
        actor="urn:weave:principal:test",
    )

    await pipeline.apply_operations_request(ctx, request, redis_client=None)

    emitted_event = enqueue_spy.call_args.args[1]
    assert emitted_event.payload["kind_counts"] == {"Actor": 2, "Process": 1, "edges": 2}
