"""CE-TASK-001 unit tests: idempotency-key cache + lock (AC-001-04).

Uses an in-process fake Redis (async, lock-protected dict) rather than a
real Redis connection -- keeps this suite in the fast/unit lane. The real
store is exercised for real in the docker-marked integration suite.
"""

from __future__ import annotations

import asyncio
import time

import pytest

from weave_backend.operations.idempotency import (
    get_cached_response,
    release_lock,
    store_response,
    try_acquire_lock,
)


class FakeRedis:
    """Minimal async stand-in for the subset of redis-py's API this module
    uses -- `set(..., nx=True, ex=...)`, `get`, `delete`. A real asyncio.Lock
    makes the NX check atomic across concurrently-scheduled coroutines in
    the same event loop, mirroring what a real Redis server guarantees
    across processes.
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
            if entry is None:
                return None
            value, expires_at = entry
            if expires_at is not None and time.monotonic() > expires_at:
                del self._store[key]
                return None
            return value

    async def delete(self, key: str) -> None:
        async with self._lock:
            self._store.pop(key, None)


@pytest.fixture
def fake_redis() -> FakeRedis:
    return FakeRedis()


async def test_cache_miss_returns_none(fake_redis: FakeRedis) -> None:
    assert await get_cached_response(fake_redis, "tenant-a", "key-1") is None


async def test_store_then_get_round_trips(fake_redis: FakeRedis) -> None:
    await store_response(fake_redis, "tenant-a", "key-1", {"activity_iri": "urn:x"})

    cached = await get_cached_response(fake_redis, "tenant-a", "key-1")

    assert cached == {"activity_iri": "urn:x"}


async def test_same_key_different_tenant_does_not_collide(fake_redis: FakeRedis) -> None:
    await store_response(fake_redis, "tenant-a", "key-1", {"activity_iri": "urn:a"})

    assert await get_cached_response(fake_redis, "tenant-b", "key-1") is None


async def test_only_one_concurrent_caller_acquires_the_lock(fake_redis: FakeRedis) -> None:
    results = await asyncio.gather(
        *(try_acquire_lock(fake_redis, "tenant-a", "key-1") for _ in range(10))
    )

    assert sum(1 for acquired in results if acquired) == 1


async def test_release_then_reacquire_succeeds(fake_redis: FakeRedis) -> None:
    assert await try_acquire_lock(fake_redis, "tenant-a", "key-1") is True
    await release_lock(fake_redis, "tenant-a", "key-1")

    assert await try_acquire_lock(fake_redis, "tenant-a", "key-1") is True
