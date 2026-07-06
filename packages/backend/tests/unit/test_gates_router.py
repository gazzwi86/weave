"""BE-TASK-007 unit tests: the gate routes' own error-shape logic (401/404)
exercised through the real ASGI app (shared auth boundary, same pattern as
`test_briefs_router.py`) -- and the DoR route's `not_found` 404 when no
brief is stored for `task_id`.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.dependencies import Principal
from weave_backend.routers.gates import run_dor_gate_route

_TASK_ID = "task-1"
_PROJECT_IRI = "urn:weave:project:t1:acme"
_PRINCIPAL = Principal(sub="u-1", tenant_id="t1", principal_iri="urn:weave:principal:user:u-1")


@asynccontextmanager
async def _fake_tenant_connection(_tenant_id: str) -> AsyncIterator[None]:
    yield None


@pytest.mark.parametrize(
    "path",
    [
        f"/api/tasks/{_TASK_ID}/gates/dor",
        f"/api/tasks/{_TASK_ID}/gates/dod",
        f"/api/projects/{_PROJECT_IRI}/gates/pre-scaffold",
    ],
)
async def test_gate_routes_return_401_without_jwt(path: str) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(path, json={})

    assert response.status_code == 401
    assert response.json() == {"error": "unauthorised"}
    assert response.headers["www-authenticate"] == "Bearer"


async def test_dor_gate_route_returns_404_when_brief_not_found() -> None:
    with (
        patch("weave_backend.routers.gates.tenant_connection", _fake_tenant_connection),
        patch("weave_backend.routers.gates.get_task_brief", AsyncMock(return_value=None)),
        pytest.raises(HTTPException) as exc_info,
    ):
        await run_dor_gate_route(_TASK_ID, _PRINCIPAL)

    assert exc_info.value.status_code == 404
    detail = exc_info.value.detail
    assert isinstance(detail, dict)
    assert detail == {"error": "not_found"}
