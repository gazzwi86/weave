"""BE-TASK-005 unit tests: `transition_spec_route`'s own error-shape logic
(404/409) exercised directly -- not through HTTP -- with `tenant_connection`
and `transition_spec` patched out, mirroring
`tests/unit/test_projects_router.py`'s pattern. AC-1's 401 goes through the
real ASGI app instead, since that's the shared auth boundary.
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
from weave_backend.build.lifecycle import InvalidTransition
from weave_backend.build.store import SpecNotFound, SpecRecord
from weave_backend.routers.specs import transition_spec_route
from weave_backend.schemas.specs import SpecTransitionRequest

_PRINCIPAL = Principal(sub="u-1", tenant_id="t1", principal_iri="urn:weave:principal:user:u-1")


@asynccontextmanager
async def _fake_tenant_connection(_tenant_id: str) -> AsyncIterator[None]:
    yield None


async def test_transition_spec_route_returns_401_without_jwt() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/specs/spec-1/transition", json={"requested_state": "Spec Review"}
        )

    assert response.status_code == 401


async def test_transition_spec_route_404_when_spec_not_found() -> None:
    body = SpecTransitionRequest(requested_state="Spec Review")

    with (
        patch("weave_backend.routers.specs.tenant_connection", _fake_tenant_connection),
        patch(
            "weave_backend.routers.specs.transition_spec",
            AsyncMock(side_effect=SpecNotFound("spec-1")),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await transition_spec_route("spec-1", body, _PRINCIPAL)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == {"error": "not_found"}  # type: ignore[comparison-overlap]


async def test_transition_spec_route_409_on_invalid_transition() -> None:
    body = SpecTransitionRequest(requested_state="In Progress")

    with (
        patch("weave_backend.routers.specs.tenant_connection", _fake_tenant_connection),
        patch(
            "weave_backend.routers.specs.transition_spec",
            AsyncMock(side_effect=InvalidTransition("Draft", "In Progress")),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await transition_spec_route("spec-1", body, _PRINCIPAL)

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == {  # type: ignore[comparison-overlap]
        "error": "invalid_transition",
        "current": "Draft",
        "requested": "In Progress",
    }


async def test_transition_spec_route_200_on_valid_transition() -> None:
    body = SpecTransitionRequest(requested_state="Spec Review")
    updated = SpecRecord(tenant_id="t1", spec_id="spec-1", status="Spec Review")

    with (
        patch("weave_backend.routers.specs.tenant_connection", _fake_tenant_connection),
        patch("weave_backend.routers.specs.transition_spec", AsyncMock(return_value=updated)),
    ):
        response = await transition_spec_route("spec-1", body, _PRINCIPAL)

    assert response.spec_id == "spec-1"
    assert response.status == "Spec Review"
