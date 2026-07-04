"""AC-3/AC-4: async, non-blocking usage recording. Redis holds the
real-time running total the gate reads (`billing:{tid}:{wid}:{period}:
consumed_usd`, updated synchronously since it's cheap); the durable record
goes through the swappable `MeteringQueue` seam -- SQS is the v-later
production queue (Law F: no real AWS here), a same-process Aurora insert
is the dev/M1 implementation. Callers get back the `asyncio.Task` doing the
durable write: production call sites can ignore it (fire-and-forget,
non-blocking); tests await it to observe completion deterministically. Task
lifetime is safe to discard -- `_spawn_background` keeps a strong ref in a
module-level set until each task finishes, so an unreferenced task is never
garbage-collected mid-write (asyncio only holds a weak ref otherwise).
"""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import Coroutine
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol

import redis.asyncio as redis_lib

from weave_backend.billing.period import current_period
from weave_backend.db.pool import tenant_connection

#: AC-4: every automation run costs exactly one unit, regardless of duration.
RUN_COST_USD = 1.0


@dataclass(frozen=True)
class TokenUsageRecord:
    tenant_id: str
    workspace_id: str
    principal_iri: str
    model_tier: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    ts: datetime


@dataclass(frozen=True)
class RunUsageRecord:
    tenant_id: str
    workspace_id: str
    run_id: str
    status: str
    run_cost_usd: float
    ts: datetime


def build_run_usage_record(
    *, tenant_id: str, workspace_id: str, run_id: str, status: str
) -> RunUsageRecord:
    """The only way production code should construct a `RunUsageRecord` --
    centralises the "one unit per run" invariant in one place rather than
    trusting every call site to pass `run_cost_usd=1.0` itself.
    """
    return RunUsageRecord(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        run_id=run_id,
        status=status,
        run_cost_usd=RUN_COST_USD,
        ts=datetime.now(UTC),
    )


class MeteringQueue(Protocol):
    async def put_token_usage(self, record: TokenUsageRecord) -> None: ...
    async def put_run_usage(self, record: RunUsageRecord) -> None: ...


class AuroraMeteringQueue:
    """ponytail: dev-only implementation -- a direct insert into the durable
    `billing_usage` table on its own (non-caller) connection. SQS is the
    real v-later swap for decoupled, retryable delivery across process
    restarts; this repo runs no live AWS (Law F).
    """

    async def put_token_usage(self, record: TokenUsageRecord) -> None:
        async with tenant_connection(record.tenant_id) as conn:
            await conn.execute(
                """
                INSERT INTO billing_usage
                    (id, tenant_id, workspace_id, record_type, principal_iri, model_tier,
                     input_tokens, output_tokens, cost_usd, period, recorded_at)
                VALUES ($1, $2, $3, 'token_usage', $4, $5, $6, $7, $8, $9, $10)
                """,
                uuid.uuid4(),
                record.tenant_id,
                record.workspace_id,
                record.principal_iri,
                record.model_tier,
                record.input_tokens,
                record.output_tokens,
                record.cost_usd,
                current_period(),
                record.ts,
            )

    async def put_run_usage(self, record: RunUsageRecord) -> None:
        async with tenant_connection(record.tenant_id) as conn:
            await conn.execute(
                """
                INSERT INTO billing_usage
                    (id, tenant_id, workspace_id, record_type, run_id, status, cost_usd,
                     period, recorded_at)
                VALUES ($1, $2, $3, 'run', $4, $5, $6, $7, $8)
                """,
                uuid.uuid4(),
                record.tenant_id,
                record.workspace_id,
                record.run_id,
                record.status,
                record.run_cost_usd,
                current_period(),
                record.ts,
            )


default_metering_queue: MeteringQueue = AuroraMeteringQueue()


def consumed_key(tenant_id: str, workspace_id: str, period: str) -> str:
    return f"billing:{tenant_id}:{workspace_id}:{period}:consumed_usd"


# PR #18 review finding 2: asyncio only holds a weak ref to a task, so an
# unreferenced fire-and-forget task (production call sites discard the
# returned Task) can be GC'd before the durable Aurora insert runs -- a
# CPython-documented gotcha, unacceptable here since Aurora is billing's
# source of truth. Keeping a strong ref in this module-level set until the
# task finishes (discarded via the done callback) fixes it without changing
# the fire-and-forget call-site semantics -- callers still don't await it.
_background_tasks: set[asyncio.Task[None]] = set()


def _spawn_background(coro: Coroutine[object, object, None]) -> asyncio.Task[None]:
    task = asyncio.create_task(coro)
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)
    return task


async def record_token_usage(
    redis: redis_lib.Redis,
    record: TokenUsageRecord,
    *,
    queue: MeteringQueue = default_metering_queue,
) -> asyncio.Task[None]:
    await redis.incrbyfloat(
        consumed_key(record.tenant_id, record.workspace_id, current_period()), record.cost_usd
    )
    return _spawn_background(queue.put_token_usage(record))


async def record_run_usage(
    redis: redis_lib.Redis,
    record: RunUsageRecord,
    *,
    queue: MeteringQueue = default_metering_queue,
) -> asyncio.Task[None]:
    await redis.incrbyfloat(
        consumed_key(record.tenant_id, record.workspace_id, current_period()),
        record.run_cost_usd,
    )
    return _spawn_background(queue.put_run_usage(record))
