"""ce-perf fix unit test: the write path clones/serializes N-Triples, not
Turtle.

rdflib's Turtle serializer computes a qname/prefix for every term it writes
(`turtle.py::preprocess` -> `compute_qname`); on a working graph with many
distinct instance IRIs and no bound namespace for them, that computation
dominated write latency at 10k-triple scale (profiled: ~35s cumtime across
200 serialize calls in a 100-batch cProfile run, vs ~15ms for the same graph
serialized as N-Triples in isolation -- see ce-perf task notes). N-Triples
needs no qname computation, so switching the *internal* Oxigraph round trip
(fetch + serialize + PUT) to it removes that cost. This is purely a wire
format between the app and Oxigraph: `fetch_graph_turtle`'s callers (the
Turtle-returning read endpoints) are untouched, and Oxigraph itself always
stores triples in its own internal representation regardless of ingest
format, so a GET with `Accept: text/turtle` still returns real Turtle.
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


async def test_apply_clones_via_ntriples_and_promotes_ntriples_with_matching_content_type(
    monkeypatch: pytest.MonkeyPatch, ctx: pipeline.ApplyContext
) -> None:
    fetch_spy = AsyncMock(return_value="")
    load_graph_spy = AsyncMock()
    monkeypatch.setattr(pipeline, "fetch_graph_ntriples", fetch_spy)
    monkeypatch.setattr(pipeline, "load_graph", load_graph_spy)
    monkeypatch.setattr(
        pipeline, "mint_version", AsyncMock(return_value=(f"{WORKING_GRAPH}:v0.1.0", "0.1.0"))
    )
    monkeypatch.setattr(
        pipeline, "write_activity", AsyncMock(return_value="urn:weave:instances:activity-1")
    )
    monkeypatch.setattr(ops_metrics, "emit_mutation_outcome_metric", AsyncMock())
    monkeypatch.setattr(pipeline, "enqueue", AsyncMock())

    request = ApplyRequest(
        operations=[AddNodeOp(op="add_node", ref="a1", kind="Actor", label="Billing Team")],
        actor="urn:weave:principal:test",
    )

    result = await pipeline.apply_operations_request(ctx, request, redis_client=None)

    assert isinstance(result, ApplyResponse)
    fetch_spy.assert_awaited_once_with(WORKING_GRAPH)

    # Both the version-snapshot PUT and the final working-graph promotion
    # PUT must declare the body they're actually sending.
    assert load_graph_spy.await_count == 2
    for call in load_graph_spy.await_args_list:
        assert call.kwargs["content_type"] == "application/n-triples"
        body = call.args[1]
        # N-Triples has no `@prefix`/qname abbreviation -- every term is a
        # full `<...>` IRI. A Turtle regression would emit `@prefix` here.
        assert "@prefix" not in body
        assert "<https://weave.io/instances/actor-" in body
