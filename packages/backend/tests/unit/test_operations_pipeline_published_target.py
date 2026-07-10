"""CE-TASK-003 AC-003-13: `POST /api/operations/apply` rejects a `target`
that names a real, already-published version -- published versions are
immutable snapshots (same rule as AC-002-09 on the read side).
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest

from weave_backend.operations import pipeline
from weave_backend.operations.versioning import GraphVersion
from weave_backend.schemas.operations import AddNodeOp, ApplyRequest, ApplyResponse

WORKING_GRAPH = "urn:weave:tenant:t1:ws:w1"
AUTHENTICATED_PRINCIPAL = "urn:weave:principal:user:u-real"
PUBLISHED_VERSION_IRI = f"{WORKING_GRAPH}:v0.1.0"


@pytest.fixture
def ctx() -> pipeline.ApplyContext:
    return pipeline.ApplyContext(
        tenant_id="t1",
        workspace_id="w1",
        named_graph_iri=WORKING_GRAPH,
        conn=AsyncMock(),
        principal_iri=AUTHENTICATED_PRINCIPAL,
    )


def _request(target: str) -> ApplyRequest:
    return ApplyRequest(
        operations=[AddNodeOp(op="add_node", ref="a1", kind="Actor", label="Billing Team")],
        actor="urn:weave:principal:test",
        target=target,
    )


def _published_version() -> GraphVersion:
    return GraphVersion(
        version_iri=PUBLISHED_VERSION_IRI,
        semver="0.1.0",
        status="published",
        created_at=datetime.now(UTC),
        published_at=datetime.now(UTC),
        actor_iri=AUTHENTICATED_PRINCIPAL,
        workspace_id="w1",
    )


async def test_apply_against_a_published_version_target_raises_published_target_error(
    monkeypatch: pytest.MonkeyPatch, ctx: pipeline.ApplyContext
) -> None:
    monkeypatch.setattr(
        pipeline, "get_version", AsyncMock(return_value=_published_version())
    )
    fetch_spy = AsyncMock(return_value="")
    monkeypatch.setattr(pipeline, "fetch_graph_ntriples", fetch_spy)

    with pytest.raises(pipeline.PublishedTargetError):
        await pipeline.apply_operations_request(
            ctx, _request(PUBLISHED_VERSION_IRI), redis_client=None
        )

    # The published-status check runs before the scratch graph is even
    # fetched -- no partial work happens against a target we're about to
    # reject.
    fetch_spy.assert_not_called()


async def test_apply_against_a_draft_version_target_is_unaffected(
    monkeypatch: pytest.MonkeyPatch, ctx: pipeline.ApplyContext
) -> None:
    draft_version = GraphVersion(
        version_iri=f"{WORKING_GRAPH}:v0.2.0",
        semver="0.2.0",
        status="draft",
        created_at=datetime.now(UTC),
        published_at=None,
        actor_iri=AUTHENTICATED_PRINCIPAL,
        workspace_id="w1",
    )
    monkeypatch.setattr(pipeline, "get_version", AsyncMock(return_value=draft_version))
    monkeypatch.setattr(pipeline, "fetch_graph_ntriples", AsyncMock(return_value=""))
    monkeypatch.setattr(
        pipeline, "mint_version", AsyncMock(return_value=(f"{WORKING_GRAPH}:v0.3.0", "0.3.0"))
    )
    monkeypatch.setattr(pipeline, "load_graph", AsyncMock())
    monkeypatch.setattr(
        pipeline, "write_activity", AsyncMock(return_value="urn:weave:instances:activity-1")
    )
    monkeypatch.setattr(pipeline, "enqueue", AsyncMock())
    from weave_backend.operations import metrics as ops_metrics

    monkeypatch.setattr(ops_metrics, "emit_mutation_outcome_metric", AsyncMock())

    result = await pipeline.apply_operations_request(
        ctx, _request(f"{WORKING_GRAPH}:v0.2.0"), redis_client=None
    )

    assert isinstance(result, ApplyResponse)
    assert result.applied_count == 1
