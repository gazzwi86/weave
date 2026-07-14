"""PLAT-V1-TASK-016: the declarative CATEGORIES registry -- the single
binding source the resolver (TASK-012), fixed tiles (TASK-010) and
role-home (TASK-017) all read (AC-1, m2-delta.md §1). Each entry declares
its published contracts + component-compatible shapes; the `fetch`
callable does the real I/O and returns a `BindingResult` with an honest
`status` per the story-specific degradation rule (AC-6).
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

import asyncpg
import httpx

from weave_backend.audit.listing import list_entries
from weave_backend.billing.usage import get_usage_summary
from weave_backend.dashboard import availability, ce_metrics, coverage_gap, ops_health, snapshots
from weave_backend.dashboard.thresholds import threshold

#: AC-1: the closed set of contract IDs a category may cite. S10's
#: CloudWatch namespace is deliberately absent -- it is internal platform
#: telemetry, not a contract, and is labelled separately in the footer.
PUBLISHED_CONTRACTS: frozenset[str] = frozenset(
    {
        "CE-METRICS-1",
        "CE-READ-1",
        "CE-VERSION-1",
        "CE-EVENT-1",
        "PLAT-AUDIT-1",
        "PLAT-BILLING-1",
        "PLAT-SETTINGS-1",
        "PLAT-IDENTITY-1",
    }
)

#: Not-yet-available marker shared by every degraded "source engine not
#: yet available" row/category (AC-7) -- one literal, named once.
NOT_YET_AVAILABLE = "not_yet_available"


@dataclass(frozen=True)
class BindingContext:
    """Bundles a fetch function's dependencies under Law E's 5-param cap."""

    tenant_id: str
    context_iri: str
    conn: asyncpg.Connection
    ce_client: httpx.AsyncClient
    ce_headers: dict[str, str] | None = None


@dataclass(frozen=True)
class BindingResult:
    shape: str
    status: str
    rows: Any = None
    meta: dict[str, Any] = field(default_factory=dict)


FetchFn = Callable[[BindingContext], Awaitable[BindingResult]]


@dataclass(frozen=True)
class Binding:
    contracts: list[str]
    shapes: list[str]
    fetch: FetchFn


def filter_agent_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """S11: the agent-activity feed shows agent-principal rows only
    (`PLAT-IDENTITY-1` scheme: `urn:weave:principal:agent:*`).
    """
    return [row for row in rows if str(row.get("actor_principal_iri", "")).startswith(
        "urn:weave:principal:agent:"
    )]


async def _ontology_health(ctx: BindingContext) -> BindingResult:
    """S1: all five CE-METRICS-1 fields."""
    try:
        body = await ce_metrics.fetch_body(ctx.ce_client, headers=ctx.ce_headers)
    except ce_metrics.CeMetricsUnavailable:
        return BindingResult(shape="scalar", status="unavailable", rows=None)
    return BindingResult(shape="scalar", status="fresh", rows=body)


#: S2's own naming of which links are required per kind -- named HERE by
#: the consumer, never derived per-kind in the CE query (contracts.md
#: coverage_gap note).
_COMPLETENESS_PAIRS: list[tuple[str, list[str]]] = [
    ("Process", ["performedBy", "governedBy"]),
    ("BusinessCapability", ["ownedBy"]),
]


async def _completeness(ctx: BindingContext) -> BindingResult:
    """S2: entity_count_by_kind + coverage_gap pairs."""
    try:
        counts = await ce_metrics.fetch(
            ctx.ce_client, {"field": "entity_count_by_kind"}, headers=ctx.ce_headers
        )
        gaps: list[dict[str, Any]] = []
        for kind, links in _COMPLETENESS_PAIRS:
            kind_gaps = await coverage_gap.coverage_gap(
                ctx.ce_client, kind=kind, required_links=links, headers=ctx.ce_headers
            )
            # TASK-017 AC-3: tag each row with the kind it was queried
            # for -- role-home's completeness map attributes a gap to its
            # kind without a second SPARQL round-trip.
            gaps.extend({**gap, "kind": kind} for gap in kind_gaps)
    except (ce_metrics.CeMetricsUnavailable, httpx.HTTPError):
        return BindingResult(shape="matrix", status="unavailable", rows=None)
    return BindingResult(shape="matrix", status="fresh", rows={"counts": counts, "gaps": gaps})


async def _token_spend(ctx: BindingContext) -> BindingResult:
    """S3-token: PLAT-BILLING-1 usage + PLAT-SETTINGS-1 burn-rate alert.
    `runs` (per-run dimension) stays dark until Events GA (AC-7) -- the
    M1 usage read is tenant/workspace-scoped (`billing/usage.py`); the
    contract's `group_by=engine|user|project` breakdown is not yet
    implemented by the M1 billing router (ADR-019, out of this task's
    scope -- flagged, not silently invented).
    """
    summary = await get_usage_summary(ctx.conn, tenant_id=ctx.tenant_id, workspace_id=None)
    burn_rate_pct = await threshold(
        ctx.conn,
        tenant_id=ctx.tenant_id,
        context_iri=ctx.context_iri,
        key="dashboard.billing.burn_rate_alert_pct",
    )
    rows: dict[str, Any] = {
        "total_tokens": summary.total_tokens,
        "total_cost_usd": None,  # cost is null pending the rate-card contract (2026-07-08 ruling)
        "cap_utilisation_pct": summary.cap_utilisation_pct,
        "burn_rate_alert": summary.cap_utilisation_pct >= burn_rate_pct,
        "runs": NOT_YET_AVAILABLE if not availability.is_ga("events") else summary.total_runs,
    }
    return BindingResult(shape="series", status="fresh", rows=rows)


async def _compliance(ctx: BindingContext) -> BindingResult:
    """S5: shacl_errors_by_severity (pending-shape aware) + per-contravention
    `/resource/{iri}` deep-link rows (AC-3).
    """
    try:
        severity = await ce_metrics.fetch(
            ctx.ce_client, {"field": "shacl_errors_by_severity"}, headers=ctx.ce_headers
        )
    except ce_metrics.CeMetricsUnavailable:
        return BindingResult(shape="categorical", status="unavailable", rows=None)
    if isinstance(severity, dict) and severity.get("pending") is True:
        return BindingResult(shape="categorical", status="pending", rows={"pending": True})
    try:
        rows = await coverage_gap.contraventions(ctx.ce_client, headers=ctx.ce_headers)
    except httpx.HTTPError:
        rows = []
    return BindingResult(
        shape="categorical",
        status="fresh",
        rows={"by_severity": severity, "contraventions": rows},
    )


async def _ontology_issues(ctx: BindingContext) -> BindingResult:
    """S7-CE: owl_inconsistencies + CE-VERSION-1 canonical lag; Build-project
    issues stay `not_yet_available` (Build is not GA, AC-7).
    """
    try:
        inconsistencies = await ce_metrics.fetch(
            ctx.ce_client, {"field": "owl_inconsistencies"}, headers=ctx.ce_headers
        )
        versions_resp = await ctx.ce_client.get("/api/ontology/versions", headers=ctx.ce_headers)
        versions_resp.raise_for_status()
        versions = versions_resp.json().get("versions", [])
    except (ce_metrics.CeMetricsUnavailable, httpx.HTTPError):
        return BindingResult(shape="scalar", status="unavailable", rows=None)
    lag = 0
    for entry in versions:
        if entry.get("status") == "published":
            break
        lag += 1
    lag_amber = await threshold(
        ctx.conn,
        tenant_id=ctx.tenant_id,
        context_iri=ctx.context_iri,
        key="dashboard.version_lag.amber",
    )
    build_issues = NOT_YET_AVAILABLE if not availability.is_ga("build") else []
    rows = {
        "owl_inconsistencies": inconsistencies,
        "version_lag": lag,
        "stale": lag >= lag_amber,
        "build_issues": build_issues,
    }
    return BindingResult(shape="scalar", status="fresh", rows=rows)


async def _operational_health(ctx: BindingContext) -> BindingResult:
    """S10: CloudWatch ops metrics -- never PLAT-AUDIT-1."""
    window_days = int(
        await threshold(
            ctx.conn,
            tenant_id=ctx.tenant_id,
            context_iri=ctx.context_iri,
            key="dashboard.ops.window_days",
        )
    )
    spike_factor = await threshold(
        ctx.conn,
        tenant_id=ctx.tenant_id,
        context_iri=ctx.context_iri,
        key="dashboard.ops.spike_factor",
    )
    result = ops_health.aggregate(
        ops_health.cloudwatch_client(),
        engines=["ce", "build", "events", "explorer"],
        window_days=window_days,
        spike_factor=spike_factor,
    )
    rows = {
        "rates_by_engine": [
            {"engine": er.engine, "rates": er.rates, "baseline": er.baseline}
            for er in result.rates_by_engine
        ],
        "alert_banner": [
            {"engine": er.engine, "rates": er.rates} for er in result.spikes
        ],
    }
    return BindingResult(shape="scalar", status="fresh", rows=rows)


async def _agent_activity(ctx: BindingContext) -> BindingResult:
    """S11: PLAT-AUDIT-1 filtered to agent-principal actors; non-CE engine
    rows are not-yet-available (AC-7).
    """
    page = await list_entries(ctx.conn, tenant_id=ctx.tenant_id, page=1, per_page=50)
    agent_rows = filter_agent_rows(
        [
            {
                "actor_principal_iri": e.actor_principal_iri,
                "engine": e.engine,
                "event_type": e.event_type,
                "target_iri": e.target_iri,
                "ts": e.ts,
            }
            for e in page.entries
        ]
    )
    ce_rows = [row for row in agent_rows if row["engine"] == "ce"]
    other_rows = [
        {**row, "status": NOT_YET_AVAILABLE} for row in agent_rows if row["engine"] != "ce"
    ]
    return BindingResult(shape="events", status="fresh", rows=ce_rows + other_rows)


async def _growth_trend(ctx: BindingContext) -> BindingResult:
    """S13: `metrics_daily_snapshots` series + stagnation advisory."""
    window_days = int(
        await threshold(
            ctx.conn,
            tenant_id=ctx.tenant_id,
            context_iri=ctx.context_iri,
            key="dashboard.growth.window_days",
        )
    )
    stagnation_days = int(
        await threshold(
            ctx.conn,
            tenant_id=ctx.tenant_id,
            context_iri=ctx.context_iri,
            key="dashboard.growth.stagnation_days",
        )
    )
    samples = await snapshots.growth_series(
        ctx.conn, tenant_id=ctx.tenant_id, window_days=window_days
    )
    if not samples:
        return BindingResult(shape="series", status="stale", rows=[], meta={"advisory": False})
    advisory = snapshots.stagnation_advisory(samples, stagnation_days=stagnation_days)
    return BindingResult(
        shape="series",
        status="fresh",
        rows=[{"day": s.day.isoformat(), "entity_count": s.entity_count} for s in samples],
        meta={"advisory": advisory},
    )


async def _rbac_coverage(ctx: BindingContext) -> BindingResult:
    """S14: RBAC & access coverage -- never renders "0 gaps" on a source
    error (AC-6); returns `unavailable` rather than a fabricated empty set.
    """
    rows = await ctx.conn.fetch(
        """
        SELECT wm.user_sub, wm.workspace_id, wm.role
        FROM workspace_members wm
        WHERE wm.tenant_id = $1 AND wm.status = 'active'
        """,
        ctx.tenant_id,
    )
    users_without_role = [dict(r) for r in rows if not r["role"]]
    return BindingResult(
        shape="matrix",
        status="fresh",
        rows={"users_without_role": users_without_role, "total_members": len(rows)},
    )


async def _onboarding_progress(ctx: BindingContext) -> BindingResult:
    """S15: reuses S2's per-kind completeness computation, different
    projection (percentage, never false 0%/100% on error -- AC-6).
    """
    try:
        counts = await ce_metrics.fetch(
            ctx.ce_client, {"field": "entity_count_by_kind"}, headers=ctx.ce_headers
        )
    except ce_metrics.CeMetricsUnavailable:
        return BindingResult(shape="ranked", status="unavailable", rows=None)
    populated_kinds = sum(
        1 for count in counts.values() if isinstance(count, (int, float)) and count > 0
    )
    total_kinds = len(counts) or 1
    pct = round(100 * populated_kinds / total_kinds, 1)
    return BindingResult(shape="ranked", status="fresh", rows={"completeness_pct": pct})


CATEGORIES: dict[str, Binding] = {
    "ontology-health": Binding(
        contracts=["CE-METRICS-1"], shapes=["scalar", "categorical"], fetch=_ontology_health
    ),
    "completeness": Binding(
        contracts=["CE-METRICS-1", "CE-READ-1"], shapes=["matrix", "ranked"], fetch=_completeness
    ),
    "token-spend": Binding(
        contracts=["PLAT-BILLING-1", "PLAT-SETTINGS-1"],
        shapes=["series", "categorical", "scalar"],
        fetch=_token_spend,
    ),
    "compliance": Binding(
        contracts=["CE-METRICS-1", "CE-READ-1"], shapes=["categorical"], fetch=_compliance
    ),
    "ontology-issues": Binding(
        contracts=["CE-METRICS-1", "CE-READ-1", "CE-VERSION-1"],
        shapes=["scalar"],
        fetch=_ontology_issues,
    ),
    "operational-health": Binding(contracts=[], shapes=["scalar"], fetch=_operational_health),
    "agent-activity": Binding(
        contracts=["PLAT-AUDIT-1", "PLAT-IDENTITY-1"], shapes=["events"], fetch=_agent_activity
    ),
    "graph-growth": Binding(contracts=["CE-METRICS-1"], shapes=["series"], fetch=_growth_trend),
    "rbac-coverage": Binding(
        contracts=["PLAT-SETTINGS-1", "PLAT-IDENTITY-1"], shapes=["matrix"], fetch=_rbac_coverage
    ),
    "onboarding-progress": Binding(
        contracts=["CE-METRICS-1"], shapes=["ranked"], fetch=_onboarding_progress
    ),
}


async def resolve_category(name: str, ctx: BindingContext) -> BindingResult:
    """Registry-driven entry point (AC-7): resolver/tiles/role-home never
    hand-check availability -- gating lives here, once.
    """
    binding = CATEGORIES[name]
    if not availability.source_available(binding.contracts):
        return BindingResult(shape=binding.shapes[0], status=NOT_YET_AVAILABLE, rows=None)
    return await binding.fetch(ctx)
