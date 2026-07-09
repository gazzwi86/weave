"""TASK-013 (ADR-008 Decisions #4/#5, FR-008): the costs read side --
`GET /api/projects/{id}/costs` (AC-1..AC-3/AC-6) and the budget-cascade
breach check the orchestrator runs at every dispatch checkpoint (AC-4/AC-5).

Reuses `billing/gate.py`'s pattern (cascade-resolved cap via
`PLAT-SETTINGS-1`, fail-open on no cap configured -- ADR-009) rather than
its literal per-period `ai.budget.per_period_usd` setting: that key tracks
Redis-metered per-period consumption for the invoicing gate, a different
concept from this module's cumulative-project-spend cap. See
`docs/specs/weave/engines/build-engine/decisions/ADR-013.md`.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from decimal import Decimal
from typing import Literal

import asyncpg

from weave_backend.briefs.store import BriefEstimate
from weave_backend.briefs.store import estimates as brief_estimates
from weave_backend.build.state_spine import BUILD_PRINCIPAL_IRI, load_state_spine
from weave_backend.notifications.dispatch import dispatch_notification
from weave_backend.notifications.store import NotificationEvent
from weave_backend.pm import contributors, cost_events
from weave_backend.settings.resolver import SettingNotFound, resolve_setting
from weave_backend.settings.scope import InvalidScopeIri, company_iri

log = logging.getLogger(__name__)

#: PLAT-SETTINGS-1 key for this module's cumulative-project-spend cap --
#: namespaced like `build/cost.py`'s `RATE_CARD_KEY`, deliberately distinct
#: from `billing/caps.py`'s per-period `ai.budget.per_period_usd`.
BUDGET_CAP_KEY = "build.budget.cap_usd"


class RollupUnavailable(Exception):
    """AC-6: the cost rollup query failed -- callers must surface this as a
    named error state, never a payload with `total_estimate_usd == 0` (a
    false "no spend" health signal).
    """


@dataclass(frozen=True)
class ResolvedCap:
    cap_usd: Decimal
    level: str


@dataclass(frozen=True)
class BudgetBreach:
    cap_usd: Decimal
    spent_usd: Decimal
    level: str


@dataclass(frozen=True)
class ForecastInputs:
    basis: Literal["calibrated", "brief_only"]
    mean_actual: Decimal
    completed_count: int
    remaining_count: int
    calibration: Decimal


@dataclass(frozen=True)
class Forecast:
    amount_usd: Decimal
    inputs: ForecastInputs


@dataclass(frozen=True)
class TaskCostRow:
    task_id: str
    tokens_in: int
    tokens_out: int
    cost_estimate_usd: Decimal
    brief_estimate_tokens: int | None


@dataclass(frozen=True)
class CostsPayload:
    total_estimate_usd: Decimal
    by_task: list[TaskCostRow]
    burn_rate_usd: Decimal
    forecast_usd: Decimal
    forecast_inputs: ForecastInputs
    label: Literal["estimated"] = "estimated"


async def resolve_budget_cap(
    conn: asyncpg.Connection, *, tenant_id: str, context_iri: str
) -> ResolvedCap | None:
    """AC-3: tighter-wins cascade lookup via `PLAT-SETTINGS-1`. `None` means
    no cap configured anywhere in the cascade -- unmetered, fail-open
    (ADR-009), same posture as `billing/gate.py`.

    `context_iri` is usually a real project IRI (`urn:weave:project:{tid}:
    {slug}`), which does not parse under `settings/scope.py`'s cascade
    grammar (see ADR-013) -- that raises `InvalidScopeIri`, caught here and
    retried at the tenant's company scope, so only the company-wide default
    cap is reachable in production today (domain/project overrides are
    inert until a follow-up threads a domain-aware project IRI).
    """
    try:
        resolved = await resolve_setting(
            conn, tenant_id=tenant_id, key=BUDGET_CAP_KEY, context_iri=context_iri
        )
    except InvalidScopeIri:
        try:
            resolved = await resolve_setting(
                conn,
                tenant_id=tenant_id,
                key=BUDGET_CAP_KEY,
                context_iri=company_iri(tenant_id),
            )
        except SettingNotFound:
            return None
    except SettingNotFound:
        return None
    return ResolvedCap(cap_usd=Decimal(str(resolved.value)), level=resolved.resolved_at)


async def check_budget(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str
) -> BudgetBreach | None:
    """AC-4: "halt >= cap, not >" -- reads the local rollup synchronously at
    the caller's safe checkpoint. `None` cap (fail-open) or spend below cap
    means no breach.
    """
    cap = await resolve_budget_cap(conn, tenant_id=tenant_id, context_iri=project_iri)
    if cap is None:
        return None
    rollup = await cost_events.rollup(conn, tenant_id=tenant_id, project_iri=project_iri)
    spent = rollup.total.cost_usd
    if spent >= cap.cap_usd:
        return BudgetBreach(cap_usd=cap.cap_usd, spent_usd=spent, level=cap.level)
    return None


async def notify_budget_breach(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str, breach: BudgetBreach
) -> None:
    """AC-5's `PLAT-NOTIFY-1` budget event -- project admins only (mirrors
    `billing/gate.py`'s admin-recipient pattern, scoped to this project's
    contributors rather than a workspace).
    """
    project_contributors = await contributors.get_all(
        conn, tenant_id=tenant_id, project_iri=project_iri
    )
    for contributor in project_contributors:
        if contributor.role != "admin":
            continue
        await dispatch_notification(
            conn,
            NotificationEvent(
                tenant_id=tenant_id,
                recipient_iri=contributor.principal_iri,
                event_type="build.budget.breach",
                payload={
                    "project_iri": project_iri,
                    "cap_usd": str(breach.cap_usd),
                    "spent_usd": str(breach.spent_usd),
                    "level": breach.level,
                },
                actor_iri=BUILD_PRINCIPAL_IRI,
            ),
        )


def compute_forecast(
    *,
    task_costs: dict[str, Decimal],
    briefs: list[BriefEstimate],
    done_task_ids: set[str],
) -> Forecast:
    """ADR-008 #4: mean actual cost over completed tasks, scaled by the
    relative brief-token size of what's left (`calibrated`); falls back to
    summing the remaining briefs' own `estimated_cost_usd` when nothing has
    completed yet (`brief_only` -- ADR-013, not re-derived from tokens x
    rate-card).
    """
    remaining = [b for b in briefs if b.task_id not in done_task_ids]
    done_costs = [
        task_costs[b.task_id]
        for b in briefs
        if b.task_id in task_costs and b.task_id in done_task_ids
    ]

    if not done_costs:
        amount = sum(
            (b.estimated_cost_usd for b in remaining if b.estimated_cost_usd is not None),
            Decimal("0"),
        )
        inputs = ForecastInputs(
            basis="brief_only",
            mean_actual=Decimal("0"),
            completed_count=0,
            remaining_count=len(remaining),
            calibration=Decimal("0"),
        )
        return Forecast(amount_usd=amount, inputs=inputs)

    mean_actual = sum(done_costs, Decimal("0")) / len(done_costs)
    done_tokens = [
        b.brief_estimate_tokens
        for b in briefs
        if b.task_id in done_task_ids and b.brief_estimate_tokens is not None
    ]
    remaining_tokens = [
        b.brief_estimate_tokens for b in remaining if b.brief_estimate_tokens is not None
    ]
    done_tokens_mean = (
        Decimal(sum(done_tokens)) / len(done_tokens) if done_tokens else Decimal("1")
    )
    remaining_tokens_mean = (
        Decimal(sum(remaining_tokens)) / len(remaining_tokens)
        if remaining_tokens
        else done_tokens_mean
    )
    calibration = remaining_tokens_mean / done_tokens_mean if done_tokens_mean else Decimal("1")

    inputs = ForecastInputs(
        basis="calibrated",
        mean_actual=mean_actual,
        completed_count=len(done_costs),
        remaining_count=len(remaining),
        calibration=calibration,
    )
    return Forecast(amount_usd=mean_actual * len(remaining) * calibration, inputs=inputs)


async def get_costs(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str
) -> CostsPayload:
    """AC-1/AC-2/AC-3/AC-6: the full costs read -- rollup totals, per-task
    breakdown (brief-less spend rows keep `brief_estimate_tokens: None`, a
    LEFT JOIN, never dropped), trailing burn rate, and the forecast.
    """
    try:
        rollup = await cost_events.rollup(conn, tenant_id=tenant_id, project_iri=project_iri)
    except (asyncpg.PostgresError, OSError) as exc:
        raise RollupUnavailable(f"cost rollup unavailable for {project_iri}") from exc

    briefs = await brief_estimates(conn, tenant_id=tenant_id, project_iri=project_iri)
    burn_rate_usd = await cost_events.burn_rate(conn, tenant_id=tenant_id, project_iri=project_iri)
    spine = await load_state_spine(conn, tenant_id=tenant_id, project_iri=project_iri)
    done_task_ids = {t.id for t in spine.tasks if t.status == "Done"} if spine else set()

    task_costs = {tc.task_id: tc.cost_usd for tc in rollup.by_task if tc.task_id is not None}
    brief_tokens_by_task = {b.task_id: b.brief_estimate_tokens for b in briefs}
    by_task = [
        TaskCostRow(
            task_id=tc.task_id,
            tokens_in=tc.tokens_in,
            tokens_out=tc.tokens_out,
            cost_estimate_usd=tc.cost_usd,
            brief_estimate_tokens=brief_tokens_by_task.get(tc.task_id),
        )
        for tc in rollup.by_task
        if tc.task_id is not None
    ]
    forecast = compute_forecast(task_costs=task_costs, briefs=briefs, done_task_ids=done_task_ids)

    return CostsPayload(
        total_estimate_usd=rollup.total.cost_usd,
        by_task=by_task,
        burn_rate_usd=burn_rate_usd,
        forecast_usd=forecast.amount_usd,
        forecast_inputs=forecast.inputs,
    )
