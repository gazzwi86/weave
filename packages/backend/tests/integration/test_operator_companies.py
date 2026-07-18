"""G15/ADR-023 integration coverage: the operator-console endpoints against
real Postgres + Oxigraph -- provisioning side effects (workspace + first-admin
invite + audit), and the suspension-enforcement guarantee that is only
provable against real DB (`auth/dependencies.py::_is_tenant_suspended`
fail-open on an unregistered tenant, then fail-closed once suspended).

`require_super_admin` itself is pure-JWT and already fully unit-tested
(`test_operator_rbac.py`, `test_operator_router.py`) -- these tests override
`get_current_principal` with a platform super-admin principal for the
operator calls (same style as `test_dashboard_example_prompts_route.py`),
and use a REAL mock-oidc token for the suspension-enforcement assertions,
since that's exercising the real `get_current_principal` path.
"""

from __future__ import annotations

import shutil
import uuid
from collections.abc import AsyncIterator, Iterator
from contextlib import contextmanager
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.dependencies import Principal, RoleGrant, get_current_principal
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.db.pool import tenant_connection
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.tenancy.members import activate_member, invite_member
from weave_backend.tenancy.workspaces import create_workspace

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]

_SUPER_ADMIN = Principal(
    sub="operator-1",
    tenant_id="platform",
    principal_iri="urn:weave:principal:operator:operator-1",
    roles=[RoleGrant(scope="platform", role="super_admin")],
)


def _unique_name(label: str) -> str:
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


@pytest.fixture
async def operator_client(client: AsyncClient) -> AsyncIterator[AsyncClient]:
    app.dependency_overrides[get_current_principal] = lambda: _SUPER_ADMIN
    yield client
    del app.dependency_overrides[get_current_principal]


@contextmanager
def _as_super_admin() -> Iterator[None]:
    """Scopes the super-admin override to a single call -- unlike the
    `operator_client` fixture (whole-test override), this leaves
    `get_current_principal` on its real verification path for any
    non-operator call made around it. Needed by the suspension test below,
    which must exercise the REAL auth path on `/api/workspaces/active` to
    prove enforcement, not just assert against a stubbed principal.
    """
    app.dependency_overrides[get_current_principal] = lambda: _SUPER_ADMIN
    try:
        yield
    finally:
        del app.dependency_overrides[get_current_principal]


async def test_provision_then_list_returns_the_new_company(
    operator_client: AsyncClient,
) -> None:
    name = _unique_name("Acme Co")
    response = await operator_client.post(
        "/api/operator/companies",
        json={
            "name": name,
            "industry": "retail",
            "region": "us",
            "admin_email": "admin@acme.example",
        },
    )

    assert response.status_code == 201, response.text
    body = response.json()
    company = body["company"]
    assert company["name"] == name
    assert company["industry"] == "retail"
    assert company["region"] == "us"
    assert company["status"] == "active"
    assert company["member_count"] == 0  # invite is pending, not active yet
    assert company["entity_count"] == 0
    assert company["model_version"] is None
    assert body["admin_invite"]["email"] == "admin@acme.example"
    assert body["admin_invite"]["role"] == "admin"
    tenant_id = company["tenant_id"]

    list_response = await operator_client.get("/api/operator/companies")
    assert list_response.status_code == 200
    listed = {c["tenant_id"]: c for c in list_response.json()}
    assert tenant_id in listed
    assert listed[tenant_id]["name"] == name

    async with tenant_connection(tenant_id) as conn:
        row = await conn.fetchrow(
            "SELECT event_type, target_iri FROM audit_entries"
            " WHERE tenant_id = $1 AND event_type = 'company.provisioned'",
            tenant_id,
        )
    assert row is not None
    assert row["target_iri"] == f"urn:weave:tenant:{tenant_id}:company"


async def test_duplicate_company_name_is_rejected(operator_client: AsyncClient) -> None:
    name = _unique_name("Dup Co")
    body = {
        "name": name,
        "industry": "retail",
        "region": "us",
        "admin_email": "admin@dup.example",
    }

    first = await operator_client.post("/api/operator/companies", json=body)
    assert first.status_code == 201

    second = await operator_client.post("/api/operator/companies", json=body)
    assert second.status_code == 409
    assert second.json()["detail"]["error"] == "tenant_id_taken"


