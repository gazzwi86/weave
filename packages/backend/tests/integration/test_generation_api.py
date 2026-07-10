"""BE-TASK-008 integration tests (build-engine EPIC-008): `generate_app`
against real Postgres (task brief + project + `generation_runs` row + audit
chain) and real LocalStack Secrets Manager, with the `GitHubDriver`'s HTTP
call sequence and CE-READ-1 grounding run against mocked transports, and
the 5 gate tools' `subprocess.run` boundary mocked (Law F -- never a real
external tool invocation, cloud call, or LLM call). Same lane conventions
as `test_repo_bootstrap.py` (`platform_stack` fixture, `tenant_connection`).

Generation has no HTTP route exercised here -- `routers/generation.py` is a
thin 404/422/503/201 mapping layer already covered by
`tests/unit/test_generation_router.py` -- these tests call `generate_app`
directly, the same "service function, not a full HTTP round-trip" choice
`test_repo_bootstrap.py` makes for its own un-routed service function.
"""

from __future__ import annotations

import json
import os
import shutil
import uuid
from pathlib import Path
from typing import Any
from unittest.mock import patch

import asyncpg
import boto3
import httpx
import pytest

from weave_backend.audit.emitter import AuditEvent, default_audit_emitter
from weave_backend.briefs.store import (
    NewBrief,
    build_brief_iri,
    generate_task_id,
    insert_task_brief,
)
from weave_backend.db.pool import tenant_connection
from weave_backend.generation.gates import GateFailure
from weave_backend.generation.service import (
    DEFAULT_DEPS,
    GenerationContext,
    GenerationDeps,
    generate_app,
)
from weave_backend.projects.model import NewProject, create_project
from weave_backend.repo_bootstrap.drivers import GitHubDriver
from weave_backend.repo_bootstrap.secrets import get_scm_token
from weave_backend.repo_bootstrap.service import RepoBootstrapDeps, ensure_project_repo

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]

# Fake, short (<8 chars) placeholder credential -- not a real provider token
# shape, kept below the secret-scanner's quoted-literal length floor.
_FAKE_TOKEN = "tok-gen"
_REPO_FULL_NAME = "acme/weave-acme-corp"
_REPO_URL = "https://github.com/acme/weave-acme-corp"


def _unique_tenant(label: str) -> str:
    return f"{label}-{uuid.uuid4().hex[:8]}"


def _secrets_client() -> Any:
    port = os.environ.get("WEAVE_LOCALSTACK_PORT", "4566")
    endpoint_url = os.environ.get("LOCALSTACK_ENDPOINT_URL", f"http://localhost:{port}")
    return boto3.client(
        "secretsmanager",
        endpoint_url=endpoint_url,
        region_name="us-east-1",
        aws_access_key_id="test",
        aws_secret_access_key="test",
    )


def _github_driver() -> GitHubDriver:
    """Handles both the bootstrap-step calls (`/user/repos`,
    `write_initial_commit`'s blob/tree/commit/ref) and generation's own
    `commit_workspace` calls (`/git/ref/heads/main` + the same
    blob/tree/commit/ref sequence) on one mock transport.
    """

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/user/repos":
            return httpx.Response(
                201,
                json={
                    "full_name": _REPO_FULL_NAME,
                    "html_url": _REPO_URL,
                    "default_branch": "main",
                },
            )
        if path.endswith("/git/ref/heads/main"):
            return httpx.Response(200, json={"object": {"sha": "head-sha"}})
        if "/git/commits/" in path:  # GET parent commit -> tree sha (AC-6)
            return httpx.Response(200, json={"tree": {"sha": "base-tree-sha"}})
        created = {
            "/git/blobs": {"sha": f"blob-{path}"},
            "/git/trees": {"sha": "tree-sha"},
            "/git/commits": {"sha": "generated-commit-sha"},
            "/git/refs": {},
        }
        for suffix, body in created.items():
            if path.endswith(suffix):
                return httpx.Response(201, json=body)
        raise AssertionError(f"unexpected path {path}")

    return GitHubDriver(
        client=httpx.AsyncClient(
            transport=httpx.MockTransport(handler), base_url="https://api.github.com"
        )
    )


