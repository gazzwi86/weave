"""PLAT-V1-TASK-017 integration tests: `GET /api/role-home` against a real
docker Postgres stack (AC-1..AC-6). `get_current_principal` is overridden
directly (same technique as `test_dashboard_example_prompts_route.py`) --
a real bearer token's `roles` claim is always empty (mock-OIDC gap, noted
in `test_dashboard_widgets_api.py`), so role differentiation is exercised
this way, not through a minted JWT.
"""

from __future__ import annotations

import shutil
import time
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient, MockTransport, Request, Response

from weave_backend import app
from weave_backend.auth.dependencies import Principal, RoleGrant, get_current_principal
from weave_backend.dashboard.ce_metrics import get_ce_metrics_client
from weave_backend.db.pool import tenant_connection

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]

_KIND_TYPES_BODY = {
    "kinds": [
        {"iri": "https://weave.io/ontology/Process", "label": "Process", "properties": []},
        {
            "iri": "https://weave.io/ontology/BusinessCapability",
            "label": "BusinessCapability",
            "properties": [],
        },
        {
            "iri": "https://weave.io/ontology/ClientExtensionKind",
            "label": "ClientExtensionKind",
            "properties": [],
        },
    ],
    "relationships": [],
}

_METRICS_BODY = {
    "entity_count_by_kind": {"Process": 4, "BusinessCapability": 2},
    "shacl_errors_by_severity": {"violation": 3, "warning": 1},
    "owl_inconsistencies": 0,
    "draft_published_delta": 7,
    "latest_version": "v3",
}


def _unique_tenant(label: str) -> str:
    return f"{label}-{uuid.uuid4().hex[:8]}"


def _principal(*, tenant_id: str, role: str | None) -> Principal:
    roles = [RoleGrant(scope="tenant", role=role)] if role else []
    return Principal(
        sub="u-1",
        tenant_id=tenant_id,
        principal_iri="urn:weave:principal:user:u-1",
        roles=roles,
    )


def _ce_stub(handlers: dict[str, object]) -> AsyncClient:
    def _handler(request: Request) -> Response:
        body = handlers.get(request.url.path)
        if isinstance(body, Exception):
            raise body
        if body is None:
            return Response(404, json={"error": "not_found"})
        return Response(200, json=body)

    return AsyncClient(transport=MockTransport(_handler), base_url="http://ce-metrics")


_HEALTHY_CE = {
    "/api/metrics/ontology": _METRICS_BODY,
    "/api/ontology/types": _KIND_TYPES_BODY,
    "/api/sparql": {"rows": []},
}


@pytest.fixture
async def client(platform_stack: Path) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


def _override(tenant_id: str, role: str | None, ce_client: AsyncClient) -> None:
    app.dependency_overrides[get_current_principal] = lambda: _principal(
        tenant_id=tenant_id, role=role
    )
    app.dependency_overrides[get_ce_metrics_client] = lambda: ce_client


async def test_role_home_content_by_role(client: AsyncClient) -> None:
    """AC-1: content matches the role->content table for read/author/publish."""
    for role, expected_ids in [
        ("read", {"explore-model", "view-model", "view-compliance"}),
        ("author", {"edit-nl", "pin-widgets"}),
        ("publish", {"publish-versions", "author-shapes"}),
    ]:
        tenant_id = _unique_tenant(f"rh-role-{role}")
        _override(tenant_id, role, _ce_stub(_HEALTHY_CE))

        resp = await client.get("/api/role-home")

        assert resp.status_code == 200
        body = resp.json()
        ids = {cap["id"] for cap in body["capabilities"]}
        assert expected_ids <= ids
        assert body["summary"]["kinds"] == 3
        assert body["summary"]["instances"] == 6
        assert body["next_action"]["label"]


async def test_role_matrix_capability_filtering(client: AsyncClient) -> None:
    """AC-4: Viewer (read) sees zero author-or-above capability ids."""
    tenant_id = _unique_tenant("rh-viewer")
    _override(tenant_id, "read", _ce_stub(_HEALTHY_CE))

    resp = await client.get("/api/role-home")

    assert resp.status_code == 200
    ids = {cap["id"] for cap in resp.json()["capabilities"]}
    author_or_above = {
        "edit-nl",
        "pin-widgets",
        "publish-versions",
        "author-shapes",
        "settings",
        "members",
        "budgets",
    }
    assert not (ids & author_or_above)


