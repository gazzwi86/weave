"""BE-TASK-010 (build-engine EPIC-011) unit tests for `ensure_project_repo`'s
orchestration logic -- provider/token resolution, idempotency, fail-closed
errors, and AC-5's never-in-response-or-log guarantee. Exercised against a
`_FakeConnection` stand-in (same pattern as `test_project_model.py`) with
injected fakes for the secrets/driver/audit collaborators, so none of this
needs real Postgres/LocalStack/HTTP -- that end-to-end proof lives in
`tests/integration/test_repo_bootstrap.py`.
"""

from __future__ import annotations

import logging
from typing import Any

import pytest

from weave_backend.audit.emitter import AuditEvent
from weave_backend.repo_bootstrap.drivers import AuthError, RepoHandle
from weave_backend.repo_bootstrap.service import (
    ProjectNotFoundError,
    RepoBootstrapDeps,
    RepoBootstrapError,
    ensure_project_repo,
)

_FAKE_TOKEN = "tok-1"


class _FakeRow(dict[str, Any]):
    """dict subclass -- stands in for an asyncpg.Record (see
    `test_project_model.py`'s `_FakeRow` precedent).
    """


class _FakeConnection:
    def __init__(self, *, fetchrow_result: _FakeRow | None) -> None:
        self._fetchrow_result = fetchrow_result
        self.executed: list[tuple[str, tuple[Any, ...]]] = []

    async def fetchrow(self, _query: str, *_args: Any) -> _FakeRow | None:
        return self._fetchrow_result

    async def execute(self, query: str, *args: Any) -> None:
        self.executed.append((query, args))


def _project_row(**overrides: Any) -> _FakeRow:
    base = {
        "name": "Acme Corp",
        "source_control_provider": "github",
        "source_control_token_secret_ref": "weave/tenant/scm-project/github-token",
        "repo_provider": None,
        "repo_url": None,
        "repo_default_branch": None,
    }
    base.update(overrides)
    return _FakeRow(base)


class _FakeDriver:
    def __init__(self, *, raise_auth_error: bool = False) -> None:
        self.raise_auth_error = raise_auth_error
        self.create_repo_called = False

    async def create_repo(self, *, name: str, private: bool, token: str) -> RepoHandle:
        self.create_repo_called = True
        if self.raise_auth_error:
            raise AuthError("provider rejected token")
        return RepoHandle(
            repo_id="acme/weave-acme-corp", url="https://scm/acme/repo", default_branch="main"
        )

    async def write_initial_commit(
        self, repo: RepoHandle, *, boilerplate: dict[str, str], token: str
    ) -> None:
        return None


def _deps(
    *, token: str | None = _FAKE_TOKEN, driver: _FakeDriver | None = None
) -> tuple[RepoBootstrapDeps, list[AuditEvent]]:
    emitted: list[AuditEvent] = []
    fake_driver = driver if driver is not None else _FakeDriver()

    async def get_secret(_secret_ref: str) -> str | None:
        return token

    def driver_for(_provider: str) -> _FakeDriver:
        return fake_driver

    async def emit_audit(_conn: _FakeConnection, event: AuditEvent) -> None:
        emitted.append(event)

    deps = RepoBootstrapDeps(get_secret=get_secret, driver_for=driver_for, emit_audit=emit_audit)
    return deps, emitted


async def test_ensure_project_repo_raises_project_not_found_when_missing() -> None:
    conn = _FakeConnection(fetchrow_result=None)
    deps, _ = _deps()

    with pytest.raises(ProjectNotFoundError):
        await ensure_project_repo(
            conn, project_iri="urn:weave:project:t1:acme", tenant_id="t1", deps=deps
        )