def _ce_read_client(
    project_iri: str,
    *,
    voice_rules: list[dict[str, Any]] | None = None,
    brand_unreachable: bool = False,
) -> httpx.AsyncClient:
    """CE-READ-1 grounding + CE-BRAND-1 (TASK-002) on one mock transport --
    `voice_rules` defaults to `[]` (AC-6's "zero normal rules -> score 1.0"
    edge, so pre-existing non-brand tests pass the brand gate for free);
    `brand_unreachable=True` 500s both brand endpoints (AC-5).
    """

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == f"/api/ontology/resource/{project_iri}":
            return httpx.Response(200, json={"entity_kinds": ["widget"]})
        if path in ("/api/brand/tokens", "/api/brand/voice-rules"):
            if brand_unreachable:
                return httpx.Response(503, json={"error": "ce_brand_unavailable"})
            body: object = {} if path == "/api/brand/tokens" else (voice_rules or [])
            return httpx.Response(200, json=body)
        raise AssertionError(f"unexpected path {path}")

    return httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="https://ce.test")


async def _seed_project_and_brief(tenant_id: str) -> tuple[str, str]:
    secret_ref = f"weave/{tenant_id}/scm/github/token"
    _secrets_client().create_secret(Name=secret_ref, SecretString=_FAKE_TOKEN)
    async with tenant_connection(tenant_id) as conn:
        project = await create_project(
            conn,
            NewProject(
                tenant_id=tenant_id,
                slug="acme-corp",
                name="Acme Corp",
                description=None,
                pinned_graph_version_iri="urn:weave:version:v1",
                source_control_provider="github",
                source_control_token_secret_ref=secret_ref,
            ),
        )
        bootstrap_deps = RepoBootstrapDeps(
            get_secret=get_scm_token, driver_for=lambda _p: _github_driver(), emit_audit=_emit
        )
        await ensure_project_repo(
            conn, project_iri=project.project_iri, tenant_id=tenant_id, deps=bootstrap_deps
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
                content={"title": "Widget list"},
            ),
        )
    return project.project_iri, task_id


async def _emit(conn: asyncpg.Connection, event: AuditEvent) -> None:
    await default_audit_emitter.emit(conn, event)


def _gen_deps(*, generate_workspace_fn: Any = None) -> GenerationDeps:
    async def default_generate_workspace(
        *, prompt: str, output_dir: str, bpmo: dict[str, object]
    ) -> None:
        del prompt, bpmo
        Path(output_dir, "openapi.yaml").write_text("openapi: 3.1.0\n")

    return GenerationDeps(
        generate_workspace_fn=generate_workspace_fn or default_generate_workspace,
        driver_for=lambda _provider: _github_driver(),
        get_secret=get_scm_token,
        emit_audit=_emit,
        # TASK-002: real recorder (own tenant_connection, migration 0013's
        # gate_results table) -- exercises the durability path for real
        # against Postgres, same as every other dep here.
        record_brand_gate=DEFAULT_DEPS.record_brand_gate,
    )


class _SubprocessResult:
    def __init__(self, returncode: int, *, stdout: str = "", stderr: str = "") -> None:
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


def _all_tools_pass(*_args: object, **_kwargs: object) -> _SubprocessResult:
    stats = json.dumps({"killed": 90, "survived": 10, "survivors": []})
    return _SubprocessResult(0, stdout=stats)


def _bandit_fails(*_args: object, **_kwargs: object) -> _SubprocessResult:
    return _SubprocessResult(1, stderr="B608: possible SQL injection")


