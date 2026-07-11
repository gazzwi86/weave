"""BE-TASK-008 (build-engine EPIC-008) + TASK-002 (E8-S1) unit tests for
`generate_app`'s orchestration logic -- 404s, CE-READ-1 grounding (AC-1),
atomic gate pipeline (AC-3), the secret-scan audit event (AC-4), workspace
cleanup, and the CE-BRAND-1 conformance gate registered 6th (TASK-002
AC-1/AC-4/AC-5). `get_project`/`get_task_brief`/`fetch_project_repo_row` are
patched directly (same domain-function-patching pattern as
`test_tasks_router.py`) so this test needs no real Postgres connection --
end-to-end proof against real Postgres/LocalStack lives in
`tests/integration/test_generation_api.py`.

TASK-008's original `test_generate_app_never_calls_ce_brand_tokens_endpoint`
(the "AC-8 guard") is deleted here: TASK-002's entire purpose is to make the
pipeline call CE-BRAND-1, which directly inverts that M1-only invariant.
"""

from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast
from unittest.mock import AsyncMock, patch

import httpx
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
from weave_backend.pm.bindings import Binding
from weave_backend.projects.model import Project
from weave_backend.repo_bootstrap.drivers import RepoHandle
from weave_backend.repo_bootstrap.store import ProjectRepoRow
from weave_backend.standards.models import StandardRecord

_MODULE = "weave_backend.generation.service"


