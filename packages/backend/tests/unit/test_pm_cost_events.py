"""TASK-010 unit tests: `pm/cost_events.py` repo layer. Fake connection --
proves the rollup's totals/by_task row-splitting logic (the `GROUPING`
flag, not `task_id IS NULL`, decides which row is the collapsed total) using
canned `GROUPING SETS`-shaped rows. The real SQL aggregate itself (that
Postgres computes the sums correctly) is proven against a real Postgres in
`tests/integration/test_v1_pm_tables.py`.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from weave_backend.pm.cost_events import NewCostEvent, Rollup, TaskCost, Totals, insert, rollup


class _FakeRow(dict[str, Any]):
    """dict subclass -- stands in for an asyncpg.Record (supports `row["x"]`)."""


class _FakeConnection:
    def __init__(self, *, fetch_result: list[_FakeRow] | None = None) -> None:
        self._fetch_result = fetch_result or []
        self.executed: list[tuple[str, tuple[Any, ...]]] = []

    async def fetch(self, _query: str, *args: Any) -> list[_FakeRow]:
        return self._fetch_result

    async def execute(self, query: str, *args: Any) -> None:
        self.executed.append((query, args))


async def test_insert_executes_with_tenant_and_event_fields() -> None:
    conn = _FakeConnection()
    event = NewCostEvent(
        project_iri="urn:weave:project:t1:acme",
        task_id="task-1",
        run_id=None,
        agent_role="engineer",
        model="claude-sonnet-5",
        tokens_in=100,
        tokens_out=50,
        cost_estimate_usd=Decimal("0.012345"),
    )

    await insert(conn, tenant_id="t1", event=event)

    assert len(conn.executed) == 1
    _query, args = conn.executed[0]
    assert args == ("t1", "urn:weave:project:t1:acme", "task-1", None, "engineer",
                     "claude-sonnet-5", 100, 50, Decimal("0.012345"))


async def test_rollup_splits_total_row_from_by_task_rows_via_grouping_flag() -> None:
    # A real NULL-task_id bucket (non-task work) plus the collapsed total --
    # both have task_id NULL, only `is_total` (GROUPING(task_id)) tells them
    # apart.
    conn = _FakeConnection(
        fetch_result=[
            _FakeRow(task_id="task-1", is_total=0, tokens_in=100, tokens_out=50,
                     cost_usd=Decimal("0.01")),
            _FakeRow(task_id=None, is_total=0, tokens_in=10, tokens_out=5,
                     cost_usd=Decimal("0.001")),
            _FakeRow(task_id=None, is_total=1, tokens_in=110, tokens_out=55,
                     cost_usd=Decimal("0.011")),
        ]
    )

    result = await rollup(conn, tenant_id="t1", project_iri="urn:weave:project:t1:acme")

    assert result == Rollup(
        total=Totals(tokens_in=110, tokens_out=55, cost_usd=Decimal("0.011")),
        by_task=[
            TaskCost(task_id="task-1", tokens_in=100, tokens_out=50, cost_usd=Decimal("0.01")),
            TaskCost(task_id=None, tokens_in=10, tokens_out=5, cost_usd=Decimal("0.001")),
        ],
    )


async def test_rollup_returns_zeroed_totals_when_no_cost_events() -> None:
    conn = _FakeConnection(fetch_result=[])

    result = await rollup(conn, tenant_id="t1", project_iri="urn:weave:project:t1:acme")

    assert result == Rollup(total=Totals(tokens_in=0, tokens_out=0, cost_usd=Decimal("0")),
                             by_task=[])
