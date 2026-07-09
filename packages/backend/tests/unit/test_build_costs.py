"""TASK-013 (ADR-008 Decisions #4/#5, FR-008) unit tests: the forecast
formula (AC-1/AC-2), Company->Domain->Project cascade tighter-wins cap
resolution (AC-3), and the named-error-not-zero rollup guard (AC-6). Fake
connections -- same pattern as `test_build_cost.py`/`test_settings_resolver.py`;
no real Postgres needed (that proof lives in the docker-marked
`tests/integration/test_costs_api.py`).
"""

from __future__ import annotations

import json
from decimal import Decimal
from typing import Any

import pytest

from weave_backend.briefs.store import BriefEstimate, estimates
from weave_backend.build.costs import (
    RollupUnavailable,
    check_budget,
    compute_forecast,
    get_costs,
    resolve_budget_cap,
)
from weave_backend.settings.resolver import set_setting

_TENANT = "tenant-budget"
_DOMAIN_ID = "d1"
_PROJECT_ID = "p1"
_COMPANY_IRI = f"urn:weave:tenant:{_TENANT}:company"
_DOMAIN_IRI = f"urn:weave:tenant:{_TENANT}:domain:{_DOMAIN_ID}"
_DOMAIN_PROJECT_IRI = f"urn:weave:tenant:{_TENANT}:domain:{_DOMAIN_ID}:project:{_PROJECT_ID}"
_PROJECT_IRI = f"urn:weave:project:{_TENANT}:acme"


def test_forecast_uses_calibrated_actuals_when_tasks_completed() -> None:
    """AC-2 (ADR-008 #4): done tasks anchor `mean_actual`; the calibration
    ratio scales it by relative brief-token size of what's left. Hand
    computed: mean_actual=$1 (only done task cost), calibration=2000/1000=2,
    forecast = 1 * 1 todo * 2 = $2.
    """
    task_costs = {"t-done": Decimal("1")}
    briefs = [
        BriefEstimate(task_id="t-done", brief_estimate_tokens=1000, estimated_cost_usd=None),
        BriefEstimate(task_id="t-todo", brief_estimate_tokens=2000, estimated_cost_usd=None),
    ]

    result = compute_forecast(
        task_costs=task_costs, briefs=briefs, done_task_ids={"t-done"}
    )

    assert result.amount_usd == Decimal("2")
    assert result.inputs.basis == "calibrated"
    assert result.inputs.mean_actual == Decimal("1")
    assert result.inputs.completed_count == 1
    assert result.inputs.remaining_count == 1
    assert result.inputs.calibration == Decimal("2")


def test_forecast_falls_back_to_brief_only_when_no_tasks_completed() -> None:
    """AC-2: no actuals yet -- sum the todo briefs' own `estimated_cost_usd`
    (already USD; not re-derived from tokens x rate-card, ADR-013).
    """
    briefs = [
        BriefEstimate(task_id="t1", brief_estimate_tokens=1000, estimated_cost_usd=Decimal("3")),
        BriefEstimate(task_id="t2", brief_estimate_tokens=2000, estimated_cost_usd=Decimal("2")),
    ]

    result = compute_forecast(task_costs={}, briefs=briefs, done_task_ids=set())

    assert result.amount_usd == Decimal("5")
    assert result.inputs.basis == "brief_only"
    assert result.inputs.completed_count == 0
    assert result.inputs.remaining_count == 2


async def test_resolve_budget_cap_tighter_wins_across_cascade() -> None:
    """AC-3: a domain-level cap overrides a looser company-level cap; the
    binding level is reported straight from
    `ResolvedSetting.resolved_at` -- no extra derivation.
    """
    conn = _FakeSettingsConnection()
    await set_setting(
        conn, tenant_id=_TENANT, key="build.budget.cap_usd", scope_iri=_COMPANY_IRI, value=100
    )
    await set_setting(
        conn, tenant_id=_TENANT, key="build.budget.cap_usd", scope_iri=_DOMAIN_IRI, value=50
    )

    resolved = await resolve_budget_cap(
        conn, tenant_id=_TENANT, context_iri=_DOMAIN_PROJECT_IRI
    )

    assert resolved is not None
    assert resolved.cap_usd == Decimal("50")
    assert resolved.level == "domain"


async def test_costs_payload_labels_all_figures_estimated() -> None:
    """AC-1: every costs read carries the `"estimated"` label, greppable in
    the payload builder (DoD verify-by) -- never presented as authoritative.
    """
    conn = _FakeCostsConnection(
        cost_rows=[
            {"task_id": None, "is_total": True, "tokens_in": 10, "tokens_out": 5,
             "cost_usd": Decimal("0.5")},
        ],
    )

    payload = await get_costs(conn, tenant_id=_TENANT, project_iri=_PROJECT_IRI)

    assert payload.label == "estimated"
    assert payload.total_estimate_usd == Decimal("0.5")