def _standard(key: str, stack_pins: dict[str, str] | None = None) -> StandardRecord:
    return StandardRecord(
        standard_id="s-1",
        tenant_id="t1",
        scope="company",
        project_id=None,
        standard_key=key,
        title=key,
        body_md=f"body for {key}",
        stack_pins=stack_pins,
        policy_iri="urn:weave:policy:t1:p1",
        status="active",
        created_by="u1",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


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
        self.apply_branch_protection = AsyncMock()
        self.commit_files = AsyncMock(return_value="sha-123")
        self.read_file = AsyncMock(return_value=None)


class _Response:
    """`httpx.Response`-shaped stand-in -- `body` defaults to the CE-READ-1
    grounding shape; brand-gate paths get a passing-by-default body (empty
    VoiceRules -> AC-6's "zero normal rules -> score 1.0" edge) so existing
    non-brand tests don't need to know about the 6th gate.
    """

    def __init__(self, body: object) -> None:
        self._body = body

    def raise_for_status(self) -> None:
        return None

    def json(self) -> object:
        return self._body


class _FakeCeClient:
    """Records every path `.get()` is called with -- TASK-002 brand-gate
    calls (`/api/brand/tokens`, `/api/brand/voice-rules`) are dispatched
    alongside the pre-existing CE-READ-1 grounding shape.
    """

    def __init__(self) -> None:
        self.paths: list[str] = []

    async def get(self, path: str) -> _Response:
        self.paths.append(path)
        if path == "/api/brand/tokens":
            return _Response({})
        if path == "/api/brand/voice-rules":
            return _Response([])
        return _Response({"entity_kinds": ["widget"]})


def _ctx(ce_client: Any = None) -> GenerationContext:
    return GenerationContext(
        tenant_id="t1",
        project_iri="urn:weave:project:t1:acme",
        task_id="task-1",
        ce_client=cast(Any, ce_client or _FakeCeClient()),
    )


def _deps(
    *,
    driver: _FakeDriver | None = None,
    workspaces: list[str] | None = None,
    brand_records: list[dict[str, object]] | None = None,
    calls: list[dict[str, Any]] | None = None,
) -> tuple[GenerationDeps, list[dict[str, object]]]:
    emitted: list[dict[str, object]] = []
    driver = driver or _FakeDriver()

    async def fake_generate_workspace(
        *, prompt: str, output_dir: str, bpmo: dict[str, Any]
    ) -> None:
        if calls is not None:
            calls.append({"prompt": prompt, "bpmo": bpmo})
        if workspaces is not None:
            workspaces.append(output_dir)
        Path(output_dir, "openapi.yaml").write_text("openapi: 3.1.0\n")

    async def fake_emit_audit(_conn: Any, event: Any) -> None:
        emitted.append({"event_type": event.event_type, "payload": event.payload})

    async def fake_get_secret(_ref: str) -> str:
        return "tok-1"

    async def fake_record_brand_gate(
        tenant_id: str, ctx: Any, status: str, payload: dict[str, object]
    ) -> None:
        if brand_records is not None:
            brand_records.append({"tenant_id": tenant_id, "status": status, **payload})

    deps = GenerationDeps(
        generate_workspace_fn=fake_generate_workspace,
        driver_for=lambda _provider: driver,
        get_secret=fake_get_secret,
        emit_audit=fake_emit_audit,
        record_brand_gate=fake_record_brand_gate,
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
        patch(f"{_MODULE}.load_effective_standards", AsyncMock(return_value=([], []))),
        patch(f"{_MODULE}.GATE_PIPELINE", gate_pipeline),
        patch(f"{_MODULE}.insert_generation_run", AsyncMock()),
    ):
        outcome = await generate_app(AsyncMock(), _ctx(), deps)

    assert outcome == {
        "commit_sha": "sha-123",
        "branch": "build/acme/task-1",
        "gates_passed": [
            {"gate": "secret_scan", "status": "PASS"},
            {"gate": "brand", "status": "PASS", "score": 1.0},
        ],
    }
    assert any(event["event_type"] == "generation_complete" for event in emitted)


async def test_generate_app_commits_anatomy_index_in_same_commit_set() -> None:
    """FR-031/AC-1: `ANATOMY.md` + `docs/wiki/` land in the workspace before
    it's committed -- same commit set as the generated app, not a follow-up.
    """
    committed_paths: list[str] = []

    async def _capture_commit_workspace(
        _repo: RepoHandle, *, workspace: str, branch: str, message: str, token: str
    ) -> str:
        del branch, message, token
        committed_paths.extend(str(p) for p in Path(workspace).rglob("*") if p.is_file())
        return "sha-123"

    driver = _FakeDriver()
    driver.commit_workspace = AsyncMock(side_effect=_capture_commit_workspace)
    deps, _ = _deps(driver=driver)
    original_generate = deps.generate_workspace_fn

    async def _generate_with_source_file(*, prompt: str, output_dir: str, bpmo: Any) -> None:
        await original_generate(prompt=prompt, output_dir=output_dir, bpmo=bpmo)
        Path(output_dir, "backend", "app.py").parent.mkdir(parents=True, exist_ok=True)
        Path(output_dir, "backend", "app.py").write_text("def handler():\n    pass\n")

    deps = replace(deps, generate_workspace_fn=_generate_with_source_file)
    gate_pipeline = (lambda _workspace: GateResult(gate="secret_scan"),)
    with (
        patch(f"{_MODULE}.get_project", AsyncMock(return_value=_project())),
        patch(f"{_MODULE}.get_task_brief", AsyncMock(return_value=_brief())),
        patch(f"{_MODULE}.fetch_project_repo_row", AsyncMock(return_value=_repo_row())),
        patch(f"{_MODULE}.GATE_PIPELINE", gate_pipeline),
        patch(f"{_MODULE}.insert_generation_run", AsyncMock()),
    ):
        await generate_app(AsyncMock(), _ctx(), deps)

    assert any(p.endswith("ANATOMY.md") for p in committed_paths)
    assert any("docs/wiki" in p for p in committed_paths)


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
        patch(f"{_MODULE}.load_effective_standards", AsyncMock(return_value=([], []))),
        patch(f"{_MODULE}.GATE_PIPELINE", (failing_gate,)),
        pytest.raises(GateFailure),
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
        patch(f"{_MODULE}.load_effective_standards", AsyncMock(return_value=([], []))),
        patch(f"{_MODULE}.GATE_PIPELINE", (failing_gate,)),
        pytest.raises(GateFailure),
    ):
        await generate_app(AsyncMock(), _ctx(), deps)

    assert len(emitted) == 1
    assert emitted[0]["event_type"] == "secret_scan_fail"


