"""TASK-012 (ADR-008): per-dispatch usage attribution -- rate-card
resolution/validation at run start (AC-3/AC-4), cost computation from the
Agent SDK usage block (pseudocode), and the `cost_events` + billing-tag
write path (AC-1/AC-2/AC-5/AC-6). The single wrap point is
`build/orchestrator.py`'s `_dispatch_one` -- this module never touches an
agent directly (Implementation Hints).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import asyncpg

from weave_backend.billing.metering import TokenUsageRecord, record_token_usage
from weave_backend.build.model_routing import ALLOWED_MODELS, ROLE_TIER
from weave_backend.build.state_spine import BUILD_PRINCIPAL_IRI
from weave_backend.pm import cost_events
from weave_backend.schemas.tasks import DispatchUsage
from weave_backend.settings.resolver import SettingNotFound, resolve_setting
from weave_backend.settings.scope import InvalidScopeIri, company_iri, workspace_of
from weave_backend.tenancy.sessions import get_redis

log = logging.getLogger(__name__)

#: PLAT-SETTINGS-1 group key (ADR-008 #2) -- never a hardcoded price.
RATE_CARD_KEY = "build.cost.rate_card"


class RateCardConfigError(Exception):
    """AC-4: one or more `ALLOWED_MODELS` has no rate-card entry -- the run
    halts before any dispatch, same fail-closed posture as
    `model_routing.ModelRoutingError`.
    """

    def __init__(self, missing_models: frozenset[str]) -> None:
        super().__init__(f"rate card missing model(s): {sorted(missing_models)}")
        self.missing_models = missing_models


@dataclass(frozen=True)
class ModelRate:
    usd_per_1k_in: Decimal
    usd_per_1k_out: Decimal


RateCard = dict[str, ModelRate]


async def resolve_rate_card(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str
) -> RateCard:
    """AC-3/AC-4: resolve the `build.cost.rate_card` PLAT-SETTINGS-1 setting
    (one JSON object, `{model_id: {usd_per_1k_in, usd_per_1k_out}}`) and
    validate every routable model (`ALLOWED_MODELS`) has an entry --
    fail-closed, never a per-row fallback price.

    XT-BE013-1: every real `project_iri` (`urn:weave:project:{tid}:{slug}`,
    `projects/model.py::build_project_iri`) does not parse under
    `settings/scope.py`'s cascade grammar and always raises
    `InvalidScopeIri` here -- same gap as `build/costs.py::resolve_budget_cap`.
    Before this fix that fell straight through to an empty card, so
    `RATE_CARD_KEY` was unresolvable on every real run regardless of what was
    configured. Mirrors `resolve_budget_cap`'s fallback: retry at the
    tenant's company scope, so at least the company-wide rate card is
    reachable. Domain/project overrides stay inert until Build threads a
    domain-aware project IRI (schema gap -- see the coordinator escalation).
    """
    try:
        resolved = await resolve_setting(
            conn, tenant_id=tenant_id, key=RATE_CARD_KEY, context_iri=project_iri
        )
        raw_card: dict[str, dict[str, str]] = resolved.value
    except InvalidScopeIri:
        try:
            resolved = await resolve_setting(
                conn, tenant_id=tenant_id, key=RATE_CARD_KEY,
                context_iri=company_iri(tenant_id),
            )
            raw_card = resolved.value
        except SettingNotFound:
            raw_card = {}
    except SettingNotFound:
        raw_card = {}

    card = {
        model: ModelRate(
            usd_per_1k_in=Decimal(str(rate["usd_per_1k_in"])),
            usd_per_1k_out=Decimal(str(rate["usd_per_1k_out"])),
        )
        for model, rate in raw_card.items()
    }

    missing = ALLOWED_MODELS - card.keys()
    if missing:
        raise RateCardConfigError(frozenset(missing))
    return card


def compute_cost(rate_card: RateCard, *, model: str, tokens_in: int, tokens_out: int) -> Decimal:
    """`tokens / 1000 * per-1k rate`, summed across in/out (pseudocode)."""
    rate = rate_card[model]
    return (Decimal(tokens_in) / 1000) * rate.usd_per_1k_in + (
        Decimal(tokens_out) / 1000
    ) * rate.usd_per_1k_out


@dataclass(frozen=True)
class DispatchCostContext:
    """AC-1/AC-2: `task_id`/`run_id` are both nullable -- non-run work
    (spec drafting, replan) attributes with one or both NULL.
    """

    tenant_id: str
    project_iri: str
    task_id: str | None
    run_id: str | None


async def default_emit_billing(
    ctx: DispatchCostContext, usage: DispatchUsage, cost: Decimal
) -> None:
    """AC-5: tag the existing PLAT-BILLING-1 per-token metering event with
    `task_id`/`run_id` (additive metadata, ADR-008 #3) -- workspace is
    derived from the project IRI (ADR-004 grammar), never a separate lookup.
    """
    record = TokenUsageRecord(
        tenant_id=ctx.tenant_id,
        workspace_id=workspace_of(ctx.project_iri) or "",
        principal_iri=BUILD_PRINCIPAL_IRI,
        model_tier=ROLE_TIER.get(usage.agent_role, usage.model),
        input_tokens=usage.tokens_in,
        output_tokens=usage.tokens_out,
        cost_usd=float(cost),
        ts=datetime.now(UTC),
        task_id=ctx.task_id,
        run_id=ctx.run_id,
    )
    await record_token_usage(get_redis(), record)


async def record_dispatch_cost(
    conn: asyncpg.Connection,
    ctx: DispatchCostContext,
    usage: DispatchUsage,
    *,
    rate_card: RateCard,
    emit_billing_fn: Any = default_emit_billing,
) -> None:
    """AC-1/AC-2/AC-5/AC-6: the dispatch-site wrap point. The `cost_events`
    insert is synchronous-cheap (one row); an insert failure is a disclosed
    warning, never fatal (AC-6). The billing emit always fires after,
    regardless of insert outcome; a metering-emit failure never fails the
    dispatch either (AC-5).
    """
    cost = compute_cost(
        rate_card, model=usage.model, tokens_in=usage.tokens_in, tokens_out=usage.tokens_out
    )

    try:
        await cost_events.insert(
            conn,
            tenant_id=ctx.tenant_id,
            event=cost_events.NewCostEvent(
                project_iri=ctx.project_iri,
                task_id=ctx.task_id,
                run_id=ctx.run_id,
                agent_role=usage.agent_role,
                model=usage.model,
                tokens_in=usage.tokens_in,
                tokens_out=usage.tokens_out,
                cost_estimate_usd=cost,
            ),
        )
    except Exception:  # AC-6: attribution loss is disclosed, never fatal
        log.warning(
            "cost_event_insert_failed",
            extra={"task_id": ctx.task_id, "run_id": ctx.run_id, "model": usage.model},
        )

    try:
        await emit_billing_fn(ctx, usage, cost)
    except Exception:  # AC-5: never-dropped queue owns delivery, not this dispatch
        log.warning(
            "billing_emit_failed", extra={"task_id": ctx.task_id, "run_id": ctx.run_id}
        )
