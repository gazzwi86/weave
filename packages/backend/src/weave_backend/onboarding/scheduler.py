"""ONB-TASK-011: the real recurring entrypoint for `poller.py`. Without this,
`select_pollable_users`/`poll_user` are dead code -- nothing invokes them.

Reuses two existing patterns rather than inventing scheduling infra:
- the fire-and-forget strong-ref task pattern from `billing/metering.py`'s
  `_spawn_background` (private to that module, so mirrored here rather than
  imported -- same CPython gotcha: asyncio only holds a weak ref to a task,
  an unreferenced one can be GC'd mid-loop).
- `db/pool.py`'s `untenanted_connection` escape hatch, for the one genuinely
  cross-tenant query this needs (which tenants have onboarding state to
  poll). That module's docstring says "exactly one caller today"; this is
  now the second, deliberately, for the same reason: no per-tenant RLS scope
  applies to "list the tenants".
"""

from __future__ import annotations

import asyncio
import logging

import asyncpg

from weave_backend.db.pool import tenant_connection, untenanted_connection
from weave_backend.onboarding.poller import (
    DEFAULT_POLL_INTERVAL_SECONDS,
    poll_user,
    select_pollable_users,
)

log = logging.getLogger(__name__)

_background_tasks: set[asyncio.Task[None]] = set()


def spawn_scheduler() -> asyncio.Task[None]:
    """Call once from app startup. Keeps a strong reference so the loop
    survives for the life of the process.
    """
    task = asyncio.create_task(_run_forever())
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)
    return task


async def _run_forever() -> None:
    while True:
        try:
            await _poll_all_tenants()
        except Exception:
            log.exception("onboarding scheduler: poll cycle failed, retrying next interval")
        await asyncio.sleep(DEFAULT_POLL_INTERVAL_SECONDS)


async def _fetch_tenant_ids(conn: asyncpg.Connection) -> list[str]:
    rows = await conn.fetch("SELECT DISTINCT tenant_id FROM onboarding_state")
    return [str(row["tenant_id"]) for row in rows]


async def _poll_all_tenants() -> None:
    async with untenanted_connection() as conn:
        tenant_ids = await _fetch_tenant_ids(conn)

    for tenant_id in tenant_ids:
        async with tenant_connection(tenant_id) as conn:
            for user in await select_pollable_users(conn, tenant_id):
                await poll_user(conn, user)
