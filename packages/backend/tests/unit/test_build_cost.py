"""TASK-012 (ADR-008) unit tests: rate-card resolution/validation (AC-3/AC-4),
cost computation (pseudocode), and the `record_dispatch_cost` write path
(AC-1/AC-2/AC-5/AC-6). Fake connection -- same pattern as
`test_settings_resolver.py`/`test_pm_cost_events.py`; no real Postgres
needed (that proof lives in TASK-010's docker-marked integration tests).
"""

from __future__ import annotations

import json
import logging
from decimal import Decimal
from typing import Any

import pytest

from weave_backend.build.cost import (
    DispatchCostContext,
    ModelRate,
    RateCardConfigError,
    compute_cost,
    record_dispatch_cost,
    resolve_rate_card,
)
from weave_backend.schemas.tasks import DispatchUsage
from weave_backend.settings.resolver import set_setting

_TENANT = "tenant-cost"
_COMPANY_IRI = f"urn:weave:tenant:{_TENANT}:company"
_PROJECT_IRI = f"urn:weave:tenant:{_TENANT}:ws:11111111-1111-1111-1111-111111111111:project:acme"

_RATE_CARD_VALUE = {
    "claude-fable-5": {"usd_per_1k_in": "0.01", "usd_per_1k_out": "0.02"},
    "claude-sonnet-5": {"usd_per_1k_in": "0.001", "usd_per_1k_out": "0.002"},
}


class _FakeSettingsConnection:
    """In-memory stand-in for the settings cascade -- mirrors
    `test_settings_resolver.py`'s fake (duplicated per that file's own
    precedent of not sharing test fakes across modules).
    """

    def __init__(self, rows: dict[tuple[str, str], dict[str, Any]] | None = None) -> None:
        self.rows = rows or {}

    async def fetch(self, query: str, *args: Any) -> list[dict[str, Any]]:
        if "scope_iri = ANY($2)" in query:
            _tenant_id, scope_iris, key = args
            return [
                {"scope_iri": iri, "scope": row["scope"], "value": row["value"]}
                for iri in scope_iris
                if (row := self.rows.get((iri, key))) is not None
            ]
        raise AssertionError(f"unexpected query: {query}")

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        if "scope_rank < $3" in query:
            # These tests only ever seed the loosest (company) scope, so
            # nothing is ever tighter -- no looser-override guard to trip.
            return None
        raise AssertionError(f"unexpected query: {query}")

    async def execute(self, query: str, *args: Any) -> str:
        _tenant_id, scope, _rank, scope_iri, key, value = args
        self.rows[(scope_iri, key)] = {"scope": scope, "value": json.dumps(json.loads(value))}
        return "INSERT 0 1"


async def _seeded_conn() -> _FakeSettingsConnection:
    conn = _FakeSettingsConnection()
    await set_setting(
        conn, tenant_id=_TENANT, key="build.cost.rate_card", scope_iri=_COMPANY_IRI,
        value=_RATE_CARD_VALUE,
    )
    return conn


async def test_resolve_rate_card_from_settings() -> None:
    """AC-3: resolves the `build.cost.rate_card` setting into a per-model
    `ModelRate` map, values coerced to `Decimal` (never a float literal).
    """
    conn = await _seeded_conn()

    card = await resolve_rate_card(conn, tenant_id=_TENANT, project_iri=_PROJECT_IRI)

    assert card["claude-sonnet-5"] == ModelRate(
        usd_per_1k_in=Decimal("0.001"), usd_per_1k_out=Decimal("0.002")
    )
    assert card["claude-fable-5"] == ModelRate(
        usd_per_1k_in=Decimal("0.01"), usd_per_1k_out=Decimal("0.02")
    )


async def test_halt_run_at_start_when_rate_card_unresolvable() -> None:
    """AC-4: a routable model (`ALLOWED_MODELS`) missing from the resolved
    card is a fail-closed config error, raised before any dispatch -- never
    a per-row fallback price.
    """
    conn = _FakeSettingsConnection()  # no rate_card setting at all
    await set_setting(
        conn, tenant_id=_TENANT, key="build.cost.rate_card", scope_iri=_COMPANY_IRI,
        value={"claude-sonnet-5": _RATE_CARD_VALUE["claude-sonnet-5"]},  # claude-fable-5 missing
    )

    with pytest.raises(RateCardConfigError) as exc_info:
        await resolve_rate_card(conn, tenant_id=_TENANT, project_iri=_PROJECT_IRI)

    assert "claude-fable-5" in exc_info.value.missing_models


def test_compute_cost_from_usage_block_and_per_model_rates() -> None:
    """Pseudocode: `tokens/1000 * rate`, summed across in/out."""
    rate_card = {
        "claude-sonnet-5": ModelRate(
            usd_per_1k_in=Decimal("0.003"), usd_per_1k_out=Decimal("0.015")
        )
    }

    cost = compute_cost(rate_card, model="claude-sonnet-5", tokens_in=2000, tokens_out=1000)

    assert cost == Decimal("0.021")  # 2*0.003 + 1*0.015


class _FakeCostEventsConnection:
    def __init__(self, *, fail_insert: bool = False) -> None:
        self.executed: list[tuple[str, tuple[Any, ...]]] = []
        self._fail_insert = fail_insert

    async def execute(self, query: str, *args: Any) -> None:
        if self._fail_insert and "INSERT INTO cost_events" in query:
            raise ConnectionResetError("insert failed")
        self.executed.append((query, args))


