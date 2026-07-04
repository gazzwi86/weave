"""AC-5/AC-7: usage-summary aggregation and cap-utilisation percentage,
against a mocked connection (no real Postgres)."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, patch

from weave_backend.billing.usage import get_usage_summary
from weave_backend.settings.resolver import ResolvedSetting, SettingNotFound

_TENANT = "acme-corp"


def _rows() -> list[dict[str, Any]]:
    return [
        {"workspace_id": "ws-1", "total_tokens": 1000, "total_runs": 2, "total_cost_usd": 30.0},
        {"workspace_id": "ws-2", "total_tokens": 500, "total_runs": 1, "total_cost_usd": 20.0},
    ]


async def test_tenant_wide_summary_aggregates_all_workspaces() -> None:
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=_rows())
    resolve_mock = AsyncMock(
        return_value=ResolvedSetting(
            key="ai.budget.per_period_usd",
            value=100.0,
            resolved_at="company",
            resolved_from_iri="x",
        )
    )

    with patch("weave_backend.billing.usage.resolve_setting", resolve_mock):
        summary = await get_usage_summary(conn, tenant_id=_TENANT)

    assert summary.total_tokens == 1500
    assert summary.total_runs == 3
    assert summary.total_cost_usd == 50.0
    assert {w.workspace_id for w in summary.by_workspace} == {"ws-1", "ws-2"}
    assert summary.cap_utilisation_pct == 50.0
    assert conn.fetch.call_args.args[-1] is None


async def test_workspace_scoped_summary_passes_workspace_id_filter() -> None:
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=[_rows()[0]])
    resolve_mock = AsyncMock(side_effect=SettingNotFound("ai.budget.per_period_usd"))

    with patch("weave_backend.billing.usage.resolve_setting", resolve_mock):
        summary = await get_usage_summary(conn, tenant_id=_TENANT, workspace_id="ws-1")

    assert [w.workspace_id for w in summary.by_workspace] == ["ws-1"]
    assert summary.total_cost_usd == 30.0
    assert conn.fetch.call_args.args[-1] == "ws-1"


async def test_no_cap_configured_reports_zero_utilisation() -> None:
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=_rows())
    resolve_mock = AsyncMock(side_effect=SettingNotFound("ai.budget.per_period_usd"))

    with patch("weave_backend.billing.usage.resolve_setting", resolve_mock):
        summary = await get_usage_summary(conn, tenant_id=_TENANT)

    assert summary.cap_utilisation_pct == 0.0
