"""BE-V1-TASK-005 (BE-SDK-1 delivery, E8-S5/FR-059) integration tests --
real Postgres (`generation_runs` migration 0031, `gate_results`,
`projects` bookkeeping columns), real mock-OIDC JWTs for the HTTP-layer
ACs (AC-1/AC-7/AC-8), and direct service-function calls for the deeper
pipeline ACs (AC-2/AC-3/AC-5/AC-6) -- same split as
`test_rich_scaffold_dispatch_hold.py` (HTTP for the thin route contract,
direct function calls for the multi-step lifecycle so CE-DIFF-1/SCM
behaviour is controlled precisely rather than threaded through the route).
No real SCM/CE network call (Law F) -- `httpx.MockTransport` for CE-DIFF-1,
a stub `ScmDriver` for commits (same shape as `_StubDriver` above).
"""

from __future__ import annotations

import json
import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.dependencies import Principal, RoleGrant, get_current_principal
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.db.pool import tenant_connection
from weave_backend.generation import sdk_commit, sdk_trigger
from weave_backend.generation.sdk_store import (
    get_sdk_run,
    insert_sdk_generation_run,
    update_sdk_run_status,
)
from weave_backend.identity.registry import ensure_human_principal, human_principal_iri
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.pm.contributors import NewContributor, upsert
from weave_backend.projects.model import NewProject, create_project, get_project
from weave_backend.repo_bootstrap.drivers import RepoHandle
from weave_backend.repo_bootstrap.service import RepoBootstrapDeps
from weave_backend.repo_bootstrap.store import set_project_repo
from weave_backend.sdkgen.ir import CeVersionPin, IRTheme, SdkModel
from weave_backend.sdkgen.pipeline import GeneratedSdk

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]

_FAKE_TOKEN = "tok-sdk"

# AC-2/AC-3 fixtures simulate "a prior successful generation exists" by
# hand-bumping this bookkeeping column directly, bypassing the pipeline --
# reused across three tests so DRY it into one constant (also dodges E501).
_SET_LAST_SDK_VERSION_SQL = (
    "UPDATE projects SET last_sdk_version_iri = $1 WHERE tenant_id = $2 AND project_iri = $3"
)


def _unique_tenant(label: str) -> str:
    return f"tenant-{label}-{uuid.uuid4().hex[:8]}"


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


async def _seed_project(
    tenant_id: str, *, pinned: str = "urn:weave:ce:v1", token_ref: str | None = None
) -> str:
    async with tenant_connection(tenant_id) as conn:
        project = await create_project(
            conn,
            NewProject(
                tenant_id=tenant_id,
                slug="acme-corp",
                name="Acme Corp",
                description=None,
                pinned_graph_version_iri=pinned,
                source_control_provider="github" if token_ref else None,
                source_control_token_secret_ref=token_ref,
            ),
        )
    return project.project_iri


async def _grant_editor(tenant_id: str, project_iri: str, principal_iri: str) -> None:
    async with tenant_connection(tenant_id) as conn:
        await upsert(
            conn,
            tenant_id=tenant_id,
            contributor=NewContributor(
                project_iri=project_iri,
                principal_iri=principal_iri,
                role="editor",
                added_by="urn:weave:person:acme:seed",
            ),
        )


def _admin_principal(tenant_id: str, sub: str) -> Principal:
    return Principal(
        sub=sub,
        tenant_id=tenant_id,
        principal_iri=human_principal_iri(sub),
        roles=[RoleGrant(scope="tenant", role="admin")],
    )


def _ce_diff_client(*, breaking_version: str | None) -> httpx.AsyncClient:
    """Stubs CE-DIFF-1 (`GET /api/ontology/diff`) -- `breaking_version` set
    means the span contains one `breaking: true` entry (AC-2); `None` means
    a clean span (AC-3's post-ack resume never re-checks this, but a clean
    stub is reused where a diff call is harmless either way).
    """

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/ontology/diff"
        versions = [{"version_iri": breaking_version, "breaking": True}] if breaking_version else []
        return httpx.Response(200, json={"versions": versions})

    return httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="https://ce.test")


