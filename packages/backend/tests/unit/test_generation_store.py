"""BE-TASK-009 unit tests: `get_generation_run_by_commit_sha` -- the deploy
flow's route from a git commit to the `run_id` it publishes under. Fake
`asyncpg.Connection` stand-in, same pattern as `test_project_model.py`'s
`_FakeConnection` -- no docker/Postgres required.
"""

from __future__ import annotations

from typing import Any

from weave_backend.generation.store import GenerationRun, get_generation_run_by_commit_sha


class _FakeRow(dict[str, Any]):
    """dict subclass -- stands in for an asyncpg.Record (supports `row["x"]`)."""


class _FakeConnection:
    def __init__(self, *, fetchrow_result: _FakeRow | None = None) -> None:
        self._fetchrow_result = fetchrow_result

    async def fetchrow(self, _query: str, *_args: Any) -> _FakeRow | None:
        return self._fetchrow_result


async def test_get_generation_run_by_commit_sha_returns_run_when_found() -> None:
    conn = _FakeConnection(
        fetchrow_result=_FakeRow(
            run_id="11111111-1111-1111-1111-111111111111",
            project_iri="urn:weave:project:t1:acme",
            task_id="task-1",
            branch="build/acme/task-1",
            commit_sha="sha-123",
        )
    )

    run = await get_generation_run_by_commit_sha(conn, tenant_id="t1", commit_sha="sha-123")

    assert run == GenerationRun(
        run_id="11111111-1111-1111-1111-111111111111",
        project_iri="urn:weave:project:t1:acme",
        task_id="task-1",
        branch="build/acme/task-1",
        commit_sha="sha-123",
    )


async def test_get_generation_run_by_commit_sha_returns_none_when_not_found() -> None:
    conn = _FakeConnection(fetchrow_result=None)

    run = await get_generation_run_by_commit_sha(conn, tenant_id="t1", commit_sha="sha-missing")

    assert run is None
