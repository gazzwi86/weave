"""CE-BRAND-1 read-through cache for the two projection endpoints.

Task brief: "cache key: (tenant_id, resolved_version_or_draft_hash)". Each
CE-WRITE-1 commit mints a brand-new `version_iri` (`operations/versioning.py`
`mint_version`), so keying on `version_iri` already gives per-version
isolation for free -- a stale entry can never be served for a *new* commit,
because a new commit is a different key, not an overwrite of the old one.
No explicit invalidation is needed (unlike `settings/cache.py`'s version
counter, which exists because settings ARE mutated in place). A short TTL
just bounds memory for old versions that will never be read again.
"""

from __future__ import annotations

import json
from typing import Any, Protocol

CACHE_TTL_SECONDS = 300


class RedisGetSet(Protocol):
    """The subset of redis-py's API this module needs -- `get`/`set` only
    (unlike `operations/idempotency.py`'s `RedisLike`, this cache never
    deletes: see module docstring for why no invalidation is needed).
    """

    async def get(self, key: str, /) -> str | None: ...
    async def set(self, key: str, value: str, /, *, ex: int | None = None) -> Any: ...


def _cache_key(kind: str, tenant_id: str, version_iri: str) -> str:
    return f"ce:brand:{kind}:{tenant_id}:{version_iri}"


async def get_cached(
    redis_client: RedisGetSet, *, kind: str, tenant_id: str, version_iri: str
) -> Any:
    raw = await redis_client.get(_cache_key(kind, tenant_id, version_iri))
    return None if raw is None else json.loads(raw)


async def set_cached(
    redis_client: RedisGetSet, *, kind: str, tenant_id: str, version_iri: str, value: Any
) -> None:
    await redis_client.set(
        _cache_key(kind, tenant_id, version_iri), json.dumps(value), ex=CACHE_TTL_SECONDS
    )
