---
type: Coding Standard
title: "Data — Redis ElastiCache Cache-Aside (python)"
description: "Golden pattern for redis-py asyncio against ElastiCache Redis 7: cache-aside get/set with TTL, JSON (de)serialization, connection URL from Secrets Manager."
tags: [standards, patterns, data, python]
timestamp: 2026-07-01
resource: docs/standards/patterns/data/redis-elasticache.md
topic: data
stack: python
verification: "python3 -m py_compile: OK; uvx ruff check (--target-version py312 --select E,W,F,I,B,C90,UP,PLR --line-length 100): All checks passed!"
---

# Data — Redis ElastiCache Cache-Aside (python)

The house style for caching against ElastiCache Redis 7: an asyncio client whose connection
URL is pulled from Secrets Manager, with tenant-scoped keys and cache-aside get/set + TTL.

```python
import json
from functools import lru_cache
from typing import Any

import boto3
import redis.asyncio as redis

_TTL_SECONDS = 300
# Cache ONLY these non-sensitive fields — never the whole source row (may carry PII).
_CACHEABLE_FIELDS = ("id", "iri", "label", "kind")


def _redis_url() -> str:
    client = boto3.client("secretsmanager")
    secret = client.get_secret_value(SecretId="weave/elasticache/redis")
    return json.loads(secret["SecretString"])["url"]  # rediss://... , no hard-coded creds


@lru_cache(maxsize=1)
def get_cache() -> redis.Redis:
    """Lazy singleton: build the client on first use — the secret fetch never runs at import."""
    # decode_responses=True → GET returns str, ready for json.loads.
    return redis.from_url(_redis_url(), decode_responses=True)


def _projection(record: dict[str, Any]) -> dict[str, Any]:
    """Non-sensitive projection of the source row — the only thing we put in the cache."""
    return {k: record[k] for k in _CACHEABLE_FIELDS if k in record}


async def get_entity(tenant_id: str, entity_id: str) -> dict[str, Any] | None:
    cache = get_cache()
    key = f"entity:{tenant_id}:{entity_id}"  # tenant-scoped key
    cached = await cache.get(key)
    if cached is not None:
        return json.loads(cached)
    record = await _load_from_source(tenant_id, entity_id)  # cache-aside miss
    if record is None:
        return None
    projection = _projection(record)  # cache the projection, not the raw (PII-bearing) row
    await cache.set(key, json.dumps(projection), ex=_TTL_SECONDS)
    return projection


async def _load_from_source(tenant_id: str, entity_id: str) -> dict[str, Any] | None:
    raise NotImplementedError  # source-of-truth read (Aurora / RDF store)
```

**Why:** Cache-aside keeps the cache lazily populated and the source of truth authoritative — a
miss reads through and back-fills with an explicit TTL (`ex=`), so stale entries self-expire.
`decode_responses=True` yields `str` so `json` is the single (de)serialization boundary.

**Security:** The connection URL (with any auth token, `rediss://` in-transit TLS) is fetched from
AWS Secrets Manager on first use via `get_cache()` — never hard-coded, never in `.env`, and never at
import time (so tests and offline dev don't hit AWS). Only the non-sensitive `_projection` is cached,
never the raw source row, so PII never lands in Redis. Cache keys are tenant-prefixed so one tenant
can never read another's cached rows.

**Anti-patterns:** hard-coded host/password or `Redis(host=..., password=...)` literals; building
the client (and fetching its secret) at module import instead of a lazy getter; the blocking
`import redis` client inside async handlers; caching without a TTL (unbounded staleness);
un-prefixed keys that leak across tenants; caching the whole source row or any PII/secret in plaintext.
