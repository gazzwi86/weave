"""Redis-backed store for Request Studio intake records + their SSE event
log (BE-TASK-003, build-engine EPIC-001).

ponytail: a `requests` row is provisional scratch state -- the whole point
of Request Studio is to "evaluate scope... before committing resources to a
project" (the task brief's own user story). That's exactly what a TTL'd
Redis hash is for, not a durable Aurora Postgres table: no new migration,
no cross-lane migration-number collision, and it reuses the `redis` package
that was already a project dependency with no prior caller. Promote to
Postgres if/when a request ever needs to survive past its TTL or be
queried/joined the way `projects` rows are (see ADR in
`docs/specs/weave/engines/build-engine/decisions/ADR-001.md`).

Event delivery is a Redis **list**, not pure pub/sub, despite the task
brief's design-decision table naming pub/sub -- see the same ADR. A pub/sub
subscriber can only ever see messages published *after* it subscribes, and
`GET .../stream` can't subscribe before it knows the (server-generated)
`request_id`, which only exists after `POST /api/requests`'s background
task has already started (and, for a fast/mocked drafting pipeline, may
already have *finished* running by the time a client can even ask for the
stream). A list makes every event replayable in order, at any time, at the
cost of a short poll interval instead of a push -- well within AC-4's 5s
first-token budget.
"""

from __future__ import annotations

import asyncio
import json
import os
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import redis.asyncio as redis

#: ponytail: 24h scratch TTL -- no AC pins an exact value; a draft the user
#: never comes back to look at within a day is presumed abandoned.
REQUEST_TTL_SECONDS = 24 * 60 * 60

_POLL_INTERVAL_SECONDS = 0.15
_MAX_WAIT_SECONDS = 65.0  # slightly above the 60s drafting timeout (AC-4)

_client: redis.Redis | None = None
_client_loop: asyncio.AbstractEventLoop | None = None


async def get_redis_client() -> redis.Redis:
    # ponytail: same loop-rebind guard as db/pool.py's asyncpg pool -- a
    # plain module-level singleton would try to reuse a dead event loop's
    # connections on the second pytest-asyncio test.
    global _client, _client_loop
    current_loop = asyncio.get_event_loop()
    if _client is None or _client_loop is not current_loop:
        host = os.environ.get("REDIS_HOST", "localhost")
        port = int(os.environ.get("REDIS_PORT", os.environ.get("WEAVE_REDIS_PORT", "6379")))
        _client = redis.Redis(host=host, port=port, decode_responses=True)
        _client_loop = current_loop
    return _client


async def close_redis_client() -> None:
    global _client, _client_loop
    if _client is not None:
        await _client.aclose()
        _client = None
        _client_loop = None


def _record_key(request_id: str) -> str:
    return f"request:{request_id}:record"


def _events_key(request_id: str) -> str:
    return f"request:{request_id}:events"


@dataclass(frozen=True)
class RequestRecord:
    request_id: str
    tenant_id: str
    run_mode: str
    status: str
    graph_context: str = "unavailable"
    draft_content: dict[str, str] | None = None
    created_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())


async def create_request_record(client: redis.Redis, record: RequestRecord) -> None:
    key = _record_key(record.request_id)
    # ponytail: redis-py's `hset` stub types `mapping` as a fixed bytes/str/
    # int/float key union, invariant -- a plain `dict[str, Any]` never
    # matches it structurally even though str keys are exactly what
    # `decode_responses=True` expects at runtime.
    await client.hset(
        key,
        mapping={
            "tenant_id": record.tenant_id,
            "run_mode": record.run_mode,
            "status": record.status,
            "graph_context": record.graph_context,
            "draft_content": json.dumps(record.draft_content) if record.draft_content else "",
            "created_at": record.created_at,
        },
    )
    await client.expire(key, REQUEST_TTL_SECONDS)


async def update_request_record(client: redis.Redis, request_id: str, **fields: Any) -> None:
    mapping = dict(fields)
    if mapping.get("draft_content") is not None:
        mapping["draft_content"] = json.dumps(mapping["draft_content"])
    await client.hset(_record_key(request_id), mapping=mapping)  # type: ignore[arg-type]


async def get_request_record(
    client: redis.Redis, request_id: str, *, tenant_id: str
) -> RequestRecord | None:
    # decode_responses=True guarantees str values at runtime; redis-py's
    # stub return type is `bytes | str` regardless (it can't see that flag
    # statically), so `str(...)` below is a real narrowing, not a cast.
    raw = await client.hgetall(_record_key(request_id))
    if not raw or raw.get("tenant_id") != tenant_id:
        return None
    draft_raw = str(raw.get("draft_content") or "")
    return RequestRecord(
        request_id=request_id,
        tenant_id=str(raw["tenant_id"]),
        run_mode=str(raw["run_mode"]),
        status=str(raw["status"]),
        graph_context=str(raw.get("graph_context", "unavailable")),
        draft_content=json.loads(draft_raw) if draft_raw else None,
        created_at=str(raw["created_at"]),
    )


async def publish_event(client: redis.Redis, request_id: str, event: dict[str, Any]) -> None:
    key = _events_key(request_id)
    await client.rpush(key, json.dumps(event))
    await client.expire(key, REQUEST_TTL_SECONDS)


async def subscribe_events(client: redis.Redis, request_id: str) -> AsyncIterator[dict[str, Any]]:
    """Replays every event recorded so far for `request_id`, in order, then
    keeps polling for new ones until a `done: true` event is seen or
    `_MAX_WAIT_SECONDS` elapses (a safety valve -- normal flows always end
    in `done`).
    """
    key = _events_key(request_id)
    seen = 0
    loop = asyncio.get_event_loop()
    deadline = loop.time() + _MAX_WAIT_SECONDS
    while True:
        raw_events = await client.lrange(key, seen, -1)
        for raw in raw_events:
            seen += 1
            payload: dict[str, Any] = json.loads(raw)
            yield payload
            if payload.get("done"):
                return
        if loop.time() > deadline:
            return
        await asyncio.sleep(_POLL_INTERVAL_SECONDS)
