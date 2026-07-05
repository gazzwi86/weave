"""Real (not mocked) connectivity checks for /api/health (AC-1).

TCP-connect for postgres/redis is deliberately auth-free — it proves the
service is reachable, which is all a liveness probe needs. (ponytail: a real
query would also prove credentials/schema are right; add one if a future
task needs that stronger guarantee.)
"""

from __future__ import annotations

import asyncio
import os

import httpx

CONNECT_TIMEOUT_SECONDS = 2.0


async def _tcp_check(host: str, port: int) -> str:
    try:
        _reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port), timeout=CONNECT_TIMEOUT_SECONDS
        )
    except (TimeoutError, OSError):
        return "down"
    writer.close()
    await writer.wait_closed()
    return "ok"


async def check_postgres() -> str:
    host = os.environ.get("POSTGRES_HOST", "localhost")
    port = int(os.environ.get("POSTGRES_PORT", os.environ.get("WEAVE_PG_PORT", "5432")))
    return await _tcp_check(host, port)


async def check_redis() -> str:
    host = os.environ.get("REDIS_HOST", "localhost")
    port = int(os.environ.get("REDIS_PORT", os.environ.get("WEAVE_REDIS_PORT", "6379")))
    return await _tcp_check(host, port)


async def check_oxigraph() -> str:
    default_url = f"http://localhost:{os.environ.get('WEAVE_OXIGRAPH_PORT', '7878')}"
    url = os.environ.get("OXIGRAPH_URL", default_url)
    try:
        async with httpx.AsyncClient(timeout=CONNECT_TIMEOUT_SECONDS) as client:
            response = await client.get(url)
    except httpx.HTTPError:
        return "down"
    return "ok" if response.status_code < 500 else "down"
