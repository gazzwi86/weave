"""BE-V1-TASK-021 (FR-065) integration tests: `POST /api/projects/{id}/prompts`
against real Postgres + real JWTs (mock OIDC), same lane conventions as
`test_project_role_guard.py` / `test_runs_api.py`.

AC-3/AC-4/AC-5 (PR opened, status chip, identical caps/gates) are not
re-proven here -- Design Decisions table (task brief) is explicit that a
prompt run rides `run_dark_factory` verbatim with zero new run machinery,
so those are already covered by TASK-012/TASK-013's suites against that
same function. This file covers the two behaviours the router itself adds:
persist + enqueue with `trigger='prompt'` (AC-1) and the reader 403 + audit
(AC-2).
"""

from __future__ import annotations

import shutil
import uuid
from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.db.pool import tenant_connection
from weave_backend.identity.registry import human_principal_iri
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.pm.contributors import NewContributor, upsert
from weave_backend.projects.model import NewProject, create_project
from weave_backend.repo_bootstrap.drivers import RepoHandle
from weave_backend.repo_bootstrap.store import set_project_repo

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]


def _unique_tenant(label: str) -> str:
    return f"tenant-{label}-{uuid.uuid4().hex[:8]}"


async def _seed_project_with_repo(tenant_id: str, slug: str) -> str:
    """Same idempotent-short-circuit trick as `test_runs_api.py` -- a
    pre-set repo handle means the background dispatch never needs a real
    SCM/network call just to prove `trigger='prompt'` landed.
    """
    async with tenant_connection(tenant_id) as conn:
        project = await create_project(
            conn,
            NewProject(
                tenant_id=tenant_id,
                slug=slug,
                name="Acme",
                description=None,
                pinned_graph_version_iri="urn:weave:version:v1",
                source_control_provider="github",
                source_control_token_secret_ref="weave/scm-token",
            ),
        )
        await set_project_repo(
            conn,
            tenant_id=tenant_id,
            project_iri=project.project_iri,
            provider="github",
            repo=RepoHandle(
                repo_id="acme/repo", url="https://scm/acme/repo", default_branch="main"
            ),
        )
        return project.project_iri


async def _seed_editor(tenant_id: str, project_iri: str, sub: str) -> str:
    principal_iri = human_principal_iri(sub)
    async with tenant_connection(tenant_id) as conn:
        await upsert(
            conn,
            tenant_id=tenant_id,
            contributor=NewContributor(
                project_iri=project_iri,
                principal_iri=principal_iri,
                role="editor",
                added_by=principal_iri,
            ),
        )
    return principal_iri


@pytest.fixture
async def test_client() -> AsyncIterator[AsyncClient]:
    mock_transport = ASGITransport(app=mock_oidc_app)
    app.dependency_overrides[get_oidc_client] = lambda: AsyncClient(
        transport=mock_transport, base_url="http://mock-oidc"
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


async def test_editor_submit_persists_prompt_and_enqueues_trigger_prompt_run(
    test_client: AsyncClient,
) -> None:
    """AC-1: editor's prompt persists a `project_prompts` row linked to a
    run, and the enqueued run's `state_spines` row carries `trigger='prompt'`
    -- proof there is no second orchestrator entry point (DoD verify-by)."""
    tenant_id = _unique_tenant("prompt-ac1")
    project_iri = await _seed_project_with_repo(tenant_id, "acme")
    await _seed_editor(tenant_id, project_iri, "u-editor")
    tokens = await issue_token_pair(sub="u-editor", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    response = await test_client.post(
        f"/api/projects/{project_iri}/prompts",
        headers=headers,
        json={"prompt_text": "fix this inaccuracy"},
    )

    assert response.status_code == 202
    body = response.json()
    assert body["run_id"] and body["prompt_id"]

    async with tenant_connection(tenant_id) as conn:
        prompt_row = await conn.fetchrow(
            "SELECT run_id FROM project_prompts WHERE prompt_id = $1", body["prompt_id"]
        )
        assert prompt_row is not None
        assert str(prompt_row["run_id"]) == body["run_id"]

        spine_row = await conn.fetchrow(
            "SELECT trigger FROM state_spines WHERE run_id = $1", body["run_id"]
        )
        assert spine_row is not None
        assert spine_row["trigger"] == "prompt"


async def test_reader_submit_is_refused_and_audited(test_client: AsyncClient) -> None:
    """AC-2: a reader (no contributor row, no tenant-admin overlay) gets a
    403 and an `authz_denied` audit row -- no run is enqueued."""
    tenant_id = _unique_tenant("prompt-ac2")
    project_iri = await _seed_project_with_repo(tenant_id, "acme")
    tokens = await issue_token_pair(sub="u-reader", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    response = await test_client.post(
        f"/api/projects/{project_iri}/prompts",
        headers=headers,
        json={"prompt_text": "fix this inaccuracy"},
    )

    assert response.status_code == 403
    assert response.json() == {"detail": {"error": "forbidden", "action": "prompt"}}

    async with tenant_connection(tenant_id) as conn:
        audit_row = await conn.fetchrow(
            "SELECT diff_summary FROM audit_entries"
            " WHERE tenant_id = $1 AND event_type = 'authz_denied' AND target_iri = $2",
            tenant_id,
            project_iri,
        )
        assert audit_row is not None

        prompt_count = await conn.fetchval(
            "SELECT count(*) FROM project_prompts WHERE project_iri = $1", project_iri
        )
        assert prompt_count == 0
