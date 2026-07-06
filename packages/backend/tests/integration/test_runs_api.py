"""BE-TASK-006 integration tests (build-engine EPIC-011): the dark-factory
run's persisted state against real Postgres (RLS isolation, blocking
commit round-trip) and the run-lifecycle HTTP routes, against the real
docker-marked stack (same lane conventions as `test_projects_api.py`).

Repo bootstrap's provider/token/network calls are never exercised here --
the seeded project row already carries a full repo handle, so
`ensure_project_repo` takes its idempotent short-circuit (Law F: no real
GitHub/LocalStack call needed for these tests).
"""

from __future__ import annotations

import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.build.dep_summary import DepSummary, write_dep_summary
from weave_backend.build.orchestrator import run_dark_factory
from weave_backend.build.state_spine import (
    StateSpine,
    TaskState,
    commit_state_spine,
    load_state_spine,
    start_or_resume_run,
)
from weave_backend.db.pool import tenant_connection
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.projects.model import NewProject, create_project
from weave_backend.repo_bootstrap.drivers import RepoHandle
from weave_backend.repo_bootstrap.store import set_project_repo

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]


def _unique_tenant(label: str) -> str:
    return f"{label}-{uuid.uuid4().hex[:8]}"


async def _seed_project_with_repo(tenant_id: str, slug: str) -> str:
    """A project row with its repo handle already set -- `ensure_project_repo`
    (TASK-010) takes the idempotent short-circuit path for it, so
    `run_dark_factory` never needs a real SCM token or GitHub call here.
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


@pytest.fixture
async def client(platform_stack: Path) -> AsyncIterator[AsyncClient]:
    mock_transport = ASGITransport(app=mock_oidc_app)
    app.dependency_overrides[get_oidc_client] = lambda: AsyncClient(
        transport=mock_transport, base_url="http://mock-oidc"
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


async def test_one_pdac_cycle_commits_state_spine_dispatch_count_1(platform_stack: Path) -> None:
    """AC-1/AC-4/AC-8: a real Postgres round-trip -- one queued task
    dispatched and committed, readable back with `dispatch_count == 1` and
    its dep summary persisted before Done. Task-backlog seeding has no API
    surface within this task's 8 ACs (loop mechanics only, not task
    discovery), so the spine is built and run directly rather than via
    `POST /runs`, which always starts from an empty backlog.
    """
    tenant_id = _unique_tenant("tenant-run")
    project_iri = await _seed_project_with_repo(tenant_id, "acme")

    async with tenant_connection(tenant_id) as conn:
        spine = await start_or_resume_run(
            conn,
            tenant_id=tenant_id,
            project_iri=project_iri,
            run_id=str(uuid.uuid4()),
            turn_cap=60,
        )
        spine.tasks.append(TaskState(id="t-1", status="Queued"))
        await run_dark_factory(conn, spine, tenant_id=tenant_id)

    async with tenant_connection(tenant_id) as conn:
        reloaded = await load_state_spine(conn, tenant_id=tenant_id, project_iri=project_iri)

    assert reloaded is not None
    assert reloaded.dispatch_count == 1
    assert reloaded.phase == "complete"
    assert reloaded.tasks[0].status == "Done"
    assert reloaded.tasks[0].codify_checkpoint is not None


async def test_run_already_active_returns_409(client: AsyncClient, platform_stack: Path) -> None:
    """AC-3/409: a run left `phase == "running"` (e.g. a crash mid-flight)
    refuses a new `POST /runs` for the same project.
    """
    tenant_id = _unique_tenant("tenant-run")
    project_iri = await _seed_project_with_repo(tenant_id, "acme")
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    async with tenant_connection(tenant_id) as conn:
        in_flight = StateSpine(
            project_iri=project_iri,
            tenant_id=tenant_id,
            run_id="run-in-flight",
            phase="running",
            dispatch_count=3,
            turn_cap=60,
            tasks=[TaskState(id="t-1", status="Queued")],
        )
        await commit_state_spine(conn, in_flight)

    response = await client.post(
        f"/api/projects/{project_iri}/runs", json={"run_mode": "spike"}, headers=headers
    )

    assert response.status_code == 409
    assert response.json()["detail"] == {"error": "run_already_active", "run_id": "run-in-flight"}


async def test_state_spine_rls_tenant_b_sees_no_tenant_a_rows(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-7: tenant B gets zero rows for tenant A's project, both at the raw
    SQL level (RLS itself) and via `GET /api/state/{project_iri}` (404).
    """
    tenant_a = _unique_tenant("tenant-run-a")
    tenant_b = _unique_tenant("tenant-run-b")
    project_iri = await _seed_project_with_repo(tenant_a, "acme")

    async with tenant_connection(tenant_a) as conn:
        spine = StateSpine(
            project_iri=project_iri,
            tenant_id=tenant_a,
            run_id="run-a",
            phase="complete",
            dispatch_count=1,
            turn_cap=60,
            tasks=[TaskState(id="t-1", status="Done")],
        )
        await commit_state_spine(conn, spine)

    async with tenant_connection(tenant_b) as conn:
        rows = await conn.fetch("SELECT project_iri FROM state_spines")
    assert rows == []

    tokens_b = await issue_token_pair(sub="u-b", tenant_id=tenant_b)
    response = await client.get(
        f"/api/state/{project_iri}", headers={"Authorization": f"Bearer {tokens_b.access_token}"}
    )
    assert response.status_code == 404


async def test_dep_summaries_rls_tenant_b_sees_no_tenant_a_rows(platform_stack: Path) -> None:
    """AC-4/AC-7 edge case (QA-added): `dep_summaries` carries its own RLS
    policy, separate from `state_spines` -- proven independently rather than
    assumed from the state-spine RLS test passing, since a policy typo/miss
    on this table wouldn't be caught by that test at all.
    """
    tenant_a = _unique_tenant("tenant-dep-a")
    tenant_b = _unique_tenant("tenant-dep-b")
    project_iri = await _seed_project_with_repo(tenant_a, "acme")

    async with tenant_connection(tenant_a) as conn:
        await write_dep_summary(
            conn,
            tenant_id=tenant_a,
            project_iri=project_iri,
            summary=DepSummary(task_id="t-1", decisions=["chose X"]),
        )

    async with tenant_connection(tenant_b) as conn:
        rows = await conn.fetch("SELECT task_id FROM dep_summaries")
    assert rows == []
