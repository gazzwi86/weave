"""CE-V1-TASK-007 (retry 1) perf gap-fill: CE-METRICS-1 aggregate metrics
benchmark.

Measures p95 latency of `GET /api/metrics/ontology` against a ~100k-triple
store, per AC-007-05 ("p95 <= 500ms cold / <= 100ms cached @ 100k-triple
store", m2-delta.md §9).

Not literal locust: follows the ADR-004 httpx/ASGI in-process percentile-loop
precedent already used by `run_benchmark.py` (CE-TASK-008) and
`run_brand_benchmark.py` (CE-V1-TASK-003, sibling) for this same CE
perf-gate family -- see
docs/specs/weave/engines/constitution-engine/decisions/ADR-004.md. Reuses
`run_benchmark.py`'s workspace/token helpers directly.

Filler shape: `aggregate_metrics.entity_count_by_kind`'s `_COUNT_QUERY` is
`SELECT ?kind (COUNT(?s) AS ?count) WHERE { ?s a ?kind } GROUP BY ?kind` --
an unbound `?kind`, so it scans every `rdf:type` triple in the store
regardless of which kind. Filler is therefore typed (`a weave:BenchFiller`),
not just inert triples, so the COUNT query genuinely processes ~100k rows --
but `weave:BenchFiller` is not a real BPMO catalogue kind (no shape targets
it in framework.shacl.ttl), so `entity_count_by_kind`'s
`label_by_iri.get(...)` drops it and it never pollutes the response. A
handful of real Actor/Process individuals are added on top so the response
still has real, checkable counts.

Cold vs cached, both halves of AC-007-05:
  - cold: evict the metrics cache key before every sample -- every call
    recomputes `entity_count_by_kind` + `draft_published_delta` from
    Oxigraph/Postgres.
  - cached: prime the cache once, then sample without evicting -- every
    call after the first is a Redis GET (`operations/metrics_cache.py`).

Seed data is loaded straight into the store via `load_graph`, not through
`POST /api/operations/apply` -- ADR-004 (CE-TASK-008) already found the
write pipeline's whole-graph SHACL replace can't complete within Oxigraph's
5s client timeout once the graph holds ~100k triples; CE-V1-TASK-003's brand
benchmark hit the same wall and made the same call. This script isolates
the CE-METRICS-1 *read* path, which is what AC-007-05 gates.

Law F: local docker only. Requires the platform docker-compose stack already
up and migrated -- this script does not manage its lifecycle.

Usage: uv run python scripts/benchmarks/ce-perf/run_metrics_benchmark.py
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

from httpx import ASGITransport, AsyncClient

sys.path.insert(0, str(Path(__file__).parent))
from run_benchmark import _bootstrap_workspace, _mint_headers, _percentiles

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.operations.metrics_cache import _cache_key
from weave_backend.rdf.oxigraph_client import load_graph
from weave_backend.tenancy.sessions import get_redis

os.environ.setdefault("AWS_MAX_ATTEMPTS", "1")

REPORT_DIR = Path(__file__).parent / "reports"

#: AC-007-05 target scale. Override for a partial/scoped-down local run with
#: `CE_METRICS_PERF_CORPUS_SIZE` (e.g. if the sandbox can't sustain 100k).
CORPUS_SIZE = int(os.environ.get("CE_METRICS_PERF_CORPUS_SIZE", "100000"))
COLD_SAMPLES = 20
CACHED_SAMPLES = 40
COLD_THRESHOLD_P95_MS = 500.0
CACHED_THRESHOLD_P95_MS = 100.0

#: Real, checkable Actor/Process individuals on top of the filler -- 2 Actor
#: (2 triples each) + 1 Process (3 triples: type + label + mandatory
#: `performedBy`) = 7 triples. Loaded directly (not through the write API,
#: see module docstring), so SHACL never runs over this seed -- the
#: `performedBy` edge is cosmetic here, kept only so this shape would also
#: pass real validation if ever reused.
_REAL_ENTITIES_TRIPLE_COUNT = 7


def _real_entities_turtle() -> str:
    return "\n".join(
        [
            "<https://weave.io/instances/bench-actor-real-0> a weave:Actor ;"
            ' weave:label "Bench Actor Real 0" .',
            "<https://weave.io/instances/bench-actor-real-1> a weave:Actor ;"
            ' weave:label "Bench Actor Real 1" .',
            "<https://weave.io/instances/bench-process-real-0> a weave:Process ;"
            ' weave:label "Bench Process Real 0" ;'
            " weave:performedBy <https://weave.io/instances/bench-actor-real-0> .",
        ]
    )


def _filler_turtle(n: int) -> str:
    """Typed filler (see module docstring) so `entity_count_by_kind`'s
    `?s a ?kind` GROUP BY genuinely scans ~100k rows, not zero.
    """
    return "\n".join(
        f"<https://weave.io/instances/bench-filler-{i}> a weave:BenchFiller ." for i in range(n)
    )


async def _evict_metrics_cache(tenant_id: str, workspace_id: str) -> None:
    redis_client: Any = get_redis()
    await redis_client.delete(_cache_key(tenant_id, workspace_id))


async def _sample_cold(
    client: AsyncClient, *, headers: dict[str, str], tenant_id: str, workspace_id: str
) -> list[float]:
    samples: list[float] = []
    for _ in range(COLD_SAMPLES):
        await _evict_metrics_cache(tenant_id, workspace_id)
        start = time.perf_counter()
        response = await client.get("/api/metrics/ontology", headers=headers)
        samples.append((time.perf_counter() - start) * 1000)
        response.raise_for_status()
    return samples


async def _sample_cached(client: AsyncClient, *, headers: dict[str, str]) -> list[float]:
    # Prime the cache once (uncounted) so every sampled call below is a hit.
    primer = await client.get("/api/metrics/ontology", headers=headers)
    primer.raise_for_status()

    samples: list[float] = []
    for _ in range(CACHED_SAMPLES):
        start = time.perf_counter()
        response = await client.get("/api/metrics/ontology", headers=headers)
        samples.append((time.perf_counter() - start) * 1000)
        response.raise_for_status()
    return samples


async def _benchmark_corpus_size(client: AsyncClient, corpus_size: int) -> dict[str, Any]:
    workspace, tenant_id = await _bootstrap_workspace(client, f"metricsperf-{corpus_size}")
    filler_size = max(0, corpus_size - _REAL_ENTITIES_TRIPLE_COUNT)
    combined_turtle = (
        "@prefix weave: <https://weave.io/ontology/> .\n"
        f"{_filler_turtle(filler_size)}\n{_real_entities_turtle()}"
    )
    await load_graph(workspace.named_graph_iri, combined_turtle)

    headers = await _mint_headers(tenant_id)
    cold_samples = await _sample_cold(
        client, headers=headers, tenant_id=tenant_id, workspace_id=workspace.id
    )
    cached_samples = await _sample_cached(client, headers=headers)

    cold_pct = _percentiles(cold_samples)
    cached_pct = _percentiles(cached_samples)
    passed = (
        cold_pct["p95"] <= COLD_THRESHOLD_P95_MS and cached_pct["p95"] <= CACHED_THRESHOLD_P95_MS
    )

    return {
        "corpus_size": corpus_size,
        "cold": cold_pct,
        "cold_threshold_p95_ms": COLD_THRESHOLD_P95_MS,
        "cached": cached_pct,
        "cached_threshold_p95_ms": CACHED_THRESHOLD_P95_MS,
        "pass": passed,
    }


async def _main() -> int:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    mock_transport = ASGITransport(app=mock_oidc_app)
    app.dependency_overrides[get_oidc_client] = lambda: AsyncClient(
        transport=mock_transport, base_url="http://mock-oidc"
    )
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://bench") as client:
        print(f"--- metrics perf: corpus_size={CORPUS_SIZE} ---")
        try:
            report = await _benchmark_corpus_size(client, CORPUS_SIZE)
        except Exception as exc:  # a crash IS a measurement here (see ADR-004)
            report = {
                "corpus_size": CORPUS_SIZE,
                "cold_threshold_p95_ms": COLD_THRESHOLD_P95_MS,
                "cached_threshold_p95_ms": CACHED_THRESHOLD_P95_MS,
                "pass": False,
                "crashed": True,
                "error": f"{type(exc).__name__}: {exc}",
            }
    app.dependency_overrides.clear()

    report_path = REPORT_DIR / f"report-metrics-{CORPUS_SIZE}.json"
    report_path.write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))

    if not report["pass"]:
        print("FAIL: metrics aggregate p95 missed threshold", file=sys.stderr)
        return 1
    print("PASS: metrics aggregate p95 within threshold")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(_main()))
