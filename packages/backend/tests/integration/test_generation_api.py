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
from weave_backend.generation.service import GenerationContext, GenerationDeps, generate_app
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
        if path.endswith("/git/blobs"):
            return httpx.Response(201, json={"sha": f"blob-{path}"})
        if path.endswith("/git/trees"):
            return httpx.Response(201, json={"sha": "tree-sha"})
        if path.endswith("/git/commits"):
            return httpx.Response(201, json={"sha": "generated-commit-sha"})
        if path.endswith("/git/refs"):
            return httpx.Response(201, json={})
        raise AssertionError(f"unexpected path {path}")

    return GitHubDriver(
        client=httpx.AsyncClient(
            transport=httpx.MockTransport(handler), base_url="https://api.github.com"
        )
    )


def _ce_read_client(project_iri: str) -> httpx.AsyncClient:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == f"/api/ontology/resource/{project_iri}"
        return httpx.Response(200, json={"entity_kinds": ["widget"]})

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
