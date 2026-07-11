"""CE-METRICS-1 client (`GET /api/metrics/ontology`, contracts.md). One
thin fetch, keyed on the response's own field names -- TASK-016's category
bindings reuse this, so no per-widget fetch functions (implementation
hint). Follows ``deploy/ce_write_client.py``'s loop-rebound singleton
``AsyncClient`` pattern.
"""

from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator
from typing import Any

import httpx

DEFAULT_CE_BASE_URL = "http://localhost:8000"

_client: httpx.AsyncClient | None = None
_client_loop: asyncio.AbstractEventLoop | None = None


class CeMetricsUnavailable(Exception):
    """CE-METRICS-1 unreachable or returned a non-2xx status -- the caller
    turns this into ``status=unavailable``/``stale`` per the honest-state
    matrix, never a raised 500 (AC-4).
    """


async def get_ce_metrics_client() -> AsyncIterator[httpx.AsyncClient]:
    global _client, _client_loop
    current_loop = asyncio.get_event_loop()
    if _client is None or _client_loop is not current_loop:
        base_url = os.environ.get("CE_API_BASE_URL", DEFAULT_CE_BASE_URL)
        _client = httpx.AsyncClient(base_url=base_url, timeout=5.0)
        _client_loop = current_loop
    yield _client


async def close_ce_metrics_client() -> None:
    global _client, _client_loop
    if _client is not None:
        await _client.aclose()
        _client = None
        _client_loop = None


async def fetch(
    client: httpx.AsyncClient, bindings: dict[str, Any], *, headers: dict[str, str] | None = None
) -> Any:
    """AC-4/AC-5: fetch the full CE-METRICS-1 payload and return just the
    field this widget binds to. ``{"pending": true}`` sub-fields pass
    through untouched -- never coerced to a zero or dropped.
    """
    field_name = bindings["field"]
    try:
        response = await client.get("/api/metrics/ontology", headers=headers)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise CeMetricsUnavailable("CE-METRICS-1 unreachable") from exc
    body = response.json()
    if field_name not in body:
        raise CeMetricsUnavailable(f"CE-METRICS-1 response missing field {field_name!r}")
    value = body[field_name]
    if bindings.get("aggregate") == "sum" and isinstance(value, dict):
        if any(isinstance(v, dict) and v.get("pending") is True for v in value.values()):
            return {"pending": True}
        return sum(value.values())
    return value
