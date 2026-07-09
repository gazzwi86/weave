"""TASK-010 unit tests: `pm/bindings.py` repo layer. Fake connection, same
pattern as `test_pm_contributors.py`. Real UNIQUE-constraint rejection of a
duplicate binding (AC-5) is proven against a real Postgres in
`tests/integration/test_v1_pm_tables.py`.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from weave_backend.pm.bindings import Binding, NewBinding, delete, get_all, put


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


_CREATED_AT = datetime(2026, 7, 1, tzinfo=UTC)


async def test_get_all_returns_bindings_for_project() -> None:
    conn = _FakeConnection(
        fetch_result=[
            _FakeRow(
                binding_id="11111111-1111-1111-1111-111111111111",
                project_iri="urn:weave:project:t1:acme",
                system="jira",
                connector_ref="conn-1",
                space_ref="ACME",
                created_by="urn:weave:person:bob",
                created_at=_CREATED_AT,
            )
        ]
    )

    result = await get_all(conn, tenant_id="t1", project_iri="urn:weave:project:t1:acme")

    assert result == [
        Binding(
            binding_id="11111111-1111-1111-1111-111111111111",
            project_iri="urn:weave:project:t1:acme",
            system="jira",
            connector_ref="conn-1",
            space_ref="ACME",
            created_by="urn:weave:person:bob",
            created_at=_CREATED_AT,
        )
    ]


async def test_put_returns_the_stored_binding() -> None:
    conn = _FakeConnection(
        fetchrow_result=_FakeRow(
            binding_id="11111111-1111-1111-1111-111111111111",
            project_iri="urn:weave:project:t1:acme",
            system="confluence",
            connector_ref="conn-2",
            space_ref="ACMESPACE",
            created_by="urn:weave:person:bob",
            created_at=_CREATED_AT,
        )
    )

    result = await put(
        conn,
        tenant_id="t1",
        binding=NewBinding(
            project_iri="urn:weave:project:t1:acme",
            system="confluence",
            connector_ref="conn-2",
            space_ref="ACMESPACE",
            created_by="urn:weave:person:bob",
        ),
    )

    assert result.system == "confluence"
    assert result.space_ref == "ACMESPACE"


async def test_delete_executes_scoped_by_tenant_and_binding_id() -> None:
    conn = _FakeConnection()

    await delete(conn, tenant_id="t1", binding_id="11111111-1111-1111-1111-111111111111")

    assert len(conn.executed) == 1
    _query, args = conn.executed[0]
    assert args == ("t1", "11111111-1111-1111-1111-111111111111")
