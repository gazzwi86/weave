"""AC-3/AC-7: per-(tenant, user) session version (Redis) for immediate
session invalidation on revoke, and the caller's active-workspace pointer
used to rewrite SPARQL scope after a workspace switch.

ponytail: if Redis is unreachable, `get_session_version` degrades to 0
rather than raising -- matches `mock_oidc`'s issuance side (see
`mock_oidc/tokens.py`), so a dev box without Redis running still gets a
working (just non-revocable) token flow instead of every request 500ing.
"""

from __future__ import annotations

import asyncio
import os

import redis.asyncio as redis
from redis.exceptions import RedisError

_CONNECT_TIMEOUT_SECONDS = 0.5

_client: redis.Redis | None = None
_client_loop: asyncio.AbstractEventLoop | None = None


def get_redis() -> redis.Redis:
    # ponytail: redis-py's asyncio connections are bound to the event loop
    # they were created on. pytest-asyncio hands each test a fresh loop, so
    # a plain module-level singleton would reuse a dead loop's connection
    # and blow up with "Event loop is closed" -- recreate whenever the
    # running loop has changed instead of caching forever.
    global _client, _client_loop
    current_loop = asyncio.get_event_loop()
    if _client is None or _client_loop is not current_loop:
        host = os.environ.get("REDIS_HOST", "localhost")
        port = os.environ.get("REDIS_PORT", os.environ.get("WEAVE_REDIS_PORT", "6379"))
        _client = redis.from_url(
            f"redis://{host}:{port}/0",
            decode_responses=True,
            socket_connect_timeout=_CONNECT_TIMEOUT_SECONDS,
            socket_timeout=_CONNECT_TIMEOUT_SECONDS,
        )
        _client_loop = current_loop
    return _client


def _session_version_key(tenant_id: str, user_sub: str) -> str:
    return f"session_version:{tenant_id}:{user_sub}"


def _active_workspace_key(tenant_id: str, user_sub: str) -> str:
    return f"active_workspace:{tenant_id}:{user_sub}"


async def get_session_version(tenant_id: str, user_sub: str) -> int:
    try:
        value = await get_redis().get(_session_version_key(tenant_id, user_sub))
    except (OSError, TimeoutError, RedisError):
        return 0
    return int(value) if value is not None else 0


async def bump_session_version(tenant_id: str, user_sub: str) -> int:
    result: int = await get_redis().incr(_session_version_key(tenant_id, user_sub))
    return result


async def set_active_workspace(tenant_id: str, user_sub: str, workspace_id: str) -> None:
    await get_redis().set(_active_workspace_key(tenant_id, user_sub), workspace_id)


async def get_active_workspace(tenant_id: str, user_sub: str) -> str | None:
    value = await get_redis().get(_active_workspace_key(tenant_id, user_sub))
    return str(value) if value is not None else None
