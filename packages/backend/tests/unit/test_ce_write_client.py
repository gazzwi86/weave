"""BE-TASK-009 unit tests: CE-WRITE-1 write-back client (AC-3/AC-4/AC-8).
Same stubbed-transport boundary as `test_ce_version_client.py` -- no real
network call, Law F.
"""

from __future__ import annotations

from collections.abc import Callable

import httpx
import pytest
from httpx import AsyncClient, MockTransport

from weave_backend.deploy.ce_write_client import (
    CeWriteUnavailable,
    apply_write_back,
    close_ce_write_client,
    get_ce_write_client,
)
from weave_backend.schemas.operations import ApplyResponse, ViolationsResponse


def _client(handler: Callable[[httpx.Request], httpx.Response]) -> AsyncClient:
    return AsyncClient(transport=MockTransport(handler), base_url="http://ce")


async def test_apply_write_back_returns_apply_response_on_201() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/operations/apply"
        body = request.read()
        assert b'"actor":"urn:weave:principal:service:build-drafting-pipeline"' in body
        return httpx.Response(
            201,
            json={
                "activity_iri": "urn:weave:activity:1",
                "applied_count": 2,
                "version_iri": "urn:weave:version:v2",
            },
        )

    client = _client(handler)

    outcome = await apply_write_back(
        client,
        operations=[{"op": "update_node", "iri": "urn:weave:x:1", "properties": {}}],
        actor="urn:weave:principal:service:build-drafting-pipeline",
    )

    assert isinstance(outcome, ApplyResponse)
    assert outcome.activity_iri == "urn:weave:activity:1"
    assert outcome.applied_count == 2


async def test_apply_write_back_returns_violations_response_on_422() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            422,
            json={
                "violations": [
                    {
                        "focus_node": "urn:weave:x:1",
                        "path": "urn:weave:bpmo:label",
                        "severity": "Violation",
                        "message": "missing label",
                    }
                ]
            },
        )

    client = _client(handler)

    outcome = await apply_write_back(
        client,
        operations=[{"op": "update_node", "iri": "urn:weave:x:1", "properties": {}}],
        actor="urn:weave:principal:service:build-drafting-pipeline",
    )

    assert isinstance(outcome, ViolationsResponse)
    assert outcome.violations[0].message == "missing label"


async def test_apply_write_back_raises_ce_write_unavailable_on_connection_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("boom", request=request)

    client = _client(handler)

    with pytest.raises(CeWriteUnavailable):
        await apply_write_back(
            client,
            operations=[{"op": "update_node", "iri": "urn:weave:x:1", "properties": {}}],
            actor="urn:weave:principal:service:build-drafting-pipeline",
        )


async def test_get_ce_write_client_yields_an_async_client_and_close_closes_it() -> None:
    """QA edge case: `test_ce_version_client.py` covers this same
    loop-rebind-guard singleton for its sibling client; this file never did.
    """
    agen = get_ce_write_client()
    client = await agen.__anext__()

    assert isinstance(client, httpx.AsyncClient)
    with pytest.raises(StopAsyncIteration):
        await agen.__anext__()

    await close_ce_write_client()
