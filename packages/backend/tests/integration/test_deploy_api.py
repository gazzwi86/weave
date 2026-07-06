"""BE-TASK-009 integration tests (build-engine EPIC-008/EPIC-009):
`publish_and_write_back` against real Postgres (project + `generation_runs`
row + `projects` write-back columns + audit chain), with the S3 publish
step against real LocalStack (Law F -- `artefact_publisher.publish` is
exercised for real, never mocked) and CE-WRITE-1 stubbed via
`httpx.MockTransport` (Law F -- never a real network call to another
engine). Same lane conventions as `test_generation_api.py`
(`platform_stack` fixture, `tenant_connection`).

`publish_and_write_back` has no HTTP route exercised here --
`routers/deploy.py` is a thin 404/422/503/200/201 mapping layer already
covered by `tests/unit/test_deploy_router.py` -- these tests call
`publish_and_write_back` directly, the same choice `test_generation_api.py`
makes for `generate_app`.
"""

from __future__ import annotations

import shutil
import uuid

import httpx
import pytest

from weave_backend.briefs.store import (
    NewBrief,
    build_brief_iri,
    generate_task_id,
    insert_task_brief,
)
from weave_backend.db.pool import tenant_connection
from weave_backend.deploy.service import DEFAULT_DEPS, DeployContext, publish_and_write_back
from weave_backend.generation.store import NewGenerationRun, insert_generation_run
from weave_backend.projects.model import NewProject, create_project

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]

_ENTITY_IRI = "urn:weave:system:widget-svc"
_COMMIT_SHA = "sha-deploy-1"


def _unique_tenant(label: str) -> str:
    return f"{label}-{uuid.uuid4().hex[:8]}"


async def _seed(tenant_id: str) -> tuple[str, str]:
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
        task_id = generate_task_id(project.project_iri, "generate the widget list page")
        await insert_task_brief(
            conn,
            NewBrief(
                tenant_id=tenant_id,
                task_id=task_id,
                project_iri=project.project_iri,
                brief_iri=build_brief_iri(task_id),
                schema_version="1.0",
                content={"tech_spec": f"System {_ENTITY_IRI} drives it."},
            ),
        )
        await insert_generation_run(
            conn,
            tenant_id=tenant_id,
            run=NewGenerationRun(
                project_iri=project.project_iri,
                task_id=task_id,
                gate_results=[],
                branch=f"build/acme-corp/{task_id}",
                commit_sha=_COMMIT_SHA,
            ),
        )
    return project.project_iri, task_id


def _ce_write_client(handler: object) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=httpx.MockTransport(handler),  # type: ignore[arg-type]
        base_url="https://ce.test",
    )


def _committed_handler(request: httpx.Request) -> httpx.Response:
    assert request.url.path == "/api/operations/apply"
    return httpx.Response(
        201,
        json={
            "activity_iri": "urn:weave:activity:1",
            "applied_count": 1,
            "version_iri": "urn:weave:version:v2",
        },
    )


def _rejected_handler(request: httpx.Request) -> httpx.Response:
    assert request.url.path == "/api/operations/apply"
    return httpx.Response(
        422,
        json={
            "violations": [
                {
                    "focus_node": _ENTITY_IRI,
                    "path": "urn:weave:bpmo:label",
                    "severity": "Violation",
                    "message": "missing label",
                }
            ]
        },
    )


def _ctx(
    tenant_id: str, project_iri: str, task_id: str, ce_write_client: httpx.AsyncClient
) -> DeployContext:
    return DeployContext(
        tenant_id=tenant_id,
        project_iri=project_iri,
        task_id=task_id,
        commit_sha=_COMMIT_SHA,
        run_mode="spec_to_build",
        ce_write_client=ce_write_client,
    )


async def test_write_back_committed_sets_write_back_complete_and_emits_prov_o_activity(
    platform_stack: object,
) -> None:
    """AC-7: a 201 from CE-WRITE-1 marks `write_back_complete` true, records
    `write_back_artefact_iri`, and emits a PROV-O `write_back_success` event
    to `PLAT-AUDIT-1` (`audit_entries`).
    """
    tenant_id = _unique_tenant("tenant-deploy-ok")
    project_iri, task_id = await _seed(tenant_id)
    ce_write_client = _ce_write_client(_committed_handler)

    async with tenant_connection(tenant_id) as conn:
        outcome = await publish_and_write_back(
            conn, _ctx(tenant_id, project_iri, task_id, ce_write_client), DEFAULT_DEPS
        )

    assert outcome["write_back_status"] == "committed"
    assert outcome["write_back_artefact_iri"]

    async with tenant_connection(tenant_id) as conn:
        row = await conn.fetchrow(
            "SELECT write_back_complete, write_back_artefact_iri FROM projects"
            " WHERE tenant_id = $1 AND project_iri = $2",
            tenant_id,
            project_iri,
        )
        audit_row = await conn.fetchrow(
            "SELECT event_type, target_iri, engine FROM audit_entries"
            " WHERE tenant_id = $1 AND event_type = 'write_back_success'",
            tenant_id,
        )

    assert row["write_back_complete"] is True
    assert row["write_back_artefact_iri"] == outcome["write_back_artefact_iri"]
    assert audit_row is not None
    assert audit_row["target_iri"] == project_iri
    assert audit_row["engine"] == "build"


async def test_write_back_422_records_write_back_fail_shacl_audit_event(
    platform_stack: object,
) -> None:
    """AC-5: a 422 from CE-WRITE-1 records a `write_back_fail_shacl` audit
    event and does not mark the project as write-back-complete.
    """
    tenant_id = _unique_tenant("tenant-deploy-422")
    project_iri, task_id = await _seed(tenant_id)
    ce_write_client = _ce_write_client(_rejected_handler)

    async with tenant_connection(tenant_id) as conn:
        outcome = await publish_and_write_back(
            conn, _ctx(tenant_id, project_iri, task_id, ce_write_client), DEFAULT_DEPS
        )

    assert outcome["write_back_status"] == "rejected"

    async with tenant_connection(tenant_id) as conn:
        row = await conn.fetchrow(
            "SELECT write_back_complete FROM projects WHERE tenant_id = $1 AND project_iri = $2",
            tenant_id,
            project_iri,
        )
        audit_row = await conn.fetchrow(
            "SELECT event_type FROM audit_entries"
            " WHERE tenant_id = $1 AND event_type = 'write_back_fail_shacl'",
            tenant_id,
        )

    assert row["write_back_complete"] is False
    assert audit_row is not None


async def test_publish_persists_demo_output_location_ref_to_aurora(platform_stack: object) -> None:
    """Persistence: a real S3 publish (LocalStack) records
    `demo_output_location_ref` on the `projects` row.
    """
    tenant_id = _unique_tenant("tenant-deploy-publish")
    project_iri, task_id = await _seed(tenant_id)
    ce_write_client = _ce_write_client(_committed_handler)

    async with tenant_connection(tenant_id) as conn:
        outcome = await publish_and_write_back(
            conn, _ctx(tenant_id, project_iri, task_id, ce_write_client), DEFAULT_DEPS
        )

    output_location_ref = outcome["output_location_ref"]
    assert isinstance(output_location_ref, str)
    assert output_location_ref.startswith("s3://weave-artefacts/")

    async with tenant_connection(tenant_id) as conn:
        row = await conn.fetchrow(
            "SELECT demo_output_location_ref FROM projects "
            "WHERE tenant_id = $1 AND project_iri = $2",
            tenant_id,
            project_iri,
        )

    assert row["demo_output_location_ref"] == outcome["output_location_ref"]
