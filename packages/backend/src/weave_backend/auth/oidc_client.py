"""FastAPI dependency for the httpx client used to talk to the OIDC issuer
(mock in dev/test; real Cognito later — env var change only, see
``OIDC_ISSUER_URL``). Overridden in tests via ``app.dependency_overrides`` to
point at the in-process mock OIDC app (no real network — Law F).

Cross-task ledger fix: one shared client per process instead of opening/
closing a fresh TCP connection on every single request.
"""

from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator

import httpx

DEFAULT_ISSUER_URL = "http://localhost:9001"

_client: httpx.AsyncClient | None = None
_client_loop: asyncio.AbstractEventLoop | None = None


async def get_oidc_client() -> AsyncIterator[httpx.AsyncClient]:
    # ponytail: same loop-rebind guard as db/pool.py's asyncpg pool -- an
    # httpx client's connection pool is tied to the event loop that opened
    # it, and pytest-asyncio hands each test a fresh loop.
    global _client, _client_loop
    current_loop = asyncio.get_event_loop()
    if _client is None or _client_loop is not current_loop:
        issuer_url = os.environ.get("OIDC_ISSUER_URL", DEFAULT_ISSUER_URL)
        _client = httpx.AsyncClient(base_url=issuer_url, timeout=5.0)
        _client_loop = current_loop
    yield _client


async def close_oidc_client() -> None:
    global _client, _client_loop
    if _client is not None:
        await _client.aclose()
        _client = None
        _client_loop = None