async def test_generate_app_commits_to_feature_branch_and_returns_commit_sha_on_all_pass(
    platform_stack: Path,
) -> None:
    tenant_id = _unique_tenant("tenant-gen-pass")
    project_iri, task_id = await _seed_project_and_brief(tenant_id)

    async with tenant_connection(tenant_id) as conn:
        ctx = GenerationContext(
            tenant_id=tenant_id,
            project_iri=project_iri,
            task_id=task_id,
            ce_client=_ce_read_client(project_iri),
        )
        with patch("weave_backend.generation.gates.subprocess.run", side_effect=_all_tools_pass):
            outcome = await generate_app(conn, ctx, _gen_deps())

    assert outcome["commit_sha"] == "generated-commit-sha"
    assert outcome["branch"] == f"build/{project_iri.split(':')[-1]}/{task_id}"
    gates_passed = outcome["gates_passed"]
    assert isinstance(gates_passed, list)
    assert {"gate": "mutation", "status": "PASS", "score": pytest.approx(0.9)} in gates_passed

    async with tenant_connection(tenant_id) as conn:
        row = await conn.fetchrow(
            "SELECT branch, commit_sha, status FROM generation_runs WHERE tenant_id = $1",
            tenant_id,
        )
    assert row["status"] == "passed"
    assert row["commit_sha"] == "generated-commit-sha"


async def test_generate_app_cleans_up_workspace_directory_when_gate_fails(
    platform_stack: Path,
) -> None:
    tenant_id = _unique_tenant("tenant-gen-fail")
    project_iri, task_id = await _seed_project_and_brief(tenant_id)
    workspaces: list[str] = []

    async def capturing_generate_workspace(
        *, prompt: str, output_dir: str, bpmo: dict[str, object]
    ) -> None:
        del prompt, bpmo
        workspaces.append(output_dir)
        Path(output_dir, "openapi.yaml").write_text("openapi: 3.1.0\n")

    async with tenant_connection(tenant_id) as conn:
        ctx = GenerationContext(
            tenant_id=tenant_id,
            project_iri=project_iri,
            task_id=task_id,
            ce_client=_ce_read_client(project_iri),
        )
        with (
            patch("weave_backend.generation.gates.subprocess.run", side_effect=_bandit_fails),
            pytest.raises(GateFailure),
        ):
            await generate_app(
                conn, ctx, _gen_deps(generate_workspace_fn=capturing_generate_workspace)
            )

    assert workspaces, "generate_workspace_fn was never invoked"
    assert not Path(workspaces[0]).exists()


async def test_generate_app_records_generation_complete_audit_event_on_success(
    platform_stack: Path,
) -> None:
    tenant_id = _unique_tenant("tenant-gen-audit")
    project_iri, task_id = await _seed_project_and_brief(tenant_id)

    async with tenant_connection(tenant_id) as conn:
        ctx = GenerationContext(
            tenant_id=tenant_id,
            project_iri=project_iri,
            task_id=task_id,
            ce_client=_ce_read_client(project_iri),
        )
        with patch("weave_backend.generation.gates.subprocess.run", side_effect=_all_tools_pass):
            await generate_app(conn, ctx, _gen_deps())

    async with tenant_connection(tenant_id) as conn:
        row = await conn.fetchrow(
            "SELECT event_type, target_iri, engine FROM audit_entries"
            " WHERE tenant_id = $1 AND event_type = 'generation_complete'",
            tenant_id,
        )
    assert row is not None
    assert row["target_iri"] == project_iri
    assert row["engine"] == "build"


# --- TASK-002 (E8-S1): CE-BRAND-1 conformance gate, 6th in the pipeline ---
# Docker-marked (`pytest.mark.integration, pytest.mark.docker`) same as the
# rest of this module -- WRITTEN per lane instructions, not run in this
# lane (the coordinator serialises docker verification across lanes).


