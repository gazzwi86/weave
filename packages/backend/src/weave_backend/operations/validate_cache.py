"""Report cache for CE-TASK-006 `GET /api/validate`, mirroring
`metrics_cache.py`'s shape.

Keyed on `(tenant_id, workspace_id, state_stamp)` where `state_stamp`
already encodes BOTH the data state (`versioning.head_version_iri` for
draft, or the resolved immutable version_iri) and the tenant shapes state
(`shacl.shapes_version_token`) -- composed by the caller
(`validate_report.py`). A cache miss at the current stamp IS the
"validation pending" state (AC-006-04): no separate hash-compare needed,
and a stale report (data or shapes moved) simply misses instead of being
served, so callers can never read a mismatched stamp as fresh. The TTL is
a memory bound only, not a correctness mechanism -- the stamp is what
keeps the report honest.
"""

from __future__ import annotations

import json
from typing import Any

import redis.asyncio as redis

VALIDATE_CACHE_TTL_SECONDS = 24 * 60 * 60


def _cache_key(tenant_id: str, workspace_id: str, state_stamp: str) -> str:
    return f"ce:validate:report:{tenant_id}:{workspace_id}:{state_stamp}"


async def get_cached_report(
    client: redis.Redis, tenant_id: str, workspace_id: str, state_stamp: str
) -> dict[str, Any] | None:
    raw = await client.get(_cache_key(tenant_id, workspace_id, state_stamp))
    if raw is None:
        return None
    parsed: dict[str, Any] = json.loads(raw)
    return parsed


async def store_report(
    client: redis.Redis,
    tenant_id: str,
    workspace_id: str,
    state_stamp: str,
    value: dict[str, Any],
) -> None:
    await client.set(
        _cache_key(tenant_id, workspace_id, state_stamp),
        json.dumps(value),
        ex=VALIDATE_CACHE_TTL_SECONDS,
    )
