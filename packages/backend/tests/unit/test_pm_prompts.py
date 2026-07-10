"""TASK-010 unit tests: `pm/prompts.py` repo layer. Fake connection, same
pattern as `test_pm_contributors.py`.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from weave_backend.pm.prompts import Prompt, get_recent, insert, set_run_id


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


async def test_insert_returns_prompt_with_no_run_id_yet() -> None:
    conn = _FakeConnection(
        fetchrow_result=_FakeRow(
            prompt_id="11111111-1111-1111-1111-111111111111",
            project_iri="urn:weave:project:t1:acme",
            principal_iri="urn:weave:person:alice",
            prompt_text="add a login page",
            run_id=None,
            created_at=_CREATED_AT,
        )
    )

    result = await insert(
        conn,
        tenant_id="t1",
        project_iri="urn:weave:project:t1:acme",
        principal_iri="urn:weave:person:alice",
        prompt_text="add a login page",
    )

    assert result == Prompt(
        prompt_id="11111111-1111-1111-1111-111111111111",
        project_iri="urn:weave:project:t1:acme",
        principal_iri="urn:weave:person:alice",
        prompt_text="add a login page",
        run_id=None,
        created_at=_CREATED_AT,
    )


async def test_set_run_id_executes_scoped_by_tenant_and_prompt() -> None:
    conn = _FakeConnection()

    await set_run_id(
        conn,
        tenant_id="t1",
        prompt_id="11111111-1111-1111-1111-111111111111",
        run_id="22222222-2222-2222-2222-222222222222",
    )

    assert len(conn.executed) == 1
    _query, args = conn.executed[0]
    assert args == ("22222222-2222-2222-2222-222222222222", "t1",
                     "11111111-1111-1111-1111-111111111111")


async def test_get_recent_returns_prompts_newest_first() -> None:
    conn = _FakeConnection(
        fetch_result=[
            _FakeRow(
                prompt_id="11111111-1111-1111-1111-111111111111",
                project_iri="urn:weave:project:t1:acme",
                principal_iri="urn:weave:person:alice",
                prompt_text="add a login page",
                run_id="22222222-2222-2222-2222-222222222222",
                created_at=_CREATED_AT,
            )
        ]
    )

    result = await get_recent(conn, tenant_id="t1", project_iri="urn:weave:project:t1:acme")

    assert result == [
        Prompt(
            prompt_id="11111111-1111-1111-1111-111111111111",
            project_iri="urn:weave:project:t1:acme",
            principal_iri="urn:weave:person:alice",
            prompt_text="add a login page",
            run_id="22222222-2222-2222-2222-222222222222",
            created_at=_CREATED_AT,
        )
    ]
