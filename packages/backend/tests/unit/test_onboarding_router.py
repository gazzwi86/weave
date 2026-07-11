"""ONB-TASK-001 AC-001-07: every `/api/onboarding/*` route rejects an
unauthenticated request with 401 before any DB read -- exercised through the
real ASGI app (the shared auth boundary), no docker/Postgres needed, same
pattern as `test_projects_router.py::test_create_project_route_returns_401_without_jwt`.
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app


@pytest.mark.parametrize(
    ("method", "path", "json"),
    [
        ("GET", "/api/onboarding/state", None),
        ("PATCH", "/api/onboarding/state", {"role_path": "technical"}),
        ("PUT", "/api/onboarding/tours/ce-onboarding/progress", {"last_completed_step": 1}),
        ("PUT", "/api/onboarding/dismissals/beacon/b-1", None),
        ("DELETE", "/api/onboarding/dismissals/beacon/b-1", None),
        ("DELETE", "/api/onboarding/dismissals/beacon", None),
    ],
)
async def test_onboarding_route_returns_401_without_jwt(
    method: str, path: str, json: dict[str, object] | None
) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.request(method, path, json=json)

    assert response.status_code == 401
