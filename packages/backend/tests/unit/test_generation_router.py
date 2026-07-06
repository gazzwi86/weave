"""BE-TASK-008 unit tests: `generate_app_route`'s error-shape mapping
(404/422/503/201) exercised directly -- not through HTTP -- with
`tenant_connection` and `generate_app` patched out, mirroring
`tests/unit/test_tasks_router.py`'s pattern. The 401-without-JWT case is
covered by `assert_all_routes_guarded` (app-startup check) plus the shared
`get_current_principal` unit tests -- no need to re-prove it per router.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from weave_backend.auth.dependencies import Principal
from weave_backend.briefs.ce_read_client import CeReadUnavailable
from weave_backend.generation.gates import GateFailure
from weave_backend.generation.service import BriefNotFoundError, ProjectNotFoundError
from weave_backend.routers.generation import generate_app_route

_PRINCIPAL = Principal(sub="u-1", tenant_id="t1", principal_iri="urn:weave:principal:user:u-1")
_MODULE = "weave_backend.routers.generation"


@asynccontextmanager
async def _fake_tenant_connection(_tenant_id: str) -> AsyncIterator[None]:
    yield None


async def test_generate_app_route_404_when_project_not_found() -> None:
    with (
        patch(f"{_MODULE}.tenant_connection", _fake_tenant_connection),
        patch(f"{_MODULE}.generate_app", AsyncMock(side_effect=ProjectNotFoundError("x"))),
        pytest.raises(HTTPException) as exc_info,
    ):
        await generate_app_route("urn:weave:project:t1:acme", "task-1", _PRINCIPAL, AsyncMock())

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == {"error": "not_found"}  # type: ignore[comparison-overlap]


async def test_generate_app_route_404_when_brief_not_found() -> None:
    with (
        patch(f"{_MODULE}.tenant_connection", _fake_tenant_connection),
        patch(f"{_MODULE}.generate_app", AsyncMock(side_effect=BriefNotFoundError("task-1"))),
        pytest.raises(HTTPException) as exc_info,
    ):
        await generate_app_route("urn:weave:project:t1:acme", "task-1", _PRINCIPAL, AsyncMock())

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == {"error": "brief_not_found"}  # type: ignore[comparison-overlap]


async def test_generate_app_route_503_when_ce_read_unavailable() -> None:
    with (
        patch(f"{_MODULE}.tenant_connection", _fake_tenant_connection),
        patch(f"{_MODULE}.generate_app", AsyncMock(side_effect=CeReadUnavailable("down"))),
        pytest.raises(HTTPException) as exc_info,
    ):
        await generate_app_route("urn:weave:project:t1:acme", "task-1", _PRINCIPAL, AsyncMock())

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == {"error": "ce_read_unavailable"}  # type: ignore[comparison-overlap]


async def test_generate_app_route_422_on_gate_failure_includes_evidence() -> None:
    failure = GateFailure("mutation_gate_fail", score=0.65, surviving_mutants=[{"id": "m1"}])
    with (
        patch(f"{_MODULE}.tenant_connection", _fake_tenant_connection),
        patch(f"{_MODULE}.generate_app", AsyncMock(side_effect=failure)),
        pytest.raises(HTTPException) as exc_info,
    ):
        await generate_app_route("urn:weave:project:t1:acme", "task-1", _PRINCIPAL, AsyncMock())

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail == {  # type: ignore[comparison-overlap]
        "error": "mutation_gate_fail",
        "score": 0.65,
        "surviving_mutants": [{"id": "m1"}],
    }


async def test_generate_app_route_201_returns_generate_response() -> None:
    outcome = {
        "commit_sha": "sha-123",
        "branch": "build/acme/task-1",
        "gates_passed": [{"gate": "secret_scan", "status": "PASS"}],
    }
    with (
        patch(f"{_MODULE}.tenant_connection", _fake_tenant_connection),
        patch(f"{_MODULE}.generate_app", AsyncMock(return_value=outcome)),
    ):
        response = await generate_app_route(
            "urn:weave:project:t1:acme", "task-1", _PRINCIPAL, AsyncMock()
        )

    assert response.commit_sha == "sha-123"
    assert response.branch == "build/acme/task-1"
    assert response.gates_passed[0].gate == "secret_scan"
