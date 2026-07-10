"""BE-TASK-006 AC-6/AC-7/AC-8 (build-engine EPIC-011) unit tests for
`rich_scaffold`/`approve_env_verification`. Exercised against a
`_FakeConnection` stand-in (same pattern as `test_repo_bootstrap_service.py`)
with injected fakes for the secrets/driver/audit/HITL collaborators -- no
real Postgres/LocalStack/HTTP needed; the real end-to-end proof lives in
`tests/integration/test_repo_bootstrap.py` (docker-marked).
"""

from __future__ import annotations

from typing import Any

import pytest

from weave_backend.audit.emitter import AuditEvent
from weave_backend.build.hitl import HitlGateContext, SelfApprovalNotPermitted
from weave_backend.repo_bootstrap.drivers import RepoHandle
from weave_backend.repo_bootstrap.rich_scaffold import (
    ScaffoldFailed,
    approve_env_verification,
    rich_scaffold,
)
from weave_backend.repo_bootstrap.service import RepoBootstrapDeps

_FAKE_TOKEN = "tok-1"
_TENANT = "t1"
_PROJECT_IRI = "urn:weave:project:t1:acme"


class _FakeRow(dict[str, Any]):
    """dict subclass -- stands in for an asyncpg.Record."""


class _FakeConnection:
    def __init__(self, *, feature_dispatch_held: bool | None) -> None:
        self.executed: list[tuple[str, tuple[Any, ...]]] = []
        self._row = _FakeRow(
            {
                "name": "Acme Corp",
                "source_control_provider": "github",
                "source_control_token_secret_ref": "weave/tenant/scm-project/github-token",
                "repo_provider": "github",
                "repo_url": "https://scm/acme/repo",
                "repo_default_branch": "main",
                "repo_id": "acme/weave-acme-corp",
                "feature_dispatch_held": feature_dispatch_held,
            }
        )

    async def fetchrow(self, _query: str, *_args: Any) -> _FakeRow:
        return self._row

    async def fetch(self, _query: str, *_args: Any) -> list[Any]:
        return []  # no effective standards configured -- demo-default path

    async def execute(self, query: str, *args: Any) -> None:
        self.executed.append((query, args))
        if "feature_dispatch_held" in query:
            self._row["feature_dispatch_held"] = args[0]


class _FakeDriver:
    """Only `apply_branch_protection`/`commit_files` are exercised by
    `rich_scaffold` -- the other `ScmDriver` Protocol members are no-ops
    here purely to satisfy the structural type (M1's `ensure_project_repo`
    path, which uses them, is covered by its own fakes)."""

    def __init__(self, *, fail_step: str | None = None) -> None:
        self.fail_step = fail_step
        self.calls: list[str] = []

    async def create_repo(self, *, name: str, private: bool, token: str) -> RepoHandle:
        raise NotImplementedError

    async def write_initial_commit(
        self, repo: RepoHandle, *, boilerplate: dict[str, str], token: str
    ) -> None:
        raise NotImplementedError

    async def commit_workspace(
        self, repo: RepoHandle, *, workspace: str, branch: str, message: str, token: str
    ) -> str:
        raise NotImplementedError

    async def apply_branch_protection(self, repo: RepoHandle, *, token: str) -> None:
        self.calls.append("branch_protection")
        if self.fail_step == "branch_protection":
            raise RuntimeError("branch-protection API rejected")

    async def commit_files(
        self, repo: RepoHandle, *, files: dict[str, str], message: str, token: str
    ) -> str:
        self.calls.append("harness_files")
        if self.fail_step == "harness_files":
            raise RuntimeError("commit rejected")
        return "sha-fake"


def _deps(*, driver: _FakeDriver | None = None) -> tuple[RepoBootstrapDeps, list[AuditEvent]]:
    emitted: list[AuditEvent] = []
    fake_driver = driver if driver is not None else _FakeDriver()

    async def get_secret(_ref: str) -> str | None:
        return _FAKE_TOKEN

    def driver_for(_provider: str) -> _FakeDriver:
        return fake_driver

    async def emit_audit(_conn: Any, event: AuditEvent) -> None:
        emitted.append(event)

    deps = RepoBootstrapDeps(get_secret=get_secret, driver_for=driver_for, emit_audit=emit_audit)
    return deps, emitted


async def _noop_fire_hitl_gate(_conn: Any, _ctx: HitlGateContext, **_kwargs: Any) -> None:
    return None


