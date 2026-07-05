"""Idempotency-key cache + lock for CE-WRITE-1 (AC-001-04).

24h TTL: "safe retry under network failure" -- a caller that never saw its
first response can resend the same key and get the original result back
without re-applying. The lock only gates the *first* caller through; a
duplicate caller arriving while the first is still in flight should wait
and poll for the cached result (`pipeline.py`), not re-run the pipeline.
"""

from __future__ import annotations

import json
from typing import Any, Protocol

IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60
LOCK_TTL_SECONDS = 30


class RedisLike(Protocol):
    async def set(
        self, key: str, value: str, *, nx: bool = False, ex: int | None = None
    ) -> Any: ...
    async def get(self, key: str) -> str | None: ...
    async def delete(self, key: str) -> Any: ...


def _response_key(tenant_id: str, key: str) -> str:
    return f"ce:operations:idempotency:{tenant_id}:{key}"


def _lock_key(tenant_id: str, key: str) -> str:
    return f"ce:operations:idempotency-lock:{tenant_id}:{key}"


async def get_cached_response(client: RedisLike, tenant_id: str, key: str) -> dict[str, Any] | None:
    raw = await client.get(_response_key(tenant_id, key))
    if raw is None:
        return None
    parsed: dict[str, Any] = json.loads(raw)
    return parsed


async def store_response(
    client: RedisLike, tenant_id: str, key: str, value: dict[str, Any]
) -> None:
    await client.set(_response_key(tenant_id, key), json.dumps(value), ex=IDEMPOTENCY_TTL_SECONDS)


async def try_acquire_lock(client: RedisLike, tenant_id: str, key: str) -> bool:
    acquired = await client.set(_lock_key(tenant_id, key), "1", nx=True, ex=LOCK_TTL_SECONDS)
    return bool(acquired)


async def release_lock(client: RedisLike, tenant_id: str, key: str) -> None:
    await client.delete(_lock_key(tenant_id, key))
