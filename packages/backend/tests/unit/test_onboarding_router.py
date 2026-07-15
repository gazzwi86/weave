"""ONB-TASK-001 AC-001-07: every `/api/onboarding/*` route rejects an
unauthenticated request with 401 before any DB read -- exercised through the
real ASGI app (the shared auth boundary), no docker/Postgres needed, same
pattern as `test_projects_router.py::test_create_project_route_returns_401_without_jwt`.
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.dependencies import Principal, get_current_principal


@pytest.mark.parametrize(
    ("method", "path", "json"),
    [
        ("GET", "/api/onboarding/state", None),
        ("PATCH", "/api/onboarding/state", {"role_path": "technical"}),
        ("GET", "/api/onboarding/path", None),
        ("PUT", "/api/onboarding/path", {"role_path": "technical"}),
        ("PUT", "/api/onboarding/tours/ce-onboarding/progress", {"last_completed_step": 1}),
        ("PUT", "/api/onboarding/dismissals/beacon/b-1", None),
        ("DELETE", "/api/onboarding/dismissals/beacon/b-1", None),
        ("DELETE", "/api/onboarding/dismissals/beacon", None),
        ("POST", "/api/onboarding/exercises/CE-01/check", {"signals": []}),
        ("POST", "/api/onboarding/checklist/restore", None),
        ("POST", "/api/onboarding/milestones/invite_admin/self-mark", None),
    ],
)
async def test_onboarding_route_returns_401_without_jwt(
    method: str, path: str, json: dict[str, object] | None
) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.request(method, path, json=json)

    assert response.status_code == 401


async def test_self_mark_rejects_non_manual_milestone_id() -> None:
    """AC-010-03: allowlist, not free-text -- a poller-owned (or made-up)
    milestone_id must never be writable through self-mark.
    """
    transport = ASGITransport(app=app)
    app.dependency_overrides[get_current_principal] = lambda: Principal(
        sub="u-1",
        tenant_id="3d6a8f2e-9b1c-4e5a-8f3d-1a2b3c4d5e6f",
        principal_iri="urn:weave:principal:user:u-1",
    )
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/onboarding/milestones/first_committed_entity/self-mark"
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404
