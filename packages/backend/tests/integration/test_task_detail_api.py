"""BE-V1-TASK-018 (build-engine EPIC-005) integration tests: `GET
/api/projects/{id}/tasks/{task_id}` and its `/audit` proxy against the real
docker-marked stack (postgres + LocalStack S3 + in-process mock-oidc).
Same lane conventions as `test_decisions_api.py`/`test_deploy_api.py`.

Covers: task-detail payload assembly (brief + handoff), Console tab
S3-vs-live sourcing, Audit tab 503 `audit_unavailable`, and the captures
manifest round-trip through LocalStack (AC-2/AC-3/AC-4/AC-5).
"""

from __future__ import annotations

import json
import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.audit.decisions import AuditUnavailable
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.briefs.store import NewBrief, build_brief_iri, insert_task_brief
from weave_backend.build.dep_summary import DepSummary, write_dep_summary
from weave_backend.build.task_detail import read_captures_manifest, read_console_log
from weave_backend.db.pool import tenant_connection
from weave_backend.generation.store import NewGenerationRun, insert_generation_run
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.projects.ce_version_client import get_ce_client
from weave_backend.storage.tenant_objects import put_object, s3_client

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]

_ARTEFACT_BUCKET = "weave-artefacts"
_SINGLE_LATEST_VERSION: list[dict[str, object]] = [
    {
        "version_iri": "urn:weave:version:v1",
        "semver": "1.0.0",
        "published_at": "2026-01-01T00:00:00Z",
        "is_latest": True,
    }
]


def _unique_tenant(label: str) -> str:
    return f"{label}-{uuid.uuid4().hex[:8]}"


def _ensure_bucket() -> object:
    client = s3_client()
    existing = {b["Name"] for b in client.list_buckets().get("Buckets", [])}
    if _ARTEFACT_BUCKET not in existing:
        client.create_bucket(Bucket=_ARTEFACT_BUCKET)
    return client


def _ce_stub(versions: list[dict[str, object]]) -> AsyncClient:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"versions": versions})

    return AsyncClient(transport=httpx.MockTransport(handler), base_url="http://ce")


@pytest.fixture
async def client(platform_stack: Path) -> AsyncIterator[AsyncClient]:
    mock_transport = ASGITransport(app=mock_oidc_app)
    app.dependency_overrides[get_oidc_client] = lambda: AsyncClient(
        transport=mock_transport, base_url="http://mock-oidc"
    )
    app.dependency_overrides[get_ce_client] = lambda: _ce_stub(_SINGLE_LATEST_VERSION)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


async def _create_project(client: AsyncClient, headers: dict[str, str]) -> str:
    response = await client.post("/api/projects", json={"name": "Acme Corp"}, headers=headers)
    assert response.status_code == 201, response.text
    return str(response.json()["project_iri"])


async def _seed_brief_and_handoff(
    tenant_id: str, project_iri: str, task_id: str, predecessor_id: str
) -> None:
    async with tenant_connection(tenant_id) as conn:
        await insert_task_brief(
            conn,
            NewBrief(
                tenant_id=tenant_id,
                task_id=task_id,
                project_iri=project_iri,
                brief_iri=build_brief_iri(task_id),
                schema_version="1.0",
                content={"title": "Do thing", "dep_chain": {"blocked_by": [predecessor_id]}},
            ),
        )
        await write_dep_summary(
            conn,
            tenant_id=tenant_id,
            project_iri=project_iri,
            summary=DepSummary(
                task_id=predecessor_id,
                decisions=["used pattern X"],
                edge_cases=["empty input"],
                outputs=["module Y"],
            ),
        )


async def _seed_run(tenant_id: str, project_iri: str, task_id: str, *, status: str) -> str:
    """AC-4: seeds a `generation_runs` row so the route's `_run_facts`
    resolves the finished-run S3 pointer/live-channel split for real.
    """
    async with tenant_connection(tenant_id) as conn:
        await insert_generation_run(
            conn,
            tenant_id=tenant_id,
            run=NewGenerationRun(
                project_iri=project_iri,
                task_id=task_id,
                gate_results=[],
                branch="feature/x",
                commit_sha="sha-1",
            ),
        )
        row = await conn.fetchrow(
            "SELECT run_id FROM generation_runs"
            " WHERE tenant_id = $1 AND project_iri = $2 AND task_id = $3",
            tenant_id,
            project_iri,
            task_id,
        )
        run_id = str(row["run_id"])
        if status != "passed":
            await conn.execute(
                "UPDATE generation_runs SET status = $1 WHERE tenant_id = $2 AND run_id = $3",
                status,
                tenant_id,
                run_id,
            )
    return run_id


