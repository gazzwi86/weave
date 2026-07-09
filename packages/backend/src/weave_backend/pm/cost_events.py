"""TASK-010: `cost_events` repo layer (ADR-008 event table -- one row per
LLM call, never a running total). `rollup` computes totals AND per-task
subtotals in one SQL aggregate (`GROUPING SETS`) -- no in-Python summing.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

import asyncpg


@dataclass(frozen=True)
class NewCostEvent:
    project_iri: str
    task_id: str | None
    run_id: str | None
    agent_role: str
    model: str
    tokens_in: int
    tokens_out: int
    cost_estimate_usd: Decimal


async def insert(conn: asyncpg.Connection, *, tenant_id: str, event: NewCostEvent) -> None:
    """Record one cost event. Append-only -- no update/delete (ADR-008)."""
    await conn.execute(
        """
        INSERT INTO cost_events
            (tenant_id, project_iri, task_id, run_id, agent_role, model,
             tokens_in, tokens_out, cost_estimate_usd)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """,
        tenant_id,
        event.project_iri,
        event.task_id,
        event.run_id,
        event.agent_role,
        event.model,
        event.tokens_in,
        event.tokens_out,
        event.cost_estimate_usd,
    )


@dataclass(frozen=True)
class Totals:
    tokens_in: int
    tokens_out: int
    cost_usd: Decimal


@dataclass(frozen=True)
class TaskCost:
    task_id: str | None
    tokens_in: int
    tokens_out: int
    cost_usd: Decimal


@dataclass(frozen=True)
class Rollup:
    total: Totals
    by_task: list[TaskCost]


_ROLLUP_QUERY = """
    SELECT task_id, GROUPING(task_id) AS is_total,
           SUM(tokens_in) AS tokens_in, SUM(tokens_out) AS tokens_out,
           SUM(cost_estimate_usd) AS cost_usd
    FROM cost_events
    WHERE tenant_id = $1 AND project_iri = $2
    GROUP BY GROUPING SETS ((task_id), ())
"""


async def rollup(conn: asyncpg.Connection, *, tenant_id: str, project_iri: str) -> Rollup:
    """Project cost totals plus a per-task breakdown, from one aggregate
    query. `GROUPING(task_id)` (not `task_id IS NULL`) distinguishes the
    collapsed totals row from a genuine non-task-work bucket, which also has
    a NULL `task_id`.
    """
    rows = await conn.fetch(_ROLLUP_QUERY, tenant_id, project_iri)
    total = Totals(tokens_in=0, tokens_out=0, cost_usd=Decimal("0"))
    by_task: list[TaskCost] = []
    for row in rows:
        if row["is_total"]:
            total = Totals(
                tokens_in=row["tokens_in"], tokens_out=row["tokens_out"], cost_usd=row["cost_usd"]
            )
        else:
            by_task.append(
                TaskCost(
                    task_id=row["task_id"],
                    tokens_in=row["tokens_in"],
                    tokens_out=row["tokens_out"],
                    cost_usd=row["cost_usd"],
                )
            )
    return Rollup(total=total, by_task=by_task)