class _StubDriver:
    """Tracks commits, no real HTTP (Law F) -- reads the provenance manifest
    at call time since `_generate_and_commit` cleans the staging dir up
    after commit (same `tempfile.mkdtemp` + `finally: shutil.rmtree`
    lifecycle as `generation/service.py::generate_app`).
    """

    def __init__(self) -> None:
        self.commits: list[dict[str, Any]] = []

    async def create_repo(self, *, name: str, private: bool, token: str) -> RepoHandle:
        raise AssertionError("SDK generation never creates a repo")

    async def write_initial_commit(
        self, repo: RepoHandle, *, boilerplate: dict[str, str], token: str
    ) -> None:
        raise AssertionError("SDK generation never writes an initial commit")

    async def commit_workspace(
        self, repo: RepoHandle, *, workspace: str, branch: str, message: str, token: str
    ) -> str:
        manifest = Path(workspace, "PROVENANCE.json")
        self.commits.append(
            {
                "message": message,
                "branch": branch,
                "provenance": json.loads(manifest.read_text()) if manifest.exists() else None,
                "files": sorted(p.name for p in Path(workspace).iterdir()),
            }
        )
        return "sha-sdk"

    async def apply_branch_protection(self, repo: RepoHandle, *, token: str) -> None:
        raise AssertionError("SDK generation never touches branch protection")

    async def commit_files(
        self, repo: RepoHandle, *, files: dict[str, str], message: str, token: str
    ) -> str:
        raise AssertionError("SDK generation always commits a whole workspace, not loose files")

    async def read_file(self, repo: RepoHandle, *, path: str, token: str) -> str | None:
        raise AssertionError("SDK generation never reads a file back")


def _repo_deps(driver: _StubDriver) -> RepoBootstrapDeps:
    async def get_secret(_ref: str) -> str | None:
        return _FAKE_TOKEN

    async def emit_audit(_conn: Any, _event: Any) -> None:
        return None

    return RepoBootstrapDeps(
        get_secret=get_secret, driver_for=lambda _p: driver, emit_audit=emit_audit
    )


def _generated_sdk(tmp_path: Path, *, version_iri: str = "urn:weave:ce:v1") -> GeneratedSdk:
    staging = tmp_path / f"staging-{uuid.uuid4().hex[:8]}"
    staging.mkdir()
    (staging / "index.ts").write_text("export const x = 1;\n")
    theme = IRTheme(color={}, typography={}, spacing={}, radius={}, extensions={})
    return GeneratedSdk(
        staging=staging,
        ir=SdkModel(
            classes=[],
            functions=[],
            queries=[],
            theme=theme,
            pin=CeVersionPin(version_iri=version_iri),
        ),
    )