async def test_rich_scaffold_applies_branch_protection_and_harness_files(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AC-6: on a fresh bootstrap, rich_scaffold applies branch protection
    plus the harness-files commit (CI/secrets/health/hooks/boilerplate).
    """
    monkeypatch.setattr(
        "weave_backend.repo_bootstrap.rich_scaffold.fire_hitl_gate", _noop_fire_hitl_gate
    )
    conn = _FakeConnection(feature_dispatch_held=None)
    driver = _FakeDriver()
    deps, _emitted = _deps(driver=driver)

    await rich_scaffold(conn, project_iri=_PROJECT_IRI, tenant_id=_TENANT, deps=deps)

    assert driver.calls == ["branch_protection", "harness_files"]


async def test_rich_scaffold_holds_feature_dispatch_and_fires_gate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AC-7: scaffold completion sets `feature_dispatch_held = True` and
    fires the env-verification HITL gate."""
    conn = _FakeConnection(feature_dispatch_held=None)
    deps, emitted = _deps()
    gate_calls: list[HitlGateContext] = []

    async def fake_fire_hitl_gate(_conn: Any, ctx: HitlGateContext, **_kwargs: Any) -> None:
        gate_calls.append(ctx)

    monkeypatch.setattr(
        "weave_backend.repo_bootstrap.rich_scaffold.fire_hitl_gate", fake_fire_hitl_gate
    )

    await rich_scaffold(conn, project_iri=_PROJECT_IRI, tenant_id=_TENANT, deps=deps)

    assert conn._row["feature_dispatch_held"] is True
    assert len(gate_calls) == 1
    assert gate_calls[0].task_id == f"env_verification:{_PROJECT_IRI}"
    assert any(e.event_type == "rich_scaffold_applied" for e in emitted)


async def test_rich_scaffold_is_idempotent_when_already_held() -> None:
    """A project already scaffolded (held True or released False) is not
    re-scaffolded on a resumed/retried run."""
    conn = _FakeConnection(feature_dispatch_held=True)
    driver = _FakeDriver()
    deps, emitted = _deps(driver=driver)

    await rich_scaffold(conn, project_iri=_PROJECT_IRI, tenant_id=_TENANT, deps=deps)

    assert driver.calls == []
    assert emitted == []


async def test_rich_scaffold_halts_naming_failing_scaffold_step() -> None:
    """AC-8: a failing step (e.g. branch-protection API rejects) halts
    fail-closed with the step named -- the M1 floor doesn't substitute."""
    conn = _FakeConnection(feature_dispatch_held=None)
    driver = _FakeDriver(fail_step="branch_protection")
    deps, _emitted = _deps(driver=driver)

    with pytest.raises(ScaffoldFailed) as exc_info:
        await rich_scaffold(conn, project_iri=_PROJECT_IRI, tenant_id=_TENANT, deps=deps)

    assert exc_info.value.step == "branch_protection"
    # Never reached feature_dispatch_held -- still unset, not silently held.
    assert conn._row["feature_dispatch_held"] is None


async def test_rich_scaffold_halts_naming_harness_files_step_on_commit_rejection() -> None:
    conn = _FakeConnection(feature_dispatch_held=None)
    driver = _FakeDriver(fail_step="harness_files")
    deps, _emitted = _deps(driver=driver)

    with pytest.raises(ScaffoldFailed) as exc_info:
        await rich_scaffold(conn, project_iri=_PROJECT_IRI, tenant_id=_TENANT, deps=deps)

    assert exc_info.value.step == "harness_files"


async def test_approve_env_verification_releases_hold_for_human_principal() -> None:
    conn = _FakeConnection(feature_dispatch_held=True)

    class _Human:
        type = "human"

    async def resolve_principal(_conn: Any, *, tenant_id: str, iri: str) -> _Human:
        return _Human()

    await approve_env_verification(
        conn,
        project_iri=_PROJECT_IRI,
        tenant_id=_TENANT,
        approving_principal_iri="urn:weave:principal:human:t1:alice",
        resolve_principal=resolve_principal,
    )

    assert conn._row["feature_dispatch_held"] is False


async def test_approve_env_verification_rejects_non_human_principal() -> None:
    """D9: the build-engine service (or any agent) approving its own
    scaffold is the self-approval this rejects -- only a human releases
    the hold."""
    conn = _FakeConnection(feature_dispatch_held=True)

    class _Agent:
        type = "agent"

    async def resolve_principal(_conn: Any, *, tenant_id: str, iri: str) -> _Agent:
        return _Agent()

    with pytest.raises(SelfApprovalNotPermitted):
        await approve_env_verification(
            conn,
            project_iri=_PROJECT_IRI,
            tenant_id=_TENANT,
            approving_principal_iri="urn:weave:principal:service:build-engine",
            resolve_principal=resolve_principal,
        )

    assert conn._row["feature_dispatch_held"] is True  # unchanged -- still held
