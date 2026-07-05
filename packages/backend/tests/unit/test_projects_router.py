"""BE-TASK-001 unit tests: `create_project_route`'s own error-shape logic
(name validation, duplicate-slug conflict, CE-unreachable) exercised
directly -- not through HTTP -- with `tenant_connection` and its DB
collaborators patched out, so no docker/Postgres is needed (mirrors
`tests/unit/test_search.py`'s pattern of calling a route function directly
with mocked collaborators). AC-3 (401 without a JWT) goes through the real
ASGI app instead, since that's the shared auth boundary, not project-specific
logic (mirrors `tests/unit/test_whoami.py`).
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.dependencies import Principal
from weave_backend.projects.ce_version_client import CeVersionUnavailable
from weave_backend.projects.model import Project
from weave_backend.routers.projects import create_project_route
from weave_backend.schemas.projects import CreateProjectRequest

_PRINCIPAL = Principal(sub="u-1", tenant_id="t1", principal_iri="urn:weave:principal:user:u-1")


@asynccontextmanager
async def _fake_tenant_connection(_tenant_id: str) -> AsyncIterator[None]:
    yield None


async def test_create_project_route_returns_401_without_jwt() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/projects", json={"name": "Acme Corp"})

    assert response.status_code == 401


@pytest.mark.parametrize("name", ["", "   "])
async def test_create_project_route_422_when_name_missing_or_blank(name: str) -> None:
    body = CreateProjectRequest(name=name)

    with pytest.raises(HTTPException) as exc_info:
        await create_project_route(body, _PRINCIPAL, httpx.AsyncClient())

    assert exc_info.value.status_code == 422
    # Starlette types HTTPException.detail as `str | None`; this route
    # deliberately raises with a dict body (AC-6's exact 422 shape).
    assert exc_info.value.detail == {  # type: ignore[comparison-overlap]
        "error": "validation_error",
        "field": "name",
    }


async def test_create_project_route_409_when_slug_already_exists() -> None:
    body = CreateProjectRequest(name="Acme Corp")

    with (
        patch("weave_backend.routers.projects.tenant_connection", _fake_tenant_connection),
        patch(
            "weave_backend.routers.projects.find_existing_project_iri",
            AsyncMock(return_value="urn:weave:project:t1:acme-corp"),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await create_project_route(body, _PRINCIPAL, httpx.AsyncClient())

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == {  # type: ignore[comparison-overlap]
        "error": "project_exists",
        "existing_iri": "urn:weave:project:t1:acme-corp",
    }


async def test_create_project_route_503_when_ce_unreachable() -> None:
    body = CreateProjectRequest(name="Acme Corp")

    with (
        patch("weave_backend.routers.projects.tenant_connection", _fake_tenant_connection),
        patch(
            "weave_backend.routers.projects.find_existing_project_iri",
            AsyncMock(return_value=None),
        ),
        patch(
            "weave_backend.routers.projects.get_pinned_latest_version",
            AsyncMock(side_effect=CeVersionUnavailable("boom")),
        ),
        pytest.raises(HTTPException) as exc_info,
    ):
        await create_project_route(body, _PRINCIPAL, httpx.AsyncClient())

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == {  # type: ignore[comparison-overlap]
        "error": "ce_version_unavailable"
    }


async def test_create_project_route_returns_pinned_version_on_success() -> None:
    body = CreateProjectRequest(name="Acme Corp")
    created = Project(
        project_iri="urn:weave:project:t1:acme-corp",
        name="Acme Corp",
        pinned_graph_version_iri="urn:weave:version:v2",
        created_at=datetime.now(UTC),
    )

    with (
        patch("weave_backend.routers.projects.tenant_connection", _fake_tenant_connection),
        patch(
            "weave_backend.routers.projects.find_existing_project_iri",
            AsyncMock(return_value=None),
        ),
        patch(
            "weave_backend.routers.projects.get_pinned_latest_version",
            AsyncMock(return_value="urn:weave:version:v2"),
        ),
        patch(
            "weave_backend.routers.projects.create_project",
            AsyncMock(return_value=created),
        ),
    ):
        result = await create_project_route(body, _PRINCIPAL, httpx.AsyncClient())

    assert result.project_iri == "urn:weave:project:t1:acme-corp"
    assert result.pinned_graph_version_iri == "urn:weave:version:v2"
