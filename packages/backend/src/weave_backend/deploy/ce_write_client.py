"""CE-WRITE-1 write-back client (`POST /api/operations/apply`, BE-TASK-009).

Follows `projects/ce_version_client.py`'s loop-rebound singleton
`AsyncClient` pattern, but with no retry loop -- the brief's pseudocode
maps a connection failure straight to a 503 (`CeWriteUnavailable`), and a
`422` (SHACL violations) straight to a `ViolationsResponse` for the router
to turn into a `rejected` body. Never a blind retry against the one
validated mutation entry point (`CE-WRITE-1 is the ONLY mutation entry
point`, contracts.md).
"""

from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator
from typing import Any

import httpx

from weave_backend.schemas.operations import ApplyResponse, ViolationsResponse

DEFAULT_CE_BASE_URL = "http://localhost:8000"

_client: httpx.AsyncClient | None = None
_client_loop: asyncio.AbstractEventLoop | None = None


class CeWriteUnavailable(Exception):
    """`CE-WRITE-1` unreachable -- the caller leaves `write_back_complete`
    false and returns a 503 (AC-8); no graph state to roll back since
    nothing was committed.
    """


async def get_ce_write_client() -> AsyncIterator[httpx.AsyncClient]:
    global _client, _client_loop
    current_loop = asyncio.get_event_loop()
    if _client is None or _client_loop is not current_loop:
        base_url = os.environ.get("CE_API_BASE_URL", DEFAULT_CE_BASE_URL)
        _client = httpx.AsyncClient(base_url=base_url, timeout=5.0)
        _client_loop = current_loop
    yield _client


async def close_ce_write_client() -> None:
    global _client, _client_loop
    if _client is not None:
        await _client.aclose()
        _client = None
        _client_loop = None


async def apply_write_back(
    client: httpx.AsyncClient, *, operations: list[dict[str, Any]], actor: str
) -> ApplyResponse | ViolationsResponse:
    """AC-3/AC-4/AC-8: post the write-back batch to `CE-WRITE-1`.

    Returns an `ApplyResponse` on `201` or a `ViolationsResponse` on `422`
    (SHACL rejection, routed to HITL by the caller). Raises
    `CeWriteUnavailable` if the request can't reach CE at all.
    """
    try:
        response = await client.post(
            "/api/operations/apply",
            json={"operations": operations, "actor": actor, "target": "draft"},
        )
    except httpx.HTTPError as exc:
        raise CeWriteUnavailable("CE-WRITE-1 unreachable") from exc
    if response.status_code == 422:
        return ViolationsResponse.model_validate(response.json())
    response.raise_for_status()
    return ApplyResponse.model_validate(response.json())