async def test_get_costs_raises_named_error_not_zero_when_rollup_unavailable() -> None:
    """AC-6: a rollup query failure (DB error) surfaces as a named
    exception -- never a payload with `total_estimate_usd == 0` (a false
    "no spend" health signal).
    """
    conn = _FakeCostsConnection(fail_rollup=True)

    with pytest.raises(RollupUnavailable):
        await get_costs(conn, tenant_id=_TENANT, project_iri=_PROJECT_IRI)


async def test_get_costs_by_task_left_joins_brief_estimate_tokens() -> None:
    """Implementation Hints: the `by_task` join is a LEFT JOIN -- a
    brief-less spend row (`t2`) keeps `brief_estimate_tokens: None`, never
    dropped, and a briefed row's tokens come straight from the brief's own
    `cost_estimate` (`briefs.store.estimates`/`BriefEstimate`, ADR-008 #4).
    """
    conn = _FakeCostsConnection(
        cost_rows=[
            {"task_id": None, "is_total": True, "tokens_in": 30, "tokens_out": 15,
             "cost_usd": Decimal("3")},
            {"task_id": "t1", "is_total": False, "tokens_in": 20, "tokens_out": 10,
             "cost_usd": Decimal("2")},
            {"task_id": "t2", "is_total": False, "tokens_in": 10, "tokens_out": 5,
             "cost_usd": Decimal("1")},
        ],
        brief_rows=[
            {"task_id": "t1", "content": {"cost_estimate": {
                "complexity": "S", "estimated_tokens_input_k": 1,
                "estimated_tokens_output_k": 0.5, "estimated_cost_usd": 1.5,
            }}},
        ],
    )

    payload = await get_costs(conn, tenant_id=_TENANT, project_iri=_PROJECT_IRI)

    by_task = {row.task_id: row for row in payload.by_task}
    assert by_task["t1"].brief_estimate_tokens == 1500
    assert by_task["t2"].brief_estimate_tokens is None


async def test_estimates_parses_stored_brief_content_into_brief_estimate() -> None:
    """`briefs.store.estimates`'s own parsing -- token/cost fields lifted out
    of the persisted `cost_estimate` document straight into `BriefEstimate`.
    """
    conn = _FakeCostsConnection(
        brief_rows=[
            {"task_id": "t1", "content": {"cost_estimate": {
                "complexity": "M", "estimated_tokens_input_k": 2,
                "estimated_tokens_output_k": 1, "estimated_cost_usd": 4.25,
            }}},
        ],
    )

    result = await estimates(conn, tenant_id=_TENANT, project_iri=_PROJECT_IRI)

    assert result == [
        BriefEstimate(task_id="t1", brief_estimate_tokens=3000, estimated_cost_usd=Decimal("4.25"))
    ]


async def test_get_costs_returns_zero_total_when_rollup_has_no_rows_at_all() -> None:
    """QA edge case: a brand-new project with zero `cost_events` rows ever
    (not merely a NULL sum) -- `cost_events.rollup` returns no grouping rows
    at all, so `get_costs` must fall back to a real `0` total, not raise
    `RollupUnavailable` (that's the AC-6 DB-*error* case, a different path)."""
    conn = _FakeCostsConnection(cost_rows=[])

    payload = await get_costs(conn, tenant_id=_TENANT, project_iri=_PROJECT_IRI)

    assert payload.total_estimate_usd == Decimal("0")
    assert payload.by_task == []
    assert payload.label == "estimated"


async def test_forecast_excludes_in_progress_task_from_completed_cohort() -> None:
    """QA edge case (ADR-008 #4 / AC-2): a task with a recorded cost event
    but NOT in `done_task_ids` (still in progress, e.g. mid-retry) must not
    be counted as "completed" -- `basis` should stay `brief_only` and
    `completed_count` should stay 0 when `done_task_ids` is empty, even
    though that in-progress task already has spend in `task_costs`.
    """
    task_costs = {"t-inprogress": Decimal("1")}
    briefs = [
        BriefEstimate(
            task_id="t-inprogress", brief_estimate_tokens=1000, estimated_cost_usd=Decimal("2")
        ),
        BriefEstimate(
            task_id="t-todo", brief_estimate_tokens=1000, estimated_cost_usd=Decimal("2")
        ),
    ]

    result = compute_forecast(task_costs=task_costs, briefs=briefs, done_task_ids=set())

    assert result.inputs.basis == "brief_only"
    assert result.inputs.completed_count == 0


