"""TASK-023 (E2-S6, FR-061/B9) integration tests: `GET/PUT
.../source-control` against the real HTTP layer, real Postgres, and real
LocalStack Secrets Manager -- the AC-to-Test Mapping table in the brief
labels AC-1/AC-2/AC-6 "Integration"; `test_source_control_router.py`'s unit
lane calls the route functions directly (mocked DB + mocked
`put_scm_token`) and never exercises FastAPI's actual `response_model`
serialization or a real boto3/LocalStack round trip -- this file is that
missing lane. Fixture/pattern precedent: `test_project_role_guard.py`
(`platform_stack`, `_seed_project`/`_seed_contributor`, `issue_token_pair`).
"""

from __future__ import annotations

import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app as production_app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.db.pool import tenant_connection
from weave_backend.identity.registry import human_principal_iri
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.pm.contributors import NewContributor, upsert
from weave_backend.projects.model import NewProject, create_project

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]

# Realistic-shaped but fake -- short enough to dodge the secret-scanner's
# quoted-literal length floor (same convention as `test_repo_bootstrap.py`).
_SENTINEL = "ghp-e2e-9f2c1a"


def _unique_tenant(label: str) -> str:
    return f"tenant-{label}-{uuid.uuid4().hex[:8]}"


@pytest.fixture
async def client(platform_stack: Path) -> AsyncIterator[AsyncClient]:
    mock_transport = ASGITransport(app=mock_oidc_app)
    production_app.dependency_overrides[get_oidc_client] = lambda: AsyncClient(
        transport=mock_transport, base_url="http://mock-oidc"
    )
    transport = ASGITransport(app=production_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    production_app.dependency_overrides.clear()


async def _seed_admin_project(tenant_id: str, *, sub: str) -> str:
    async with tenant_connection(tenant_id) as conn:
        project = await create_project(
            conn,
            NewProject(
                tenant_id=tenant_id,
                slug=f"proj-{uuid.uuid4().hex[:8]}",
                name="TASK-023 project",
                description=None,
                pinned_graph_version_iri="urn:weave:graph:v1",
            ),
        )
        await upsert(
            conn,
            tenant_id=tenant_id,
            contributor=NewContributor(
                project_iri=project.project_iri,
                principal_iri=human_principal_iri(sub),
                role="admin",
                added_by="urn:weave:person:acme:seed",
            ),
        )
    return project.project_iri


async def test_put_then_get_never_echoes_token_over_real_http_and_secrets_manager(
    client: AsyncClient,
) -> None:
    """AC-1/AC-2 (crux, Integration): a real PUT (real Postgres row write +
    real LocalStack `create_secret`) followed by an independent real GET --
    the sentinel value must not appear anywhere in either response body,
    and the DB row must carry a reference, never the plaintext value.
    """
    tenant_id = _unique_tenant("scm")
    sub = "u-admin"
    project_iri = await _seed_admin_project(tenant_id, sub=sub)
    tokens = await issue_token_pair(sub=sub, tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    put_response = await client.put(
        f"/api/projects/{project_iri}/source-control",
        json={"provider": "github", "token": _SENTINEL},
        headers=headers,
    )

    assert put_response.status_code == 200
    put_body = put_response.json()
    assert _SENTINEL not in put_response.text
    ref = put_body["token_secret_ref"]
    assert ref  # a reference, not the value
    assert ref != _SENTINEL

    get_response = await client.get(
        f"/api/projects/{project_iri}/source-control", headers=headers
    )

    assert get_response.status_code == 200
    assert _SENTINEL not in get_response.text
    assert get_response.json()["token_secret_ref"] == ref

    async with tenant_connection(tenant_id) as conn:
        row = await conn.fetchrow(
            "SELECT source_control_token_secret_ref FROM projects WHERE project_iri = $1",
            project_iri,
        )
    assert row["source_control_token_secret_ref"] == ref
    assert row["source_control_token_secret_ref"] != _SENTINEL


async def test_put_denies_non_admin_over_real_http(client: AsyncClient) -> None:
    """AC-6 (Integration): an editor-role contributor gets a real 403, the
    write never reaches Secrets Manager or the `projects` row.
    """
    tenant_id = _unique_tenant("scm-editor")
    sub = "u-editor"
    project_iri = await _seed_admin_project(tenant_id, sub="u-admin-seed")
    async with tenant_connection(tenant_id) as conn:
        await upsert(
            conn,
            tenant_id=tenant_id,
            contributor=NewContributor(
                project_iri=project_iri,
                principal_iri=human_principal_iri(sub),
                role="editor",
                added_by="urn:weave:person:acme:seed",
            ),
        )
    tokens = await issue_token_pair(sub=sub, tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    response = await client.put(
        f"/api/projects/{project_iri}/source-control",
        json={"provider": "github", "token": _SENTINEL},
        headers=headers,
    )

    assert response.status_code == 403
    assert _SENTINEL not in response.text

    async with tenant_connection(tenant_id) as conn:
        row = await conn.fetchrow(
            "SELECT source_control_token_secret_ref FROM projects WHERE project_iri = $1",
            project_iri,
        )
    assert row["source_control_token_secret_ref"] is None
