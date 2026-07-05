"""BE-TASK-010 integration tests (build-engine EPIC-011): `ensure_project_repo`
against real Postgres (project row + persisted repo handle + audit chain)
and real LocalStack Secrets Manager, with the `GitHubDriver`/`GitLabDriver`
HTTP call sequences run against a mocked provider transport (Law F -- never
a real GitHub/GitLab call). Same lane conventions as `test_projects_api.py`
(`platform_stack` fixture, `tenant_connection`).

Repo bootstrap has no HTTP route of its own in M1 (it's a run step invoked
internally by TASK-006, which doesn't exist yet) -- so these tests call
`ensure_project_repo` directly, seeding the project row the same way
`create_project` does.
"""

from __future__ import annotations

import json
import os
import shutil
import uuid
from pathlib import Path

import asyncpg
import boto3
import httpx
import pytest

from weave_backend.audit.emitter import AuditEvent, default_audit_emitter
from weave_backend.db.pool import tenant_connection
from weave_backend.projects.model import NewProject, create_project
from weave_backend.repo_bootstrap.drivers import GitHubDriver, RepoHandle
from weave_backend.repo_bootstrap.secrets import get_scm_token
from weave_backend.repo_bootstrap.service import (
    RepoBootstrapDeps,
    RepoBootstrapError,
    ensure_project_repo,
)

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]

# Fake, short (<8 chars) placeholder credentials -- not a real provider
# token shape, kept below the secret-scanner's quoted-literal length floor.
_FAKE_TOKEN_A = "tok-a"
_FAKE_TOKEN_B = "tok-b"
_FAKE_TOKEN_C = "tok-c"


def _unique_tenant(label: str) -> str:
    return f"{label}-{uuid.uuid4().hex[:8]}"


def _secrets_client() -> boto3.client:
    port = os.environ.get("WEAVE_LOCALSTACK_PORT", "4566")
    endpoint_url = os.environ.get("LOCALSTACK_ENDPOINT_URL", f"http://localhost:{port}")
    return boto3.client(
        "secretsmanager",
        endpoint_url=endpoint_url,
        region_name="us-east-1",
        aws_access_key_id="test",
        aws_secret_access_key="test",
    )


def _seed_scm_token(secret_ref: str, value: str) -> None:
    client = _secrets_client()
    client.create_secret(Name=secret_ref, SecretString=value)


def _github_mock_driver(repo_full_name: str, repo_url: str) -> GitHubDriver:
    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/user/repos":
            return httpx.Response(
                201,
                json={"full_name": repo_full_name, "html_url": repo_url, "default_branch": "main"},
            )
        if path.endswith("/git/blobs"):
            return httpx.Response(201, json={"sha": f"blob-{path}"})
        if path.endswith("/git/trees"):
            return httpx.Response(201, json={"sha": "tree-sha"})
        if path.endswith("/git/commits"):
            return httpx.Response(201, json={"sha": "commit-sha"})
        if path.endswith("/git/refs"):
            return httpx.Response(201, json={})
        raise AssertionError(f"unexpected path {path}")

    return GitHubDriver(
        client=httpx.AsyncClient(
            transport=httpx.MockTransport(handler), base_url="https://api.github.com"
        )
    )


async def _default_emit_audit(conn: asyncpg.Connection, event: AuditEvent) -> None:
    await default_audit_emitter.emit(conn, event)


async def _seed_project(
    *, tenant_id: str, secret_ref: str, token: str, provider: str = "github"
) -> str:
    _seed_scm_token(secret_ref, token)
    async with tenant_connection(tenant_id) as conn:
        project = await create_project(
            conn,
            NewProject(
                tenant_id=tenant_id,
                slug="acme-corp",
                name="Acme Corp",
                description=None,
                pinned_graph_version_iri="urn:weave:version:v1",
                source_control_provider=provider,
                source_control_token_secret_ref=secret_ref,
            ),
        )
    return project.project_iri