async def test_check_budget_halts_exactly_at_cap_not_only_above_it() -> None:
    """QA edge case (Design Decisions: "Halt >= cap (not >)" -- AC-4): spend
    exactly equal to the cap is a breach; one cent under is not.
    """
    conn = _FakeBudgetConnection(cap_usd=Decimal("10"), spent_usd=Decimal("10"))
    breach = await check_budget(conn, tenant_id=_TENANT, project_iri=_PROJECT_IRI)
    assert breach is not None
    assert breach.cap_usd == Decimal("10")
    assert breach.level == "company"

    conn_under = _FakeBudgetConnection(cap_usd=Decimal("10"), spent_usd=Decimal("9.99"))
    no_breach = await check_budget(conn_under, tenant_id=_TENANT, project_iri=_PROJECT_IRI)
    assert no_breach is None


class _FakeBudgetConnection:
    """Routes `fetch` for `check_budget`'s two real collaborators -- the
    settings cascade cap lookup and the cost rollup -- so the boundary check
    exercises the actual `>=` comparison in `build.costs.check_budget`,
    not a stand-in.
    """

    def __init__(self, *, cap_usd: Decimal, spent_usd: Decimal) -> None:
        self.cap_usd = cap_usd
        self.spent_usd = spent_usd

    async def fetch(self, query: str, *args: Any) -> list[dict[str, Any]]:
        if "scope_iri = ANY($2)" in query:
            _tenant_id, scope_iris, _key = args
            return [
                {"scope_iri": scope_iris[-1], "scope": "company", "value": str(self.cap_usd)}
            ]
        if "GROUPING SETS" in query:
            return [
                {
                    "task_id": None,
                    "is_total": True,
                    "tokens_in": 0,
                    "tokens_out": 0,
                    "cost_usd": self.spent_usd,
                }
            ]
        raise AssertionError(f"unexpected fetch: {query}")

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        raise AssertionError(f"unexpected fetchrow: {query}")


class _FakeSettingsConnection:
    """In-memory settings cascade stand-in -- duplicated from
    `test_build_cost.py`'s fake per that file's own precedent of not
    sharing test fakes across modules.
    """

    def __init__(self) -> None:
        self.rows: dict[tuple[str, str], dict[str, Any]] = {}

    async def fetch(self, query: str, *args: Any) -> list[dict[str, Any]]:
        if "scope_iri = ANY($2)" in query:
            _tenant_id, scope_iris, key = args
            return [
                {"scope_iri": iri, "scope": row["scope"], "value": row["value"]}
                for iri in scope_iris
                if (row := self.rows.get((iri, key))) is not None
            ]
        raise AssertionError(f"unexpected fetch: {query}")

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        if "scope_rank < $3" in query:
            return None  # these tests never seed a tighter scope first
        raise AssertionError(f"unexpected fetchrow: {query}")

    async def execute(self, query: str, *args: Any) -> str:
        _tenant_id, scope, _rank, scope_iri, key, value = args
        self.rows[(scope_iri, key)] = {"scope": scope, "value": json.dumps(json.loads(value))}
        return "INSERT 0 1"


class _FakeCostsConnection:
    """Routes `fetch`/`fetchrow` by SQL substring across the collaborators
    `get_costs` touches (cost rollup, burn rate, brief estimates, state
    spine, settings) -- no real Postgres needed.
    """

    def __init__(
        self,
        *,
        cost_rows: list[dict[str, Any]] | None = None,
        burn_row: dict[str, Any] | None = None,
        brief_rows: list[dict[str, Any]] | None = None,
        spine_row: dict[str, Any] | None = None,
        fail_rollup: bool = False,
    ) -> None:
        self.cost_rows = cost_rows or []
        self.burn_row = burn_row or {"burn_usd": Decimal("0")}
        self.brief_rows = brief_rows or []
        self.spine_row = spine_row
        self.fail_rollup = fail_rollup

    async def fetch(self, query: str, *args: Any) -> list[dict[str, Any]]:
        if "GROUPING SETS" in query:
            if self.fail_rollup:
                raise ConnectionResetError("rollup unavailable")
            return self.cost_rows
        if "FROM task_briefs" in query:
            return self.brief_rows
        if "scope_iri = ANY($2)" in query:
            return []  # burn-rate window setting unset -- default applies
        raise AssertionError(f"unexpected fetch: {query}")

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        if "FROM state_spines" in query:
            return self.spine_row
        if "FROM cost_events" in query:
            return self.burn_row
        raise AssertionError(f"unexpected fetchrow: {query}")