_RATE_CARD: dict[str, ModelRate] = {
    "claude-sonnet-5": ModelRate(usd_per_1k_in=Decimal("0.003"), usd_per_1k_out=Decimal("0.015"))
}
_USAGE = DispatchUsage(
    agent_role="delegate", model="claude-sonnet-5", tokens_in=1000, tokens_out=500
)


async def test_persist_cost_event_with_null_run_id_for_non_run_work() -> None:
    """AC-2: non-run work (spec drafting, replan) has no `run_id` -- and
    here, no `task_id` either; both persist as NULL, never a placeholder.
    """
    conn = _FakeCostEventsConnection()
    ctx = DispatchCostContext(
        tenant_id=_TENANT, project_iri=_PROJECT_IRI, task_id=None, run_id=None
    )
    captured: list[Any] = []

    async def _capture_emit(
        _ctx: DispatchCostContext, _usage: DispatchUsage, _cost: Decimal
    ) -> None:
        captured.append(_ctx)

    await record_dispatch_cost(
        conn, ctx, _USAGE, rate_card=_RATE_CARD, emit_billing_fn=_capture_emit
    )

    assert len(conn.executed) == 1
    _query, args = conn.executed[0]
    assert args == (
        _TENANT, _PROJECT_IRI, None, None, "delegate", "claude-sonnet-5", 1000, 500,
        Decimal("0.0105"),
    )
    assert len(captured) == 1


async def test_tag_billing_events_with_task_and_run_ids() -> None:
    """AC-5: the billing emit carries `task_id`/`run_id` metadata -- proven
    against an emitter stub, not a real PLAT-BILLING-1 round trip.
    """
    conn = _FakeCostEventsConnection()
    ctx = DispatchCostContext(
        tenant_id=_TENANT, project_iri=_PROJECT_IRI, task_id="t-1", run_id="run-1"
    )
    captured: list[DispatchCostContext] = []

    async def _capture_emit(
        _ctx: DispatchCostContext, _usage: DispatchUsage, _cost: Decimal
    ) -> None:
        captured.append(_ctx)

    await record_dispatch_cost(
        conn, ctx, _USAGE, rate_card=_RATE_CARD, emit_billing_fn=_capture_emit
    )

    assert captured[0].task_id == "t-1"
    assert captured[0].run_id == "run-1"


async def test_disclose_and_continue_when_cost_event_insert_fails(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """AC-6: an insert failure is a disclosed warning, never fatal -- the
    dispatch (here: the billing emit that follows it) still proceeds.
    """
    conn = _FakeCostEventsConnection(fail_insert=True)
    ctx = DispatchCostContext(
        tenant_id=_TENANT, project_iri=_PROJECT_IRI, task_id="t-1", run_id="run-1"
    )
    emit_calls: list[Any] = []

    async def _capture_emit(_ctx: Any, _usage: Any, _cost: Any) -> None:
        emit_calls.append(_ctx)

    with caplog.at_level(logging.WARNING, logger="weave_backend.build.cost"):
        await record_dispatch_cost(
            conn, ctx, _USAGE, rate_card=_RATE_CARD, emit_billing_fn=_capture_emit
        )

    warnings = [r for r in caplog.records if r.message == "cost_event_insert_failed"]
    assert len(warnings) == 1
    assert warnings[0].__dict__["task_id"] == "t-1"
    assert len(emit_calls) == 1  # never held up by the insert failure


async def test_billing_emit_failure_does_not_raise(caplog: pytest.LogCaptureFixture) -> None:
    """AC-5: a metering-emit failure never fails the dispatch."""
    conn = _FakeCostEventsConnection()
    ctx = DispatchCostContext(
        tenant_id=_TENANT, project_iri=_PROJECT_IRI, task_id="t-1", run_id="run-1"
    )

    async def _boom(_ctx: Any, _usage: Any, _cost: Any) -> None:
        raise ConnectionError("billing queue unreachable")

    with caplog.at_level(logging.WARNING, logger="weave_backend.build.cost"):
        await record_dispatch_cost(conn, ctx, _USAGE, rate_card=_RATE_CARD, emit_billing_fn=_boom)

    assert len(conn.executed) == 1  # the cost_events row still landed
    assert any(r.message == "billing_emit_failed" for r in caplog.records)


async def test_default_emit_billing_sends_tagged_token_usage_record(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The production `emit_billing_fn` default -- resolves workspace from
    the project IRI (ADR-004 grammar) and forwards to
    `billing.metering.record_token_usage`, tagged with task/run ids.
    """
    from weave_backend.build import cost as cost_module

    sent: list[Any] = []

    async def _fake_record_token_usage(_redis: Any, record: Any, **_kw: Any) -> None:
        sent.append(record)

    monkeypatch.setattr(cost_module, "record_token_usage", _fake_record_token_usage)
    monkeypatch.setattr(cost_module, "get_redis", lambda: "fake-redis")

    ctx = DispatchCostContext(
        tenant_id=_TENANT, project_iri=_PROJECT_IRI, task_id="t-1", run_id="run-1"
    )

    await cost_module.default_emit_billing(ctx, _USAGE, Decimal("0.0105"))

    assert len(sent) == 1
    record = sent[0]
    assert record.task_id == "t-1"
    assert record.run_id == "run-1"
    assert record.tenant_id == _TENANT
    assert record.workspace_id == "11111111-1111-1111-1111-111111111111"
