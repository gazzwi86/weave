"""BE-V1-TASK-005 (BE-SDK-1 delivery, E8-S5/FR-059) unit tests --
`generation.sdk_trigger` orchestration against fake connections/deps (same
`_FakeConnection`/`_FakeDriver`/`_deps()` pattern as `test_rich_scaffold.py`).
The full end-to-end proof (real Postgres, CE-DIFF-1 stub, HITL ack, SCM
stub) lives in `tests/integration/test_sdk_generation_api.py` (docker-marked).
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any

import pytest

from weave_backend.projects.model import Project
from weave_backend.repo_bootstrap.drivers import RepoHandle
from weave_backend.repo_bootstrap.service import RepoBootstrapDeps
from weave_backend.sdkgen.ir import CeVersionPin, IRTheme, SdkModel
from weave_backend.sdkgen.pipeline import GeneratedSdk

_TENANT = "t1"
_PROJECT_IRI = "urn:weave:project:t1:acme"


class _FakeRow(dict[str, Any]):
    """dict subclass -- stands in for an asyncpg.Record."""


def _project(
    *, last_sdk_version_iri: str | None = None, pinned: str = "urn:weave:ce:v1"
) -> Project:
    return Project(
        project_iri=_PROJECT_IRI,
        name="Acme",
        pinned_graph_version_iri=pinned,
        created_at=datetime.now(),
        last_sdk_version_iri=last_sdk_version_iri,
        sdk_generation_count=2,
    )


class _FakeTriggerConn:
    """Backs `trigger_sdk_generation`'s two queries -- the `FOR UPDATE` lock
    read and the insert. `existing_run` controls the lock read's result.
    """

    def __init__(self, *, existing_run: dict[str, Any] | None = None) -> None:
        self.existing_run = existing_run
        self.executed: list[tuple[str, tuple[Any, ...]]] = []

    async def fetchrow(self, query: str, *args: Any) -> _FakeRow | None:
        if "FOR UPDATE" in query:
            return _FakeRow(self.existing_run) if self.existing_run is not None else None
        if "INSERT INTO generation_runs" in query:
            return _FakeRow(
                {"run_id": "gen-new", "project_iri": args[1], "status": "queued", "payload": "{}"}
            )
        raise AssertionError(f"unexpected fetchrow: {query}")

    async def execute(self, query: str, *args: Any) -> None:
        self.executed.append((query, args))


async def test_should_return_422_when_project_has_no_pinned_version() -> None:
    """AC-1's 422 precondition -- checked before any DB read, so the fake
    conn never needs its `fetchrow` to be reachable for this path."""
    from weave_backend.generation.sdk_trigger import (
        ProjectHasNoPinnedVersion,
        trigger_sdk_generation,
    )

    conn = _FakeTriggerConn()
    project = _project(pinned="")

    with pytest.raises(ProjectHasNoPinnedVersion):
        await trigger_sdk_generation(conn, project=project, tenant_id=_TENANT)


async def test_should_return_409_when_generation_already_in_flight() -> None:
    from weave_backend.generation.sdk_trigger import SdkGenerationInFlight, trigger_sdk_generation

    conn = _FakeTriggerConn(
        existing_run={
            "run_id": "gen-1",
            "project_iri": _PROJECT_IRI,
            "status": "running",
            "payload": "{}",
        }
    )
    project = _project()

    with pytest.raises(SdkGenerationInFlight):
        await trigger_sdk_generation(conn, project=project, tenant_id=_TENANT)


async def test_should_skip_breaking_check_on_first_generation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AC-4: no `last_sdk_version_iri` -> CE-DIFF-1 is never called, and the
    pipeline proceeds straight to `_generate_and_commit`."""
    from weave_backend.generation import sdk_trigger

    project = _project(last_sdk_version_iri=None)

    async def fake_get_project(_conn: Any, *, tenant_id: str, project_iri: str) -> Project:
        return project

    async def fail_if_called(*_args: Any, **_kwargs: Any) -> Any:
        raise AssertionError("CE-DIFF-1 must not be called on a project's first generation")

    calls: list[str] = []

    async def fake_generate_and_commit(**kwargs: Any) -> None:
        calls.append(kwargs["run_id"])

    class _RunConn:
        async def execute(self, *_args: Any) -> None:
            return None

        async def fetchrow(self, *_args: Any) -> None:
            return None

    monkeypatch.setattr(sdk_trigger, "get_project", fake_get_project)
    monkeypatch.setattr(sdk_trigger, "get_ontology_diff", fail_if_called)
    monkeypatch.setattr(sdk_trigger, "_generate_and_commit", fake_generate_and_commit)
    monkeypatch.setattr(sdk_trigger, "tenant_connection", lambda _tenant_id: _AsyncCM(_RunConn()))

    await sdk_trigger.run_sdk_generation(
        tenant_id=_TENANT, run_id="gen-1", project_iri=_PROJECT_IRI
    )

    assert calls == ["gen-1"]


