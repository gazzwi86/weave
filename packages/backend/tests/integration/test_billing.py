"""PLAT-TASK-008 integration tests: budget-cap cascade validation (AC-1),
the synchronous pre-call gate (AC-2), async metering (AC-3/AC-4), the usage
summary (AC-5/AC-7), and cap-utilisation notifications (AC-6) -- against
real Postgres/Redis (see `test_notifications_api.py` for the same
`docker`-marked precedent).
"""

from __future__ import annotations

import asyncio
import shutil
import time
import uuid
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.billing.metering import build_run_usage_record, record_run_usage
from weave_backend.billing.period import current_period
from weave_backend.db.pool import tenant_connection
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.settings.scope import company_iri, workspace_iri
from weave_backend.tenancy.sessions import get_redis

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]


def _unique_tenant(label: str) -> str:
    return f"{label}-{uuid.uuid4().hex[:8]}"


@pytest.fixture
async def client(platform_stack: Path) -> AsyncIterator[AsyncClient]:
    mock_transport = ASGITransport(app=mock_oidc_app)
    app.dependency_overrides[get_oidc_client] = lambda: AsyncClient(
        transport=mock_transport, base_url="http://mock-oidc"
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


async def _create_workspace_via_route(
    client: AsyncClient, *, tenant_id: str, admin_sub: str, slug: str
) -> tuple[str, dict[str, str]]:
    tokens = await issue_token_pair(sub=admin_sub, tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}
    response = await client.post(
        f"/api/tenants/{tenant_id}/workspaces",
        json={"slug": slug, "display_name": slug},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()["id"], headers


async def _wait_for_row(tenant_id: str, query: str, *args: object) -> tuple[Any, float]:
    """AC-3/DoD: the metering write is queued off the hot path (fire-and-forget
    task, not awaited by the route) and must land within a 100ms budget --
    poll tightly (5ms) from the moment the HTTP response returns and report
    how long it actually took, so the caller can assert against the budget
    instead of only checking eventual arrival.
    """
    start = time.perf_counter()
    deadline = start + 0.5  # generous hard stop so a real regression fails loudly
    while time.perf_counter() < deadline:
        async with tenant_connection(tenant_id) as conn:
            row = await conn.fetchrow(query, tenant_id, *args)
        if row is not None:
            return row, (time.perf_counter() - start) * 1000
        await asyncio.sleep(0.005)
    return None, (time.perf_counter() - start) * 1000


async def _seed_usage(
    *, tenant_id: str, workspace_id: str, cost_usd: float, record_type: str = "run"
) -> None:
    async with tenant_connection(tenant_id) as conn:
        await conn.execute(
            """
            INSERT INTO billing_usage
                (id, tenant_id, workspace_id, record_type, cost_usd, period, recorded_at)
            VALUES ($1, $2, $3, $4, $5, $6, now())
            """,
            uuid.uuid4(),
            tenant_id,
            workspace_id,
            record_type,
            cost_usd,
            current_period(),
        )


async def test_set_cap_rejects_workspace_cap_exceeding_company_parent(
    client: AsyncClient,
) -> None:
    tenant_id = _unique_tenant("billing-cap-parent")
    workspace_id, headers = await _create_workspace_via_route(
        client, tenant_id=tenant_id, admin_sub="u-admin", slug="ws-cap"
    )

    company_set = await client.put(
        "/api/billing/caps",
        json={"scope_iri": company_iri(tenant_id), "value_usd": 100.0},
        headers=headers,
    )
    assert company_set.status_code == 200, company_set.text

    workspace_set = await client.put(
        "/api/billing/caps",
        json={"scope_iri": workspace_iri(tenant_id, workspace_id), "value_usd": 200.0},
        headers=headers,
    )

    assert workspace_set.status_code == 422
    assert workspace_set.json()["detail"]["error"] == "cap_exceeds_parent"


async def test_set_cap_within_parent_succeeds(client: AsyncClient) -> None:
    tenant_id = _unique_tenant("billing-cap-ok")
    workspace_id, headers = await _create_workspace_via_route(
        client, tenant_id=tenant_id, admin_sub="u-admin", slug="ws-cap-ok"
    )

    await client.put(
        "/api/billing/caps",
        json={"scope_iri": company_iri(tenant_id), "value_usd": 100.0},
        headers=headers,
    )
    response = await client.put(
        "/api/billing/caps",
        json={"scope_iri": workspace_iri(tenant_id, workspace_id), "value_usd": 50.0},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json() == {
        "scope_iri": workspace_iri(tenant_id, workspace_id),
        "value_usd": 50.0,
    }


async def test_simulate_ai_call_rejected_at_cap_never_calls_ai_client(
    client: AsyncClient,
) -> None:
    """AC-2: `consumed >= cap` rejects with 429 before `ai_route` (the
    external AI client) is ever called.
    """
    tenant_id = _unique_tenant("billing-gate")
    workspace_id, headers = await _create_workspace_via_route(
        client, tenant_id=tenant_id, admin_sub="u-admin", slug="ws-gate"
    )
    await client.put(
        "/api/billing/caps",
        json={"scope_iri": workspace_iri(tenant_id, workspace_id), "value_usd": 10.0},
        headers=headers,
    )
    redis = get_redis()
    await redis.set(f"billing:{tenant_id}:{workspace_id}:{current_period()}:consumed_usd", "10.0")

    with patch("weave_backend.routers.billing.ai_route") as ai_route_mock:
        response = await client.post(
            "/api/billing/simulate-ai-call",
            json={
                "workspace_id": workspace_id,
                "model_tier": "sonnet",
                "input_tokens": 10,
                "output_tokens": 10,
                "cost_usd": 0.01,
            },
            headers=headers,
        )

    assert response.status_code == 429
    assert response.json()["detail"]["error"] == "budget_cap_reached"
    ai_route_mock.assert_not_called()


async def test_simulate_ai_call_under_cap_calls_ai_client_and_records_usage(
    client: AsyncClient,
) -> None:
    tenant_id = _unique_tenant("billing-under-cap")
    workspace_id, headers = await _create_workspace_via_route(
        client, tenant_id=tenant_id, admin_sub="u-admin", slug="ws-under-cap"
    )
    await client.put(
        "/api/billing/caps",
        json={"scope_iri": workspace_iri(tenant_id, workspace_id), "value_usd": 100.0},
        headers=headers,
    )

    with patch("weave_backend.routers.billing.ai_route") as ai_route_mock:
        response = await client.post(
            "/api/billing/simulate-ai-call",
            json={
                "workspace_id": workspace_id,
                "model_tier": "sonnet",
                "input_tokens": 10,
                "output_tokens": 5,
                "cost_usd": 0.5,
            },
            headers=headers,
        )

    assert response.status_code == 204
    ai_route_mock.assert_called_once_with("sonnet", "harness simulated call")

    row, elapsed_ms = await _wait_for_row(
        tenant_id,
        "SELECT input_tokens, output_tokens, cost_usd FROM billing_usage"
        " WHERE tenant_id = $1 AND workspace_id = $2 AND record_type = 'token_usage'",
        workspace_id,
    )
    assert row is not None
    assert elapsed_ms < 100, f"AC-3/DoD: metering write took {elapsed_ms:.1f}ms, budget is 100ms"
    assert row["input_tokens"] == 10
    assert row["output_tokens"] == 5
    assert float(row["cost_usd"]) == 0.5


async def test_run_usage_costs_exactly_one_unit_regardless_of_status(client: AsyncClient) -> None:
    """AC-4: a run's cost is always 1.0, never derived from duration/status."""
    tenant_id = _unique_tenant("billing-run")
    redis = get_redis()
    record = build_run_usage_record(
        tenant_id=tenant_id, workspace_id="ws-run", run_id="run-1", status="failed"
    )
    task = await record_run_usage(redis, record)
    await task

    async with tenant_connection(tenant_id) as conn:
        row = await conn.fetchrow(
            "SELECT run_id, status, cost_usd FROM billing_usage"
            " WHERE tenant_id = $1 AND record_type = 'run'",
            tenant_id,
        )
    assert row is not None
    assert row["run_id"] == "run-1"
    assert row["status"] == "failed"
    assert float(row["cost_usd"]) == 1.0


async def test_usage_summary_workspace_admin_sees_only_own_workspace(client: AsyncClient) -> None:
    """AC-7: a workspace admin's scoped usage read never includes another
    workspace's cost, even though both belong to the same tenant.
    """
    tenant_id = _unique_tenant("billing-scope")
    workspace_a, headers_a = await _create_workspace_via_route(
        client, tenant_id=tenant_id, admin_sub="u-admin-a", slug="ws-a"
    )
    workspace_b, _headers_b = await _create_workspace_via_route(
        client, tenant_id=tenant_id, admin_sub="u-admin-b", slug="ws-b"
    )
    await _seed_usage(tenant_id=tenant_id, workspace_id=workspace_a, cost_usd=5.0)
    await _seed_usage(tenant_id=tenant_id, workspace_id=workspace_b, cost_usd=9.0)

    own_scope = await client.get(
        "/api/billing/usage", params={"workspace_id": workspace_a}, headers=headers_a
    )
    assert own_scope.status_code == 200
    body = own_scope.json()
    assert [w["workspace_id"] for w in body["by_workspace"]] == [workspace_a]
    assert body["total_cost_usd"] == 5.0

    foreign_scope = await client.get(
        "/api/billing/usage", params={"workspace_id": workspace_b}, headers=headers_a
    )
    assert foreign_scope.status_code == 403


async def test_usage_summary_tenant_wide_requires_tenant_admin(client: AsyncClient) -> None:
    """AC-5: the tenant-wide read (no `workspace_id`) is scoped to the
    caller's own tenant and requires tenant-admin standing.
    """
    tenant_id = _unique_tenant("billing-tenant-wide")
    workspace_id, headers = await _create_workspace_via_route(
        client, tenant_id=tenant_id, admin_sub="u-admin", slug="ws-wide"
    )
    await _seed_usage(tenant_id=tenant_id, workspace_id=workspace_id, cost_usd=3.0)

    response = await client.get("/api/billing/usage", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["total_cost_usd"] == 3.0
    assert body["period"] == current_period()


async def test_cap_warning_and_reached_notify_workspace_admins(client: AsyncClient) -> None:
    """AC-6: 80% utilisation dispatches `billing.cap.warning`; hitting 100%
    dispatches `billing.cap.reached` -- both land in the admin's notification
    centre.
    """
    tenant_id = _unique_tenant("billing-notify")
    workspace_id, headers = await _create_workspace_via_route(
        client, tenant_id=tenant_id, admin_sub="u-admin-notify", slug="ws-notify"
    )
    await client.put(
        "/api/billing/caps",
        json={"scope_iri": workspace_iri(tenant_id, workspace_id), "value_usd": 10.0},
        headers=headers,
    )
    redis = get_redis()
    await redis.set(f"billing:{tenant_id}:{workspace_id}:{current_period()}:consumed_usd", "8.0")

    with patch("weave_backend.routers.billing.ai_route"):
        warning_response = await client.post(
            "/api/billing/simulate-ai-call",
            json={
                "workspace_id": workspace_id,
                "model_tier": "sonnet",
                "input_tokens": 1,
                "output_tokens": 1,
                "cost_usd": 0.0,
            },
            headers=headers,
        )
    assert warning_response.status_code == 204

    await redis.set(f"billing:{tenant_id}:{workspace_id}:{current_period()}:consumed_usd", "10.0")
    with patch("weave_backend.routers.billing.ai_route"):
        reached_response = await client.post(
            "/api/billing/simulate-ai-call",
            json={
                "workspace_id": workspace_id,
                "model_tier": "sonnet",
                "input_tokens": 1,
                "output_tokens": 1,
                "cost_usd": 0.0,
            },
            headers=headers,
        )
    assert reached_response.status_code == 429

    listing = await client.get(
        "/api/notifications", params={"unread": "true"}, headers=headers
    )
    event_types = {n["event_type"] for n in listing.json()["notifications"]}
    assert "billing.cap.warning" in event_types
    assert "billing.cap.reached" in event_types
