"""PLAT-V1-TASK-013 unit tests: refine's context-threading, the
PLAT-SETTINGS-1-backed history cap, and restore's "not a new step"
invariant -- all exercised without the real Postgres/Redis stack (Law F
unit tier). The full SSE-pipeline reuse (budget gate, order invariant,
metering, audit) is proven by the integration suite
(`test_dashboard_refine_api.py`), which is where AC-1/AC-3/AC-6 live.
"""

from __future__ import annotations

from datetime import UTC, datetime

from weave_backend.dashboard import refine
from weave_backend.dashboard.generate import _resolve_with_context
from weave_backend.schemas.dashboard import WidgetSpec

_CURRENT_SPEC = WidgetSpec(
    component_type="bar_chart",
    title="Entities by kind",
    data_source_contracts=["CE-METRICS-1"],
    bindings={"field": "entity_count_by_kind"},
    column_span=6,
    data_shape="categorical",
)


async def test_refine_context_passed_to_resolver() -> None:
    """AC-1: the resolver spy receives both the delta prompt and
    `context=current_spec` -- the exact seam `generate_widget_stream` calls
    internally, so this proves the wiring without a real DB/model call.
    """
    received: dict[str, object] = {}

    async def _spy(prompt: str, context: WidgetSpec | None = None) -> WidgetSpec:
        received["prompt"] = prompt
        received["context"] = context
        return _CURRENT_SPEC

    result = await _resolve_with_context(_spy, "split by severity", _CURRENT_SPEC)

    assert received == {"prompt": "split by severity", "context": _CURRENT_SPEC}
    assert result is _CURRENT_SPEC


async def test_resolve_with_context_none_for_plain_generate() -> None:
    """Generate (no refine) still calls the resolver with `context=None` --
    same seam, so a fresh generation never accidentally inherits stale
    context from a previous call.
    """
    received: dict[str, object] = {}

    async def _spy(prompt: str, context: WidgetSpec | None = None) -> WidgetSpec:
        received["context"] = context
        return _CURRENT_SPEC

    await _resolve_with_context(_spy, "show entities by kind", None)

    assert received["context"] is None


class _FakeConn:
    """Minimal `asyncpg.Connection` stand-in: `fetch` returns canned rows
    (plain dicts, which support the same `row["col"]` subscript access
    `resolve_setting` uses), `execute` records calls for assertion.
    """

    def __init__(self, fetch_rows: list[dict[str, object]]) -> None:
        self._fetch_rows = fetch_rows
        self.executed: list[tuple[str, tuple[object, ...]]] = []

    async def fetch(self, query: str, *args: object) -> list[dict[str, object]]:
        return self._fetch_rows

    async def execute(self, query: str, *args: object) -> str:
        self.executed.append((query, args))
        return "UPDATE 1"


async def test_history_cap_config_defaults_to_ten_when_unset() -> None:
    """AC-2: no PLAT-SETTINGS-1 row anywhere in the cascade -> fail-open
    default of 10, same `SettingNotFound` shape as `billing/gate.py`.
    """
    conn = _FakeConn(fetch_rows=[])

    cap = await refine.resolve_history_cap(conn, tenant_id="t-1")

    assert cap == 10


async def test_history_cap_config_resolves_through_settings_cascade() -> None:
    """AC-2: a real settings row overrides the default -- proves this reads
    through `resolve_setting`'s cascade, not a hardcoded constant (the
    `example_prompts.py::EXAMPLE_PROMPTS_HIDE_AFTER` anti-pattern this task
    must NOT repeat).
    """
    conn = _FakeConn(
        fetch_rows=[
            {
                "scope_iri": "urn:weave:tenant:t-1:company",
                "scope": "company",
                "value": "5",
            }
        ]
    )

    cap = await refine.resolve_history_cap(conn, tenant_id="t-1")

    assert cap == 5


async def test_restore_not_appended_to_history() -> None:
    """AC-4/DoD: restore only ever UPDATEs `widget_instances` -- it never
    touches `widget_refinements`, so replaying a step is structurally not a
    new step (Design Decisions table).
    """
    conn = _FakeConn(fetch_rows=[])

    await refine.restore_widget_spec(
        conn,
        tenant_id="t-1",
        widget_id="w-1",
        outcome=refine.RestoreOutcome(
            spec=_CURRENT_SPEC,
            last_result={"Person": 12},
            fetched_at=datetime.now(UTC),
            status="fresh",
        ),
    )

    assert len(conn.executed) == 1
    query, _args = conn.executed[0]
    assert "widget_instances" in query
    assert "widget_refinements" not in query