async def test_should_return_task_detail_payload_with_brief_and_handoff(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-2."""
    tenant_id = _unique_tenant("tenant-taskdet")
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}
    project_iri = await _create_project(client, headers)
    task_id = "task-1"
    await _seed_brief_and_handoff(tenant_id, project_iri, task_id, "task-0")

    response = await client.get(
        f"/api/projects/{project_iri}/tasks/{task_id}", headers=headers
    )

    assert response.status_code == 200
    body = response.json()
    assert body["brief"]["title"] == "Do thing"
    assert len(body["handoff"]) == 1
    assert body["handoff"][0]["task_id"] == "task-0"
    assert body["handoff"][0]["decisions"] == ["used pattern X"]


async def test_should_source_console_from_live_channel_for_a_running_task(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-4: an in-progress run's Console tab points at the live SSE
    channel, not an S3 pointer (finished-vs-live split, through the real
    route + real `generation_runs` row).
    """
    tenant_id = _unique_tenant("tenant-taskdet-live")
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}
    project_iri = await _create_project(client, headers)
    task_id = "task-live"
    run_id = await _seed_run(tenant_id, project_iri, task_id, status="running")

    response = await client.get(
        f"/api/projects/{project_iri}/tasks/{task_id}", headers=headers
    )

    assert response.status_code == 200
    console = response.json()["console"]
    assert console["live_channel"] == f"/api/requests/{run_id}/stream"
    assert console["log_location_ref"] is None


async def test_should_read_finished_run_console_log_from_s3(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-4: a finished run's Console tab reads its S3-persisted log,
    proving the `RunLogSink`-written key round-trips through the real
    `read_console_log` reader against LocalStack (not a fake client).
    """
    tenant_id = _unique_tenant("tenant-taskdet-console")
    s3 = _ensure_bucket()
    run_id = "run-console-1"
    key = f"tenant/{tenant_id}/runs/{run_id}/run.ndjson"
    put_object(s3, _ARTEFACT_BUCKET, key, b'{"event": "started"}\n{"event": "done"}\n')

    log = await read_console_log(
        s3, bucket=_ARTEFACT_BUCKET, log_location_ref=f"s3://{_ARTEFACT_BUCKET}/{key}"
    )

    assert log is not None
    assert '"event": "started"' in log


async def test_should_return_403_or_404_for_a_different_tenants_task(
    client: AsyncClient, platform_stack: Path
) -> None:
    """RLS/tenant isolation: another tenant's task is not visible."""
    tenant_a = _unique_tenant("tenant-taskdet-a")
    tenant_b = _unique_tenant("tenant-taskdet-b")
    tokens_a = await issue_token_pair(sub="u-a", tenant_id=tenant_a)
    headers_a = {"Authorization": f"Bearer {tokens_a.access_token}"}
    project_iri = await _create_project(client, headers_a)
    task_id = "task-shared-id"
    await _seed_brief_and_handoff(tenant_a, project_iri, task_id, "task-0")

    tokens_b = await issue_token_pair(sub="u-b", tenant_id=tenant_b)
    headers_b = {"Authorization": f"Bearer {tokens_b.access_token}"}
    response = await client.get(
        f"/api/projects/{project_iri}/tasks/{task_id}", headers=headers_b
    )

    assert response.status_code == 200
    body = response.json()
    assert body["brief"] is None


async def test_should_show_audit_unavailable_when_plat_audit_1_unreachable(
    client: AsyncClient, platform_stack: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """AC-5."""
    tenant_id = _unique_tenant("tenant-taskdet-audit")
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}
    project_iri = await _create_project(client, headers)

    async def _raise_unavailable(*_args: object, **_kwargs: object) -> None:
        raise AuditUnavailable

    monkeypatch.setattr(
        "weave_backend.routers.task_detail.list_decisions", _raise_unavailable
    )

    response = await client.get(
        f"/api/projects/{project_iri}/tasks/task-1/audit", headers=headers
    )

    assert response.status_code == 503
    assert response.json()["detail"] == {"error": "audit_unavailable"}


async def test_should_read_captures_manifest_written_during_assess(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-3/AC-7: the Tests tab's captures manifest round-trips through
    real LocalStack S3, proving `build.captures.capture_visual_states`'
    manifest shape is readable by `read_captures_manifest`.
    """
    tenant_id = _unique_tenant("tenant-taskdet-cap")
    s3 = _ensure_bucket()
    run_id = "run-cap-1"
    key = f"tenant/{tenant_id}/runs/{run_id}/captures/manifest.json"
    manifest = {
        "default": f"tenant/{tenant_id}/runs/{run_id}/captures/default.png",
        "hover": f"tenant/{tenant_id}/runs/{run_id}/captures/hover.png",
        "loading": {"absent": True, "reason": "state not exhibited"},
    }
    put_object(s3, _ARTEFACT_BUCKET, key, json.dumps(manifest).encode())

    read_back = read_captures_manifest(
        s3, bucket=_ARTEFACT_BUCKET, captures_manifest_ref=f"s3://{_ARTEFACT_BUCKET}/{key}"
    )

    assert read_back is not None
    assert read_back["default"].endswith("default.png")
    assert read_back["loading"] == {"absent": True, "reason": "state not exhibited"}


async def test_should_return_none_when_captures_manifest_missing(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-3: honest absence -- a task never ASSESSed has no manifest key,
    reader returns `None` rather than raising, caller renders "captures not
    available" (never a broken image).
    """
    s3 = _ensure_bucket()

    read_back = read_captures_manifest(
        s3,
        bucket=_ARTEFACT_BUCKET,
        captures_manifest_ref=f"s3://{_ARTEFACT_BUCKET}/tenant/nope/runs/none/captures/manifest.json",
    )

    assert read_back is None
