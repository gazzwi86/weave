"""TASK-023 (E2-S6, FR-061/B9) unit tests: `pm/source_control.py` repo
layer. Fake connection, same pattern as `test_pm_bindings.py`. Persists on
the existing `projects` table columns (`source_control_provider`,
`source_control_token_secret_ref`, migration 0009) -- not a new table and
not PLAT-SETTINGS-1 (ADR-002: project-scope settings writes 503 for a
Build project IRI, ADR-013).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from weave_backend.pm.source_control import (
    SourceControlConfig,
    get_configured_meta,
    get_row,
    project_exists,
    set_row,
)


class _FakeRow(dict[str, Any]):
    """dict subclass -- stands in for an asyncpg.Record (supports `row["x"]`)."""


class _FakeConnection:
    def __init__(
        self,
        *,
        fetchrow_results: list[_FakeRow | None] | None = None,
    ) -> None:
        self._fetchrow_results = list(fetchrow_results or [])
        self.executed: list[tuple[str, tuple[Any, ...]]] = []

    async def fetchrow(self, _query: str, *args: Any) -> _FakeRow | None:
        return self._fetchrow_results.pop(0)

    async def execute(self, query: str, *args: Any) -> None:
        self.executed.append((query, args))


_PROJECT_IRI = "urn:weave:project:t1:acme"


async def test_get_row_returns_none_when_project_missing() -> None:
    conn = _FakeConnection(fetchrow_results=[None])

    result = await get_row(conn, tenant_id="t1", project_iri=_PROJECT_IRI)

    assert result is None


async def test_get_row_returns_none_when_project_has_no_source_control_configured() -> None:
    conn = _FakeConnection(
        fetchrow_results=[
            _FakeRow(source_control_provider=None, source_control_token_secret_ref=None)
        ]
    )

    result = await get_row(conn, tenant_id="t1", project_iri=_PROJECT_IRI)

    assert result is None


async def test_get_row_returns_config_when_configured() -> None:
    conn = _FakeConnection(
        fetchrow_results=[
            _FakeRow(
                source_control_provider="github",
                source_control_token_secret_ref="weave/t1/scm/acme/github/token",
            )
        ]
    )

    result = await get_row(conn, tenant_id="t1", project_iri=_PROJECT_IRI)

    assert result == SourceControlConfig(
        provider="github", token_secret_ref="weave/t1/scm/acme/github/token"
    )


async def test_project_exists_true_when_row_found() -> None:
    conn = _FakeConnection(fetchrow_results=[_FakeRow(x=1)])

    assert await project_exists(conn, tenant_id="t1", project_iri=_PROJECT_IRI) is True


async def test_project_exists_false_when_row_missing() -> None:
    conn = _FakeConnection(fetchrow_results=[None])

    assert await project_exists(conn, tenant_id="t1", project_iri=_PROJECT_IRI) is False


async def test_set_row_executes_scoped_update() -> None:
    conn = _FakeConnection()

    await set_row(
        conn,
        tenant_id="t1",
        project_iri=_PROJECT_IRI,
        provider="github",
        token_secret_ref="weave/t1/scm/acme/github/token",
    )

    assert len(conn.executed) == 1
    _query, args = conn.executed[0]
    assert args == ("github", "weave/t1/scm/acme/github/token", "t1", _PROJECT_IRI)


_TS = datetime(2026, 7, 1, tzinfo=UTC).isoformat()


async def test_get_configured_meta_returns_none_when_never_configured() -> None:
    conn = _FakeConnection(fetchrow_results=[None])

    result = await get_configured_meta(conn, tenant_id="t1", project_iri=_PROJECT_IRI)

    assert result is None


async def test_get_configured_meta_returns_latest_configure_event() -> None:
    conn = _FakeConnection(
        fetchrow_results=[_FakeRow(actor_principal_iri="urn:weave:person:bob", ts=_TS)]
    )

    result = await get_configured_meta(conn, tenant_id="t1", project_iri=_PROJECT_IRI)

    assert result is not None
    assert result.configured_by == "urn:weave:person:bob"
    assert result.configured_at == _TS
