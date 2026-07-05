"""BE-TASK-002 unit tests: CE-READ-1 grounding client (AC-4). No retry (unlike
CE-VERSION-1) -- the brief's pseudocode calls this a single, non-retried
grounding read that raises straight to a 503 on any failure.
"""

from __future__ import annotations

from collections.abc import Callable

import httpx
import pytest
from httpx import AsyncClient, MockTransport

from weave_backend.briefs.ce_read_client import CeReadUnavailable, get_bpmo_context


def _client(handler: Callable[[httpx.Request], httpx.Response]) -> AsyncClient:
    return AsyncClient(transport=MockTransport(handler), base_url="http://ce")


async def test_get_bpmo_context_returns_json_on_200() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"iri": "urn:weave:project:t1:acme", "nodes": []})

    client = _client(handler)

    context = await get_bpmo_context(client, "urn:weave:project:t1:acme")

    assert context == {"iri": "urn:weave:project:t1:acme", "nodes": []}


async def test_get_bpmo_context_raises_ce_read_unavailable_on_non_2xx() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(500)

    client = _client(handler)

    with pytest.raises(CeReadUnavailable):
        await get_bpmo_context(client, "urn:weave:project:t1:acme")


async def test_get_bpmo_context_raises_ce_read_unavailable_on_connection_error() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("boom")

    client = _client(handler)

    with pytest.raises(CeReadUnavailable):
        await get_bpmo_context(client, "urn:weave:project:t1:acme")