async def test_generate_app_runs_brand_gate_sixth_and_records_score_row() -> None:
    """AC-1: TASK-002 supersedes TASK-008's M1-only "never calls CE-BRAND-1"
    guard (deleted) -- the brand gate is now the 6th step, queries both
    CE-BRAND-1 endpoints, and records a gate_results row via
    `deps.record_brand_gate`.
    """
    ce_client = _FakeCeClient()
    brand_records: list[dict[str, object]] = []
    deps, _ = _deps(brand_records=brand_records)
    gate_pipeline = (lambda _workspace: GateResult(gate="secret_scan"),)
    with (
        patch(f"{_MODULE}.get_project", AsyncMock(return_value=_project())),
        patch(f"{_MODULE}.get_task_brief", AsyncMock(return_value=_brief())),
        patch(f"{_MODULE}.fetch_project_repo_row", AsyncMock(return_value=_repo_row())),
        patch(f"{_MODULE}.load_effective_standards", AsyncMock(return_value=([], []))),
        patch(f"{_MODULE}.GATE_PIPELINE", gate_pipeline),
        patch(f"{_MODULE}.insert_generation_run", AsyncMock()),
    ):
        outcome = await generate_app(AsyncMock(), _ctx(ce_client), deps)

    assert "/api/brand/tokens" in ce_client.paths
    assert "/api/brand/voice-rules" in ce_client.paths
    gates_passed = cast("list[dict[str, object]]", outcome["gates_passed"])
    assert gates_passed[-1] == {"gate": "brand", "status": "PASS", "score": 1.0}
    assert brand_records == [
        {
            "tenant_id": "t1",
            "status": "passed",
            "score": 1.0,
            "critical_failures": [],
            "rules_evaluated": 0,
        }
    ]


async def test_generate_app_fails_closed_when_ce_brand_unreachable() -> None:
    """AC-5: CE-BRAND-1 unreachable -> the gate is recorded `not_verified`
    and fails closed (never passes on an unevaluable result).
    """

    class _DownCeClient(_FakeCeClient):
        async def get(self, path: str) -> _Response:
            self.paths.append(path)
            if path == "/api/brand/tokens":
                raise httpx.ConnectError("connection refused")
            return await super().get(path)

    ce_client = _DownCeClient()
    brand_records: list[dict[str, object]] = []
    workspaces: list[str] = []
    deps, _ = _deps(workspaces=workspaces, brand_records=brand_records)
    gate_pipeline = (lambda _workspace: GateResult(gate="secret_scan"),)
    with (
        patch(f"{_MODULE}.get_project", AsyncMock(return_value=_project())),
        patch(f"{_MODULE}.get_task_brief", AsyncMock(return_value=_brief())),
        patch(f"{_MODULE}.fetch_project_repo_row", AsyncMock(return_value=_repo_row())),
        patch(f"{_MODULE}.GATE_PIPELINE", gate_pipeline),
        pytest.raises(GateFailure) as excinfo,
    ):
        await generate_app(AsyncMock(), _ctx(ce_client), deps)

    assert excinfo.value.evidence["reason"] == "ce_unavailable"
    assert not Path(workspaces[0]).exists()
    assert brand_records == [
        {"tenant_id": "t1", "status": "failed", "reason": "ce_unavailable", "not_verified": True}
    ]