async def test_generate_app_runs_brand_gate_sixth_and_records_score_row(
    platform_stack: Path,
) -> None:
    """AC-1: the brand gate runs 6th (after mutation), and its result is
    durably recorded in `gate_results` (migration 0013) even though it's
    evaluated inside the same request the M1 five gates already passed.
    """
    tenant_id = _unique_tenant("tenant-gen-brand-pass")
    project_iri, task_id = await _seed_project_and_brief(tenant_id)
    voice_rules = [{"id": "tok-1", "severity": "normal", "assertion": {"kind": "token_scan"}}]

    async with tenant_connection(tenant_id) as conn:
        ctx = GenerationContext(
            tenant_id=tenant_id,
            project_iri=project_iri,
            task_id=task_id,
            ce_client=_ce_read_client(project_iri, voice_rules=voice_rules),
        )
        with patch("weave_backend.generation.gates.subprocess.run", side_effect=_all_tools_pass):
            outcome = await generate_app(conn, ctx, _gen_deps())

    gates_passed = outcome["gates_passed"]
    assert isinstance(gates_passed, list)
    assert {"gate": "brand", "status": "PASS", "score": 1.0} in gates_passed

    async with tenant_connection(tenant_id) as conn:
        row = await conn.fetchrow(
            "SELECT result, payload FROM gate_results WHERE tenant_id = $1 AND gate = 'brand'",
            tenant_id,
        )
    assert row is not None
    assert row["result"] == "passed"
    payload = json.loads(row["payload"])
    assert payload == {"score": 1.0, "critical_failures": [], "rules_evaluated": 1}


async def test_generate_app_commits_nothing_when_brand_gate_fails_after_five_passes(
    platform_stack: Path,
) -> None:
    """AC-4: a brand-gate failure after all 5 M1 gates pass still commits
    nothing -- the six-gate set is atomic, same as the M1 five-gate set.
    """
    tenant_id = _unique_tenant("tenant-gen-brand-fail")
    project_iri, task_id = await _seed_project_and_brief(tenant_id)
    voice_rules = [{"id": "crit-1", "severity": "critical", "assertion": {"kind": "unknown"}}]

    async with tenant_connection(tenant_id) as conn:
        ctx = GenerationContext(
            tenant_id=tenant_id,
            project_iri=project_iri,
            task_id=task_id,
            ce_client=_ce_read_client(project_iri, voice_rules=voice_rules),
        )
        with (
            patch("weave_backend.generation.gates.subprocess.run", side_effect=_all_tools_pass),
            pytest.raises(GateFailure) as excinfo,
        ):
            await generate_app(conn, ctx, _gen_deps())

    assert excinfo.value.evidence["critical_failures"] == ["crit-1"]

    async with tenant_connection(tenant_id) as conn:
        run_row = await conn.fetchrow(
            "SELECT 1 FROM generation_runs WHERE tenant_id = $1", tenant_id
        )
        gate_row = await conn.fetchrow(
            "SELECT result FROM gate_results WHERE tenant_id = $1 AND gate = 'brand'", tenant_id
        )
    assert run_row is None  # AC-4: nothing committed
    assert gate_row is not None
    assert gate_row["result"] == "failed"


async def test_generate_app_fails_closed_when_ce_brand_unreachable(
    platform_stack: Path,
) -> None:
    """AC-5: CE-BRAND-1 unreachable -> the gate is recorded `not_verified`
    and fails closed (an unevaluable gate never passes).
    """
    tenant_id = _unique_tenant("tenant-gen-brand-down")
    project_iri, task_id = await _seed_project_and_brief(tenant_id)

    async with tenant_connection(tenant_id) as conn:
        ctx = GenerationContext(
            tenant_id=tenant_id,
            project_iri=project_iri,
            task_id=task_id,
            ce_client=_ce_read_client(project_iri, brand_unreachable=True),
        )
        with (
            patch("weave_backend.generation.gates.subprocess.run", side_effect=_all_tools_pass),
            pytest.raises(GateFailure) as excinfo,
        ):
            await generate_app(conn, ctx, _gen_deps())

    assert excinfo.value.evidence["reason"] == "ce_unavailable"

    async with tenant_connection(tenant_id) as conn:
        gate_row = await conn.fetchrow(
            "SELECT result, payload FROM gate_results WHERE tenant_id = $1 AND gate = 'brand'",
            tenant_id,
        )
    assert gate_row is not None
    assert gate_row["result"] == "failed"
    assert json.loads(gate_row["payload"])["not_verified"] is True
