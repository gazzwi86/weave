"""TASK-001 (build-engine EPIC-002) unit test: AC-7's scope/project_id
mismatch 422, exercised directly against `put_standard_route` (mirrors
`test_projects_router.py`'s direct-function-call pattern) -- no docker/
Postgres, since the validation raises before any DB/CE call.
"""

from __future__ import annotations

import httpx
import pytest
from fastapi import HTTPException

from weave_backend.auth.dependencies import Principal
from weave_backend.routers.standards import put_standard_route
from weave_backend.schemas.standards import PutStandardRequest

_PRINCIPAL = Principal(sub="u-1", tenant_id="t1", principal_iri="urn:weave:principal:user:u-1")


async def test_put_standard_route_422_when_project_scope_missing_project_id() -> None:
    body = PutStandardRequest(
        project_id=None,
        title="Lint rules",
        body_md="# Lint",
        policy_iri="urn:weave:policy:t1:lint",
    )

    with pytest.raises(HTTPException) as exc_info:
        await put_standard_route("project", "lint", body, _PRINCIPAL, httpx.AsyncClient())

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail == {"error": "scope_project_id_mismatch"}  # type: ignore[comparison-overlap]


async def test_put_standard_route_422_when_company_scope_has_project_id() -> None:
    body = PutStandardRequest(
        project_id="urn:weave:project:t1:acme",
        title="Lint rules",
        body_md="# Lint",
        policy_iri="urn:weave:policy:t1:lint",
    )

    with pytest.raises(HTTPException) as exc_info:
        await put_standard_route("company", "lint", body, _PRINCIPAL, httpx.AsyncClient())

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail == {"error": "scope_project_id_mismatch"}  # type: ignore[comparison-overlap]


async def test_put_standard_route_422_when_scope_invalid() -> None:
    body = PutStandardRequest(
        project_id=None,
        title="Lint rules",
        body_md="# Lint",
        policy_iri="urn:weave:policy:t1:lint",
    )

    with pytest.raises(HTTPException) as exc_info:
        await put_standard_route("workspace", "lint", body, _PRINCIPAL, httpx.AsyncClient())

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail == {"error": "invalid_scope"}  # type: ignore[comparison-overlap]
