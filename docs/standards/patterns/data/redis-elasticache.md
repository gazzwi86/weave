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
from typing import Any

import boto3
import redis.asyncio as redis

_TTL_SECONDS = 300


def _redis_url() -> str:
    client = boto3.client("secretsmanager")
    secret = client.get_secret_value(SecretId="weave/elasticache/redis")
    return json.loads(secret["SecretString"])["url"]  # rediss://... , no hard-coded creds


# decode_responses=True → GET returns str, ready for json.loads.
cache = redis.from_url(_redis_url(), decode_responses=True)


async def get_entity(tenant_id: str, entity_id: str) -> dict[str, Any] | None:
    key = f"entity:{tenant_id}:{entity_id}"  # tenant-scoped key
    cached = await cache.get(key)
    if cached is not None:
        return json.loads(cached)
    record = await _load_from_source(tenant_id, entity_id)  # cache-aside miss
    if record is not None:
        await cache.set(key, json.dumps(record), ex=_TTL_SECONDS)
    return record


async def _load_from_source(tenant_id: str, entity_id: str) -> dict[str, Any] | None:
    raise NotImplementedError  # source-of-truth read (Aurora / RDF store)
```

**Why:** Cache-aside keeps the cache lazily populated and the source of truth authoritative — a
miss reads through and back-fills with an explicit TTL (`ex=`), so stale entries self-expire.
`decode_responses=True` yields `str` so `json` is the single (de)serialization boundary.

**Security:** The connection URL (with any auth token, `rediss://` in-transit TLS) is fetched from
AWS Secrets Manager at startup — never hard-coded, never in `.env`. Cache keys are tenant-prefixed
so one tenant can never read another's cached rows.

**Anti-patterns:** hard-coded host/password or `Redis(host=..., password=...)` literals; the
blocking `import redis` client inside async handlers; caching without a TTL (unbounded staleness);
un-prefixed keys that leak across tenants; caching PII/secrets in plaintext values.