async def test_generate_app_fails_closed_when_voice_rules_endpoint_5xxs_after_tokens_ok() -> None:
    """AC-5 edge case (QA): the existing fail-closed test only exercises a
    connection-refused on the FIRST call (`/api/brand/tokens`). This proves
    the same fail-closed behaviour holds when `/api/brand/tokens` succeeds
    but the SECOND call (`/api/brand/voice-rules`) 5xxs -- `raise_for_status`
    raises `httpx.HTTPStatusError`, a subclass of `httpx.HTTPError`, so it
    must hit the same `except httpx.HTTPError` fail-closed path (AC-5), not
    slip through as an unhandled exception or a false pass. Also pins AC-4's
    "nothing commits" at the DB-write level (`insert_generation_run`), not
    just the git-commit level the existing test checks.
    """

    class _Response5xx(_Response):
        def raise_for_status(self) -> None:
            request = httpx.Request("GET", "https://ce.test")
            raise httpx.HTTPStatusError(
                "server error",
                request=request,
                response=httpx.Response(503, request=request),
            )

    class _VoiceRules5xxCeClient(_FakeCeClient):
        async def get(self, path: str) -> _Response:
            self.paths.append(path)
            if path == "/api/brand/voice-rules":
                return _Response5xx([])
            return await super().get(path)

    ce_client = _VoiceRules5xxCeClient()
    brand_records: list[dict[str, object]] = []
    workspaces: list[str] = []
    deps, _ = _deps(workspaces=workspaces, brand_records=brand_records)
    gate_pipeline = (lambda _workspace: GateResult(gate="secret_scan"),)
    with (
        patch(f"{_MODULE}.get_project", AsyncMock(return_value=_project())),
        patch(f"{_MODULE}.get_task_brief", AsyncMock(return_value=_brief())),
        patch(f"{_MODULE}.fetch_project_repo_row", AsyncMock(return_value=_repo_row())),
        patch(f"{_MODULE}.GATE_PIPELINE", gate_pipeline),
        patch(f"{_MODULE}.insert_generation_run", AsyncMock()) as insert_run,
        pytest.raises(GateFailure) as excinfo,
    ):
        await generate_app(AsyncMock(), _ctx(ce_client), deps)

    assert excinfo.value.evidence["reason"] == "ce_unavailable"
    assert "/api/brand/tokens" in ce_client.paths
    assert "/api/brand/voice-rules" in ce_client.paths
    assert not Path(workspaces[0]).exists()
    assert brand_records == [
        {"tenant_id": "t1", "status": "failed", "reason": "ce_unavailable", "not_verified": True}
    ]
    insert_run.assert_not_awaited()  # AC-4: no generation_runs write on gate failure


async def test_generate_app_commits_nothing_when_brand_gate_fails_after_five_passes() -> None:
    """AC-4: a brand-gate failure after all 5 M1 gates pass still commits
    nothing -- atomicity of the six-gate set matches the M1 five-gate
    behaviour.
    """

    class _CriticalFailCeClient(_FakeCeClient):
        async def get(self, path: str) -> _Response:
            self.paths.append(path)
            if path == "/api/brand/voice-rules":
                return _Response(
                    [{"id": "voice-1", "severity": "critical", "assertion": {"kind": "unknown"}}]
                )
            return await super().get(path)

    ce_client = _CriticalFailCeClient()
    workspaces: list[str] = []
    deps, _ = _deps(workspaces=workspaces)
    gate_pipeline = (lambda _workspace: GateResult(gate="secret_scan"),)
    with (
        patch(f"{_MODULE}.get_project", AsyncMock(return_value=_project())),
        patch(f"{_MODULE}.get_task_brief", AsyncMock(return_value=_brief())),
        patch(f"{_MODULE}.fetch_project_repo_row", AsyncMock(return_value=_repo_row())),
        patch(f"{_MODULE}.GATE_PIPELINE", gate_pipeline),
        pytest.raises(GateFailure) as excinfo,
    ):
        await generate_app(AsyncMock(), _ctx(ce_client), deps)

    assert excinfo.value.evidence["critical_failures"] == ["voice-1"]
    assert deps.driver_for("github").commit_workspace.await_count == 0  # type: ignore[attr-defined]
    assert workspaces, "generate_workspace_fn was never invoked"
    assert not Path(workspaces[0]).exists()


