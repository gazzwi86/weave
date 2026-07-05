"""BE-TASK-005 unit tests: `submit_task_result_route` / `submit_hitl_action_route`'s
own error-shape logic (404/403/503/422) exercised directly -- not through
HTTP -- with `tenant_connection` and the domain functions patched out,
mirroring `tests/unit/test_projects_router.py`'s pattern.
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
from weave_backend.build.hitl import HitlGateClosedError, SelfApprovalNotPermitted
from weave_backend.build.store import TaskNotFound
from weave_backend.routers.tasks import submit_hitl_action_route, submit_task_result_route
from weave_backend.schemas.tasks import HitlActionRequest, TypedResult

_PRINCIPAL = Principal(sub="u-1", tenant_id="t1", principal_iri="urn:weave:principal:user:u-1")


@asynccontextmanager
async def _fake_tenant_connection(_tenant_id: str) -> AsyncIterator[None]:
    yield None


async def test_submit_task_result_route_returns_401_without_jwt() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/tasks/task-1/result",
            json={"status": "PASS", "retry_recommended": False},
        )

    assert response.status_code == 401


async def test_submit_task_result_route_404_when_task_not_found() -> None:
    body = TypedResult(status="PASS", retry_recommended=False)

    with (
        patch("weave_backend.routers.tasks.tenant_connection", _fake_tenant_connection),
        patch(
            "weave_backend.routers.tasks.handle_agent_result",
            AsyncMock(side_effect=TaskNotFound("task-1")),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await submit_task_result_route("task-1", body, _PRINCIPAL)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == {"error": "not_found"}  # type: ignore[comparison-overlap]


async def test_submit_task_result_route_503_on_hitl_gate_closed() -> None:
    body = TypedResult(status="FAIL", failure_class="logic", retry_recommended=True)

    with (
        patch("weave_backend.routers.tasks.tenant_connection", _fake_tenant_connection),
        patch(
            "weave_backend.routers.tasks.handle_agent_result",
            AsyncMock(side_effect=HitlGateClosedError("unreachable")),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await submit_task_result_route("task-1", body, _PRINCIPAL)

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == {  # type: ignore[comparison-overlap]
        "error": "hitl_gate_closed"
    }


async def test_submit_task_result_route_200_returns_outcome() -> None:
    body = TypedResult(status="PASS", retry_recommended=False)

    with (
        patch("weave_backend.routers.tasks.tenant_connection", _fake_tenant_connection),
        patch(
            "weave_backend.routers.tasks.handle_agent_result",
            AsyncMock(return_value={"action": "proceed", "retry_count": None}),
        ),
    ):
        response = await submit_task_result_route("task-1", body, _PRINCIPAL)

    assert response.action == "proceed"
    assert response.retry_count is None


async def test_submit_hitl_action_route_404_when_task_not_found() -> None:
    body = HitlActionRequest(action="approve")

    with (
        patch("weave_backend.routers.tasks.tenant_connection", _fake_tenant_connection),
        patch(
            "weave_backend.routers.tasks.handle_hitl_response",
            AsyncMock(side_effect=TaskNotFound("task-1")),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await submit_hitl_action_route("task-1", body, _PRINCIPAL)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == {"error": "not_found"}  # type: ignore[comparison-overlap]


async def test_submit_hitl_action_route_403_on_self_approval() -> None:
    body = HitlActionRequest(action="approve")

    with (
        patch("weave_backend.routers.tasks.tenant_connection", _fake_tenant_connection),
        patch(
            "weave_backend.routers.tasks.handle_hitl_response",
            AsyncMock(side_effect=SelfApprovalNotPermitted("urn:weave:principal:user:u-1")),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await submit_hitl_action_route("task-1", body, _PRINCIPAL)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == {  # type: ignore[comparison-overlap]
        "error": "self_approval_not_permitted"
    }


async def test_submit_hitl_action_route_200_returns_outcome() -> None:
    body = HitlActionRequest(action="approve")

    with (
        patch("weave_backend.routers.tasks.tenant_connection", _fake_tenant_connection),
        patch(
            "weave_backend.routers.tasks.handle_hitl_response",
            AsyncMock(return_value={"action": "resumed"}),
        ),
    ):
        response = await submit_hitl_action_route("task-1", body, _PRINCIPAL)

    assert response.action == "resumed"


async def test_hitl_action_request_422_when_amendment_missing_for_amend() -> None:
    with pytest.raises(ValueError, match="amendment"):
        HitlActionRequest(action="amend")