async def test_coming_soon_consistency_with_fr015(client: AsyncClient) -> None:
    """AC-2: role-home's engine-gated rows use the same availability
    registry as FR-015's widget-category gating -- both report Build/
    Events/Explorer as not-yet-available, CE as available, from one fixture.
    """
    tenant_id = _unique_tenant("rh-coming-soon")
    _override(tenant_id, "read", _ce_stub(_HEALTHY_CE))

    resp = await client.get("/api/role-home")

    body = resp.json()
    coming_soon_ids = {"build-generate", "events-automate", "explorer-collaborate"}
    found_ids = {cap["id"] for cap in body["capabilities"] if cap["id"] in coming_soon_ids}
    assert found_ids == coming_soon_ids
    for cap in body["capabilities"]:
        if cap["id"] in coming_soon_ids:
            assert cap["available"] is False
            assert cap["coming_soon"]


async def test_completeness_map_kinds_from_types_endpoint(client: AsyncClient) -> None:
    """AC-3: a client-extension kind registered only in the CE fixture's
    `/api/ontology/types` response appears in the completeness map --
    proves no hand-copied kind list.
    """
    tenant_id = _unique_tenant("rh-extension-kind")
    _override(tenant_id, "publish", _ce_stub(_HEALTHY_CE))

    resp = await client.get("/api/role-home")

    kinds = {row["kind"] for row in resp.json()["completeness"]}
    assert "ClientExtensionKind" in kinds
    ext_row = next(
        row for row in resp.json()["completeness"] if row["kind"] == "ClientExtensionKind"
    )
    assert ext_row["instance_count"] == 0


async def test_role_home_degrades_to_cached_snapshot(client: AsyncClient) -> None:
    """AC-5: CE unreachable on a later request -> 200 with the last-cached
    snapshot, a `stale` tile status, never a blank/zeroed summary.
    """
    tenant_id = _unique_tenant("rh-degrade")
    _override(tenant_id, "publish", _ce_stub(_HEALTHY_CE))
    warm = await client.get("/api/role-home")
    assert warm.status_code == 200
    warm_summary = warm.json()["summary"]

    _override(tenant_id, "publish", _ce_stub({}))  # every CE path 404s
    degraded = await client.get("/api/role-home")

    assert degraded.status_code == 200
    body = degraded.json()
    assert body["summary"] == warm_summary
    assert body["summary"]["instances"] != 0
    assert body["tiles"][0]["status"] == "stale"


async def test_role_home_p95(client: AsyncClient) -> None:
    """AC-6: warm read against a seeded fixture stays <= 200ms p95."""
    tenant_id = _unique_tenant("rh-perf")
    _override(tenant_id, "read", _ce_stub(_HEALTHY_CE))
    await client.get("/api/role-home")  # warm the tile row

    durations: list[float] = []
    for _ in range(5):
        started = time.perf_counter()
        resp = await client.get("/api/role-home")
        durations.append(time.perf_counter() - started)
        assert resp.status_code == 200
    durations.sort()
    p95_index = max(0, int(len(durations) * 0.95) - 1)
    assert durations[p95_index] <= 0.2


async def test_role_home_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/role-home")
    assert resp.status_code == 401


async def test_role_home_tiles_ride_swr_scope(client: AsyncClient) -> None:
    """AC-5 (m2-delta §7): the role-home tile is a real `scope='role_home'`
    widget_instances row, not a parallel cache. It is tenant-wide (owner
    NULL, like `tenant_default`) since the cached payload is tenant-scoped
    CE data; `widget_instances_check1` requires a NULL owner for any scope
    other than `user`.
    """
    tenant_id = _unique_tenant("rh-swr-scope")
    _override(tenant_id, "read", _ce_stub(_HEALTHY_CE))
    await client.get("/api/role-home")

    async with tenant_connection(tenant_id) as conn:
        row = await conn.fetchrow(
            "SELECT scope, owner_principal_iri FROM widget_instances"
            " WHERE tenant_id = $1 AND scope = 'role_home'",
            tenant_id,
        )
    assert row is not None
    assert row["owner_principal_iri"] is None
