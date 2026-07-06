"""BE-TASK-008 (build-engine EPIC-008) unit tests for `generate_app`'s
orchestration logic -- 404s, CE-READ-1 grounding (AC-1), atomic gate
pipeline (AC-3), the secret-scan audit event (AC-4), workspace cleanup, and
the AC-8 "CE-BRAND-1 never called in M1" guard. `get_project`/
`get_task_brief`/`fetch_project_repo_row` are patched directly (same
domain-function-patching pattern as `test_tasks_router.py`) so this test
needs no real Postgres connection -- end-to-end proof against real
Postgres/LocalStack lives in `tests/integration/test_generation_api.py`.
"""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast
from unittest.mock import AsyncMock, patch

import pytest

from weave_backend.briefs.ce_read_client import CeReadUnavailable
from weave_backend.briefs.store import StoredBrief
from weave_backend.generation.gates import GateFailure, GateResult
from weave_backend.generation.service import (
    BriefNotFoundError,
    GenerationContext,
    GenerationDeps,
    ProjectNotFoundError,
    generate_app,
)
from weave_backend.projects.model import Project
from weave_backend.repo_bootstrap.store import ProjectRepoRow

_MODULE = "weave_backend.generation.service"


def _project() -> Project:
    return Project(
        project_iri="urn:weave:project:t1:acme",
        name="Acme",
        pinned_graph_version_iri="urn:weave:graph:t1:v1",
        created_at=datetime.now(UTC),
    )


def _brief() -> StoredBrief:
    return StoredBrief(
        task_id="task-1",
        brief_iri="urn:weave:brief:task-1",
        schema_version="1.0",
        content={"title": "Widget list"},
        created_at=datetime.now(UTC),
    )


def _repo_row() -> ProjectRepoRow:
    return ProjectRepoRow(
        name="Acme",
        source_control_provider="github",
        source_control_token_secret_ref="weave/tenant/scm-project/github-token",
        repo_provider="github",
        repo_url="https://github.com/acme/weave-acme",
        repo_default_branch="main",
        repo_id="acme/weave-acme",
    )


class _FakeDriver:
    def __init__(self) -> None:
        self.create_repo = AsyncMock()
        self.write_initial_commit = AsyncMock()
        self.commit_workspace = AsyncMock(return_value="sha-123")


class _FakeCeClient:
    """Records every path `.get()` is called with (AC-8 guard)."""

    def __init__(self) -> None:
        self.paths: list[str] = []

    async def get(self, path: str) -> Any:
        self.paths.append(path)

        class _Response:
            def raise_for_status(self) -> None:
                return None

            def json(self) -> dict[str, object]:
                return {"entity_kinds": ["widget"]}

        return _Response()


def _ctx(ce_client: Any = None) -> GenerationContext:
    return GenerationContext(
        tenant_id="t1",
        project_iri="urn:weave:project:t1:acme",
        task_id="task-1",
        ce_client=cast(Any, ce_client or _FakeCeClient()),
    )


def _deps(*, driver: _FakeDriver | None = None, workspaces: list[str] | None = None) -> tuple[
    GenerationDeps, list[dict[str, object]]
]:
    emitted: list[dict[str, object]] = []
    driver = driver or _FakeDriver()

    async def fake_generate_workspace(
        *, prompt: str, output_dir: str, bpmo: dict[str, Any]
    ) -> None:
        del prompt, bpmo
        if workspaces is not None:
            workspaces.append(output_dir)
        Path(output_dir, "openapi.yaml").write_text("openapi: 3.1.0\n")

    async def fake_emit_audit(_conn: Any, event: Any) -> None:
        emitted.append({"event_type": event.event_type, "payload": event.payload})

    async def fake_get_secret(_ref: str) -> str:
        return "tok-1"

    deps = GenerationDeps(
        generate_workspace_fn=fake_generate_workspace,
        driver_for=lambda _provider: driver,
        get_secret=fake_get_secret,
        emit_audit=fake_emit_audit,
    )
    return deps, emitted


async def test_generate_app_raises_project_not_found_when_project_missing() -> None:
    with (
        patch(f"{_MODULE}.get_project", AsyncMock(return_value=None)),
        pytest.raises(ProjectNotFoundError),
    ):
        await generate_app(AsyncMock(), _ctx(), _deps()[0])


async def test_generate_app_raises_brief_not_found_when_brief_missing() -> None:
    with (
        patch(f"{_MODULE}.get_project", AsyncMock(return_value=_project())),
        patch(f"{_MODULE}.get_task_brief", AsyncMock(return_value=None)),
        pytest.raises(BriefNotFoundError),
    ):
        await generate_app(AsyncMock(), _ctx(), _deps()[0])


