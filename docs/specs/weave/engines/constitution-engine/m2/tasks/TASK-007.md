---
type: Task
title: "Task: TASK-007 — CE-METRICS-1 Aggregate Metrics Endpoint"
description: "GET /api/metrics/ontology serving the contracted aggregate shape for the Platform
  composable dashboard (FR-017), 60s-cached, no live reasoning."
tags: [constitution-engine, arch, task, milestone-M2]
timestamp: 2026-07-08T00:00:00Z
status: Backlog
priority: Must Have
entity: constitution-engine
epic: EPIC-005
milestone: M2
created: 2026-07-08
blocked_by: []
unlocks: []
adr_refs: []
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [constitution-engine.md](../../../constitution-engine.md) (FR-017)
Contracts: [contracts.md](../../../../contracts.md) (CE-METRICS-1) · M2 delta:
[m2-delta.md](../../tech-spec/m2-delta.md) §7, §9

## Story

As the Platform dashboard, I need one endpoint that answers "how big, how fresh, how healthy is
this tenant's graph" as plain aggregates, so dashboard tiles compose from a contract instead of
each hand-rolling SPARQL.

## Scope

`GET /api/metrics/ontology` per the CE-METRICS-1 contract shape. Provides **CE-METRICS-1**.
Backend only; the composable dashboard is Platform's (M2+). The M1 fixed dashboard does NOT
consume this (contracts.md note) — no migration work here.

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-007-01 | WHEN `GET /api/metrics/ontology` is called THE SYSTEM SHALL return exactly the contracted shape: `{ entity_count_by_kind, latest_version, draft_published_delta, shacl_errors_by_severity, owl_inconsistencies }`. |
| AC-007-02 | WHEN `entity_count_by_kind` is computed THE SYSTEM SHALL count draft-graph instances grouped by BPMO kind (the kinds served by `GET /api/ontology/types` — never a hand-copied list). |
| AC-007-03 | WHEN `owl_inconsistencies` is served THE SYSTEM SHALL report the publish-time reasoner result stored with the latest version — no live reasoning (post-v1). |
| AC-007-04 | WHEN `draft_published_delta` is computed THE SYSTEM SHALL reuse the CE-DIFF-1 machinery (counts from the diff of draft vs latest published) — not a re-implementation. |
| AC-007-05 | WHEN the endpoint is called twice within the cache window THE SYSTEM SHALL serve the second from a 60 s per-tenant cache; p95 ≤ 500 ms cold, ≤ 100 ms cached (m2-delta §9). |
| AC-007-06 | WHEN called without a JWT THE SYSTEM SHALL return 401; a tenant with an empty graph gets zeros, not errors. |

## Pseudocode

```text
GET /api/metrics/ontology:
    cached? -> return                              # key: (tenant_id), TTL 60s
    counts  = SELECT ?kind (COUNT(?s)) GROUP BY ?kind        # draft graph
    latest  = ontology_versions WHERE is_latest              # Aurora, CE-VERSION-1 source
    delta   = diff_counts(draft, latest)                     # CE-DIFF-1 internals
    shacl   = latest stored validation report -> counts by severity
              (or {"pending": true} if none for current state — mirror TASK-006 honesty rule)
    owl     = latest.publish_reasoner_result                 # stored at publish, never live
    return shape -> cache -> respond
```

## API Contracts

- **CE-METRICS-1** (canonical in [contracts.md](../../../../contracts.md)):
  `GET /api/metrics/ontology`. Errors: 401, 500. p95 ≤ 500 ms cold / ≤ 100 ms cached.
- Read-only; no write routes.

## Diagram References

| Diagram | Source | What it covers |
|---|---|---|
| M2 component delta | [m2-delta.md](../../tech-spec/m2-delta.md) §10 | Metrics Aggregator wired to CE-READ-1 surface + Platform |
| Metrics design | [m2-delta.md](../../tech-spec/m2-delta.md) §7 | Cache policy + no-live-reasoning rule |

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| 60 s per-tenant cache | Dashboard is not a consistency surface; stale-by-a-minute is harmless and caps store load | m2-delta §7 |
| `owl_inconsistencies` = stored publish-time result | OWL reasoning is post-v1; live reasoning here would smuggle it in early | m2-delta §7, roadmap |
| Reuse CE-DIFF-1 internals for the delta | The diff is already correct and edge-inclusive; a second diff implementation would drift | ADR-002 (M1), contracts CE-DIFF-1 |
| SHACL severity counts may be "pending" | Mirrors TASK-006: never serve stale counts as fresh | TASK-006 AC-006-04 |

## Test Requirements

Minimum: 3 unit, 3 integration.

| Layer | Scenario (`should X when Y`) | AC |
|---|---|---|
| Unit | should shape the response exactly per contract (schema test) | AC-007-01 |
| Unit | should group counts by kinds from the types endpoint fixture | AC-007-02 |
| Unit | should serve zeros for an empty tenant graph | AC-007-06 |
| Integration | should return correct counts/delta on the seeded fixture graph | AC-007-01/02/04 |
| Integration | should serve second call from cache within 60 s (store untouched — spy/counter) | AC-007-05 |
| Integration | should 401 without JWT | AC-007-06 |
| Perf | locust: cold ≤ 500 ms, cached ≤ 100 ms @ 100k store | AC-007-05 |

## Dependencies

- **blocked_by**: none within M2 (consumes M1 spine: types endpoint, CE-DIFF-1, version rows,
  stored validation results) — fully parallel
- **unlocks**: none in CE (unblocks Platform M2 dashboard externally)

## Cost Estimate

**S** — est. **200k tokens** (scale: S ≈ 200k, M ≈ 400k, L ≈ 700k). One read endpoint composing
four existing sources + a cache.

## DoR Checklist

- [x] Contract shape canonical (contracts.md CE-METRICS-1)
- [x] Cache + no-live-reasoning pinned (m2-delta §7); p95 pinned (§9)
- [x] All four data sources exist from M1 (types, diff, versions, stored reports)
- [ ] M1 program gate green (build precondition)

## DoD Checklist

- [ ] All ACs pass (unit + integration + perf)
- [ ] Contract schema test wired into CI (Platform consumes this shape)
- [ ] No write route under `/api/metrics/*`
- [ ] Coverage ≥ 80%, mutation ≥ 60% on new modules

## Implementation Hints

- `entity_count_by_kind` is one GROUP BY SELECT — resist per-kind queries in a loop.
- Read the kind list from the same module that serves `GET /api/ontology/types`
  (in-process call, not HTTP-to-self).
- Pitfall: `latest_version` for a never-published tenant is null — the schema must allow null
  and the delta then counts draft vs empty.
