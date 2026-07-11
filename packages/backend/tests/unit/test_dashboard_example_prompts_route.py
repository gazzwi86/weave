"""AC-8 (TASK-011): `GET /api/dashboard/widgets/example-prompts` --
role-resolved, GA-filtered prompt catalogue for the empty prompt bar.
No DB involved (role comes off the principal's roles, same as
`resolve_starter_role` in `routers/dashboard.py::list_widgets_route`) --
mirrors `test_layout_routes.py`'s no-docker, dependency-override style.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.dependencies import Principal, RoleGrant, get_current_principal
from weave_backend.dashboard.example_prompts import EXAMPLE_PROMPTS_HIDE_AFTER


def _principal(role: str) -> Principal:
    return Principal(
        sub="u-1",
        tenant_id="3d6a8f2e-9b1c-4e5a-8f3d-1a2b3c4d5e6f",
        principal_iri="urn:weave:principal:user:u-1",
        roles=[RoleGrant(scope="tenant", role=role)],
    )


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


async def test_returns_role_scoped_ga_prompts(client: AsyncClient) -> None:
    app.dependency_overrides[get_current_principal] = lambda: _principal("author")

    response = await client.get("/api/dashboard/widgets/example-prompts")

    assert response.status_code == 200
    body = response.json()
    assert 4 <= len(body["prompts"]) <= 6
    assert body["hide_after"] == EXAMPLE_PROMPTS_HIDE_AFTER
    assert not any("build" in p.lower() for p in body["prompts"])


async def test_requires_auth(client: AsyncClient) -> None:
    response = await client.get("/api/dashboard/widgets/example-prompts")
    assert response.status_code == 401
