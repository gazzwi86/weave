"""BE-TASK-009 unit tests: `deploy_route`/`get_demo_route` error-shape
mapping (404/422/503/200/201), exercised directly -- not through HTTP --
mirroring `tests/unit/test_generation_router.py`'s pattern.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from fastapi.responses import JSONResponse

from weave_backend.auth.dependencies import Principal
from weave_backend.deploy.ce_write_client import CeWriteUnavailable
from weave_backend.deploy.service import GenerationRunNotFoundError, ProjectNotFoundError
from weave_backend.projects.model import Project
from weave_backend.routers.deploy import deploy_route, get_demo_route
from weave_backend.schemas.deploy import DeployRequestBody

_PRINCIPAL = Principal(sub="u-1", tenant_id="t1", principal_iri="urn:weave:principal:user:u-1")
_MODULE = "weave_backend.routers.deploy"


@asynccontextmanager
async def _fake_tenant_connection(_tenant_id: str) -> AsyncIterator[None]:
    yield None


def _body(run_mode: str = "spec_to_build") -> DeployRequestBody:
    return DeployRequestBody(commit_sha="sha-123", run_mode=run_mode)


async def test_deploy_route_422_on_invalid_run_mode() -> None:
    with pytest.raises(HTTPException) as exc_info:
        await deploy_route(
            "urn:weave:project:t1:acme", "task-1", _body("bogus"), _PRINCIPAL, AsyncMock()
        )

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail["error"] == "invalid_run_mode"  # type: ignore[index]


async def test_deploy_route_404_when_project_not_found() -> None:
    with (
        patch(f"{_MODULE}.tenant_connection", _fake_tenant_connection),
        patch(
            f"{_MODULE}.publish_and_write_back",
            AsyncMock(side_effect=ProjectNotFoundError("x")),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await deploy_route("urn:weave:project:t1:acme", "task-1", _body(), _PRINCIPAL, AsyncMock())

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == {"error": "not_found"}  # type: ignore[comparison-overlap]


async def test_deploy_route_404_when_generation_run_not_found() -> None:
    with (
        patch(f"{_MODULE}.tenant_connection", _fake_tenant_connection),
        patch(
            f"{_MODULE}.publish_and_write_back",
            AsyncMock(side_effect=GenerationRunNotFoundError("sha-123")),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await deploy_route("urn:weave:project:t1:acme", "task-1", _body(), _PRINCIPAL, AsyncMock())

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == {"error": "not_found"}  # type: ignore[comparison-overlap]


async def test_deploy_route_503_when_ce_write_unavailable() -> None:
    with (
        patch(f"{_MODULE}.tenant_connection", _fake_tenant_connection),
        patch(
            f"{_MODULE}.publish_and_write_back",
            AsyncMock(side_effect=CeWriteUnavailable("down")),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await deploy_route("urn:weave:project:t1:acme", "task-1", _body(), _PRINCIPAL, AsyncMock())

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == {"error": "ce_write_unavailable"}  # type: ignore[comparison-overlap]


async def test_deploy_route_200_on_publish_failed() -> None:
    outcome = {
        "publish_status": "failed",
        "error": "bucket unreachable",
        "prior_output_location_ref": None,
    }
    with (
        patch(f"{_MODULE}.tenant_connection", _fake_tenant_connection),
        patch(f"{_MODULE}.publish_and_write_back", AsyncMock(return_value=outcome)),
    ):
        response = await deploy_route(
            "urn:weave:project:t1:acme", "task-1", _body(), _PRINCIPAL, AsyncMock()
        )

    assert isinstance(response, JSONResponse)
    assert response.status_code == 200


async def test_deploy_route_201_on_write_back_committed() -> None:
    outcome = {
        "output_location_ref": "s3://weave-artefacts/t1/run-1/",
        "write_back_status": "committed",
        "write_back_artefact_iri": "urn:weave:artefact:t1:run-1",
        "activity_iri": "urn:weave:activity:1",
        "applied_count": 1,
    }
    with (
        patch(f"{_MODULE}.tenant_connection", _fake_tenant_connection),
        patch(f"{_MODULE}.publish_and_write_back", AsyncMock(return_value=outcome)),
    ):
        response = await deploy_route(
            "urn:weave:project:t1:acme", "task-1", _body(), _PRINCIPAL, AsyncMock()
        )

    assert isinstance(response, JSONResponse)
    assert response.status_code == 201


async def test_get_demo_route_404_when_project_not_found() -> None:
    with (
        patch(f"{_MODULE}.tenant_connection", _fake_tenant_connection),
        patch(f"{_MODULE}.get_project", AsyncMock(return_value=None)),
        pytest.raises(HTTPException) as exc_info,
    ):
        await get_demo_route("urn:weave:project:t1:acme", _PRINCIPAL)

    assert exc_info.value.status_code == 404


async def test_get_demo_route_200_returns_demo_response() -> None:
    project = Project(
        project_iri="urn:weave:project:t1:acme",
        name="Acme",
        pinned_graph_version_iri="urn:weave:version:v1",
        created_at=datetime.now(UTC),
        demo_output_location_ref="s3://weave-artefacts/t1/run-1/",
        write_back_complete=True,
        write_back_artefact_iri="urn:weave:artefact:t1:run-1",
    )
    with (
        patch(f"{_MODULE}.tenant_connection", _fake_tenant_connection),
        patch(f"{_MODULE}.get_project", AsyncMock(return_value=project)),
    ):
        response = await get_demo_route("urn:weave:project:t1:acme", _PRINCIPAL)

    assert response.output_location_ref == "s3://weave-artefacts/t1/run-1/"
    assert response.write_back_complete is True
    assert response.write_back_artefact_iri == "urn:weave:artefact:t1:run-1"
