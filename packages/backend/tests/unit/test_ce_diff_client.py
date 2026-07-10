"""TASK-016 unit tests: CE-DIFF-1 client (AC-1 diff fetch, AC-2 unreachable
-> raise). Stubbed at the transport boundary with `httpx.MockTransport` --
same pattern as `test_ce_version_client.py`.
"""

from __future__ import annotations

import httpx
import pytest

from weave_backend.projects.ce_version_client import CeDiffUnavailable, get_ontology_diff


def _diff_body(*, versions: list[dict[str, object]] | None = None) -> dict[str, object]:
    body: dict[str, object] = {
        "added": [{"subject": "s", "predicate": "p", "object": "o1"}],
        "removed": [],
        "modified": [],
    }
    if versions is not None:
        body["versions"] = versions
    return body


async def test_get_ontology_diff_returns_diff_body() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_diff_body())

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://ce")
    result = await get_ontology_diff(client, from_version="v1", to_version="v2")

    assert result["added"] == [{"subject": "s", "predicate": "p", "object": "o1"}]
    assert result["removed"] == []
    assert result["modified"] == []


async def test_get_ontology_diff_passes_through_versions_breaking_span() -> None:
    """contracts.md CE-DIFF-1 amendment: Build passes `versions` through
    verbatim -- it never derives breakingness itself.
    """
    versions = [{"version_iri": "v2", "breaking": True}]

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_diff_body(versions=versions))

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://ce")
    result = await get_ontology_diff(client, from_version="v1", to_version="v2")

    assert result["versions"] == versions


async def test_get_ontology_diff_sends_from_and_to_query_params() -> None:
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json=_diff_body())

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://ce")
    await get_ontology_diff(client, from_version="v1", to_version="v2")

    assert captured[0].url.params["from"] == "v1"
    assert captured[0].url.params["to"] == "v2"


async def test_get_ontology_diff_forwards_authorization_header() -> None:
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json=_diff_body())

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://ce")
    await get_ontology_diff(
        client, from_version="v1", to_version="v2", headers={"Authorization": "Bearer tok"}
    )

    assert captured[0].headers["authorization"] == "Bearer tok"


async def test_get_ontology_diff_raises_after_retries_on_connection_error() -> None:
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        raise httpx.ConnectError("boom", request=request)

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://ce")

    with pytest.raises(CeDiffUnavailable):
        await get_ontology_diff(client, from_version="v1", to_version="v2")

    assert attempts == 3


async def test_get_ontology_diff_raises_on_non_2xx_status() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(500)

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://ce")

    with pytest.raises(CeDiffUnavailable):
        await get_ontology_diff(client, from_version="v1", to_version="v2")