async def test_generate_app_propagates_ce_read_unavailable() -> None:
    """AC-1: CE-READ-1 grounding failure halts generation before any
    workspace is created -- `CeReadUnavailable` propagates uncaught for the
    router to map to 503.
    """
    with (
        patch(f"{_MODULE}.get_project", AsyncMock(return_value=_project())),
        patch(f"{_MODULE}.get_task_brief", AsyncMock(return_value=_brief())),
        patch(f"{_MODULE}.get_bpmo_context", AsyncMock(side_effect=CeReadUnavailable("down"))),
        pytest.raises(CeReadUnavailable),
    ):
        await generate_app(AsyncMock(), _ctx(), _deps()[0])


async def test_generate_app_commits_and_returns_gates_passed_on_all_pass() -> None:
    deps, emitted = _deps()
    gate_pipeline = (lambda _workspace: GateResult(gate="secret_scan"),)
    with (
        patch(f"{_MODULE}.get_project", AsyncMock(return_value=_project())),
        patch(f"{_MODULE}.get_task_brief", AsyncMock(return_value=_brief())),
        patch(f"{_MODULE}.get_bpmo_context", AsyncMock(return_value={"entity_kinds": ["widget"]})),
        patch(f"{_MODULE}.fetch_project_repo_row", AsyncMock(return_value=_repo_row())),
        patch(f"{_MODULE}.GATE_PIPELINE", gate_pipeline),
        patch(f"{_MODULE}.insert_generation_run", AsyncMock()),
    ):
        outcome = await generate_app(AsyncMock(), _ctx(), deps)

    assert outcome == {
        "commit_sha": "sha-123",
        "branch": "build/acme/task-1",
        "gates_passed": [{"gate": "secret_scan", "status": "PASS"}],
    }
    assert any(event["event_type"] == "generation_complete" for event in emitted)


async def test_generate_app_cleans_up_workspace_on_gate_failure() -> None:
    workspaces: list[str] = []
    deps, emitted = _deps(workspaces=workspaces)

    def failing_gate(_workspace: str) -> GateResult:
        raise GateFailure("sast_fail", evidence="boom")

    with (
        patch(f"{_MODULE}.get_project", AsyncMock(return_value=_project())),
        patch(f"{_MODULE}.get_task_brief", AsyncMock(return_value=_brief())),
        patch(f"{_MODULE}.get_bpmo_context", AsyncMock(return_value={"entity_kinds": ["widget"]})),
        patch(f"{_MODULE}.fetch_project_repo_row", AsyncMock(return_value=_repo_row())),
        patch(f"{_MODULE}.GATE_PIPELINE", (failing_gate,)),pytest.raises(GateFailure)
    ):
        await generate_app(AsyncMock(), _ctx(), deps)

    assert workspaces, "generate_workspace_fn was never invoked"
    assert not Path(workspaces[0]).exists()
    assert emitted == []  # only secret_scan_fail emits; sast_fail does not


async def test_generate_app_emits_secret_scan_fail_audit_on_secret_scan_gate_failure() -> None:
    deps, emitted = _deps()

    def failing_gate(_workspace: str) -> GateResult:
        raise GateFailure("secret_scan_fail", hits=[{"file": "a.py", "line": 1}])

    with (
        patch(f"{_MODULE}.get_project", AsyncMock(return_value=_project())),
        patch(f"{_MODULE}.get_task_brief", AsyncMock(return_value=_brief())),
        patch(f"{_MODULE}.get_bpmo_context", AsyncMock(return_value={"entity_kinds": ["widget"]})),
        patch(f"{_MODULE}.fetch_project_repo_row", AsyncMock(return_value=_repo_row())),
        patch(f"{_MODULE}.GATE_PIPELINE", (failing_gate,)),pytest.raises(GateFailure)
    ):
        await generate_app(AsyncMock(), _ctx(), deps)

    assert len(emitted) == 1
    assert emitted[0]["event_type"] == "secret_scan_fail"


async def test_generate_app_never_calls_ce_brand_tokens_endpoint() -> None:
    """AC-7/AC-8: the M1 gate pipeline never queries CE-BRAND-1 -- an
    explicit, intentionally-preserved guard (task brief's implementation
    hint), not merely an absence-of-evidence check.
    """
    ce_client = _FakeCeClient()
    deps, _ = _deps()
    gate_pipeline = (lambda _workspace: GateResult(gate="secret_scan"),)
    with (
        patch(f"{_MODULE}.get_project", AsyncMock(return_value=_project())),
        patch(f"{_MODULE}.get_task_brief", AsyncMock(return_value=_brief())),
        patch(f"{_MODULE}.fetch_project_repo_row", AsyncMock(return_value=_repo_row())),
        patch(f"{_MODULE}.GATE_PIPELINE", gate_pipeline),
        patch(f"{_MODULE}.insert_generation_run", AsyncMock()),
    ):
        await generate_app(AsyncMock(), _ctx(ce_client), deps)

    assert "/api/brand/tokens" not in ce_client.paths