async def test_bootstrap_creates_repo_writes_boilerplate_and_persists_handle(
    platform_stack: Path,
) -> None:
    tenant_id = _unique_tenant("tenant-repo")
    secret_ref = f"weave/{tenant_id}/scm/github/token"
    project_iri = await _seed_project(
        tenant_id=tenant_id, secret_ref=secret_ref, token=_FAKE_TOKEN_A
    )
    driver = _github_mock_driver("acme/weave-acme-corp", "https://github.com/acme/weave-acme-corp")
    written_commits: list[dict[str, str]] = []
    original_write = driver.write_initial_commit

    async def _capturing_write(
        repo: RepoHandle, *, boilerplate: dict[str, str], token: str
    ) -> None:
        written_commits.append(boilerplate)
        await original_write(repo, boilerplate=boilerplate, token=token)

    driver.write_initial_commit = _capturing_write  # type: ignore[method-assign]
    deps = RepoBootstrapDeps(
        get_secret=get_scm_token, driver_for=lambda _p: driver, emit_audit=_default_emit_audit
    )

    async with tenant_connection(tenant_id) as conn:
        status_code, body = await ensure_project_repo(
            conn, project_iri=project_iri, tenant_id=tenant_id, deps=deps
        )

    assert status_code == 201
    assert body == {
        "provider": "github",
        "repo_url": "https://github.com/acme/weave-acme-corp",
        "default_branch": "main",
    }
    assert "README.md" in written_commits[0]

    async with tenant_connection(tenant_id) as conn:
        row = await conn.fetchrow(
            "SELECT repo_provider, repo_url, repo_default_branch, repo_id"
            " FROM projects WHERE project_iri = $1",
            project_iri,
        )
    assert row["repo_provider"] == "github"
    assert row["repo_url"] == "https://github.com/acme/weave-acme-corp"
    assert row["repo_default_branch"] == "main"
    assert row["repo_id"] == "acme/weave-acme-corp"


async def test_bootstrap_second_run_is_idempotent_and_reuses_existing_repo(
    platform_stack: Path,
) -> None:
    tenant_id = _unique_tenant("tenant-repo-idem")
    secret_ref = f"weave/{tenant_id}/scm/github/token"
    project_iri = await _seed_project(
        tenant_id=tenant_id, secret_ref=secret_ref, token=_FAKE_TOKEN_B
    )
    deps = RepoBootstrapDeps(
        get_secret=get_scm_token,
        driver_for=lambda _p: _github_mock_driver(
            "acme/weave-acme-corp", "https://github.com/acme/weave-acme-corp"
        ),
        emit_audit=_default_emit_audit,
    )

    async with tenant_connection(tenant_id) as conn:
        first = await ensure_project_repo(
            conn, project_iri=project_iri, tenant_id=tenant_id, deps=deps
        )

    def _driver_that_fails(_provider: str) -> GitHubDriver:
        raise AssertionError("driver must not be invoked on a repeat run")

    deps_second = RepoBootstrapDeps(
        get_secret=get_scm_token, driver_for=_driver_that_fails, emit_audit=_default_emit_audit
    )
    async with tenant_connection(tenant_id) as conn:
        second = await ensure_project_repo(
            conn, project_iri=project_iri, tenant_id=tenant_id, deps=deps_second
        )

    assert first[0] == 201
    assert second == (200, first[1])


async def test_bootstrap_emits_repo_bootstrapped_audit_event_with_no_token(
    platform_stack: Path,
) -> None:
    tenant_id = _unique_tenant("tenant-repo-audit")
    secret_ref = f"weave/{tenant_id}/scm/github/token"
    project_iri = await _seed_project(
        tenant_id=tenant_id, secret_ref=secret_ref, token=_FAKE_TOKEN_C
    )
    deps = RepoBootstrapDeps(
        get_secret=get_scm_token,
        driver_for=lambda _p: _github_mock_driver(
            "acme/weave-acme-corp", "https://github.com/acme/weave-acme-corp"
        ),
        emit_audit=_default_emit_audit,
    )

    async with tenant_connection(tenant_id) as conn:
        await ensure_project_repo(conn, project_iri=project_iri, tenant_id=tenant_id, deps=deps)

    async with tenant_connection(tenant_id) as conn:
        row = await conn.fetchrow(
            "SELECT event_type, target_iri, diff_summary, actor_principal_iri, engine"
            " FROM audit_entries WHERE tenant_id = $1 AND event_type = 'repo_bootstrapped'",
            tenant_id,
        )
    assert row is not None
    assert row["target_iri"] == project_iri
    assert row["engine"] == "build"
    diff_summary = json.loads(row["diff_summary"])
    assert diff_summary == {
        "provider": "github",
        "repo_url": "https://github.com/acme/weave-acme-corp",
    }
    assert _FAKE_TOKEN_C not in json.dumps(diff_summary)


async def test_bootstrap_halts_when_provider_unconfigured(platform_stack: Path) -> None:
    tenant_id = _unique_tenant("tenant-repo-unconf")
    async with tenant_connection(tenant_id) as conn:
        project = await create_project(
            conn,
            NewProject(
                tenant_id=tenant_id,
                slug="no-scm",
                name="No SCM",
                description=None,
                pinned_graph_version_iri="urn:weave:version:v1",
            ),
        )

    deps = RepoBootstrapDeps(
        get_secret=get_scm_token,
        driver_for=lambda _p: (_ for _ in ()).throw(AssertionError("must not be called")),
        emit_audit=_default_emit_audit,
    )
    async with tenant_connection(tenant_id) as conn:
        with pytest.raises(RepoBootstrapError) as exc_info:
            await ensure_project_repo(
                conn, project_iri=project.project_iri, tenant_id=tenant_id, deps=deps
            )
    assert exc_info.value.reason == "repo_provider_unconfigured"
