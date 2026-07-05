"""BE-TASK-001 unit tests: CE-VERSION-1 client (AC-1 pin selection, AC-2
unreachable -> raise). Stubbed at the transport boundary with
`httpx.MockTransport` -- no real network, no dependency on the CE lane's
endpoint existing yet.
"""

from __future__ import annotations

import httpx
import pytest

from weave_backend.projects.ce_version_client import (
    CeVersionUnavailable,
    close_ce_client,
    get_ce_client,
    get_pinned_latest_version,
)


async def test_get_pinned_latest_version_returns_latest_version_iri() -> None:
    versions = [
        {
            "version_iri": "urn:weave:version:v1",
            "semver": "1.0.0",
            "published_at": "2026-01-01T00:00:00Z",
            "is_latest": False,
        },
        {
            "version_iri": "urn:weave:version:v2",
            "semver": "1.1.0",
            "published_at": "2026-02-01T00:00:00Z",
            "is_latest": True,
        },
    ]

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=versions)

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://ce")
    result = await get_pinned_latest_version(client)

    assert result == "urn:weave:version:v2"


async def test_get_pinned_latest_version_raises_after_retries_on_connection_error() -> None:
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        raise httpx.ConnectError("boom", request=request)

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://ce")

    with pytest.raises(CeVersionUnavailable):
        await get_pinned_latest_version(client)

    assert attempts == 3  # initial attempt + 2 retries


async def test_get_pinned_latest_version_raises_on_non_2xx_status() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(500)

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://ce")

    with pytest.raises(CeVersionUnavailable):
        await get_pinned_latest_version(client)


async def test_get_ce_client_yields_an_async_client_and_close_ce_client_closes_it() -> None:
    """Exercises the loop-rebind-guard singleton directly (same pattern as
    `auth/oidc_client.py`/`db/pool.py`) -- not covered elsewhere since the
    integration tests override this dependency with a stub.
    """
    agen = get_ce_client()
    client = await agen.__anext__()

    assert isinstance(client, httpx.AsyncClient)

    with pytest.raises(StopAsyncIteration):
        await agen.__anext__()

    await close_ce_client()


async def test_get_pinned_latest_version_raises_when_no_entry_is_latest() -> None:
    versions = [
        {
            "version_iri": "urn:weave:version:v1",
            "semver": "1.0.0",
            "published_at": "2026-01-01T00:00:00Z",
            "is_latest": False,
        }
    ]

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=versions)

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://ce")

    with pytest.raises(CeVersionUnavailable):
        await get_pinned_latest_version(client)