async def test_should_enqueue_generation_and_return_202(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """AC-1: the background pipeline itself is stubbed out here -- this
    test proves the route/persistence contract (202 body + a real `queued`
    row), not the pipeline (covered by AC-2/3/5/6 below).
    """
    ran: list[str] = []

    async def fake_run(**kwargs: Any) -> None:
        ran.append(kwargs["run_id"])

    monkeypatch.setattr("weave_backend.routers.sdk_generation.run_sdk_generation", fake_run)

    tenant_id = _unique_tenant("enqueue")
    project_iri = await _seed_project(tenant_id)
    sub = "u-owner"
    await _grant_editor(tenant_id, project_iri, human_principal_iri(sub))
    tokens = await issue_token_pair(sub=sub, tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    response = await client.post(f"/api/projects/{project_iri}/sdk-generations", headers=headers)

    assert response.status_code == 202, response.text
    body = response.json()
    assert body["status"] == "queued"

    async with tenant_connection(tenant_id) as conn:
        run = await get_sdk_run(conn, tenant_id=tenant_id, run_id=body["generation_id"])
    assert run is not None
    assert run.status == "queued"


async def test_should_return_409_via_route_when_already_in_flight(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """AC-1's 409 branch proven at the route (unit coverage already proves
    `trigger_sdk_generation`'s lock logic in isolation)."""
    monkeypatch.setattr(
        "weave_backend.routers.sdk_generation.run_sdk_generation", lambda **_kw: None
    )
    tenant_id = _unique_tenant("inflight")
    project_iri = await _seed_project(tenant_id)
    sub = "u-owner2"
    await _grant_editor(tenant_id, project_iri, human_principal_iri(sub))
    tokens = await issue_token_pair(sub=sub, tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    first = await client.post(f"/api/projects/{project_iri}/sdk-generations", headers=headers)
    assert first.status_code == 202, first.text

    second = await client.post(f"/api/projects/{project_iri}/sdk-generations", headers=headers)

    assert second.status_code == 409, second.text


async def test_should_refuse_sdk_regeneration_across_breaking_version_without_ack(
    platform_stack: Path,
) -> None:
    """AC-2: CE-DIFF-1's `breaking: true` span halts before the pipeline
    runs -- run goes to `breaking_hold`, no `commit_workspace` call."""
    tenant_id = _unique_tenant("breaking")
    project_iri = await _seed_project(tenant_id, pinned="urn:weave:ce:v2")
    async with tenant_connection(tenant_id) as conn:
        # Simulate a prior successful generation so AC-4's skip doesn't apply.
        await conn.execute(
            _SET_LAST_SDK_VERSION_SQL,
            "urn:weave:ce:v1",
            tenant_id,
            project_iri,
        )
        run = await insert_sdk_generation_run(conn, tenant_id=tenant_id, project_iri=project_iri)

    await sdk_trigger.run_sdk_generation(
        tenant_id=tenant_id,
        run_id=run.run_id,
        project_iri=project_iri,
        ce_client=_ce_diff_client(breaking_version="urn:weave:ce:v2"),
    )

    async with tenant_connection(tenant_id) as conn:
        held = await get_sdk_run(conn, tenant_id=tenant_id, run_id=run.run_id)
    assert held is not None
    assert held.status == "breaking_hold"
    assert held.payload["breaking_hold"]["version_iris"] == ["urn:weave:ce:v2"]


async def test_should_persist_ack_row_and_proceed_after_approval(
    platform_stack: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """AC-3: a non-self human approver's ack persists a `gate_results`
    row (`gate="sdk_breaking_ack"`) and resumes the pipeline past the hold."""
    tenant_id = _unique_tenant("ack")
    secret_ref = f"weave/{tenant_id}/scm/github/token"
    project_iri = await _seed_project(tenant_id, pinned="urn:weave:ce:v2", token_ref=secret_ref)
    driver = _StubDriver()
    async with tenant_connection(tenant_id) as conn:
        await set_project_repo(
            conn,
            tenant_id=tenant_id,
            project_iri=project_iri,
            provider="github",
            repo=RepoHandle(
                repo_id="acme/weave-acme", url="https://scm/acme/repo", default_branch="main"
            ),
        )
        await conn.execute(
            _SET_LAST_SDK_VERSION_SQL,
            "urn:weave:ce:v1",
            tenant_id,
            project_iri,
        )
        run = await insert_sdk_generation_run(conn, tenant_id=tenant_id, project_iri=project_iri)
        await update_sdk_run_status(
            conn,
            tenant_id=tenant_id,
            run_id=run.run_id,
            status="breaking_hold",
            payload={"breaking_hold": {"version_iris": ["urn:weave:ce:v2"]}},
        )
        human_iri = await ensure_human_principal(
            conn, tenant_id=tenant_id, sub="approver-sdk", display_name="Approver"
        )

    monkeypatch.setattr(sdk_commit, "generate_sdk", lambda _pin: _generated_sdk(tmp_path))

    async with tenant_connection(tenant_id) as conn:
        await sdk_trigger.approve_sdk_breaking_ack(
            conn,
            run_id=run.run_id,
            tenant_id=tenant_id,
            approving_principal_iri=human_iri,
            ack_deps=sdk_trigger.SdkAckDeps(repo_deps=_repo_deps(driver)),
        )

    assert len(driver.commits) == 1, "ack must resume straight to the single commit_workspace call"

    async with tenant_connection(tenant_id) as conn:
        gate_row = await conn.fetchrow(
            "SELECT result, payload FROM gate_results "
            "WHERE tenant_id = $1 AND gate = 'sdk_breaking_ack'",
            tenant_id,
        )
        resumed = await get_sdk_run(conn, tenant_id=tenant_id, run_id=run.run_id)

    assert gate_row is not None
    gate_payload = json.loads(gate_row["payload"])
    assert gate_payload["approver"] == human_iri
    assert resumed is not None
    assert resumed.status == "passed"


async def test_should_reject_self_approval_of_breaking_ack(platform_stack: Path) -> None:
    """AC-3's D9 half: the submitting principal is always the build-engine
    service actor, so a service/agent principal "approving" its own hold is
    the self-approval the shared HITL machinery rejects."""
    from weave_backend.build.hitl import SelfApprovalNotPermitted
    from weave_backend.repo_bootstrap.service import BUILD_SERVICE_PRINCIPAL_IRI

    tenant_id = _unique_tenant("selfack")
    project_iri = await _seed_project(tenant_id, pinned="urn:weave:ce:v2")
    async with tenant_connection(tenant_id) as conn:
        await conn.execute(
            _SET_LAST_SDK_VERSION_SQL,
            "urn:weave:ce:v1",
            tenant_id,
            project_iri,
        )
        run = await insert_sdk_generation_run(conn, tenant_id=tenant_id, project_iri=project_iri)
        await update_sdk_run_status(
            conn, tenant_id=tenant_id, run_id=run.run_id, status="breaking_hold"
        )

    async with tenant_connection(tenant_id) as conn:
        with pytest.raises(SelfApprovalNotPermitted):
            await sdk_trigger.approve_sdk_breaking_ack(
                conn,
                run_id=run.run_id,
                tenant_id=tenant_id,
                approving_principal_iri=BUILD_SERVICE_PRINCIPAL_IRI,
            )


async def test_should_stamp_provenance_and_commit_atomically(
    platform_stack: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """AC-5: provenance manifest present in the committed workspace, package
    version `{ce_version_tag}+build.{n}`, one commit, bookkeeping bumped in
    the same transaction as the commit."""
    tenant_id = _unique_tenant("provenance")
    secret_ref = f"weave/{tenant_id}/scm/github/token"
    project_iri = await _seed_project(tenant_id, token_ref=secret_ref)
    driver = _StubDriver()
    async with tenant_connection(tenant_id) as conn:
        await set_project_repo(
            conn,
            tenant_id=tenant_id,
            project_iri=project_iri,
            provider="github",
            repo=RepoHandle(
                repo_id="acme/weave-acme", url="https://scm/acme/repo", default_branch="main"
            ),
        )

    monkeypatch.setattr(sdk_commit, "generate_sdk", lambda _pin: _generated_sdk(tmp_path))

    async with tenant_connection(tenant_id) as conn:
        await sdk_trigger.run_sdk_generation(
            tenant_id=tenant_id,
            run_id="gen-first",
            project_iri=project_iri,
            deps=_repo_deps(driver),
        )

    assert len(driver.commits) == 1
    commit = driver.commits[0]
    assert commit["message"] == "chore(sdk): v1+build.1"
    assert commit["provenance"] is not None
    assert commit["provenance"]["pinned_version_iri"] == "urn:weave:ce:v1"

    async with tenant_connection(tenant_id) as conn:
        project = await get_project(conn, tenant_id=tenant_id, project_iri=project_iri)
    assert project is not None
    assert project.last_sdk_version_iri == "urn:weave:ce:v1"
    assert project.sdk_generation_count == 1


async def test_should_leave_repo_and_bookkeeping_unchanged_on_failure(
    platform_stack: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """AC-6: a poisoned pipeline never reaches `commit_workspace`, and the
    generation is recorded `failed` -- projects columns stay at their
    pre-attempt values."""

    def _poisoned(_pin: CeVersionPin) -> GeneratedSdk:
        raise RuntimeError("pipeline poisoned")

    tenant_id = _unique_tenant("failure")
    project_iri = await _seed_project(tenant_id)
    driver = _StubDriver()
    monkeypatch.setattr(sdk_commit, "generate_sdk", _poisoned)

    async with tenant_connection(tenant_id) as conn:
        await sdk_trigger.run_sdk_generation(
            tenant_id=tenant_id, run_id="gen-fail", project_iri=project_iri, deps=_repo_deps(driver)
        )

    assert driver.commits == []
    async with tenant_connection(tenant_id) as conn:
        project = await get_project(conn, tenant_id=tenant_id, project_iri=project_iri)
        run = await get_sdk_run(conn, tenant_id=tenant_id, run_id="gen-fail")
    assert project is not None
    assert project.sdk_generation_count == 0
    assert project.last_sdk_version_iri is None
    assert run is not None
    assert run.status == "failed"


async def test_bookkeeping_failure_after_successful_commit_leaves_run_unresolved(
    platform_stack: Path, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Edge case (not in the AC-6 test mapping, which only pokes a
    pre-commit pipeline failure): pins the DESIRED behaviour -- a failure in
    the bookkeeping step that runs after a successful `commit_workspace`
    should still resolve the run to `failed` (with the orphaned `commit_sha`
    recorded), matching ADR-006 Sec3's no-desync guarantee. Fixed for
    QA-TASK-005-1: `_generate_and_commit`'s fail-closed except now also
    covers the post-commit bookkeeping transaction.
    """
    tenant_id = _unique_tenant("bookkeeping-fail")
    project_iri = await _seed_project(
        tenant_id, token_ref=f"weave/{tenant_id}/scm/github/token"
    )
    driver = _StubDriver()
    async with tenant_connection(tenant_id) as conn:
        await set_project_repo(
            conn,
            tenant_id=tenant_id,
            project_iri=project_iri,
            provider="github",
            repo=RepoHandle(
                repo_id="acme/weave-acme", url="https://scm/acme/repo", default_branch="main"
            ),
        )

    monkeypatch.setattr(sdk_commit, "generate_sdk", lambda _pin: _generated_sdk(tmp_path))

    async def _poisoned_bookkeeping(*_args: Any, **_kwargs: Any) -> None:
        raise RuntimeError("db connection dropped post-commit")

    monkeypatch.setattr(sdk_commit, "update_project_sdk_generation", _poisoned_bookkeeping)

    # Desired: run_sdk_generation swallows the post-commit bookkeeping error
    # the same way it swallows a pre-commit pipeline error -- it must not
    # propagate uncaught.
    await sdk_trigger.run_sdk_generation(
        tenant_id=tenant_id, run_id="gen-bookkeeping-fail", project_iri=project_iri,
        deps=_repo_deps(driver),
    )

    # The commit already landed (git has no rollback) -- but ADR-006 Sec3's
    # no-desync promise means the run must still resolve to "failed" with the
    # orphaned commit_sha recorded, not vanish into a stuck "running" state.
    assert len(driver.commits) == 1

    async with tenant_connection(tenant_id) as conn:
        run = await get_sdk_run(conn, tenant_id=tenant_id, run_id="gen-bookkeeping-fail")
    assert run is not None
    assert run.status == "failed"
    assert run.payload.get("commit_sha")  # orphaned commit must be discoverable


async def test_should_return_latest_generation_status(client: AsyncClient) -> None:
    """AC-7: `GET .../sdk-generations/latest` reflects the newest row."""
    tenant_id = _unique_tenant("latest")
    project_iri = await _seed_project(tenant_id)
    sub = "u-reader"
    await _grant_editor(tenant_id, project_iri, human_principal_iri(sub))
    async with tenant_connection(tenant_id) as conn:
        run = await insert_sdk_generation_run(conn, tenant_id=tenant_id, project_iri=project_iri)
        await update_sdk_run_status(
            conn,
            tenant_id=tenant_id,
            run_id=run.run_id,
            status="passed",
            payload={"package_version": "v1+build.1"},
        )
    tokens = await issue_token_pair(sub=sub, tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    response = await client.get(
        f"/api/projects/{project_iri}/sdk-generations/latest", headers=headers
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["generation_id"] == run.run_id
    assert body["status"] == "passed"
    assert body["package_version"] == "v1+build.1"


async def test_should_return_404_cross_tenant(client: AsyncClient) -> None:
    """AC-8: a tenant-B principal reading a tenant-A project's generation
    status gets 404 (RLS -- the project does not exist for them). A
    tenant-wide admin overlay grant is used so the request reaches the
    route's own project lookup rather than 403ing on the missing
    contributor row first.
    """
    tenant_a = _unique_tenant("crossA")
    tenant_b = _unique_tenant("crossB")
    project_iri = await _seed_project(tenant_a)
    app.dependency_overrides[get_current_principal] = lambda: _admin_principal(tenant_b, "u-cross")

    response = await client.get(f"/api/projects/{project_iri}/sdk-generations/latest")

    del app.dependency_overrides[get_current_principal]
    assert response.status_code == 404, response.text