async def test_generate_app_falls_back_to_demo_default_and_warns_when_standards_missing(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """AC-4: empty catalogue never halts generation -- it proceeds with the
    M1 demo-default stack and logs a `standards_missing` run-log warning.
    """
    calls: list[dict[str, Any]] = []
    deps, _ = _deps(calls=calls)
    gate_pipeline = (lambda _workspace: GateResult(gate="secret_scan"),)
    with (
        patch(f"{_MODULE}.get_project", AsyncMock(return_value=_project())),
        patch(f"{_MODULE}.get_task_brief", AsyncMock(return_value=_brief())),
        patch(f"{_MODULE}.get_bpmo_context", AsyncMock(return_value={"entity_kinds": ["widget"]})),
        patch(f"{_MODULE}.fetch_project_repo_row", AsyncMock(return_value=_repo_row())),
        patch(f"{_MODULE}.load_effective_standards", AsyncMock(return_value=([], []))),
        patch(f"{_MODULE}.GATE_PIPELINE", gate_pipeline),
        patch(f"{_MODULE}.insert_generation_run", AsyncMock()),
        caplog.at_level("WARNING"),
    ):
        outcome = await generate_app(AsyncMock(), _ctx(), deps)

    assert outcome["gates_passed"] == [
        {"gate": "secret_scan", "status": "PASS"},
        {"gate": "brand", "status": "PASS", "score": 1.0},
    ]
    assert "standards_missing" in caplog.text
    assert calls[0]["bpmo"]["stack_pins"] is None


async def test_generate_app_injects_stack_pins_into_generation_context(
) -> None:
    """AC-5: a non-empty effective set is folded into the generation
    context and keys stack selection off `stack_pins`.
    """
    calls: list[dict[str, Any]] = []
    deps, _ = _deps(calls=calls)
    gate_pipeline = (lambda _workspace: GateResult(gate="secret_scan"),)
    standards = [_standard("frontend_framework", {"frontend": "nextjs"})]
    with (
        patch(f"{_MODULE}.get_project", AsyncMock(return_value=_project())),
        patch(f"{_MODULE}.get_task_brief", AsyncMock(return_value=_brief())),
        patch(f"{_MODULE}.get_bpmo_context", AsyncMock(return_value={"entity_kinds": ["widget"]})),
        patch(f"{_MODULE}.fetch_project_repo_row", AsyncMock(return_value=_repo_row())),
        patch(f"{_MODULE}.load_effective_standards", AsyncMock(return_value=(standards, []))),
        patch(f"{_MODULE}.GATE_PIPELINE", gate_pipeline),
        patch(f"{_MODULE}.insert_generation_run", AsyncMock()),
    ):
        await generate_app(AsyncMock(), _ctx(), deps)

    assert calls[0]["bpmo"]["stack_pins"] == {"frontend": "nextjs"}
    assert "frontend_framework" in calls[0]["prompt"]


async def test_generate_app_exposes_external_bindings_in_run_context() -> None:
    """AC-6 (TASK-022): the project's bound external spaces (system + refs,
    never credentials) are folded into the bpmo run context so agents know
    *where* to target -- delivery itself stays Platform-owned.
    """
    calls: list[dict[str, Any]] = []
    deps, _ = _deps(calls=calls)
    gate_pipeline = (lambda _workspace: GateResult(gate="secret_scan"),)
    binding = Binding(
        binding_id="b-1",
        project_iri="urn:weave:project:t1:acme",
        system="jira",
        connector_ref="jira-1",
        space_ref="ACME",
        created_by="urn:weave:principal:user:admin-1",
        created_at=datetime(2026, 7, 1, tzinfo=UTC),
    )
    with (
        patch(f"{_MODULE}.get_project", AsyncMock(return_value=_project())),
        patch(f"{_MODULE}.get_task_brief", AsyncMock(return_value=_brief())),
        patch(f"{_MODULE}.get_bpmo_context", AsyncMock(return_value={"entity_kinds": ["widget"]})),
        patch(f"{_MODULE}.fetch_project_repo_row", AsyncMock(return_value=_repo_row())),
        patch(f"{_MODULE}.load_effective_standards", AsyncMock(return_value=([], []))),
        patch(f"{_MODULE}.get_bindings", AsyncMock(return_value=[binding])),
        patch(f"{_MODULE}.GATE_PIPELINE", gate_pipeline),
        patch(f"{_MODULE}.insert_generation_run", AsyncMock()),
    ):
        await generate_app(AsyncMock(), _ctx(), deps)

    assert calls[0]["bpmo"]["external_bindings"] == [
        {"system": "jira", "space_ref": "ACME", "connector_ref": "jira-1"}
    ]


async def test_generate_app_external_bindings_empty_when_none_bound() -> None:
    """No bindings is a normal state, not an error -- an empty list, not a
    missing key or an exception.
    """
    calls: list[dict[str, Any]] = []
    deps, _ = _deps(calls=calls)
    gate_pipeline = (lambda _workspace: GateResult(gate="secret_scan"),)
    with (
        patch(f"{_MODULE}.get_project", AsyncMock(return_value=_project())),
        patch(f"{_MODULE}.get_task_brief", AsyncMock(return_value=_brief())),
        patch(f"{_MODULE}.get_bpmo_context", AsyncMock(return_value={"entity_kinds": ["widget"]})),
        patch(f"{_MODULE}.fetch_project_repo_row", AsyncMock(return_value=_repo_row())),
        patch(f"{_MODULE}.load_effective_standards", AsyncMock(return_value=([], []))),
        patch(f"{_MODULE}.get_bindings", AsyncMock(return_value=[])),
        patch(f"{_MODULE}.GATE_PIPELINE", gate_pipeline),
        patch(f"{_MODULE}.insert_generation_run", AsyncMock()),
    ):
        await generate_app(AsyncMock(), _ctx(), deps)

    assert calls[0]["bpmo"]["external_bindings"] == []


async def test_generate_app_falls_back_to_demo_default_for_conflicting_stack_pin_axis(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Implementation hint: cross-key `stack_pins` conflicts never resolve
    via last-write-wins -- the conflicting axis falls back to demo-default
    and is logged as a finding, while a non-conflicting axis still resolves
    and generation still proceeds (never halts).
    """
    calls: list[dict[str, Any]] = []
    deps, _ = _deps(calls=calls)
    gate_pipeline = (lambda _workspace: GateResult(gate="secret_scan"),)
    standards = [
        _standard("a_backend", {"backend": "fastapi", "auth": "cognito"}),
        _standard("b_backend", {"backend": "django"}),
    ]
    with (
        patch(f"{_MODULE}.get_project", AsyncMock(return_value=_project())),
        patch(f"{_MODULE}.get_task_brief", AsyncMock(return_value=_brief())),
        patch(f"{_MODULE}.get_bpmo_context", AsyncMock(return_value={"entity_kinds": ["widget"]})),
        patch(f"{_MODULE}.fetch_project_repo_row", AsyncMock(return_value=_repo_row())),
        patch(f"{_MODULE}.load_effective_standards", AsyncMock(return_value=(standards, []))),
        patch(f"{_MODULE}.GATE_PIPELINE", gate_pipeline),
        patch(f"{_MODULE}.insert_generation_run", AsyncMock()),
        caplog.at_level("WARNING"),
    ):
        outcome = await generate_app(AsyncMock(), _ctx(), deps)

    assert outcome["gates_passed"] == [
        {"gate": "secret_scan", "status": "PASS"},
        {"gate": "brand", "status": "PASS", "score": 1.0},
    ]
    assert calls[0]["bpmo"]["stack_pins"] == {"auth": "cognito"}
    assert "standards_conflict" in caplog.text
    assert "backend" in caplog.text
