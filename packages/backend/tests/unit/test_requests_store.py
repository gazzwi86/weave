"""BE-TASK-003: Redis-backed request-record store + SSE event log
(build-engine EPIC-001, Request Studio). Exercised against an in-memory
``_FakeRedis`` double -- no docker/real Redis needed for unit tests (mirrors
``test_projects_router.py``'s ``_fake_tenant_connection`` pattern for
asyncpg).
"""

from __future__ import annotations

import json
from typing import Any

import pytest

from weave_backend.requests.store import (
    RequestRecord,
    create_request_record,
    get_request_record,
    publish_event,
    subscribe_events,
    update_request_record,
)


class _FakeRedis:
    """Implements just the hash/list subset of the ``redis.asyncio.Redis``
    surface that ``store.py`` calls -- enough to prove the store's own
    logic without a real Redis server.
    """

    def __init__(self) -> None:
        self._hashes: dict[str, dict[str, str]] = {}
        self._lists: dict[str, list[str]] = {}

    async def hset(self, name: str, mapping: dict[str, Any]) -> None:
        self._hashes.setdefault(name, {}).update({k: str(v) for k, v in mapping.items()})

    async def hgetall(self, name: str) -> dict[str, str]:
        return dict(self._hashes.get(name, {}))

    async def expire(self, name: str, ttl: int) -> None:
        pass  # ponytail: TTL is a fire-and-forget call against real Redis; no-op fake.

    async def rpush(self, name: str, value: str) -> None:
        self._lists.setdefault(name, []).append(value)

    async def lrange(self, name: str, start: int, end: int) -> list[str]:
        values = self._lists.get(name, [])
        if end == -1:
            return values[start:]
        return values[start : end + 1]


@pytest.fixture
def redis_client() -> _FakeRedis:
    return _FakeRedis()


async def test_create_and_get_request_record_roundtrip(redis_client: _FakeRedis) -> None:
    record = RequestRecord(
        request_id="r1", tenant_id="t1", run_mode="draft_spec_only", status="drafting"
    )

    await create_request_record(redis_client, record)  # type: ignore[arg-type]
    fetched = await get_request_record(redis_client, "r1", tenant_id="t1")  # type: ignore[arg-type]

    assert fetched is not None
    assert fetched.request_id == "r1"
    assert fetched.status == "drafting"
    assert fetched.graph_context == "unavailable"
    assert fetched.draft_content is None


async def test_get_request_record_returns_none_for_wrong_tenant(redis_client: _FakeRedis) -> None:
    record = RequestRecord(request_id="r1", tenant_id="t1", run_mode="spike", status="drafting")
    await create_request_record(redis_client, record)  # type: ignore[arg-type]

    fetched = await get_request_record(redis_client, "r1", tenant_id="t2")  # type: ignore[arg-type]

    assert fetched is None


async def test_get_request_record_returns_none_when_missing(redis_client: _FakeRedis) -> None:
    fetched = await get_request_record(redis_client, "missing", tenant_id="t1")  # type: ignore[arg-type]

    assert fetched is None


async def test_update_request_record_serialises_draft_content(redis_client: _FakeRedis) -> None:
    record = RequestRecord(
        request_id="r1", tenant_id="t1", run_mode="spec_to_build", status="drafting"
    )
    await create_request_record(redis_client, record)  # type: ignore[arg-type]

    await update_request_record(
        redis_client,  # type: ignore[arg-type]
        "r1",
        status="draft_complete",
        draft_content={"brief": "hello"},
    )
    fetched = await get_request_record(redis_client, "r1", tenant_id="t1")  # type: ignore[arg-type]

    assert fetched is not None
    assert fetched.status == "draft_complete"
    assert fetched.draft_content == {"brief": "hello"}


async def test_publish_and_subscribe_replays_events_in_order(redis_client: _FakeRedis) -> None:
    await publish_event(redis_client, "r1", {"section": "brief", "content": "x", "done": False})  # type: ignore[arg-type]
    await publish_event(redis_client, "r1", {"done": True})  # type: ignore[arg-type]

    events = [event async for event in subscribe_events(redis_client, "r1")]  # type: ignore[arg-type]

    assert events == [
        {"section": "brief", "content": "x", "done": False},
        {"done": True},
    ]


async def test_subscribe_events_stops_at_done_even_with_trailing_entries(
    redis_client: _FakeRedis,
) -> None:
    await publish_event(redis_client, "r1", {"done": True})  # type: ignore[arg-type]
    # A stray entry appended after "done" (shouldn't normally happen) must
    # never be yielded -- the generator stops as soon as it sees `done`.
    await redis_client.rpush("request:r1:events", json.dumps({"section": "prd", "done": False}))

    events = [event async for event in subscribe_events(redis_client, "r1")]  # type: ignore[arg-type]

    assert events == [{"done": True}]