class _AsyncCM:
    def __init__(self, value: Any) -> None:
        self._value = value

    async def __aenter__(self) -> Any:
        return self._value

    async def __aexit__(self, *_exc: object) -> None:
        return None


class _FakeDriver:
    """Full `ScmDriver` stub -- only `commit_workspace` is exercised by SDK
    generation, the rest assert-fail if ever reached (extracted to module
    scope so the test function itself stays under the complexity budget).
    """

    def __init__(self, commits: list[dict[str, Any]]) -> None:
        self._commits = commits

    async def create_repo(self, *, name: str, private: bool, token: str) -> RepoHandle:
        raise AssertionError("SDK generation never creates a repo")

    async def write_initial_commit(
        self, repo: RepoHandle, *, boilerplate: dict[str, str], token: str
    ) -> None:
        raise AssertionError("SDK generation never writes an initial commit")

    async def commit_workspace(
        self, repo: RepoHandle, *, workspace: str, branch: str, message: str, token: str
    ) -> str:
        self._commits.append({"message": message, "workspace": workspace})
        return "sha-fake"

    async def apply_branch_protection(self, repo: RepoHandle, *, token: str) -> None:
        raise AssertionError("SDK generation never touches branch protection")

    async def commit_files(
        self, repo: RepoHandle, *, files: dict[str, str], message: str, token: str
    ) -> str:
        raise AssertionError("SDK generation always commits a whole workspace")

    async def read_file(self, repo: RepoHandle, *, path: str, token: str) -> str | None:
        raise AssertionError("SDK generation never reads a file back")


async def test_should_compute_package_version_from_generation_count(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """AC-5: `{ce_version_tag}+build.{n}` -- project's `sdk_generation_count`
    is 2 going in, so the third build is `v1+build.3`."""
    from weave_backend.generation import sdk_commit, sdk_trigger

    project = _project()
    staging = tmp_path / "staging"
    staging.mkdir()
    (staging / "index.ts").write_text("export const x = 1;\n")
    theme = IRTheme(color={}, typography={}, spacing={}, radius={}, extensions={})
    generated = GeneratedSdk(
        staging=staging,
        ir=SdkModel(
            classes=[], functions=[], queries=[], theme=theme,
            pin=CeVersionPin(version_iri="urn:weave:ce:v1"),
        ),
    )

    commits: list[dict[str, Any]] = []

    class _RunConn:
        def __init__(self) -> None:
            self.executed: list[tuple[str, tuple[Any, ...]]] = []

        async def fetchrow(self, query: str, *args: Any) -> _FakeRow:
            return _FakeRow(
                {
                    "repo_provider": "github",
                    "repo_url": "https://scm/acme/repo",
                    "repo_default_branch": "main",
                    "repo_id": "acme/weave-acme",
                    "source_control_token_secret_ref": "weave/tenant/scm/github-token",
                }
            )

        async def execute(self, query: str, *args: Any) -> None:
            self.executed.append((query, args))

    conn = _RunConn()

    async def fake_get_secret(_ref: str) -> str | None:
        return "tok-1"

    deps = RepoBootstrapDeps(
        get_secret=fake_get_secret,
        driver_for=lambda _p: _FakeDriver(commits),
        emit_audit=_noop_emit_audit,
    )

    status_updates: list[dict[str, Any]] = []

    async def fake_update_sdk_run_status(_conn: Any, **kwargs: Any) -> None:
        status_updates.append(kwargs)

    monkeypatch.setattr(sdk_commit, "generate_sdk", lambda _pin: generated)
    monkeypatch.setattr(sdk_commit, "update_sdk_run_status", fake_update_sdk_run_status)
    monkeypatch.setattr(sdk_commit, "tenant_connection", lambda _tenant_id: _AsyncCM(conn))

    await sdk_trigger._generate_and_commit(
        tenant_id=_TENANT,
        run_id="gen-1",
        project=project,
        pin=CeVersionPin(version_iri="urn:weave:ce:v1"),
        deps=deps,
    )

    assert commits[0]["message"] == "chore(sdk): v1+build.3"
    passed_update = next(u for u in status_updates if u["status"] == "passed")
    assert passed_update["payload"]["package_version"] == "v1+build.3"


async def _noop_emit_audit(_conn: Any, _event: Any) -> None:
    return None
