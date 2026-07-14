"""CE-V1-TASK-030 AC-4: `POST /api/views` (view save) p95 latency benchmark.

m2-delta-explorer.md's release-gate budget: view save <= 800ms p95. Not
literal locust: follows the same ADR-004 httpx/ASGI in-process
percentile-loop precedent as `run_benchmark.py`/`run_metrics_benchmark.py` --
reuses their workspace/token bootstrap helpers directly.

Requires the platform docker-compose stack already up and migrated
(mirrors run_benchmark.py's own precondition) -- this script only talks to
it, never manages its lifecycle.

Usage:
    uv run python scripts/benchmarks/ce-perf/run_view_save_benchmark.py
"""

from __future__ import annotations

import asyncio
import json
import sys
import time
import uuid
from pathlib import Path
from typing import Any

from httpx import ASGITransport, AsyncClient

sys.path.insert(0, str(Path(__file__).parent))

from run_benchmark import _bootstrap_workspace, _mint_headers, _percentiles

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.mock_oidc.app import app as mock_oidc_app

REPORT_DIR = Path(__file__).parent / "reports"
SAMPLES = 30
THRESHOLD_P95_MS = 800.0


def _save_view_body(idx: int) -> dict[str, Any]:
    # A new name + overwrite=True each call: TASK-030 AC-4 is measuring the
    # save round trip (insert-or-update view row + layout-snapshot rows),
    # not exercising the 409 name-collision branch.
    return {
        "name": f"bench-view-{uuid.uuid4().hex[:8]}-{idx}",
        "overwrite": True,
        "definition": {"filters": [], "overlays": []},
        "positions": [
            {"node_iri": "https://weave.io/instances/bench-node", "position_x": 0, "position_y": 0}
        ],
    }


async def _sample_view_saves(client: AsyncClient, headers: dict[str, str]) -> list[float]:
    samples: list[float] = []
    for i in range(SAMPLES):
        start = time.perf_counter()
        response = await client.post("/api/views", headers=headers, json=_save_view_body(i))
        samples.append((time.perf_counter() - start) * 1000)
        response.raise_for_status()
    return samples


async def _main() -> int:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://bench.invalid") as client:
        app.dependency_overrides[get_oidc_client] = lambda: AsyncClient(
            transport=ASGITransport(app=mock_oidc_app), base_url="http://mock-oidc.invalid"
        )
        try:
            _workspace, tenant_id = await _bootstrap_workspace(client, "viewsaveperf")
            headers = await _mint_headers(tenant_id)
            samples = await _sample_view_saves(client, headers)
        finally:
            app.dependency_overrides.pop(get_oidc_client, None)

    pct = _percentiles(samples)
    passed = pct["p95"] <= THRESHOLD_P95_MS
    report = {
        "endpoint": "POST /api/views",
        **pct,
        "threshold_p95_ms": THRESHOLD_P95_MS,
        "passed": passed,
        "samples": len(samples),
    }
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    (REPORT_DIR / "view-save-summary.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(_main()))
