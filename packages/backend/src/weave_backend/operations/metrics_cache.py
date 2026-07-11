"""60 s per-(tenant, workspace) cache for CE-METRICS-1 (AC-007-05).

Keyed on `(tenant_id, workspace_id)` -- NOT tenant alone. The aggregate is
scoped to one workspace's draft graph; a tenant-only key would serve caller
A (viewing workspace 1) another caller's workspace-2 numbers whenever both
share a tenant (cross-workspace data leak, not just "stale by a minute" --
the 60 s per-tenant framing in the task pseudocode covers time-staleness
only, not this).
"""

from __future__ import annotations

import json
from typing import Any

import redis.asyncio as redis

METRICS_CACHE_TTL_SECONDS = 60


def _cache_key(tenant_id: str, workspace_id: str) -> str:
    return f"ce:metrics:agg:{tenant_id}:{workspace_id}"


async def get_cached_metrics(
    client: redis.Redis, tenant_id: str, workspace_id: str
) -> dict[str, Any] | None:
    raw = await client.get(_cache_key(tenant_id, workspace_id))
    if raw is None:
        return None
    parsed: dict[str, Any] = json.loads(raw)
    return parsed


async def store_metrics(
    client: redis.Redis, tenant_id: str, workspace_id: str, value: dict[str, Any]
) -> None:
    await client.set(
        _cache_key(tenant_id, workspace_id), json.dumps(value), ex=METRICS_CACHE_TTL_SECONDS
    )
