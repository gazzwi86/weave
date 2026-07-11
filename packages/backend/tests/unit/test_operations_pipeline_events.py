"""CE-V1-TASK-008 unit tests: CE-WRITE-1 pipeline hook into the CE-EVENT-1
change feed (AC-008-01/-02). Mocks the Oxigraph HTTP boundary + spies on
`events.record_commit_event` -- real same-txn/own-txn/RLS/append-only
behaviour is proven in the docker-marked integration suite.
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
    AddNodeOp,
    ApplyRequest,
    ApplyResponse,
    ViolationsResponse,
)

WORKING_GRAPH = "urn:weave:tenant:t1:ws:w1"
AUTHENTICATED_PRINCIPAL = "urn:weave:principal:user:u-real"


@pytest.fixture
def ctx() -> pipeline.ApplyContext:
    return pipeline.ApplyContext(
        tenant_id="t1",
        workspace_id="w1",
        named_graph_iri=WORKING_GRAPH,
        conn=AsyncMock(),
        principal_iri=AUTHENTICATED_PRINCIPAL,
    )


def _valid_request() -> ApplyRequest:
    return ApplyRequest(
        operations=[AddNodeOp(op="add_node", ref="a1", kind="Actor", label="Billing Team")],
        actor="urn:weave:principal:test",
    )


def _invalid_request() -> ApplyRequest:
    # Process with a label but no performedBy -- trips ProcessShape's
    # `performedBy` Violation (same fixture as test_operations_pipeline_rollback.py).
    return ApplyRequest(
        operations=[AddNodeOp(op="add_node", ref="p1", kind="Process", label="Invoicing")],
        actor="urn:weave:principal:test",
    )


def _stub_success_path(monkeypatch: pytest.MonkeyPatch) -> None:
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


def _fake_tenant_connection_factory(conn: Any) -> Any:
    @asynccontextmanager
    async def _factory(_tenant_id: str) -> AsyncIterator[Any]:
        yield conn

    return _factory


async def test_successful_commit_records_one_added_event_on_the_same_connection(
    monkeypatch: pytest.MonkeyPatch, ctx: pipeline.ApplyContext
) -> None:
    _stub_success_path(monkeypatch)
    record_spy = AsyncMock()
    monkeypatch.setattr(pipeline, "record_commit_event", record_spy)

    result = await pipeline.apply_operations_request(ctx, _valid_request(), redis_client=None)

    assert isinstance(result, ApplyResponse)
    record_spy.assert_called_once()
    conn_arg, event_arg = record_spy.call_args.args
    # AC-008-01: same connection/transaction the version row committed on.
    assert conn_arg is ctx.conn
    assert event_arg.change_type == "added"
    assert event_arg.entity_iri == result.ref_map["a1"]
    # AC-008-03: CE-WRITE-1 always mints a *draft* -- version_iri stays
    # null on the event even though the commit itself succeeded.
    assert event_arg.version_iri is None
    assert event_arg.tenant_id == "t1"
    assert event_arg.workspace_id == "w1"
    assert event_arg.actor == AUTHENTICATED_PRINCIPAL


async def test_shacl_violation_records_constraint_violated_event_on_its_own_connection(
    monkeypatch: pytest.MonkeyPatch, ctx: pipeline.ApplyContext
) -> None:
    monkeypatch.setattr(pipeline, "fetch_graph_ntriples", AsyncMock(return_value=""))
    load_graph_spy = AsyncMock()
    monkeypatch.setattr(pipeline, "load_graph", load_graph_spy)
    monkeypatch.setattr(ops_metrics, "emit_mutation_outcome_metric", AsyncMock())
    record_spy = AsyncMock()
    monkeypatch.setattr(pipeline, "record_commit_event", record_spy)
    own_txn_conn = AsyncMock()
    monkeypatch.setattr(
        pipeline, "tenant_connection", _fake_tenant_connection_factory(own_txn_conn)
    )

    result = await pipeline.apply_operations_request(ctx, _invalid_request(), redis_client=None)

    assert isinstance(result, ViolationsResponse)
    load_graph_spy.assert_not_called()
    record_spy.assert_called_once()
    conn_arg, event_arg = record_spy.call_args.args
    # AC-008-02: constraint-violated is the one exception to same-txn --
    # never the caller's still-open (and, here, otherwise-untouched) conn.
    assert conn_arg is own_txn_conn
    assert conn_arg is not ctx.conn
    assert event_arg.change_type == "constraint-violated"
    assert event_arg.entity_iri.startswith("https://weave.io/instances/process-")
    assert event_arg.version_iri is None
    assert event_arg.tenant_id == "t1"
    assert event_arg.workspace_id == "w1"
    assert event_arg.actor == AUTHENTICATED_PRINCIPAL


async def test_warning_only_batch_still_records_an_added_event(
    monkeypatch: pytest.MonkeyPatch, ctx: pipeline.ApplyContext
) -> None:
    """A Warning-only batch commits (AC-001-03) -- it must record a
    change-feed event same as any other successful commit, not be treated
    as a non-event because advisories were present.
    """
    _stub_success_path(monkeypatch)
    record_spy = AsyncMock()
    monkeypatch.setattr(pipeline, "record_commit_event", record_spy)

    request = ApplyRequest(
        operations=[AddNodeOp(op="add_node", ref="a1", kind="Activity", label="Send invoice")],
        actor="urn:weave:principal:test",
    )

    result = await pipeline.apply_operations_request(ctx, request, redis_client=None)

    assert isinstance(result, ApplyResponse)
    record_spy.assert_called_once()
