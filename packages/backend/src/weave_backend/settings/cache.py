"""AC-4 caching: 30s TTL on resolved settings reads.

ponytail: invalidation is version-scoped rather than a `KEYS`-pattern scan
(Redis `KEYS` is O(n) and blocks the server -- never do that even in a
cache this small). Every write bumps a per-tenant version counter; cache
keys embed the version they were computed under, so a bump makes every
previously-cached key for that tenant unreachable (and it'll simply expire
via the normal 30s TTL rather than needing an explicit delete).
"""

from __future__ import annotations

import json

import redis.asyncio as redis

from weave_backend.settings.resolver import ResolvedSetting

CACHE_TTL_SECONDS = 30

Redis = redis.Redis


def _version_key(tenant_id: str) -> str:
    return f"settings_version:{tenant_id}"


def _cache_key(tenant_id: str, version: int, context_iri: str, key: str) -> str:
    return f"settings_cache:{tenant_id}:{version}:{context_iri}:{key}"


async def get_cached(
    redis: Redis, *, tenant_id: str, key: str, context_iri: str
) -> ResolvedSetting | None:
    version = int(await redis.get(_version_key(tenant_id)) or 0)
    raw = await redis.get(_cache_key(tenant_id, version, context_iri, key))
    if raw is None:
        return None
    data = json.loads(raw)
    return ResolvedSetting(**data)


async def set_cached(
    redis: Redis, *, tenant_id: str, key: str, context_iri: str, resolved: ResolvedSetting
) -> None:
    version = int(await redis.get(_version_key(tenant_id)) or 0)
    payload = json.dumps(
        {
            "key": resolved.key,
            "value": resolved.value,
            "resolved_at": resolved.resolved_at,
            "resolved_from_iri": resolved.resolved_from_iri,
        }
    )
    await redis.set(
        _cache_key(tenant_id, version, context_iri, key), payload, ex=CACHE_TTL_SECONDS
    )


async def invalidate_tenant(redis: Redis, *, tenant_id: str) -> None:
    await redis.incr(_version_key(tenant_id))
