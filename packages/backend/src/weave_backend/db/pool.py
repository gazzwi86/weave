"""Application-role asyncpg pool + per-request tenant scoping.

Connects as ``weave_app`` (non-superuser, see ``migrations/0001_tenancy.sql``
and ADR-003) -- never as the migration/admin role -- so the RLS policies on
every tenancy/settings/audit table actually apply.
"""

from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import asyncpg

_pool: asyncpg.Pool | None = None
_pool_loop: asyncio.AbstractEventLoop | None = None


def _dsn() -> str:
    user = os.environ.get("POSTGRES_APP_USER", "weave_app")
    host = os.environ.get("POSTGRES_HOST", "localhost")
    port = os.environ.get("POSTGRES_PORT", "5432")
    database = os.environ.get("POSTGRES_DB", "weave")
    return f"postgresql://{user}@{host}:{port}/{database}"


async def get_app_pool() -> asyncpg.Pool:
    # ponytail: same loop-binding gotcha as tenancy/sessions.py's redis
    # client -- asyncpg's pool holds real socket connections tied to the
    # event loop that opened them. pytest-asyncio hands each test a fresh
    # loop, so a plain module-level singleton would try to reuse a dead
    # loop's connections on the second test and blow up with "Event loop is
    # closed" -- recreate whenever the running loop has changed instead of
    # caching forever.
    global _pool, _pool_loop
    current_loop = asyncio.get_event_loop()
    if _pool is None or _pool_loop is not current_loop:
        _pool = await asyncpg.create_pool(_dsn(), min_size=1, max_size=5)
        _pool_loop = current_loop
    return _pool


async def close_app_pool() -> None:
    global _pool, _pool_loop
    if _pool is not None:
        await _pool.close()
        _pool = None
        _pool_loop = None


@asynccontextmanager
async def tenant_connection(tenant_id: str) -> AsyncIterator[asyncpg.Connection]:
    """Acquire a pooled connection scoped to ``tenant_id`` for one
    transaction. ``set_config(..., is_local=true)`` behaves like
    ``SET LOCAL`` -- scoped strictly to this transaction, so it can never
    leak `app.tenant_id` onto a pooled connection's next, unrelated borrower.
    """
    pool = await get_app_pool()
    async with pool.acquire() as conn, conn.transaction():
        await conn.execute("SELECT set_config('app.tenant_id', $1, true)", tenant_id)
        yield conn
