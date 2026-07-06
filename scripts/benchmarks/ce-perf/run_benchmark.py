"""CE-TASK-008 SPIKE (SS-CE-1): CE core performance benchmark harness.

Benchmarks the CE-WRITE-1 write path (`POST /api/operations/apply`) and the
CE-READ-1 read path (`GET /api/ontology/types`, `GET /api/ontology/resource`,
`GET /api/sparql`) at 10k/100k/500k triple corpus scale, per the task brief's
AC-008-01..-06. Emits one JSON report per corpus size plus a combined
go/no-go summary.

Law F: local docker only, never real cloud. Requires the platform
docker-compose stack already up and migrated (`docker compose up -d
postgres redis localstack oxigraph`, then `weave-migrate`) -- this script
does not manage the stack lifecycle itself, it only talks to it.

ponytail: hits the FastAPI app via in-process ASGI transport (same pattern
every integration test in this repo already uses), not a live uvicorn
process -- this still measures the full app-level path (middleware, auth,
serialisation, Postgres, Oxigraph HTTP, Redis), which is what the
thresholds below actually gate. It skips OS-socket/TCP overhead, which is
sub-millisecond and negligible against these 300-2000ms budgets. Swap in a
live server + real `httpx` transport if literal wire latency ever matters.

Usage: uv run python scripts/benchmarks/ce-perf/run_benchmark.py
"""

from __future__ import annotations

import asyncio
import json
import os
import statistics
import sys
import time
import uuid
from pathlib import Path
from typing import Any

from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.db.pool import tenant_connection
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.rdf.oxigraph_client import load_graph
from weave_backend.tenancy.members import activate_member, invite_member
from weave_backend.tenancy.workspaces import create_workspace

# HOTSPOT (see ADR-004): `operations/metrics.emit_mutation_outcome_metric` is
# awaited inline on every `apply` and retries CloudWatch's PutMetricData 4x
# (~7.7s total) against this LocalStack build's incompatible protocol before
# giving up -- it never fails the mutation (best-effort, caught), but it does
# dominate write latency end to end. Capping retries here (env var, no
# app-code change) isolates the CE pipeline's own latency, which is what
# this spike benchmarks; the retry-storm itself is reported as a separate
# finding. boto3 reads this lazily per-call, so setting it here (before any
# apply call, after all imports) is sufficient.
os.environ.setdefault("AWS_MAX_ATTEMPTS", "1")

REPORT_DIR = Path(__file__).parent / "reports"

#: AC-008-01: corpora at three sizes, per the task brief.
_DEFAULT_CORPUS_SIZES = [10_000, 100_000, 500_000]


def _corpus_sizes_from_env() -> list[int]:
    """CI runs only the gating 10k corpus (fast, and the non-gating 100k/500k
    currently crash — no value burning CI minutes on known timeouts). A local
    full run uses all three. Override with e.g. `CE_PERF_CORPUS_SIZES=10000`."""
    raw = os.environ.get("CE_PERF_CORPUS_SIZES")
    if not raw:
        return list(_DEFAULT_CORPUS_SIZES)
    return [int(s) for s in raw.split(",") if s.strip()]


CORPUS_SIZES = _corpus_sizes_from_env()

#: Go/no-go thresholds. The write<=800ms / read<=300ms budget is the M1 UI
#: latency budget (modeller feedback < 1s), applied to the *gating* corpus.
#: Human-authorised retarget 2026-07-06 (ADR-004 decision addendum): the M1
#: gate is **10k**, not 100k -- 100k is not required at M1 and CE's whole-graph
#: replace write pattern cannot complete a single write at 100k under the 5s
#: Oxigraph client timeout (ADR-004 hotspot analysis). 100k/500k stay measured
#: (non-gating) for the deferred delta-patch-write + production-store decision;
#: `GATING_CORPUS_SIZE` is what `_main`'s exit code actually checks.
THRESHOLDS_MS: dict[int, dict[str, float]] = {
    10_000: {"write_p95": 800, "read_p95": 300},
    100_000: {"write_p95": 800, "read_p95": 300},
    500_000: {"write_p95": 2000, "read_p95": 1000},
}
GATING_CORPUS_SIZE = 10_000

