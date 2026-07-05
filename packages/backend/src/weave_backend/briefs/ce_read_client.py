"""HTTP client for CE-READ-1 (``GET /api/ontology/resource/{iri}``,
contracts.md Sec. CE-READ-1) -- grounds the Architect agent's draft in the
BPMO graph (FR-018 AC-4).

No retry (unlike CE-VERSION-1's pin-latest read): the brief's pseudocode
treats any grounding failure as an immediate 503, since a brief drafted
without real graph context would be worse than no brief at all.
"""

from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator

import httpx

from weave_backend.projects.ce_version_client import DEFAULT_CE_BASE_URL

_client: httpx.AsyncClient | None = None
_client_loop: asyncio.AbstractEventLoop | None = None


class CeReadUnavailable(Exception):
    """CE-READ-1 unreachable or returned a non-2xx status -- callers turn
    this into the 503 ``ce_read_unavailable`` response and must not persist
    a brief.
    """


async def get_ce_read_client() -> AsyncIterator[httpx.AsyncClient]:
    # ponytail: same loop-rebind guard as ce_version_client.get_ce_client.
    global _client, _client_loop
    current_loop = asyncio.get_event_loop()
    if _client is None or _client_loop is not current_loop:
        base_url = os.environ.get("CE_API_BASE_URL", DEFAULT_CE_BASE_URL)
        _client = httpx.AsyncClient(base_url=base_url, timeout=5.0)
        _client_loop = current_loop
    yield _client


async def close_ce_read_client() -> None:
    global _client, _client_loop
    if _client is not None:
        await _client.aclose()
        _client = None
        _client_loop = None


async def get_bpmo_context(client: httpx.AsyncClient, project_iri: str) -> dict[str, object]:
    """AC-4: fetch the BPMO graph context for ``project_iri`` to ground the
    Architect agent's draft. Raises :class:`CeReadUnavailable` on any
    connection error or non-2xx status -- no retry.
    """
    try:
        response = await client.get(f"/api/ontology/resource/{project_iri}")
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise CeReadUnavailable(f"CE-READ-1 unreachable: {exc}") from exc
    return dict(response.json())