async def test_suspend_blocks_authentication_and_unsuspend_restores(
    client: AsyncClient,
) -> None:
    """Uses the bare `client` fixture (no whole-test override) so the
    `/api/workspaces/active` calls exercise the REAL `get_current_principal`
    path via a real mock-oidc token -- `_as_super_admin()` only wraps the
    operator calls, which is the one part of this flow allowed to skip real
    auth.
    """
    with _as_super_admin():
        provision = await client.post(
            "/api/operator/companies",
            json={
                "name": _unique_name("Suspend Co"),
                "industry": "retail",
                "region": "us",
                "admin_email": "admin@suspend.example",
            },
        )
    tenant_id = provision.json()["company"]["tenant_id"]

    user_sub = "u-operator-test"
    async with tenant_connection(tenant_id) as conn:
        workspace = await create_workspace(
            conn, tenant_id=tenant_id, slug="ws", display_name="Suspend workspace"
        )
        await invite_member(
            conn,
            tenant_id=tenant_id,
            workspace_id=workspace.id,
            email="m@suspend.example",
            role="read",
        )
        await activate_member(
            conn, workspace_id=workspace.id, email="m@suspend.example", user_sub=user_sub
        )

    tokens = await issue_token_pair(sub=user_sub, tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    ok_before = await client.get("/api/workspaces/active", headers=headers)
    assert ok_before.status_code == 200

    with _as_super_admin():
        suspend = await client.post(f"/api/operator/companies/{tenant_id}/suspend")
    assert suspend.status_code == 200
    assert suspend.json() == {"tenant_id": tenant_id, "status": "suspended"}

    blocked = await client.get("/api/workspaces/active", headers=headers)
    assert blocked.status_code == 403
    assert blocked.json()["detail"]["error"] == "tenant_suspended"

    with _as_super_admin():
        unsuspend = await client.post(f"/api/operator/companies/{tenant_id}/unsuspend")
    assert unsuspend.status_code == 200
    assert unsuspend.json() == {"tenant_id": tenant_id, "status": "active"}

    ok_after = await client.get("/api/workspaces/active", headers=headers)
    assert ok_after.status_code == 200

    async with tenant_connection(tenant_id) as conn:
        rows = await conn.fetch(
            "SELECT event_type FROM audit_entries WHERE tenant_id = $1"
            " AND event_type IN ('company.suspended', 'company.unsuspended')"
            " ORDER BY event_type",
            tenant_id,
        )
    assert [r["event_type"] for r in rows] == ["company.suspended", "company.unsuspended"]


async def test_suspend_unregistered_company_returns_404(operator_client: AsyncClient) -> None:
    response = await operator_client.post("/api/operator/companies/no-such-tenant/suspend")

    assert response.status_code == 404
    assert response.json()["detail"]["error"] == "company_not_found"


async def test_a_tenant_never_provisioned_via_the_operator_still_authenticates(
    client: AsyncClient,
) -> None:
    """ADR-023 point 3's fail-open guarantee: a tenant with no `tenants`
    registry row (every tenant provisioned before G15, e.g. via
    `create_workspace` directly like `seed_demo.py`/`onboarding/sandbox.py`)
    must authenticate normally -- no operator record must never mean
    "nobody can log in".
    """
    tenant_id = _unique_name("legacy-tenant")
    user_sub = "u-legacy"
    async with tenant_connection(tenant_id) as conn:
        workspace = await create_workspace(
            conn, tenant_id=tenant_id, slug="ws", display_name="Legacy workspace"
        )
        await invite_member(
            conn,
            tenant_id=tenant_id,
            workspace_id=workspace.id,
            email="legacy@example.invalid",
            role="read",
        )
        await activate_member(
            conn, workspace_id=workspace.id, email="legacy@example.invalid", user_sub=user_sub
        )

    tokens = await issue_token_pair(sub=user_sub, tenant_id=tenant_id)

    response = await client.get(
        "/api/workspaces/active", headers={"Authorization": f"Bearer {tokens.access_token}"}
    )

    assert response.status_code == 200
