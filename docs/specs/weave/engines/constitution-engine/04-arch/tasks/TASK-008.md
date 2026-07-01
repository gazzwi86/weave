---
type: Task
title: "Task: TASK-008 — SPIKE: CE Core Performance Benchmark"
description: "Load-test CE read/write/SPARQL at critical-path scale; gate downstream M1 engine reliance."
tags: [constitution-engine, 04-arch, task, milestone-M1, spike]
timestamp: 2026-07-01T00:00:00Z
status: Backlog
priority: Must Have
entity: constitution-engine
epic: EPIC-010
milestone: M1
created: 2026-07-01
owner_role: Architect
blocked_by: ["TASK-001", "TASK-003"]
unlocks: ["Build Engine M1 grounding calls", "Graph Explorer M1 read calls"]
adr_refs: []
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: e6499f88873d7157bed76c3632ce25e2f5fb6d4b
expires_on: 2026-12-28
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [constitution-engine.md](../../../constitution-engine.md)
Contracts: [contracts.md](../../../../contracts.md)

## Context

CE is the synchronous critical path for every downstream M1 engine (Build Engine grounding
calls, Graph Explorer read calls). Before those engines build hard reliance on CE's latency
profile, CE's core read/write/SPARQL performance must pass a benchmark at operational scale.
This SPIKE (SS-CE-1) produces a reusable harness and a go/no-go signal.

This task does not implement new CE features. It stress-tests the existing implementation
produced by TASK-001 through TASK-003 and records the result as an ADR-style decision record.

## Story

As the Technical Architect, I need a reproducible performance benchmark for the CE mutation
pipeline and read/query surface at 10k–500k triple scale, so that I can give the Build Engine
and Graph Explorer teams a confident go/no-go before they build M1 grounding calls on top of CE.

## Acceptance Criteria

### Benchmark Harness

| ID | Criterion (EARS) |
|---|---|
| AC-008-01 | WHEN the benchmark harness runs, THE SYSTEM SHALL seed the Oxigraph dev store with test corpora at three sizes: 10k, 100k, and 500k triples, representative of BPMO graph topology (class nodes, instance nodes, typed edges). |
| AC-008-02 | WHEN the harness runs the write benchmark, THE SYSTEM SHALL submit 100 sequential `POST /api/operations/apply` batches (10 operations each) and record p50, p95, p99 latency, and throughput (ops/sec). |
| AC-008-03 | WHEN the harness runs the read benchmark, THE SYSTEM SHALL execute 200 `GET /api/sparql` SELECT queries (drawn from the CE-READ-1 representative query set) against each corpus size and record p50, p95, p99 latency. |
| AC-008-04 | WHEN the harness runs the NL→SELECT benchmark, THE SYSTEM SHALL issue 20 `POST /api/query/nl` requests (pre-translated, no live LLM call — inject cached SPARQL to isolate CE latency) and record p50, p95, p99. |
| AC-008-05 | WHEN the benchmark completes, THE SYSTEM SHALL emit a machine-readable JSON report `{corpus_size, write_p95_ms, read_p95_ms, nl_query_p95_ms, pass: bool}` and a human-readable summary to stdout. |
| AC-008-06 | WHEN the benchmark is run in CI, THE SYSTEM SHALL fail the CI job if the go/no-go threshold is not met, blocking merge of Build/Explorer integration tests that depend on CE. |

### Go/No-Go Thresholds

| Metric | Corpus | Pass threshold | Rationale |
|---|---|---|---|
| Write p95 (CE-WRITE-1 full pipeline) | 100k triples | ≤ 800 ms | UI latency budget; modeller sees feedback in < 1 s |
| Read p95 (CE-READ-1 SPARQL SELECT) | 100k triples | ≤ 300 ms | Explorer/Build polling; 300 ms is sub-perceptible for async loads |
| NL query p95 (CE sans LLM) | 100k triples | ≤ 500 ms | LLM adds ~2–4 s; CE portion must stay under 500 ms for total < 5 s |
| Write p95 | 500k triples | ≤ 2000 ms | Large-tenant headroom; degradation allowed but not failure |
| Read p95 | 500k triples | ≤ 1000 ms | Large-tenant headroom |

Thresholds apply to the **100k corpus** for pass/fail (the M1 target scale). 500k results are
recorded and inform the production store decision (Neptune vs Jena Fuseki) but do not gate M1.

### Degrade Plan (if thresholds are not met)

| ID | Criterion (EARS) |
|---|---|
| AC-008-07 | WHEN write p95 exceeds 800 ms at 100k triples, THE SYSTEM SHALL record the failure in the benchmark report and the Architect SHALL trigger one of: (a) switch SHACL shape loading to startup-cached + async-invalidation, (b) batch SPARQL UPDATE into a single transaction, or (c) defer Build Engine grounding calls to M2 pending optimisation. |
| AC-008-08 | WHEN read p95 exceeds 300 ms at 100k triples, THE SYSTEM SHALL record the failure and the Architect SHALL evaluate: (a) add Oxigraph index tuning for BPMO query patterns, (b) introduce Redis result cache with CE-EVENT-1 invalidation, or (c) widen the threshold and record a documented risk. |
| AC-008-09 | WHEN a degrade plan is invoked, THE ARCHITECT SHALL record the decision in an ADR before closing this SPIKE. |

