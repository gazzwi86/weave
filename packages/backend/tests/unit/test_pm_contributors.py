"""TASK-010 unit tests: `pm/contributors.py` repo layer. Fake
`asyncpg.Connection` stand-in, same pattern as `test_generation_store.py` --
no docker/Postgres required. Real CHECK-constraint rejection of an invalid
role (AC-4) is proven against a real Postgres in
`tests/integration/test_v1_pm_tables.py` -- a fake connection cannot prove a
DB constraint fired.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from weave_backend.pm.contributors import (
    Contributor,
    NewContributor,
    delete,
    get_all,
    get_role,
    upsert,
)


class _FakeRow(dict[str, Any]):
    """dict subclass -- stands in for an asyncpg.Record (supports `row["x"]`)."""


class _FakeConnection:
    def __init__(
        self,
        *,
        fetch_result: list[_FakeRow] | None = None,
        fetchrow_result: _FakeRow | None = None,
    ) -> None:
        self._fetch_result = fetch_result or []
        self._fetchrow_result = fetchrow_result
        self.executed: list[tuple[str, tuple[Any, ...]]] = []

    async def fetch(self, _query: str, *args: Any) -> list[_FakeRow]:
        return self._fetch_result

    async def fetchrow(self, _query: str, *args: Any) -> _FakeRow | None:
        return self._fetchrow_result

    async def execute(self, query: str, *args: Any) -> None:
        self.executed.append((query, args))


_ADDED_AT = datetime(2026, 7, 1, tzinfo=UTC)


async def test_get_all_returns_contributors_for_project() -> None:
    conn = _FakeConnection(
        fetch_result=[
            _FakeRow(
                project_iri="urn:weave:project:t1:acme",
                principal_iri="urn:weave:person:alice",
                role="admin",
                added_by="urn:weave:person:bob",
                added_at=_ADDED_AT,
            )
        ]
    )

    result = await get_all(conn, tenant_id="t1", project_iri="urn:weave:project:t1:acme")

    assert result == [
        Contributor(
            project_iri="urn:weave:project:t1:acme",
            principal_iri="urn:weave:person:alice",
            role="admin",
            added_by="urn:weave:person:bob",
            added_at=_ADDED_AT,
        )
    ]


async def test_get_all_returns_empty_list_when_no_contributors() -> None:
    conn = _FakeConnection(fetch_result=[])

    result = await get_all(conn, tenant_id="t1", project_iri="urn:weave:project:t1:acme")

    assert result == []


async def test_upsert_returns_the_stored_contributor() -> None:
    conn = _FakeConnection(
        fetchrow_result=_FakeRow(
            project_iri="urn:weave:project:t1:acme",
            principal_iri="urn:weave:person:alice",
            role="editor",
            added_by="urn:weave:person:bob",
            added_at=_ADDED_AT,
        )
    )

    result = await upsert(
        conn,
        tenant_id="t1",
        contributor=NewContributor(
            project_iri="urn:weave:project:t1:acme",
            principal_iri="urn:weave:person:alice",
            role="editor",
            added_by="urn:weave:person:bob",
        ),
    )

    assert result.role == "editor"


async def test_delete_executes_scoped_by_tenant_and_project() -> None:
    conn = _FakeConnection()

    await delete(
        conn,
        tenant_id="t1",
        project_iri="urn:weave:project:t1:acme",
        principal_iri="urn:weave:person:alice",
    )

    assert len(conn.executed) == 1
    _query, args = conn.executed[0]
    assert args == ("t1", "urn:weave:project:t1:acme", "urn:weave:person:alice")


async def test_get_role_returns_the_role_for_a_known_contributor() -> None:
    conn = _FakeConnection(fetchrow_result=_FakeRow(role="admin"))

    role = await get_role(
        conn,
        tenant_id="t1",
        project_iri="urn:weave:project:t1:acme",
        principal_iri="urn:weave:person:alice",
    )

    assert role == "admin"


async def test_get_role_returns_none_for_a_non_contributor() -> None:
    conn = _FakeConnection(fetchrow_result=None)

    role = await get_role(
        conn,
        tenant_id="t1",
        project_iri="urn:weave:project:t1:acme",
        principal_iri="urn:weave:person:nobody",
    )

    assert role is None
