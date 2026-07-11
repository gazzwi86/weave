"""BE-V1-TASK-019 integration tests: `GET
/api/projects/{project_iri}/dashboard/{tile}` against real docker-marked
Postgres -- same lane conventions as `test_costs_api.py`/`test_deploy_api.py`
(`platform_stack` fixture, `tenant_connection`). Per-handler payload logic
is proven fake-connection-fast in `tests/unit/test_dashboard_router.py`;
these prove real SQL wiring end-to-end for AC-3 (demo tile) and the
unknown-tile 400 (AC-1 API contract).
"""

from __future__ import annotations

import shutil
import uuid

import pytest
from weave_backend.build.dashboard import UnknownTile, get_tile_payload

from weave_backend.db.pool import tenant_connection
from weave_backend.generation.store import NewGenerationRun, insert_generation_run
from weave_backend.projects.model import NewProject, create_project, update_project_publish

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]


def _unique_tenant(label: str) -> str:
    return f"{label}-{uuid.uuid4().hex[:8]}"


async def test_demo_tile_retains_prior_url_and_surfaces_failure_after_failed_deploy(
    platform_stack: object,
) -> None:
    """AC-3: seed a successful deploy (prior URL persisted), then a second,
    failed `generation_runs` row -- the demo tile must keep the prior URL
    and surface the failure, never a false green.
    """
    tenant_id = _unique_tenant("tenant-dash-demo")
    async with tenant_connection(tenant_id) as conn:
        project = await create_project(
            conn,
            NewProject(
                tenant_id=tenant_id,
                slug="acme-corp",
                name="Acme Corp",
                description=None,
                pinned_graph_version_iri="urn:weave:version:v1",
            ),
        )
        await update_project_publish(
            conn,
            tenant_id=tenant_id,
            project_iri=project.project_iri,
            demo_output_location_ref="s3://weave-artefacts/t1/run-1/",
        )
        await insert_generation_run(
            conn,
            tenant_id=tenant_id,
            run=NewGenerationRun(
                project_iri=project.project_iri,
                task_id="task-1",
                gate_results=[],
                branch="build/acme-corp/task-1",
                commit_sha="sha-ok",
            ),
        )
        # `insert_generation_run` always writes `status='passed'` (no code
        # path produces `'failed'` today) -- seed the failed row directly,
        # same as the CHECK constraint the migration allows.
        # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
        await conn.execute(
            "INSERT INTO generation_runs"
            " (tenant_id, project_iri, task_id, status, gate_results, branch, commit_sha)"
            " VALUES ($1, $2, $3, 'failed', '[]'::jsonb, $4, $5)",
            tenant_id,
            project.project_iri,
            "task-2",
            "build/acme-corp/task-2",
            "sha-fail",
        )

        payload = await get_tile_payload(
            conn, tenant_id=tenant_id, project_iri=project.project_iri, tile="demo"
        )

    assert payload.output_location_ref == "s3://weave-artefacts/t1/run-1/"
    assert payload.last_run_status == "failed"


async def test_get_dashboard_tile_raises_unknown_tile_for_bad_segment(
    platform_stack: object,
) -> None:
    """AC-1 API contract: an unrecognised `tile` path segment is a 400, not
    a 404/422 -- `routers/dashboard.py` maps this exception to 400.
    """
    tenant_id = _unique_tenant("tenant-dash-400")
    async with tenant_connection(tenant_id) as conn:
        project = await create_project(
            conn,
            NewProject(
                tenant_id=tenant_id,
                slug="acme-corp",
                name="Acme Corp",
                description=None,
                pinned_graph_version_iri="urn:weave:version:v1",
            ),
        )
        with pytest.raises(UnknownTile):
            await get_tile_payload(
                conn, tenant_id=tenant_id, project_iri=project.project_iri, tile="bogus"
            )
