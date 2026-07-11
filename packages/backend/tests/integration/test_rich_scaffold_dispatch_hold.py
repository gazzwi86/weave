"""BE-TASK-006 AC-6/AC-7/AC-8 (build-engine EPIC-011) integration tests:
`rich_scaffold`'s real bootstrap steps against real Postgres + LocalStack
Secrets Manager, and the full held->approve->released dispatch-hold cycle
through `run_dark_factory` / `handle_hitl_response`. No real SCM/GitHub
network call (Law F) -- a stub driver (same shape as `test_rich_scaffold.py`'s
`_FakeDriver`) is injected via `RepoBootstrapDeps.driver_for`.
"""

from __future__ import annotations

import os
import shutil
import uuid
from pathlib import Path
from typing import Any

import boto3
import pytest

from weave_backend.build.hitl import HitlResponseContext, handle_hitl_response
from weave_backend.build.orchestrator import OrchestratorDeps, run_dark_factory
from weave_backend.build.state_spine import TaskState, start_or_resume_run
from weave_backend.db.pool import tenant_connection
from weave_backend.identity.registry import ensure_human_principal
from weave_backend.projects.model import NewProject, create_project
from weave_backend.repo_bootstrap.drivers import RepoHandle
from weave_backend.repo_bootstrap.rich_scaffold import rich_scaffold
from weave_backend.repo_bootstrap.service import RepoBootstrapDeps
from weave_backend.repo_bootstrap.store import fetch_project_repo_row
from weave_backend.schemas.tasks import TypedResult

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]

_FAKE_TOKEN = "tok-rs"


class _StubDriver:
    """Tracks every SCM call made -- no real HTTP, Law F."""

    def __init__(self, *, anatomy: str | None = None) -> None:
        self.calls: list[str] = []
        #: TASK-009/AC-2: `read_file("ANATOMY.md")`'s canned reply -- `None`
        #: (the default) mirrors a freshly scaffolded repo with no anatomy
        #: index committed yet.
        self.anatomy = anatomy

    async def create_repo(self, *, name: str, private: bool, token: str) -> RepoHandle:
        self.calls.append("create_repo")
        return RepoHandle(repo_id="acme/repo", url="https://scm/acme/repo", default_branch="main")

    async def write_initial_commit(
        self, repo: RepoHandle, *, boilerplate: dict[str, str], token: str
    ) -> None:
        self.calls.append("write_initial_commit")

    async def commit_workspace(
        self, repo: RepoHandle, *, workspace: str, branch: str, message: str, token: str
    ) -> str:
        self.calls.append("commit_workspace")
        return "sha-stub"

    async def apply_branch_protection(self, repo: RepoHandle, *, token: str) -> None:
        self.calls.append("branch_protection")

    async def commit_files(
        self, repo: RepoHandle, *, files: dict[str, str], message: str, token: str
    ) -> str:
        self.calls.append("harness_files")
        return "sha-stub"

    async def read_file(self, repo: RepoHandle, *, path: str, token: str) -> str | None:
        self.calls.append("read_file")
        return self.anatomy


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
    _secrets_client().create_secret(Name=secret_ref, SecretString=value)


async def _seed_project(tenant_id: str, secret_ref: str) -> str:
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
    return project.project_iri


def _repo_bootstrap_deps(driver: _StubDriver) -> RepoBootstrapDeps:
    async def get_secret(_ref: str) -> str | None:
        return _FAKE_TOKEN

    def driver_for(_provider: str) -> _StubDriver:
        return driver

    async def emit_audit(_conn: Any, _event: Any) -> None:
        return None

    return RepoBootstrapDeps(get_secret=get_secret, driver_for=driver_for, emit_audit=emit_audit)


async def _empty_rate_card(_conn: Any, *, tenant_id: str, project_iri: str) -> dict[str, Any]:
    return {}


async def _dispatch_pass(
    _conn: Any, *, tenant_id: str, project_iri: str, task: TaskState
) -> tuple[TypedResult, Any]:
    from weave_backend.build.dep_summary import DepSummary

    return TypedResult(status="PASS", retry_recommended=False), DepSummary(task_id=task.id)


async def test_should_apply_rich_scaffold_on_bootstrap(platform_stack: Path) -> None:
    """AC-6/AC-7: `rich_scaffold` runs the M1 create+push floor then the
    extra branch-protection + harness-files steps, and marks the project
    held for feature dispatch in real Postgres.
    """
    tenant_id = _unique_tenant("tenant-scaffold")
    secret_ref = f"weave/{tenant_id}/scm/github/token"
    _seed_scm_token(secret_ref, _FAKE_TOKEN)
    project_iri = await _seed_project(tenant_id, secret_ref)
    driver = _StubDriver()

    async with tenant_connection(tenant_id) as conn:
        await rich_scaffold(
            conn, project_iri=project_iri, tenant_id=tenant_id, deps=_repo_bootstrap_deps(driver)
        )
        row = await fetch_project_repo_row(conn, tenant_id=tenant_id, project_iri=project_iri)

    assert driver.calls == [
        "create_repo",
        "write_initial_commit",
        "branch_protection",
        "harness_files",
    ]
    assert row is not None
    assert row.feature_dispatch_held is True


