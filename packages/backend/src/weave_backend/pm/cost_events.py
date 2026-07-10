"""TASK-010: `cost_events` repo layer (ADR-008 event table -- one row per
LLM call, never a running total). `rollup` computes totals AND per-task
subtotals in one SQL aggregate (`GROUPING SETS`) -- no in-Python summing.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

import asyncpg

from weave_backend.settings.resolver import SettingNotFound, resolve_setting
from weave_backend.settings.scope import company_iri

#: TASK-013: trailing-window burn rate -- a tuned settings value (Implementation
#: Hints: "not a constant"), company-scoped since it is a global tuning knob,
#: not part of the per-project budget cascade.
BURN_RATE_WINDOW_KEY = "build.cost.burn_rate_window_days"
DEFAULT_BURN_RATE_WINDOW_DAYS = 7


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
           COALESCE(SUM(tokens_in), 0) AS tokens_in,
           COALESCE(SUM(tokens_out), 0) AS tokens_out,
           COALESCE(SUM(cost_estimate_usd), 0) AS cost_usd
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


async def burn_rate(conn: asyncpg.Connection, *, tenant_id: str, project_iri: str) -> Decimal:
    """TASK-013 Implementation Hints: total spend over a trailing window,
    window length a `PLAT-SETTINGS-1` value (`DEFAULT_BURN_RATE_WINDOW_DAYS`
    fallback), never a hardcoded constant.
    """
    try:
        resolved = await resolve_setting(
            conn,
            tenant_id=tenant_id,
            key=BURN_RATE_WINDOW_KEY,
            context_iri=company_iri(tenant_id),
        )
        window_days = int(resolved.value)
    except SettingNotFound:
        window_days = DEFAULT_BURN_RATE_WINDOW_DAYS

    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    row = await conn.fetchrow(
        """
        SELECT COALESCE(SUM(cost_estimate_usd), 0) AS burn_usd
        FROM cost_events
        WHERE tenant_id = $1 AND project_iri = $2
          AND recorded_at >= now() - ($3::text || ' days')::interval
        """,
        tenant_id,
        project_iri,
        str(window_days),
    )
    return Decimal(str(row["burn_usd"])) if row is not None else Decimal("0")
