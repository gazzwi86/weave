"""CE-V1-TASK-009 AC-009-04: `POST /api/operations/apply` rejects an
in-place edit of a *published* `weave:Function`'s signature -- published
signatures are immutable; the change must land as a new revision. Mirrors
`test_operations_pipeline_published_target.py`'s mock-the-module-level-
imports pattern: no real Postgres/Oxigraph needed to exercise the gate.
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from weave_backend.operations import pipeline
from weave_backend.schemas.operations import (
    AddEdgeOp,
    AddNodeOp,
    ApplyRequest,
    ApplyResponse,
    UpdateNodeOp,
)

WORKING_GRAPH = "urn:weave:tenant:t1:ws:w1"
AUTHENTICATED_PRINCIPAL = "urn:weave:principal:user:u-real"
PUBLISHED_VERSION_IRI = f"{WORKING_GRAPH}:v0.1.0"
FN_IRI = "https://weave.io/instances/fn-reorderStock"


@pytest.fixture
def ctx() -> pipeline.ApplyContext:
    return pipeline.ApplyContext(
        tenant_id="t1",
        workspace_id="w1",
        named_graph_iri=WORKING_GRAPH,
        conn=AsyncMock(),
        principal_iri=AUTHENTICATED_PRINCIPAL,
    )


def _signature_edit_request() -> ApplyRequest:
    return ApplyRequest(
        operations=[
            AddEdgeOp(
                op="add_edge", subject_ref=FN_IRI, predicate="boundKind", object_ref="Activity"
            )
        ],
        actor="urn:weave:principal:test",
        target="draft",
    )


async def test_editing_a_published_functions_signature_raises_immutable_error(
    monkeypatch: pytest.MonkeyPatch, ctx: pipeline.ApplyContext
) -> None:
    monkeypatch.setattr(pipeline, "resolve_version", AsyncMock(return_value=PUBLISHED_VERSION_IRI))
    monkeypatch.setattr(pipeline, "run_query", AsyncMock(return_value={"boolean": True}))
    fetch_spy = AsyncMock(return_value="")
    monkeypatch.setattr(pipeline, "fetch_graph_ntriples", fetch_spy)

    with pytest.raises(pipeline.FunctionSignatureImmutableError):
        await pipeline.apply_operations_request(ctx, _signature_edit_request(), redis_client=None)

    # Fails before any scratch-graph work, same fast-reject shape as
    # PublishedTargetError.
    fetch_spy.assert_not_called()


async def test_defining_a_brand_new_function_is_unaffected(
    monkeypatch: pytest.MonkeyPatch, ctx: pipeline.ApplyContext
) -> None:
    monkeypatch.setattr(pipeline, "resolve_version", AsyncMock(return_value=PUBLISHED_VERSION_IRI))
    ask_spy = AsyncMock(return_value={"boolean": False})
    monkeypatch.setattr(pipeline, "run_query", ask_spy)
    monkeypatch.setattr(pipeline, "fetch_graph_ntriples", AsyncMock(return_value=""))
    monkeypatch.setattr(
        pipeline, "mint_version", AsyncMock(return_value=(f"{WORKING_GRAPH}:v0.2.0", "0.2.0"))
    )
    monkeypatch.setattr(pipeline, "load_graph", AsyncMock())
    monkeypatch.setattr(
        pipeline, "write_activity", AsyncMock(return_value="urn:weave:instances:activity-1")
    )
    monkeypatch.setattr(pipeline, "enqueue", AsyncMock())
    from weave_backend.operations import metrics as ops_metrics

    monkeypatch.setattr(ops_metrics, "emit_mutation_outcome_metric", AsyncMock())

    request = ApplyRequest(
        operations=[
            AddNodeOp(
                op="add_node",
                ref="fn1",
                kind="https://weave.io/ontology/Function",
                label="reorderStock",
            ),
            AddEdgeOp(
                op="add_edge", subject_ref="fn1", predicate="boundKind", object_ref="Activity"
            ),
        ],
        actor="urn:weave:principal:test",
        target="draft",
    )

    result = await pipeline.apply_operations_request(ctx, request, redis_client=None)

    assert isinstance(result, ApplyResponse)
    # The new node's local ref never reaches the ASK check -- only a
    # *pre-existing* subject_ref would.
    ask_spy.assert_not_called()


async def test_label_only_edit_of_a_published_function_is_unaffected(
    monkeypatch: pytest.MonkeyPatch, ctx: pipeline.ApplyContext
) -> None:
    """AC-009-05: label/description edits never trip the immutability
    gate -- `touches_function_signature` only fires on signature predicates.
    """
    monkeypatch.setattr(pipeline, "resolve_version", AsyncMock(return_value=PUBLISHED_VERSION_IRI))
    ask_spy = AsyncMock(return_value={"boolean": True})
    monkeypatch.setattr(pipeline, "run_query", ask_spy)
    monkeypatch.setattr(pipeline, "fetch_graph_ntriples", AsyncMock(return_value=""))
    monkeypatch.setattr(
        pipeline, "mint_version", AsyncMock(return_value=(f"{WORKING_GRAPH}:v0.2.0", "0.2.0"))
    )
    monkeypatch.setattr(pipeline, "load_graph", AsyncMock())
    monkeypatch.setattr(
        pipeline, "write_activity", AsyncMock(return_value="urn:weave:instances:activity-1")
    )
    monkeypatch.setattr(pipeline, "enqueue", AsyncMock())
    from weave_backend.operations import metrics as ops_metrics

    monkeypatch.setattr(ops_metrics, "emit_mutation_outcome_metric", AsyncMock())

    request = ApplyRequest(
        operations=[UpdateNodeOp(op="update_node", iri=FN_IRI, properties={"label": "renamed"})],
        actor="urn:weave:principal:test",
        target="draft",
    )

    result = await pipeline.apply_operations_request(ctx, request, redis_client=None)

    assert isinstance(result, ApplyResponse)
    ask_spy.assert_not_called()
