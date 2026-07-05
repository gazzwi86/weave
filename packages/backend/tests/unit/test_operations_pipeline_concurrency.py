"""CE-TASK-001 unit test: idempotent replay under real concurrency (AC-001-04,
DoD "idempotency dedup verified under concurrent requests").

`test_operations_idempotency.py` proves the Redis primitives are safe under
concurrency (only one caller wins the lock); this test proves
`pipeline.apply_operations_request` itself only ever runs the mutation once
for two callers racing on the same idempotency key -- the second must wait
and return the first's cached result, never re-apply.
"""

from __future__ import annotations

import asyncio
import time
from unittest.mock import AsyncMock

import pytest

from weave_backend.operations import metrics as ops_metrics
from weave_backend.operations import pipeline
from weave_backend.operations.idempotency import try_acquire_lock
from weave_backend.schemas.operations import (
    AddNodeOp,
    ApplyRequest,
    ApplyResponse,
    ViolationsResponse,
)

WORKING_GRAPH = "urn:weave:tenant:t1:ws:w1"


class FakeRedis:
    """Minimal async stand-in for the subset of redis-py's API `idempotency.py`
    uses -- see `test_operations_idempotency.py` for the same shape.
    """

    def __init__(self) -> None:
        self._store: dict[str, tuple[str, float | None]] = {}
        self._lock = asyncio.Lock()

    async def set(
        self, key: str, value: str, *, nx: bool = False, ex: int | None = None
    ) -> bool | None:
        async with self._lock:
            if nx and key in self._store:
                return None
            expires_at = time.monotonic() + ex if ex else None
            self._store[key] = (value, expires_at)
            return True

    async def get(self, key: str) -> str | None:
        async with self._lock:
            entry = self._store.get(key)
            return None if entry is None else entry[0]

    async def delete(self, key: str) -> None:
        async with self._lock:
            self._store.pop(key, None)


@pytest.fixture
def ctx() -> pipeline.ApplyContext:
    return pipeline.ApplyContext(
        tenant_id="t1",
        workspace_id="w1",
        named_graph_iri=WORKING_GRAPH,
        conn=AsyncMock(),
        principal_iri="urn:weave:principal:user:u-real",
    )


def _request(key: str) -> ApplyRequest:
    return ApplyRequest(
        operations=[AddNodeOp(op="add_node", ref="a1", kind="Actor", label="Billing Team")],
        actor="urn:weave:principal:test",
        idempotency_key=key,
    )


async def test_concurrent_replays_apply_the_mutation_exactly_once(
    monkeypatch: pytest.MonkeyPatch, ctx: pipeline.ApplyContext
) -> None:
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
    apply_uncached_spy = AsyncMock(wraps=pipeline._apply_uncached)
    monkeypatch.setattr(pipeline, "_apply_uncached", apply_uncached_spy)

    redis_client = FakeRedis()
    request = _request("concurrent-key-1")

    first, second = await asyncio.gather(
        pipeline.apply_operations_request(ctx, request, redis_client),
        pipeline.apply_operations_request(ctx, request, redis_client),
    )

    assert apply_uncached_spy.await_count == 1
    assert isinstance(first, ApplyResponse)
    assert isinstance(second, ApplyResponse)
    assert first == second


async def test_concurrent_replays_of_a_violating_batch_return_422_not_500(
    monkeypatch: pytest.MonkeyPatch, ctx: pipeline.ApplyContext
) -> None:
    """PR #20 finding 2a: only `ApplyResponse` outcomes were cached, so a
    concurrent replay of a *violating* batch had nothing valid to replay --
    the losing caller would poll, find a cache entry it couldn't
    reconstruct as `ApplyResponse`, and 500. Violations must be cached too,
    and reconstructed as `ViolationsResponse` on replay.
    """
    monkeypatch.setattr(pipeline, "fetch_graph_turtle", AsyncMock(return_value=""))
    monkeypatch.setattr(ops_metrics, "emit_mutation_outcome_metric", AsyncMock())

    redis_client = FakeRedis()
    request = ApplyRequest(
        # Process with no `performedBy` -- trips a Violation, no commit.
        operations=[AddNodeOp(op="add_node", ref="p1", kind="Process", label="Invoicing")],
        actor="urn:weave:principal:test",
        idempotency_key="concurrent-violation-key",
    )

    first, second = await asyncio.gather(
        pipeline.apply_operations_request(ctx, request, redis_client),
        pipeline.apply_operations_request(ctx, request, redis_client),
    )

    assert isinstance(first, ViolationsResponse)
    assert isinstance(second, ViolationsResponse)


async def test_slow_concurrent_holder_raises_timeout_not_a_malformed_response(
    monkeypatch: pytest.MonkeyPatch, ctx: pipeline.ApplyContext
) -> None:
    """PR #20 finding 2b: if the first caller's lock is held but it never
    stores a response (e.g. its process crashed), the second caller must see
    a clean `TimeoutError` -- the router maps this to 409, not a raw 500.
    Poll window is aligned to the lock TTL (module docstring); shrink both
    here for a fast test.
    """
    monkeypatch.setattr(pipeline, "_POLL_ATTEMPTS", 3)
    monkeypatch.setattr(pipeline, "_POLL_INTERVAL_SECONDS", 0.01)

    redis_client = FakeRedis()
    key = "stuck-lock-key"
    assert await try_acquire_lock(redis_client, ctx.tenant_id, key)

    with pytest.raises(TimeoutError):
        await pipeline.apply_operations_request(ctx, _request(key), redis_client)
