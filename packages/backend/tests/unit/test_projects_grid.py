"""TASK-014 QA-retry unit tests: AC-1 ("should filter and search projects
grid") -- QA's coverage-retry only added a docker-lane test for this AC; the
task brief specified a Unit-lane one too, which this closes. `list_projects`
composes one raw-SQL query (`grid.py::_GRID_QUERY`) a fake connection can't
execute, so the genuine unit boundary is arg-forwarding + the pure Python
pagination/mapping around it (mirrors the advisor-reviewed scope: SQL
predicate correctness -- ILIKE/phase/owner filtering -- is QA's docker-lane
job, not re-implemented here).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from weave_backend.projects.grid import GridFilters, list_projects

_TENANT = "acme-corp"


class _FakeConnection:
    """Captures the positional bind args `list_projects` forwards to
    `conn.fetch` (the `$1..$7` placeholders in `_GRID_QUERY`) and returns
    canned rows.
    """

    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows
        self.calls: list[tuple[Any, ...]] = []

    async def fetch(self, query: str, *args: Any) -> list[dict[str, Any]]:
        assert "lifecycle_phase = $3" in query
        self.calls.append(args)
        return self.rows


def _row(project_iri: str, created_at: datetime, owner_iri: str | None = None) -> dict[str, Any]:
    return {
        "project_iri": project_iri,
        "name": "Widget Factory",
        "created_at": created_at,
        "owner_iri": owner_iri,
        "lifecycle_phase": "Speccing",
    }


async def test_list_projects_filters_and_searches_projects_grid() -> None:
    """AC-1: `search`/`lifecycle_phase`/`owner_iri` each forward as their own
    bind arg -- no fold-together, no dropped filter.
    """
    conn = _FakeConnection(rows=[])
    filters = GridFilters(
        search="widget",
        lifecycle_phase="Building",
        owner_iri="urn:weave:person:acme-corp:u1",
        limit=10,
    )

    await list_projects(conn, tenant_id=_TENANT, filters=filters)

    assert conn.calls == [
        (_TENANT, "widget", "Building", "urn:weave:person:acme-corp:u1", None, "", 11)
    ]


async def test_list_projects_decodes_the_cursor_into_keyset_bind_args() -> None:
    created_at = datetime(2026, 7, 1, tzinfo=UTC)
    cursor = f"{created_at.isoformat()}|urn:weave:project:acme-corp:widget"
    conn = _FakeConnection(rows=[])
    filters = GridFilters(cursor=cursor)

    await list_projects(conn, tenant_id=_TENANT, filters=filters)

    (args,) = conn.calls
    assert args[4] == created_at
    assert args[5] == "urn:weave:project:acme-corp:widget"


async def test_list_projects_no_cursor_binds_null_and_empty_string() -> None:
    conn = _FakeConnection(rows=[])

    await list_projects(conn, tenant_id=_TENANT, filters=GridFilters())

    (args,) = conn.calls
    assert args[4] is None
    assert args[5] == ""


async def test_list_projects_sets_next_cursor_when_more_rows_than_limit() -> None:
    rows = [
        _row(f"urn:weave:project:acme-corp:p{i}", datetime(2026, 7, i + 1, tzinfo=UTC))
        for i in range(3)
    ]
    conn = _FakeConnection(rows=rows)

    page = await list_projects(conn, tenant_id=_TENANT, filters=GridFilters(limit=2))

    assert len(page.items) == 2
    assert page.items[0].project_iri == rows[0]["project_iri"]
    assert page.next_cursor == f"{rows[1]['created_at'].isoformat()}|{rows[1]['project_iri']}"


async def test_list_projects_omits_next_cursor_on_the_last_page() -> None:
    rows = [_row("urn:weave:project:acme-corp:p0", datetime(2026, 7, 1, tzinfo=UTC))]
    conn = _FakeConnection(rows=rows)

    page = await list_projects(conn, tenant_id=_TENANT, filters=GridFilters(limit=25))

    assert page.next_cursor is None
    assert page.items[0].owner_iri is None
