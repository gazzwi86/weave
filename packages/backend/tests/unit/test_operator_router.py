"""G15 CRITICAL isolation tests (task brief): every `/api/operator/companies*`
route must 403 a non-super-admin, including a tenant-admin of one company
(who must never reach another company's operator view). `require_super_admin`
is pure-JWT (`rbac.py`) -- no DB, no docker, same dependency-override style
as `test_dashboard_example_prompts_route.py`.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.dependencies import Principal, RoleGrant, get_current_principal


def _principal(*, roles: list[RoleGrant]) -> Principal:
    return Principal(
        sub="u-1",
        tenant_id="company-a",
        principal_iri="urn:weave:principal:user:u-1",
        roles=roles,
    )


_NO_GRANTS = _principal(roles=[])
_TENANT_ADMIN_OF_COMPANY_A = _principal(roles=[RoleGrant(scope="tenant", role="admin")])


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.mark.parametrize("principal", [_NO_GRANTS, _TENANT_ADMIN_OF_COMPANY_A])
async def test_list_companies_denies_a_non_super_admin(
    client: AsyncClient, principal: Principal
) -> None:
    app.dependency_overrides[get_current_principal] = lambda: principal

    response = await client.get("/api/operator/companies")

    assert response.status_code == 403
    assert response.json()["detail"]["error"] == "forbidden"


@pytest.mark.parametrize("principal", [_NO_GRANTS, _TENANT_ADMIN_OF_COMPANY_A])
async def test_provision_company_denies_a_non_super_admin(
    client: AsyncClient, principal: Principal
) -> None:
    app.dependency_overrides[get_current_principal] = lambda: principal

    response = await client.post(
        "/api/operator/companies",
        json={
            "name": "Company B",
            "industry": "retail",
            "region": "us",
            "admin_email": "admin@company-b.example",
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"]["error"] == "forbidden"


@pytest.mark.parametrize("principal", [_NO_GRANTS, _TENANT_ADMIN_OF_COMPANY_A])
async def test_suspend_company_denies_a_non_super_admin(
    client: AsyncClient, principal: Principal
) -> None:
    """The isolation-critical case: company A's tenant-admin must not be
    able to suspend company B (or any company) via this route.
    """
    app.dependency_overrides[get_current_principal] = lambda: principal

    response = await client.post("/api/operator/companies/company-b/suspend")

    assert response.status_code == 403
    assert response.json()["detail"]["error"] == "forbidden"


@pytest.mark.parametrize("principal", [_NO_GRANTS, _TENANT_ADMIN_OF_COMPANY_A])
async def test_unsuspend_company_denies_a_non_super_admin(
    client: AsyncClient, principal: Principal
) -> None:
    app.dependency_overrides[get_current_principal] = lambda: principal

    response = await client.post("/api/operator/companies/company-b/unsuspend")

    assert response.status_code == 403
    assert response.json()["detail"]["error"] == "forbidden"


async def test_operator_routes_require_auth(client: AsyncClient) -> None:
    response = await client.get("/api/operator/companies")

    assert response.status_code == 401
