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
from weave_backend.schemas.operations import AddNodeOp, ApplyRequest, ApplyResponse

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
        tenant_id="t1", workspace_id="w1", named_graph_iri=WORKING_GRAPH, conn=AsyncMock()
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