async def test_should_hold_feature_tasks_until_env_verification_approved(
    platform_stack: Path,
) -> None:
    """AC-7: a fresh project's run halts at the env-verification HITL gate
    with zero dispatches while held; a real human principal approving via
    `handle_hitl_response` releases the hold, and the resumed run then
    dispatches the queued task.
    """
    tenant_id = _unique_tenant("tenant-hold")
    secret_ref = f"weave/{tenant_id}/scm/github/token"
    _seed_scm_token(secret_ref, _FAKE_TOKEN)
    project_iri = await _seed_project(tenant_id, secret_ref)
    driver = _StubDriver()
    deps = OrchestratorDeps(
        repo_deps=_repo_bootstrap_deps(driver),
        dispatch_pdac_fn=_dispatch_pass,
        resolve_rate_card_fn=_empty_rate_card,
    )
    run_id = str(uuid.uuid4())

    async with tenant_connection(tenant_id) as conn:
        spine = await start_or_resume_run(
            conn, tenant_id=tenant_id, project_iri=project_iri, run_id=run_id, turn_cap=60
        )
        spine.tasks.append(TaskState(id="t-1", status="Queued"))
        held_spine = await run_dark_factory(conn, spine, tenant_id=tenant_id, deps=deps)

    assert held_spine.phase == "halted_hitl"
    assert held_spine.dispatch_count == 0

    async with tenant_connection(tenant_id) as conn:
        human_iri = await ensure_human_principal(
            conn, tenant_id=tenant_id, sub="approver-1", display_name="Approver One"
        )
        await handle_hitl_response(
            conn,
            HitlResponseContext(
                tenant_id=tenant_id,
                task_id=f"env_verification:{project_iri}",
                approving_principal_iri=human_iri,
                action="approve",
            ),
        )

    async with tenant_connection(tenant_id) as conn:
        resumed = await start_or_resume_run(
            conn, tenant_id=tenant_id, project_iri=project_iri, run_id=run_id, turn_cap=60
        )
        result_spine = await run_dark_factory(conn, resumed, tenant_id=tenant_id, deps=deps)

    assert result_spine.dispatch_count == 1
    assert result_spine.tasks[0].status == "Done"


async def test_should_load_anatomy_into_task_context_before_delegate(
    platform_stack: Path,
) -> None:
    """AC-2 (task brief mapping: `should load anatomy into task context
    before delegate`): once a project's repo carries a committed
    `ANATOMY.md`, `run_dark_factory` prepends its content into the
    dispatched task's `context` before `dispatch_pdac_fn` (PLAN->DELEGATE)
    ever runs -- proven end to end (real Postgres, stub SCM driver) rather
    than just at the `_dispatch_one` unit level.
    """
    anatomy_md = "# Repository Anatomy\n\n| Area | Files | Wiki |\n|---|---|---|\n"
    tenant_id = _unique_tenant("tenant-anatomy")
    secret_ref = f"weave/{tenant_id}/scm/github/token"
    _seed_scm_token(secret_ref, _FAKE_TOKEN)
    project_iri = await _seed_project(tenant_id, secret_ref)
    driver = _StubDriver(anatomy=anatomy_md)
    seen_context: list[str] = []

    async def _dispatch_capture_context(
        _conn: Any, *, tenant_id: str, project_iri: str, task: TaskState
    ) -> tuple[TypedResult, Any]:
        from weave_backend.build.dep_summary import DepSummary

        seen_context.extend(task.context)
        return TypedResult(status="PASS", retry_recommended=False), DepSummary(task_id=task.id)

    deps = OrchestratorDeps(
        repo_deps=_repo_bootstrap_deps(driver),
        dispatch_pdac_fn=_dispatch_capture_context,
        resolve_rate_card_fn=_empty_rate_card,
    )
    run_id = str(uuid.uuid4())

    async with tenant_connection(tenant_id) as conn:
        spine = await start_or_resume_run(
            conn, tenant_id=tenant_id, project_iri=project_iri, run_id=run_id, turn_cap=60
        )
        spine.tasks.append(TaskState(id="t-1", status="Queued"))
        held_spine = await run_dark_factory(conn, spine, tenant_id=tenant_id, deps=deps)

    assert held_spine.phase == "halted_hitl"

    async with tenant_connection(tenant_id) as conn:
        human_iri = await ensure_human_principal(
            conn, tenant_id=tenant_id, sub="approver-2", display_name="Approver Two"
        )
        await handle_hitl_response(
            conn,
            HitlResponseContext(
                tenant_id=tenant_id,
                task_id=f"env_verification:{project_iri}",
                approving_principal_iri=human_iri,
                action="approve",
            ),
        )

    async with tenant_connection(tenant_id) as conn:
        resumed = await start_or_resume_run(
            conn, tenant_id=tenant_id, project_iri=project_iri, run_id=run_id, turn_cap=60
        )
        result_spine = await run_dark_factory(conn, resumed, tenant_id=tenant_id, deps=deps)

    assert result_spine.dispatch_count == 1
    assert seen_context == [anatomy_md], "AC-2: DELEGATE must see the anatomy already loaded"
    assert result_spine.tasks[0].context == [anatomy_md]