#: AC-008-04: `POST /api/query/nl` does not exist in this codebase yet (no
#: NL->SPARQL translation route has shipped) -- this task's own brief says
#: "does not implement new CE features", so the harness does not invent one
#: just to benchmark it. Recorded as skipped in every report; see ADR-004.
NL_BENCH_SKIPPED_REASON = "POST /api/query/nl does not exist yet (not built by CE-001..CE-003)"


def _percentiles(samples_ms: list[float]) -> dict[str, float]:
    ordered = sorted(samples_ms)
    n = len(ordered)
    return {
        "p50": statistics.median(ordered),
        "p95": ordered[max(0, int(n * 0.95) - 1)],
        "p99": ordered[max(0, int(n * 0.99) - 1)],
    }


def _seed_turtle(corpus_size: int) -> str:
    """AC-008-01: instance nodes (`weave:Actor`, 2 triples each) + a small
    slice of `weave:Process` nodes (3 triples each: label + one mandatory
    `performedBy` -> Actor, satisfying `ProcessShape`'s `minCount 1`) +
    typed Actor-Actor edges (1 triple each), sized to hit `corpus_size`
    exactly.

    ponytail: every seeded node must already pass SHACL, because
    `pipeline._apply_uncached` re-validates the WHOLE draft graph (not a
    delta) on every `apply` call -- see `pipeline.py`'s `_fetch_scratch_graph`
    -- so a Process seeded without a `performedBy` edge would 422 the very
    first write-bench batch. `weave:Actor` carries no shape (framework.shacl.ttl
    has no `ActorShape`), so it's the safe kind for bulk filler triples;
    `weave:performedBy` between two Actors is inert (`ProcessShape` only
    targets `weave:Process` subjects), so it doubles as the "typed edge"
    triple without needing its own shape.
    """
    n_processes = max(1, corpus_size // 200)
    n_actors = max(n_processes, corpus_size // 20)
    n_edges = max(0, corpus_size - (3 * n_processes + 2 * n_actors))

    lines = ["@prefix weave: <https://weave.io/ontology/> ."]
    for i in range(n_actors):
        lines.append(
            f'<https://weave.io/instances/bench-actor-{i}> a weave:Actor ;'
            f' weave:label "Bench Actor {i}" .'
        )
    for i in range(n_processes):
        lines.append(
            f'<https://weave.io/instances/bench-process-{i}> a weave:Process ;'
            f' weave:label "Bench Process {i}" ;'
            f" weave:performedBy <https://weave.io/instances/bench-actor-{i % n_actors}> ."
        )
    for i in range(n_edges):
        # bug found by test_run_benchmark.py's own triple-count check: a plain
        # `(i % n, (i+1) % n)` cycle only ever emits n distinct pairs, so an
        # RDF graph (a *set* of triples) silently collapsed thousands of
        # "unique" edges down to ~n_actors once i wrapped -- corpus_size was
        # never actually reached. Reading i as two base-n_actors digits keeps
        # every (s, o) pair distinct for i up to n_actors**2, which safely
        # covers every corpus size used here (n_actors grows with
        # corpus_size, so n_actors**2 vastly exceeds n_edges in practice).
        s, o = i % n_actors, (i // n_actors) % n_actors
        lines.append(
            f"<https://weave.io/instances/bench-actor-{s}> weave:performedBy"
            f" <https://weave.io/instances/bench-actor-{o}> ."
        )
    return "\n".join(lines)


def _write_batch(batch_idx: int) -> list[dict[str, Any]]:
    """AC-008-02: 10 ops/batch. Distinct labels per batch (UUID suffix, per
    the brief's isolation hint) so `graph_ops._find_existing_by_label_kind`
    never dedups a batch onto a prior one -- each of the 100 batches must
    genuinely grow the graph and pay real SHACL-validation cost.

    3 Actor + 3 Process nodes + 4 edges (one `performedBy` per Process is
    mandatory -- the BPMO shape rejects a Process with none -- plus one
    extra edge to keep the join fan-out realistic) = 10 ops.
    """
    suffix = uuid.uuid4().hex[:8]
    ops: list[dict[str, Any]] = [
        {
            "op": "add_node",
            "ref": f"a{i}",
            "kind": "Actor",
            "label": f"Bench Actor {batch_idx}-{i}-{suffix}",
        }
        for i in range(3)
    ]
    ops += [
        {
            "op": "add_node",
            "ref": f"p{i}",
            "kind": "Process",
            "label": f"Bench Process {batch_idx}-{i}-{suffix}",
        }
        for i in range(3)
    ]
    ops += [
        {
            "op": "add_edge",
            "subject_ref": f"p{i}",
            "predicate": "performedBy",
            "object_ref": f"a{i}",
        }
        for i in range(3)
    ]
    ops.append(
        {"op": "add_edge", "subject_ref": "p0", "predicate": "performedBy", "object_ref": "a1"}
    )
    return ops


async def _mint_headers(tenant_id: str) -> dict[str, str]:
    """Mint a fresh bearer token for the bench principal.

    ponytail: mock OIDC access tokens expire after ACCESS_TOKEN_TTL_SECONDS
    (300s, mirrors real Cognito's minimum per ADR-001). Large corpus sizes
    push seeding + the write/read loops past that -- so this is called
    again before each slow phase rather than reusing one token for the
    whole run. Workspace-switch state lives in the session store keyed by
    (tenant_id, sub), not in the JWT, so a fresh token needs no re-switch.
    """
    tokens = await issue_token_pair(sub="u-bench", tenant_id=tenant_id)
    return {"Authorization": f"Bearer {tokens.access_token}"}


async def _bootstrap_workspace(client: AsyncClient, label: str) -> tuple[Any, str]:
    tenant_id = f"{label}-{uuid.uuid4().hex[:8]}"
    email = "bench@example.invalid"
    async with tenant_connection(tenant_id) as conn:
        workspace = await create_workspace(
            conn, tenant_id=tenant_id, slug="bench", display_name="bench"
        )
        await invite_member(
            conn, tenant_id=tenant_id, workspace_id=workspace.id, email=email, role="admin"
        )
        await activate_member(conn, workspace_id=workspace.id, email=email, user_sub="u-bench")
    headers = await _mint_headers(tenant_id)
    switch = await client.post(f"/api/workspaces/{workspace.id}/switch", headers=headers)
    switch.raise_for_status()
    return workspace, tenant_id


async def _run_write_bench(client: AsyncClient, headers: dict[str, str]) -> tuple[list[float], str]:
    samples: list[float] = []
    version_iri = ""
    for batch_idx in range(100):
        start = time.perf_counter()
        response = await client.post(
            "/api/operations/apply",
            json={"operations": _write_batch(batch_idx), "actor": "urn:weave:principal:bench"},
            headers=headers,
        )
        samples.append((time.perf_counter() - start) * 1000)
        response.raise_for_status()
        version_iri = response.json()["version_iri"]
    return samples, version_iri


def _read_query_set(
    version_iri: str, resource_iri: str
) -> dict[str, tuple[str, dict[str, str] | None]]:
    """AC-008-03/`Representative Query Set`: the 5 CE-READ-1 patterns named
    in the task brief.
    """
    graph_scan = "SELECT ?s WHERE { GRAPH ?g { ?s a <https://weave.io/ontology/Process> } }"
    join = (
        "SELECT ?s ?o WHERE { GRAPH ?g { ?s <https://weave.io/ontology/performedBy> ?o } }"
    )
    keyword = (
        "SELECT ?s WHERE { GRAPH ?g { ?s <https://weave.io/ontology/label> ?l ."
        ' FILTER(CONTAINS(?l, "Bench")) } }'
    )
    return {
        "ontology_types_catalogue": ("/api/ontology/types", None),
        "resource_3hop": (f"/api/ontology/resource/{resource_iri}", {"version": version_iri}),
        "sparql_kind_scan": ("/api/sparql", {"query": graph_scan, "version": version_iri}),
        "sparql_join_heavy": ("/api/sparql", {"query": join, "version": version_iri}),
        "sparql_keyword_search": ("/api/sparql", {"query": keyword, "version": version_iri}),
    }


async def _run_read_bench(
    client: AsyncClient, headers: dict[str, str], version_iri: str, resource_iri: str
) -> dict[str, list[float]]:
    results: dict[str, list[float]] = {}
    for name, (path, params) in _read_query_set(version_iri, resource_iri).items():
        samples: list[float] = []
        for _ in range(40):
            start = time.perf_counter()
            response = await client.get(path, params=params, headers=headers)
            samples.append((time.perf_counter() - start) * 1000)
            response.raise_for_status()
        results[name] = samples
    return results


async def _publish(client: AsyncClient, headers: dict[str, str], version_iri: str) -> None:
    response = await client.post(f"/api/ontology/versions/{version_iri}/publish", headers=headers)
    response.raise_for_status()


async def _benchmark_corpus_size(client: AsyncClient, corpus_size: int) -> dict[str, Any]:
    workspace, tenant_id = await _bootstrap_workspace(client, f"ceperf-{corpus_size}")
    await load_graph(workspace.named_graph_iri, _seed_turtle(corpus_size))

    # Re-mint before each slow phase -- seeding/writing/reading a large
    # corpus can each individually approach the 300s mock-token TTL.
    headers = await _mint_headers(tenant_id)
    write_samples, version_iri = await _run_write_bench(client, headers)
    headers = await _mint_headers(tenant_id)
    await _publish(client, headers, version_iri)
    headers = await _mint_headers(tenant_id)
    read_samples = await _run_read_bench(
        client, headers, version_iri, resource_iri="https://weave.io/instances/bench-actor-0"
    )

    write_pct = _percentiles(write_samples)
    write_throughput_ops_sec = len(write_samples) / (sum(write_samples) / 1000)
    read_pct_by_query = {name: _percentiles(s) for name, s in read_samples.items()}
    read_p95_worst = max(pct["p95"] for pct in read_pct_by_query.values())

    threshold = THRESHOLDS_MS.get(corpus_size)
    passed = (
        threshold is None
        or (write_pct["p95"] <= threshold["write_p95"] and read_p95_worst <= threshold["read_p95"])
    )

    return {
        "corpus_size": corpus_size,
        "write_p50_ms": write_pct["p50"],
        "write_p95_ms": write_pct["p95"],
        "write_p99_ms": write_pct["p99"],
        "write_throughput_ops_sec": write_throughput_ops_sec,
        "read_p95_ms": read_p95_worst,
        "read_by_query": read_pct_by_query,
        "nl_query_p95_ms": None,
        "nl_query_skipped_reason": NL_BENCH_SKIPPED_REASON,
        "gated": corpus_size == GATING_CORPUS_SIZE,
        "pass": passed,
    }


async def _main() -> int:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    mock_transport = ASGITransport(app=mock_oidc_app)
    app.dependency_overrides[get_oidc_client] = lambda: AsyncClient(
        transport=mock_transport, base_url="http://mock-oidc"
    )
    transport = ASGITransport(app=app)

    reports = []
    async with AsyncClient(transport=transport, base_url="http://bench") as client:
        for corpus_size in CORPUS_SIZES:
            print(f"--- corpus_size={corpus_size} ---")
            try:
                report = await _benchmark_corpus_size(client, corpus_size)
            except Exception as exc:  # a crash IS a measurement here (see ADR-004):
                # DoD requires all three corpus sizes "measured and recorded", so a hard failure
                # (e.g. the app's internal 5s oxigraph-client timeout at 500k) is itself the
                # finding, not a reason to abort the other corpus sizes.
                report = {
                    "corpus_size": corpus_size,
                    "gated": corpus_size == GATING_CORPUS_SIZE,
                    "pass": False,
                    "crashed": True,
                    "error": f"{type(exc).__name__}: {exc}",
                }
            reports.append(report)
            report_path = REPORT_DIR / f"report-{corpus_size}.json"
            report_path.write_text(json.dumps(report, indent=2))
            print(json.dumps(report, indent=2))
    app.dependency_overrides.clear()

    (REPORT_DIR / "summary.json").write_text(json.dumps(reports, indent=2))
    failed = [r for r in reports if r["gated"] and not r["pass"]]
    if failed:
        print(f"FAIL: {len(failed)} gated corpus size(s) missed threshold", file=sys.stderr)
        return 1
    print("PASS: all gated thresholds met")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(_main()))
