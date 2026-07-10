"""TASK-011 integration tests: `require_project_role` blocking/allowing at
the real HTTP layer, against real Postgres (`project_contributors` rows
seeded via `pm.contributors.upsert`) and real JWTs (mock OIDC). Marked
`integration`/`docker` per `test_identity_rbac.py`'s precedent.

A test-local `FastAPI()` + `APIRouter()` mounts the guard on a throwaway
route (same technique as `test_public_routes_guarded.py`) -- TASK-011 ships
no production PM mutation route yet, only the dependency itself.
"""

from __future__ import annotations

import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Annotated

import pytest
from fastapi import APIRouter, Depends, FastAPI
from httpx import ASGITransport, AsyncClient

from weave_backend import app as production_app
from weave_backend.auth.dependencies import Principal, RoleGrant, get_current_principal
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.db.pool import tenant_connection
from weave_backend.identity.registry import human_principal_iri
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.pm.contributors import NewContributor, upsert
from weave_backend.projects.model import NewProject, create_project
from weave_backend.rbac import ProjectAction, require_project_role

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]

_test_router = APIRouter()


@_test_router.put("/api/_test/projects/{project_iri}/settings")
async def _settings_mutation(
    project_iri: str,
    principal: Annotated[Principal, Depends(require_project_role(ProjectAction.SETTINGS))],
) -> dict[str, str]:
    return {"project_iri": project_iri, "principal_iri": principal.principal_iri}


@_test_router.put("/api/_test/projects/{project_iri}/contributors")
async def _contributors_mutation(
    project_iri: str,
    principal: Annotated[Principal, Depends(require_project_role(ProjectAction.CONTRIBUTORS))],
) -> dict[str, str]:
    return {"project_iri": project_iri, "principal_iri": principal.principal_iri}


_test_app = FastAPI()
_test_app.include_router(_test_router)


def _unique_tenant(label: str) -> str:
    return f"tenant-{label}-{uuid.uuid4().hex[:8]}"


@pytest.fixture
async def test_client(platform_stack: Path) -> AsyncIterator[AsyncClient]:
    """Real Postgres + real mock-OIDC JWTs, hitting the test-local app."""
    mock_transport = ASGITransport(app=mock_oidc_app)
    _test_app.dependency_overrides[get_oidc_client] = lambda: AsyncClient(
        transport=mock_transport, base_url="http://mock-oidc"
    )
    transport = ASGITransport(app=_test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    _test_app.dependency_overrides.clear()


@pytest.fixture
async def production_client(platform_stack: Path) -> AsyncIterator[AsyncClient]:
    """Real production `app` -- for AC-5's real `GET /api/projects/{iri}`."""
    mock_transport = ASGITransport(app=mock_oidc_app)
    production_app.dependency_overrides[get_oidc_client] = lambda: AsyncClient(
        transport=mock_transport, base_url="http://mock-oidc"
    )
    transport = ASGITransport(app=production_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    production_app.dependency_overrides.clear()


async def _seed_project(tenant_id: str) -> str:
    async with tenant_connection(tenant_id) as conn:
        project = await create_project(
            conn,
            NewProject(
                tenant_id=tenant_id,
                slug=f"proj-{uuid.uuid4().hex[:8]}",
                name="TASK-011 project",
                description=None,
                pinned_graph_version_iri="urn:weave:graph:v1",
            ),
        )
    return project.project_iri


async def _seed_contributor(
    *, tenant_id: str, project_iri: str, principal_iri: str, role: str
) -> None:
    async with tenant_connection(tenant_id) as conn:
        await upsert(
            conn,
            tenant_id=tenant_id,
            contributor=NewContributor(
                project_iri=project_iri,
                principal_iri=principal_iri,
                role=role,
                added_by="urn:weave:person:acme:seed",
            ),
        )


async def test_settings_mutation_denies_editor_and_allows_admin(test_client: AsyncClient) -> None:
    """AC-1/AC-2/AC-6: contributor-table role check at the real HTTP layer,
    denial writes a PLAT-AUDIT-1 `authz_denied` row.
    """
    tenant_id = _unique_tenant("settings")
    project_iri = await _seed_project(tenant_id)
    sub = "u-editor"
    principal_iri = human_principal_iri(sub)
    await _seed_contributor(
        tenant_id=tenant_id, project_iri=project_iri, principal_iri=principal_iri, role="editor"
    )
    tokens = await issue_token_pair(sub=sub, tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    denied = await test_client.put(f"/api/_test/projects/{project_iri}/settings", headers=headers)

    assert denied.status_code == 403

    async with tenant_connection(tenant_id) as conn:
        audit_row = await conn.fetchrow(
            "SELECT diff_summary FROM audit_entries"
            " WHERE tenant_id = $1 AND event_type = 'authz_denied' AND target_iri = $2",
            tenant_id,
            project_iri,
        )
    assert audit_row is not None

    await _seed_contributor(
        tenant_id=tenant_id, project_iri=project_iri, principal_iri=principal_iri, role="admin"
    )

    allowed = await test_client.put(f"/api/_test/projects/{project_iri}/settings", headers=headers)

    assert allowed.status_code == 200


async def test_tenant_admin_jwt_grant_allows_any_project_mutation(test_client: AsyncClient) -> None:
    """AC-4: a tenant admin/owner grant overlays with no contributor row at
    all. Mock OIDC has no `roles` claim support, so the principal is
    injected via `get_current_principal` override -- still a real route,
    real DB, real guard logic.
    """
    tenant_id = _unique_tenant("tenantadmin")
    project_iri = await _seed_project(tenant_id)
    admin_principal = Principal(
        sub="u-admin",
        tenant_id=tenant_id,
        principal_iri=human_principal_iri("u-admin"),
        roles=[RoleGrant(scope="tenant", role="admin")],
    )
    _test_app.dependency_overrides[get_current_principal] = lambda: admin_principal

    response = await test_client.put(f"/api/_test/projects/{project_iri}/contributors")

    del _test_app.dependency_overrides[get_current_principal]
    assert response.status_code == 200


async def test_project_read_allows_any_tenant_member_with_no_contributor_row(
    production_client: AsyncClient,
) -> None:
    """AC-5: reads carry no `require_project_role` guard -- tenant
    membership alone (via `get_current_principal`) is sufficient, proven
    against the real production route with no `project_contributors` row.
    """
    tenant_id = _unique_tenant("reader")
    project_iri = await _seed_project(tenant_id)
    tokens = await issue_token_pair(sub="u-reader", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    response = await production_client.get(f"/api/projects/{project_iri}", headers=headers)

    assert response.status_code == 200
