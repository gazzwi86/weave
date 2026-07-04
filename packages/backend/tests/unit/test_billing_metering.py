"""AC-3/AC-4: metering is non-blocking (durable write happens on a task the
caller can await, not inline) and every run costs exactly 1 unit regardless
of duration.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from weave_backend.billing.metering import (
    RUN_COST_USD,
    RunUsageRecord,
    TokenUsageRecord,
    build_run_usage_record,
    consumed_key,
    record_run_usage,
    record_token_usage,
)

_TENANT = "acme-corp"
_WORKSPACE = "ws-1"


class _FakeRedis:
    def __init__(self) -> None:
        self.values: dict[str, float] = {}

    async def incrbyfloat(self, key: str, amount: float) -> float:
        self.values[key] = self.values.get(key, 0.0) + amount
        return self.values[key]


def _redis() -> Any:
    """Typed `Any` -- see `test_billing_gate.py`'s `_redis` docstring."""
    return _FakeRedis()


class _FakeQueue:
    def __init__(self) -> None:
        self.token_calls: list[TokenUsageRecord] = []
        self.run_calls: list[RunUsageRecord] = []

    async def put_token_usage(self, record: TokenUsageRecord) -> None:
        self.token_calls.append(record)

    async def put_run_usage(self, record: RunUsageRecord) -> None:
        self.run_calls.append(record)


def test_build_run_usage_record_always_costs_one_unit() -> None:
    """AC-4: a 3-second run and a 3-hour run both cost 1.0 -- duration
    never enters the calculation."""
    record = build_run_usage_record(
        tenant_id=_TENANT, workspace_id=_WORKSPACE, run_id="run-1", status="completed"
    )

    assert record.run_cost_usd == RUN_COST_USD == 1.0


async def test_record_token_usage_increments_redis_and_queues_durable_write() -> None:
    redis = _redis()
    queue = _FakeQueue()
    record = TokenUsageRecord(
        tenant_id=_TENANT,
        workspace_id=_WORKSPACE,
        principal_iri="urn:weave:principal:user:u-1",
        model_tier="sonnet",
        input_tokens=100,
        output_tokens=50,
        cost_usd=0.42,
        ts=datetime.now(UTC),
    )

    task = await record_token_usage(redis, record, queue=queue)
    await task

    period_key = next(iter(redis.values))
    assert period_key == consumed_key(_TENANT, _WORKSPACE, period_key.split(":")[3])
    assert redis.values[period_key] == 0.42
    assert queue.token_calls == [record]


async def test_record_run_usage_increments_redis_by_exactly_one_unit() -> None:
    redis = _redis()
    queue = _FakeQueue()
    record = build_run_usage_record(
        tenant_id=_TENANT, workspace_id=_WORKSPACE, run_id="run-1", status="completed"
    )

    task = await record_run_usage(redis, record, queue=queue)
    await task

    assert list(redis.values.values()) == [1.0]
    assert queue.run_calls == [record]
