"""PLAT-V1-TASK-024 (AC-1/AC-6): the tenant-scoped `GET /api/proxy/events`
pass-through over CE-EVENT-1. CE and the platform share one `weave_backend`
process/database (`routers/events.py::read_events`), so "proxy" here means
"call the same tenant-RLS'd read helper in-process" -- no second HTTP hop,
no reshaping (Arch Law 2). One function so the HTTP route (AC-6) and the
`collaboration-activity` binding fetch (AC-1) never diverge on tenant
scoping.
"""

from __future__ import annotations

from dataclasses import dataclass

import asyncpg

from weave_backend.operations.events import read_events


@dataclass(frozen=True)
class ProxyEventsResult:
    rows: list[asyncpg.Record]
    latest_seq: int
    gone: bool


async def proxy_events(
    conn: asyncpg.Connection, *, tenant_id: str, since_seq: int, limit: int = 100
) -> ProxyEventsResult:
    """Tenant comes from the caller's already-RLS'd connection/`tenant_id`
    -- never a client-supplied param (AC-6 cross-tenant-read family).
    """
    page = await read_events(conn, tenant_id=tenant_id, since_seq=since_seq, limit=limit)
    return ProxyEventsResult(rows=page.events, latest_seq=page.latest_seq, gone=page.aged_out)
