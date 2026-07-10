"""TASK-009 (build-engine EPIC-008) unit tests: FR-036 staleness indicator.
AC-3 (lag vs threshold) / AC-4 (honest "unknown" on CE outage, never
fake-healthy) -- mirrors CE-METRICS-1's pending-not-zero honesty rule
(Design Decisions). Stubbed at the transport boundary like
`test_ce_version_client.py` -- no real network.
"""

from __future__ import annotations

import httpx

from weave_backend.projects.staleness import StalenessOptions, get_staleness, version_distance

_VERSIONS = [
    {"version_iri": "urn:weave:version:v1", "is_latest": False},
    {"version_iri": "urn:weave:version:v2", "is_latest": False},
    {"version_iri": "urn:weave:version:v3", "is_latest": False},
    {"version_iri": "urn:weave:version:v4", "is_latest": True},
]


def _versions_body(versions: list[dict[str, object]]) -> dict[str, object]:
    return {"versions": versions, "total": len(versions), "page": 1, "per_page": 50}


def test_version_distance_counts_index_gap_to_latest() -> None:
    assert version_distance("urn:weave:version:v2", _VERSIONS) == 2
    assert version_distance("urn:weave:version:v4", _VERSIONS) == 0


def test_version_distance_returns_none_when_pin_not_in_list() -> None:
    assert version_distance("urn:weave:version:unknown", _VERSIONS) is None


async def test_set_staleness_indicator_at_lag_threshold() -> None:
    """AC-3: `should set staleness indicator at lag threshold` -- lag >=
    threshold (default 2) is stale, lag below threshold is not.
    """

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_versions_body(_VERSIONS))

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://ce")

    at_threshold = await get_staleness(
        client,
        project_iri="urn:weave:project:t:at",
        pinned_graph_version_iri="urn:weave:version:v2",
    )
    below_threshold = await get_staleness(
        client,
        project_iri="urn:weave:project:t:below",
        pinned_graph_version_iri="urn:weave:version:v3",
    )

    assert at_threshold == {"lag": 2, "stale": True}
    assert below_threshold == {"lag": 1, "stale": False}


async def test_report_unknown_staleness_when_ce_unreachable() -> None:
    """AC-4: `should report unknown staleness when CE unreachable` -- never
    fabricates `stale: false` when the version list can't be fetched.
    """

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("boom", request=request)

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://ce")

    result = await get_staleness(
        client,
        project_iri="urn:weave:project:t:unreachable",
        pinned_graph_version_iri="urn:weave:version:v2",
    )

    assert result == {"lag": None, "stale": "unknown"}


async def test_staleness_is_cached_per_project_within_ttl() -> None:
    """Implementation Hints: cache the lag per project for 60s so a
    project-list read doesn't fan out to CE per row.
    """
    calls = 0

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, json=_versions_body(_VERSIONS))

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://ce")

    await get_staleness(
        client,
        project_iri="urn:weave:project:t:cache",
        pinned_graph_version_iri="urn:weave:version:v3",
        options=StalenessOptions(now=1000.0),
    )
    await get_staleness(
        client,
        project_iri="urn:weave:project:t:cache",
        pinned_graph_version_iri="urn:weave:version:v3",
        options=StalenessOptions(now=1030.0),
    )

    assert calls == 1


async def test_staleness_cache_expires_after_ttl() -> None:
    calls = 0

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, json=_versions_body(_VERSIONS))

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://ce")

    await get_staleness(
        client,
        project_iri="urn:weave:project:t:cache-expiry",
        pinned_graph_version_iri="urn:weave:version:v3",
        options=StalenessOptions(now=1000.0),
    )
    await get_staleness(
        client,
        project_iri="urn:weave:project:t:cache-expiry",
        pinned_graph_version_iri="urn:weave:version:v3",
        options=StalenessOptions(now=1061.0),
    )

    assert calls == 2
