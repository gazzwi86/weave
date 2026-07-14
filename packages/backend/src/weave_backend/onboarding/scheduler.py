"""ONB-TASK-011: the real recurring entrypoint for `poller.py` and
`outbox_dispatcher.py`. Without this, `select_pollable_users`/`poll_user`
and `flush_pending` are dead code -- nothing invokes them.

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
from weave_backend.onboarding.outbox_dispatcher import flush_pending
from weave_backend.onboarding.poller import (
    DEFAULT_POLL_INTERVAL_SECONDS,
    poll_user,
    select_pollable_users,
)

log = logging.getLogger(__name__)

# Dispatcher drains more often than the poller scans -- notify latency
# should be much tighter than "did the user hit a milestone" latency.
DISPATCH_INTERVAL_SECONDS: float = 30

_background_tasks: set[asyncio.Task[None]] = set()


def spawn_scheduler() -> asyncio.Task[None]:
    """Call once from app startup. Keeps a strong reference so the loop
    survives for the life of the process.
    """
    task = asyncio.create_task(_run_forever())
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)
    return task


def spawn_dispatcher() -> asyncio.Task[None]:
    """Call once from app startup, alongside `spawn_scheduler`. Same
    fire-and-forget strong-ref pattern; drains the outbox `flush_pending`
    writes into instead of polling for new milestones.
    """
    task = asyncio.create_task(_dispatch_run_forever())
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


async def _dispatch_run_forever() -> None:
    while True:
        try:
            await _flush_all_tenants()
        except Exception:
            log.exception("onboarding dispatcher: flush cycle failed, retrying next interval")
        await asyncio.sleep(DISPATCH_INTERVAL_SECONDS)


async def _fetch_tenant_ids(conn: asyncpg.Connection) -> list[str]:
    # `onboarding_state` FORCEs RLS (0082) -- a plain SELECT on this
    # untenanted connection (app.tenant_id deliberately unset, see module
    # docstring) returns zero rows always. `list_pollable_tenants()` (0084)
    # is a narrow SECURITY DEFINER function that bypasses RLS for this one
    # cross-tenant "list the tenants" lookup, same pattern as
    # `resolve_workspace_tenant` (0002_identity.sql).
    rows = await conn.fetch("SELECT tenant_id FROM list_pollable_tenants()")
    return [str(row["tenant_id"]) for row in rows]


async def _poll_tenant(tenant_id: str) -> None:
    async with tenant_connection(tenant_id) as conn:
        for user in await select_pollable_users(conn, tenant_id):
            try:
                await poll_user(conn, user)
            except Exception:
                log.exception(
                    "onboarding scheduler: poll_user failed, skipping user "
                    "tenant_id=%s user_id=%s",
                    tenant_id,
                    user.user_id,
                )


async def _poll_all_tenants() -> None:
    # One bad tenant/user must not kill the cycle for everyone else -- each
    # tenant (and each user within it) is isolated so a single raising query
    # only drops that tenant's/user's poll this cycle, not the whole sweep.
    async with untenanted_connection() as conn:
        tenant_ids = await _fetch_tenant_ids(conn)

    for tenant_id in tenant_ids:
        try:
            await _poll_tenant(tenant_id)
        except Exception:
            log.exception(
                "onboarding scheduler: poll cycle failed, skipping tenant_id=%s",
                tenant_id,
            )


async def _flush_all_tenants() -> None:
    # Same per-tenant fault isolation as _poll_all_tenants.
    async with untenanted_connection() as conn:
        tenant_ids = await _fetch_tenant_ids(conn)

    for tenant_id in tenant_ids:
        try:
            async with tenant_connection(tenant_id) as conn:
                await flush_pending(conn, tenant_id)
        except Exception:
            log.exception(
                "onboarding dispatcher: flush cycle failed, skipping tenant_id=%s",
                tenant_id,
            )
