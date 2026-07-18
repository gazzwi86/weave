"""G14 (docs/design/remediation-2-api-gaps.md): the "brand conformance, last
N days" rollup. Source is the `gate_result_brand` audit events already
emitted by `generation/service.py::_default_record_brand_gate` for every
generated artefact (CE-BRAND-1, `generation/brand_gate.py`) -- NOT OTel.
Conformance = pass rate over those events in the window; critical-rule
failures are tracked separately (a critical failure is also a `failed`
event, never subtracted out of it -- see `decide_brand_gate`'s hard-fail
rule in `generation/brand_gate.py`).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import asyncpg

_EVENT_TYPE = "gate_result_brand"


@dataclass(frozen=True)
class BrandConformanceSummary:
    window_days: int
    passed: int
    failed: int
    critical_failures: int
    conformance_pct: float


async def get_brand_conformance(
    conn: asyncpg.Connection, tenant_id: str, *, window_days: int = 30
) -> BrandConformanceSummary:
    # `audit_entries.ts` is TEXT (ISO8601 string), matching
    # `audit/compliance.py::_period_bounds`'s precedent for string bounds.
    since = (datetime.now(UTC) - timedelta(days=window_days)).isoformat()
    # `_EVENT_TYPE` is a fixed internal constant (never user input), so it's
    # inlined rather than bound -- only `tenant_id`/`since` are parameters.
    rows = await conn.fetch(
        f"SELECT diff_summary FROM audit_entries WHERE tenant_id = $1"  # noqa: S608
        f" AND event_type = '{_EVENT_TYPE}' AND ts >= $2",  # fixed constant, not user input
        tenant_id,
        since,
    )
    passed = failed = critical_failures = 0
    for row in rows:
        payload = json.loads(row["diff_summary"])
        if payload.get("status") == "passed":
            passed += 1
        else:
            failed += 1
        critical_failures += len(payload.get("critical_failures") or [])

    total = passed + failed
    conformance_pct = (passed / total * 100) if total else 100.0

    return BrandConformanceSummary(
        window_days=window_days,
        passed=passed,
        failed=failed,
        critical_failures=critical_failures,
        conformance_pct=conformance_pct,
    )
