"""CE-V1-TASK-003 (EPIC-004) perf gap-fill: CE-BRAND-1 projection benchmark.

Measures p95 latency of `GET /api/brand/tokens` and `GET /api/brand/voice-rules`
against a 100k-triple store, per the task brief's AC-003-06 ("respond p95 <=
400 ms at 100k-triple store") and Test Requirements table ("locust case: both
endpoints p95 <= 400 ms @ 100k store").

Not literal `locust`: this repo has no locust dependency and ADR-004
(CE-TASK-008 spike) already established the precedent of an httpx/ASGI
in-process percentile-loop harness instead of installing a separate load-test
tool, for the same CE perf-gate family. This script follows that precedent
rather than reopening the tool choice -- see `scripts/benchmarks/ce-perf/
run_benchmark.py` and `docs/specs/weave/engines/constitution-engine/decisions/
ADR-004.md`. It reuses that script's workspace/token helpers directly.

Cache is deliberately bypassed between samples (`_evict_brand_cache`): both
endpoints are read-through cached per `(tenant_id, version_iri)`
(`brand/cache.py`), so repeated identical calls would mostly measure Redis,
not the SPARQL query engine at 100k-triple scale. Evicting before every
sample keeps every measurement a genuine cold projection over the RDF store,
which is the honest (harder) reading of the AC.

Seed data (filler + the real BrandStandard/VoiceRule individuals under test)
is loaded straight into the store with `load_graph` (one PUT into an empty
named graph), and the version row is minted/published directly against
Postgres (`versioning.mint_version`/`publish_version`) -- neither goes
through `POST /api/operations/apply`. This is deliberate, not a shortcut:
ADR-004 (CE-TASK-008 spike) already found that CE-WRITE-1's apply pipeline
re-validates and *replaces* the whole named graph on every commit, and that
replace cannot complete within Oxigraph's 5s client timeout once the graph
already holds ~100k triples (measured ~11.9s for the PUT alone) -- a known,
separately-escalated, deferred write-path gap, unrelated to what AC-003-06
tests. Routing this benchmark's seed through the live write API would
therefore fail on that pre-existing write-path bug, not on anything this
task built. This script isolates the CE-BRAND-1 *read* path, which is what
AC-003-06 actually gates; the real write path + PROV-O stamping is proven
separately at ordinary scale by `tests/integration/test_brand_api.py`.

Law F: local docker only. Requires the platform docker-compose stack already
up and migrated -- this script does not manage its lifecycle.

Usage: uv run python scripts/benchmarks/ce-perf/run_brand_benchmark.py
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
from run_benchmark import (
    _bootstrap_workspace,
    _mint_headers,
    _percentiles,
    _seed_turtle,
)

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.brand.cache import _cache_key
from weave_backend.db.pool import tenant_connection
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.operations import versioning
from weave_backend.rdf.oxigraph_client import load_graph
from weave_backend.tenancy.sessions import get_redis

os.environ.setdefault("AWS_MAX_ATTEMPTS", "1")

REPORT_DIR = Path(__file__).parent / "reports"

#: AC-003-06 target scale. Override for a partial/scoped-down local run with
#: `CE_BRAND_PERF_CORPUS_SIZE` (e.g. if the sandbox can't sustain 100k).
CORPUS_SIZE = int(os.environ.get("CE_BRAND_PERF_CORPUS_SIZE", "100000"))
N_SAMPLES = 40
THRESHOLD_P95_MS = 400.0

_ENDPOINTS = ("tokens", "voice-rules")


#: Triple count of `_brand_individuals_turtle()`'s output -- 2 BrandStandard
#: individuals (type + contentType + contentBody + owner + effectiveDate = 5
#: each) + 2 VoiceRule individuals (type + ruleId + severity + assertion = 4
#: each). Kept as an explicit constant, regression-guarded by the unit test,
#: rather than computed at runtime -- it must stay accurate for `CORPUS_SIZE`
#: minus filler to land on the real target scale.
_BRAND_TRIPLE_COUNT = 18


def _brand_individuals_turtle() -> str:
    """The real BrandStandard + VoiceRule individuals under test, as raw
    turtle body (no `@prefix` line of its own -- appended after
    `_seed_turtle`'s filler, which already declares `weave:`). Loaded
    straight into the store via `load_graph` rather than the write API --
    see module docstring (ADR-004 write-path finding).
    """
    return "\n".join(
        [
            "<https://weave.io/instances/bench-brand-0> a weave:BrandStandard ;",
            '  weave:contentType "color" ;',
            '  weave:contentBody "{\\"primary\\": \\"#111827\\"}" ;',
            '  weave:owner "design-team" ;',
            '  weave:effectiveDate "2026-01-01" .',
            "<https://weave.io/instances/bench-brand-1> a weave:BrandStandard ;",
            '  weave:contentType "motion" ;',
            '  weave:contentBody "{\\"duration\\": \\"200ms\\"}" ;',
            '  weave:owner "design-team" ;',
            '  weave:effectiveDate "2026-01-01" .',
            "<https://weave.io/instances/bench-voice-0> a weave:VoiceRule ;",
            '  weave:ruleId "vr-1" ;',
            '  weave:severity "critical" ;',
            '  weave:assertion "no second-person imperative" .',
            "<https://weave.io/instances/bench-voice-1> a weave:VoiceRule ;",
            '  weave:ruleId "vr-2" ;',
            '  weave:severity "normal" ;',
            '  weave:assertion "max-length:140" .',
        ]
    )


async def _evict_brand_cache(tenant_id: str, version_iri: str) -> None:
    redis_client: Any = get_redis()
    for kind in ("tokens", "voice-rules"):
        await redis_client.delete(_cache_key(kind, tenant_id, version_iri))


async def _sample_endpoint(
    client: AsyncClient,
    *,
    path: str,
    headers: dict[str, str],
    version_iri: str,
    tenant_id: str,
) -> list[float]:
    samples: list[float] = []
    for _ in range(N_SAMPLES):
        await _evict_brand_cache(tenant_id, version_iri)
        start = time.perf_counter()
        response = await client.get(path, params={"version": version_iri}, headers=headers)
        samples.append((time.perf_counter() - start) * 1000)
        response.raise_for_status()
    return samples


async def _benchmark_corpus_size(client: AsyncClient, corpus_size: int) -> dict[str, Any]:
    workspace, tenant_id = await _bootstrap_workspace(client, f"brandperf-{corpus_size}")
    filler_size = max(0, corpus_size - _BRAND_TRIPLE_COUNT)
    combined_turtle = f"{_seed_turtle(filler_size)}\n{_brand_individuals_turtle()}"
    await load_graph(workspace.named_graph_iri, combined_turtle)

    async with tenant_connection(tenant_id) as conn:
        version_iri, _semver = await versioning.mint_version(
            conn,
            tenant_id=tenant_id,
            workspace_id=workspace.id,
            named_graph_iri=workspace.named_graph_iri,
            actor_iri="urn:weave:principal:bench",
        )
        await versioning.publish_version(
            conn, tenant_id=tenant_id, workspace_id=workspace.id, version_iri=version_iri
        )

    headers = await _mint_headers(tenant_id)
    by_endpoint: dict[str, dict[str, float]] = {}
    for name in _ENDPOINTS:
        samples = await _sample_endpoint(
            client,
            path=f"/api/brand/{name}",
            headers=headers,
            version_iri=version_iri,
            tenant_id=tenant_id,
        )
        by_endpoint[name] = _percentiles(samples)

    worst_p95 = max(pct["p95"] for pct in by_endpoint.values())
    return {
        "corpus_size": corpus_size,
        "by_endpoint": by_endpoint,
        "worst_p95_ms": worst_p95,
        "threshold_p95_ms": THRESHOLD_P95_MS,
        "pass": worst_p95 <= THRESHOLD_P95_MS,
    }


async def _main() -> int:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    mock_transport = ASGITransport(app=mock_oidc_app)
    app.dependency_overrides[get_oidc_client] = lambda: AsyncClient(
        transport=mock_transport, base_url="http://mock-oidc"
    )
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://bench") as client:
        print(f"--- brand perf: corpus_size={CORPUS_SIZE} ---")
        try:
            report = await _benchmark_corpus_size(client, CORPUS_SIZE)
        except Exception as exc:  # a crash IS a measurement here (see ADR-004)
            report = {
                "corpus_size": CORPUS_SIZE,
                "threshold_p95_ms": THRESHOLD_P95_MS,
                "pass": False,
                "crashed": True,
                "error": f"{type(exc).__name__}: {exc}",
            }
    app.dependency_overrides.clear()

    report_path = REPORT_DIR / f"report-brand-{CORPUS_SIZE}.json"
    report_path.write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))

    if not report["pass"]:
        print("FAIL: brand projection p95 missed threshold", file=sys.stderr)
        return 1
    print("PASS: brand projection p95 within threshold")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(_main()))
