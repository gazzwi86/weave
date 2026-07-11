"""TASK-003 (EPIC-004) unit tests: CE-BRAND-1's projection cache
(`brand/cache.py`) -- cache key is `(tenant_id, version_iri)` per the task
brief's implementation hint, no explicit invalidation needed because a new
CE-WRITE-1 commit always mints a brand-new `version_iri` (see module
docstring).
"""

from __future__ import annotations

import time

import pytest

from weave_backend.brand.cache import get_cached, set_cached


class FakeRedis:
    """Same minimal async stand-in as `test_operations_idempotency.py`."""

    def __init__(self) -> None:
        self._store: dict[str, tuple[str, float | None]] = {}

    async def set(self, key: str, value: str, *, ex: int | None = None) -> None:
        expires_at = time.monotonic() + ex if ex else None
        self._store[key] = (value, expires_at)

    async def get(self, key: str) -> str | None:
        entry = self._store.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if expires_at is not None and time.monotonic() > expires_at:
            del self._store[key]
            return None
        return value


@pytest.fixture
def fake_redis() -> FakeRedis:
    return FakeRedis()


async def test_cache_miss_returns_none(fake_redis: FakeRedis) -> None:
    result = await get_cached(fake_redis, kind="tokens", tenant_id="t1", version_iri="v1")

    assert result is None


async def test_store_then_get_round_trips(fake_redis: FakeRedis) -> None:
    await set_cached(
        fake_redis, kind="tokens", tenant_id="t1", version_iri="v1", value={"color": {}}
    )

    cached = await get_cached(fake_redis, kind="tokens", tenant_id="t1", version_iri="v1")

    assert cached == {"color": {}}


async def test_different_tenant_does_not_collide(fake_redis: FakeRedis) -> None:
    await set_cached(fake_redis, kind="tokens", tenant_id="t1", version_iri="v1", value={"a": 1})

    assert await get_cached(fake_redis, kind="tokens", tenant_id="t2", version_iri="v1") is None


async def test_new_commit_mints_new_version_iri_so_old_cache_entry_is_unreachable(
    fake_redis: FakeRedis,
) -> None:
    """AC-003-03's caching implementation hint: keying on version_iri means a
    new commit (new version_iri) can never see a stale cached value from the
    previous version -- it is a different key, not an overwrite.
    """
    await set_cached(fake_redis, kind="tokens", tenant_id="t1", version_iri="v1", value={"a": 1})

    result_after_commit = await get_cached(
        fake_redis, kind="tokens", tenant_id="t1", version_iri="v2"
    )

    assert result_after_commit is None


async def test_tokens_and_voice_rules_kinds_do_not_collide(fake_redis: FakeRedis) -> None:
    await set_cached(fake_redis, kind="tokens", tenant_id="t1", version_iri="v1", value={"a": 1})

    assert (
        await get_cached(fake_redis, kind="voice-rules", tenant_id="t1", version_iri="v1") is None
    )