## Benchmark Harness Design

```mermaid
flowchart LR
    seed[Corpus seeder<br/>10k / 100k / 500k triples<br/>BPMO topology] --> store[(Oxigraph dev store)]
    store --> write_bench[Write benchmark<br/>100 × POST /api/operations/apply]
    store --> read_bench[Read benchmark<br/>200 × GET /api/sparql SELECT]
    store --> nl_bench[NL bench<br/>20 × POST /api/query/nl<br/>cached SPARQL, no LLM]
    write_bench --> report[JSON report<br/>{p50, p95, p99, pass}]
    read_bench --> report
    nl_bench --> report
    report --> ci_gate{CI gate<br/>pass?}
    ci_gate -->|yes| unblock[Unblock Build/Explorer M1]
    ci_gate -->|no| degrade[Trigger degrade plan<br/>ADR required]
```

## Representative Query Set

The read benchmark draws from these CE-READ-1 query patterns (derive from contracts.md):

1. `GET /api/ontology/types` — full kind catalogue fetch
2. `GET /api/ontology/resource/{iri}` — single resource with 3-hop edges
3. `GET /api/sparql` — `SELECT ?s ?p ?o WHERE { ?s a weave:Process }` (kind scan)
4. `GET /api/sparql` — `coverage_gap(process)` pattern (join-heavy)
5. `GET /api/sparql` — entity keyword search (CONTAINS filter)

Each query is run 40 times per corpus size; p50/p95/p99 computed per query pattern.

## Design Decisions

| Decision | Rationale |
|---|---|
| 100k triples as M1 pass/fail corpus | Represents a mid-size enterprise model; large enough to stress joins, small enough for a dev Oxigraph instance. |
| 500k triples measured but not gating M1 | Production store (Neptune/Fuseki) decision is deferred; 500k result informs that decision without blocking M1 ship. |
| LLM bypassed in NL benchmark | Isolates CE latency from LLM latency; both are measured end-to-end separately in TASK-007 E2E tests. |
| Harness runs against the real HTTP API (not in-process) | Measures the actual latency a caller experiences including serialisation, middleware, and auth. |
| Degrade plan requires ADR before SPIKE closes | Ensures optimisation decisions are recorded and traceable, not improvised. |

## Test Requirements

| Layer | Scenario | AC |
|---|---|---|
| Benchmark | Corpus seeder produces graphs of correct size and BPMO topology | AC-008-01 |
| Benchmark | Write p95 ≤ 800 ms at 100k (pass) | AC-008-02 |
| Benchmark | Read p95 ≤ 300 ms at 100k (pass) | AC-008-03 |
| Benchmark | NL query p95 ≤ 500 ms at 100k (pass) | AC-008-04 |
| Benchmark | JSON report emitted with correct schema | AC-008-05 |
| CI | CI job fails if any 100k threshold is breached | AC-008-06 |
| Degrade | If write threshold breached, degrade plan documented in ADR | AC-008-07 |
| Degrade | If read threshold breached, degrade plan documented in ADR | AC-008-08 |

## Dependencies

- **blocked_by**: TASK-001 (mutation pipeline must be functional), TASK-003 (CE-READ-1 endpoints
  must be accessible)
- **unlocks**: Build Engine M1 grounding calls, Graph Explorer M1 read calls — neither should
  be built to depend on CE latency until this SPIKE passes

## Cost Estimate

**M** — harness authoring + corpus generation + three benchmark runs + report + potential
degrade-plan ADR. No new CE feature code.

## DoR Checklist

- [ ] TASK-001 and TASK-003 complete and deployed to CI environment
- [ ] Oxigraph dev store accessible from CI runner
- [ ] BPMO graph topology defined for corpus seeder (class/instance/edge ratio)
- [ ] Representative query set confirmed against contracts.md CE-READ-1 patterns
- [ ] Degrade plan options reviewed by Architect before harness run

## DoD Checklist

- [ ] Benchmark harness committed to repo under `scripts/benchmarks/ce-perf/`
- [ ] JSON report generated and archived as CI artefact
- [ ] All three corpus sizes measured and recorded
- [ ] Go/no-go decision recorded in `04-arch/decisions/ADR-CE-PERF-001.md`
- [ ] If any threshold missed: degrade plan selected and ADR written before SPIKE is closed
- [ ] CI gate wired: Build/Explorer integration tests blocked until this SPIKE passes
- [ ] Harness is repeatable: clean store state before each run; no cross-run pollution

## Implementation Hints

**Corpus seeder**: generate BPMO-representative triples programmatically. A realistic ratio for
a 100k-triple graph is approximately: 500 class nodes × 10 triples each (5k), 1500 instance
nodes × 20 triples each (30k), 3000 typed edges × 5 triples each (15k), provenance/version
triples (50k). Adjust to hit the target size.

**Write benchmark isolation**: each batch in the 100-batch write run should operate on
distinct node IRIs to avoid idempotency cache hits distorting the latency. Use a UUID suffix
per batch.

**CI gate implementation**: emit a non-zero exit code from the harness when any 100k threshold
is breached. Wire into the CI workflow as a required check on the `ce-perf` job; Build Engine
and Graph Explorer integration test workflows declare `needs: [ce-perf]`.