async def test_ensure_project_repo_is_idempotent_reuses_existing_repo() -> None:
    conn = _FakeConnection(
        fetchrow_result=_project_row(
            repo_provider="github",
            repo_url="https://github.com/acme/weave-acme-corp",
            repo_default_branch="main",
        )
    )
    fake_driver = _FakeDriver()
    deps, emitted = _deps(driver=fake_driver)

    status_code, body = await ensure_project_repo(
        conn, project_iri="urn:weave:project:t1:acme", tenant_id="t1", deps=deps
    )

    assert status_code == 200
    assert body == {
        "provider": "github",
        "repo_url": "https://github.com/acme/weave-acme-corp",
        "default_branch": "main",
    }
    assert fake_driver.create_repo_called is False
    assert emitted == []


async def test_ensure_project_repo_raises_provider_unconfigured_when_no_provider_set() -> None:
    conn = _FakeConnection(
        fetchrow_result=_project_row(
            source_control_provider=None, source_control_token_secret_ref=None
        )
    )
    deps, _ = _deps()

    with pytest.raises(RepoBootstrapError) as exc_info:
        await ensure_project_repo(
            conn, project_iri="urn:weave:project:t1:acme", tenant_id="t1", deps=deps
        )
    assert exc_info.value.reason == "repo_provider_unconfigured"


async def test_ensure_project_repo_raises_auth_invalid_when_token_missing() -> None:
    conn = _FakeConnection(fetchrow_result=_project_row())
    deps, _ = _deps(token=None)

    with pytest.raises(RepoBootstrapError) as exc_info:
        await ensure_project_repo(
            conn, project_iri="urn:weave:project:t1:acme", tenant_id="t1", deps=deps
        )
    assert exc_info.value.reason == "repo_auth_invalid"


async def test_ensure_project_repo_raises_auth_invalid_when_token_secret_ref_unset() -> None:
    """A provider is configured but no token secret ref was ever captured --
    same fail-closed error as a missing secret, not a crash on `None`.
    """
    conn = _FakeConnection(
        fetchrow_result=_project_row(source_control_token_secret_ref=None)
    )
    deps, _ = _deps()

    with pytest.raises(RepoBootstrapError) as exc_info:
        await ensure_project_repo(
            conn, project_iri="urn:weave:project:t1:acme", tenant_id="t1", deps=deps
        )
    assert exc_info.value.reason == "repo_auth_invalid"


async def test_ensure_project_repo_raises_auth_invalid_when_driver_rejects_auth() -> None:
    conn = _FakeConnection(fetchrow_result=_project_row())
    deps, _ = _deps(driver=_FakeDriver(raise_auth_error=True))

    with pytest.raises(RepoBootstrapError) as exc_info:
        await ensure_project_repo(
            conn, project_iri="urn:weave:project:t1:acme", tenant_id="t1", deps=deps
        )
    assert exc_info.value.reason == "repo_auth_invalid"


async def test_ensure_project_repo_creates_repo_and_persists_handle() -> None:
    conn = _FakeConnection(fetchrow_result=_project_row())
    deps, emitted = _deps()

    status_code, body = await ensure_project_repo(
        conn, project_iri="urn:weave:project:t1:acme", tenant_id="t1", deps=deps
    )

    assert status_code == 201
    assert body == {
        "provider": "github",
        "repo_url": "https://scm/acme/repo",
        "default_branch": "main",
    }
    # AC-6: exactly one audit event, no token anywhere in it.
    assert len(emitted) == 1
    assert emitted[0].event_type == "repo_bootstrapped"
    assert emitted[0].payload == {"provider": "github", "repo_url": "https://scm/acme/repo"}
    # Persisted via UPDATE ... SET repo_provider, repo_url, ... (store.py).
    assert len(conn.executed) == 1


async def test_ensure_project_repo_response_and_logs_never_include_the_token(
    caplog: pytest.LogCaptureFixture,
) -> None:
    conn = _FakeConnection(fetchrow_result=_project_row())
    deps, _ = _deps()

    with caplog.at_level(logging.DEBUG):
        _status_code, body = await ensure_project_repo(
            conn, project_iri="urn:weave:project:t1:acme", tenant_id="t1", deps=deps
        )

    assert _FAKE_TOKEN not in str(body)
    assert all(_FAKE_TOKEN not in record.getMessage() for record in caplog.records)
