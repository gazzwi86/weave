"""AC-5/AC-7: usage summary read. Two scopes off one query -- tenant-wide
(no `workspace_id`) or single-workspace (`workspace_id` set) -- rather than
two endpoints, since the SQL differs only by a WHERE clause.
"""

from __future__ import annotations

from dataclasses import dataclass

import asyncpg

from weave_backend.billing.caps import BUDGET_CAP_KEY
from weave_backend.billing.period import current_period
from weave_backend.settings.resolver import SettingNotFound, resolve_setting
from weave_backend.settings.scope import company_iri, workspace_iri


@dataclass(frozen=True)
class WorkspaceUsage:
    workspace_id: str
    total_tokens: int
    total_runs: int
    total_cost_usd: float


@dataclass(frozen=True)
class UsageSummary:
    period: str
    total_tokens: int
    total_runs: int
    total_cost_usd: float
    by_workspace: list[WorkspaceUsage]
    cap_utilisation_pct: float


async def get_usage_summary(
    conn: asyncpg.Connection, *, tenant_id: str, workspace_id: str | None = None
) -> UsageSummary:
    period = current_period()
    rows = await conn.fetch(
        """
        SELECT workspace_id,
               COALESCE(SUM(input_tokens) + SUM(output_tokens), 0) AS total_tokens,
               COUNT(*) FILTER (WHERE record_type = 'run') AS total_runs,
               COALESCE(SUM(cost_usd), 0) AS total_cost_usd
        FROM billing_usage
        WHERE tenant_id = $1 AND period = $2
          AND ($3::text IS NULL OR workspace_id = $3)
        GROUP BY workspace_id
        """,
        tenant_id,
        period,
        workspace_id,
    )

    by_workspace = [
        WorkspaceUsage(
            workspace_id=row["workspace_id"],
            total_tokens=row["total_tokens"],
            total_runs=row["total_runs"],
            total_cost_usd=float(row["total_cost_usd"]),
        )
        for row in rows
    ]
    total_tokens = sum(w.total_tokens for w in by_workspace)
    total_runs = sum(w.total_runs for w in by_workspace)
    total_cost_usd = sum(w.total_cost_usd for w in by_workspace)

    cap_utilisation_pct = await _cap_utilisation_pct(
        conn, tenant_id=tenant_id, workspace_id=workspace_id, consumed_usd=total_cost_usd
    )

    return UsageSummary(
        period=period,
        total_tokens=total_tokens,
        total_runs=total_runs,
        total_cost_usd=total_cost_usd,
        by_workspace=by_workspace,
        cap_utilisation_pct=cap_utilisation_pct,
    )


async def _cap_utilisation_pct(
    conn: asyncpg.Connection, *, tenant_id: str, workspace_id: str | None, consumed_usd: float
) -> float:
    context_iri = (
        workspace_iri(tenant_id, workspace_id) if workspace_id else company_iri(tenant_id)
    )
    try:
        resolved = await resolve_setting(
            conn, tenant_id=tenant_id, key=BUDGET_CAP_KEY, context_iri=context_iri
        )
    except SettingNotFound:
        return 0.0  # ponytail: no cap configured -- utilisation is meaningless, report 0
    cap_usd = float(resolved.value)
    return (consumed_usd / cap_usd * 100) if cap_usd > 0 else 0.0
