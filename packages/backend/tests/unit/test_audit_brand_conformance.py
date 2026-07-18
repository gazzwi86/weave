"""G14 (docs/design/remediation-2-api-gaps.md): the "brand conformance, last
N days" rollup -- computed as a pass rate over `gate_result_brand` audit
events (emitted at `generation/service.py::_default_record_brand_gate`),
NOT from OTel. DB-free unit tests against a mocked connection, mirroring
`test_audit_compliance.py`'s established precedent.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock

from weave_backend.audit.brand_conformance import get_brand_conformance

_TENANT = "acme-corp"


def _row(payload: dict[str, object]) -> dict[str, object]:
    return {"diff_summary": json.dumps(payload)}


async def test_conformance_pct_is_the_pass_rate_over_the_window() -> None:
    conn = AsyncMock()
    conn.fetch.return_value = [
        _row({"task_id": "t1", "status": "passed", "score": 1.0, "critical_failures": []}),
        _row({"task_id": "t2", "status": "passed", "score": 0.95, "critical_failures": []}),
        _row({"task_id": "t3", "status": "failed", "score": 0.5, "critical_failures": ["r1"]}),
        _row({"task_id": "t4", "status": "failed", "reason": "ce_unavailable"}),
    ]

    summary = await get_brand_conformance(conn, _TENANT, window_days=30)

    assert summary.window_days == 30
    assert summary.passed == 2
    assert summary.failed == 2
    assert summary.conformance_pct == 50.0


async def test_critical_failures_are_counted_separately_and_not_subtracted_from_failed() -> None:
    conn = AsyncMock()
    conn.fetch.return_value = [
        _row({"status": "failed", "critical_failures": ["r1", "r2"]}),
        _row({"status": "failed", "critical_failures": ["r3"]}),
        _row({"status": "passed", "critical_failures": []}),
    ]

    summary = await get_brand_conformance(conn, _TENANT, window_days=30)

    assert summary.failed == 2
    assert summary.critical_failures == 3


async def test_a_ce_unavailable_payload_with_no_critical_failures_key_counts_as_failed() -> None:
    conn = AsyncMock()
    conn.fetch.return_value = [_row({"status": "failed", "reason": "ce_unavailable"})]

    summary = await get_brand_conformance(conn, _TENANT, window_days=30)

    assert summary.failed == 1
    assert summary.critical_failures == 0


async def test_zero_events_in_window_is_vacuously_fully_conformant() -> None:
    conn = AsyncMock()
    conn.fetch.return_value = []

    summary = await get_brand_conformance(conn, _TENANT, window_days=30)

    assert summary.passed == 0
    assert summary.failed == 0
    assert summary.conformance_pct == 100.0


async def test_window_days_bounds_the_query_to_now_minus_window() -> None:
    conn = AsyncMock()
    conn.fetch.return_value = []

    await get_brand_conformance(conn, _TENANT, window_days=7)

    query_call = conn.fetch.await_args
    assert query_call is not None
    assert query_call.args[0].count("gate_result_brand") == 1
    assert query_call.args[1] == _TENANT
    # A window bound (ts >= $N) was passed as a third positional arg.
    assert len(query_call.args) == 3
