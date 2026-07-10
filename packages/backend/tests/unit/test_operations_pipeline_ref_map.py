"""TASK-004 unit test: `ApplyResponse.ref_map` (AC-004-01/-04).

CE-WRITE-1 already computes `ApplyResult.ref_map` (the real, minted IRI for
every `ref` in the request) while applying ops in-memory (`graph_ops.py`) --
it was just discarded before this task, so no caller of
`POST /api/operations/apply` had any way to learn the IRI it had just
created. Threading it through closes that gap without changing the
request schema or the IRI-minting scheme.
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from weave_backend.operations import metrics as ops_metrics
from weave_backend.operations import pipeline
from weave_backend.schemas.operations import AddNodeOp, ApplyRequest, ApplyResponse

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


async def test_apply_response_returns_the_real_minted_iri_for_every_ref(
    monkeypatch: pytest.MonkeyPatch, ctx: pipeline.ApplyContext
) -> None:
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
        operations=[
            AddNodeOp(op="add_node", ref="a1", kind="Actor", label="Billing Team"),
            AddNodeOp(op="add_node", ref="a2", kind="Actor", label="Finance Team"),
        ],
        actor="urn:weave:principal:test",
    )

    result = await pipeline.apply_operations_request(ctx, request, redis_client=None)

    assert isinstance(result, ApplyResponse)
    assert set(result.ref_map) == {"a1", "a2"}
    assert result.ref_map["a1"].startswith("https://weave.io/instances/actor-")
