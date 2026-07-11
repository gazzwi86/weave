# Progress: CE-V1-TASK-007 — CE-METRICS-1 Aggregate Metrics Endpoint (EPIC-005 root)

`constitution-engine` EPIC-005. **PARALLEL LANE E** worktree `../weave-CE-V1-EPIC-005`, branch `feature/CE-V1-EPIC-005`
(off origin/main 67fc6ef — behind by EPIC-008, restack at close). Backend. Built across overflow + continuation.
Coordinator-authored from receipt, pre-QA. HEAD `9f7d0fb`, not pushed. 6 ACs, all Met per engineer.

## What shipped
- `GET /api/metrics/ontology` (`routers/metrics.py`) → `MetricsResponse` (`schemas/metrics.py`): exact CE-METRICS-1
  shape `{entity_count_by_kind, latest_version, draft_published_delta, shacl_errors_by_severity, owl_inconsistencies}`.
- `operations/aggregate_metrics.py` (count/delta/version), `operations/metrics_cache.py` (Redis 60s TTL). No new tables.

## Per-AC (engineer-reported — QA re-verify; 6 ACs, counted exactly)
- **AC-007-01** exact contract shape ✓. **AC-007-02** entity_count_by_kind grouped by BPMO kind, zero-defaults from
  `catalogue.list_kinds()` (canonical, not hand-copied) ✓.
- **AC-007-03** owl_inconsistencies + shacl_errors serve `{"pending":true}` (NO reasoner/SHACL-report producer exists
  yet — TASK-006 backlog, reasoner post-v1) — honest pending, never fake 0 ✓.
- **AC-007-04** draft_published_delta reuses M1 `operations.diff::diff_graphs` DIRECTLY (not CE-DIFF-1 HTTP) ✓.
- **AC-007-05** 60s cache mechanism tested (hit/miss/TTL/call-count spy). ⚠️ **PERF TARGET UNVERIFIED** (p95 ≤500ms cold
  /≤100ms cached) — zero locust infra in repo; endpoint NOT in `testing-strategy.md` §6 locust-gated table. QA ADJUDICATE:
  real DoD gap (like CE-003 AC-003-06 which m2-delta §9 explicitly required) OR aspirational/deferrable (endpoint absent
  from the locust table + perf line reads pseudocode-aspirational)? Decide per the actual brief DoD + testing-strategy.
- **AC-007-06** 401 no-JWT; empty-graph tenant → zeros not errors ✓.

## Tenant isolation
Cache key `ce:metrics:agg:{tenant_id}:{workspace_id}` — STRONGER than tenant-only (workspace-scoped, no cross-workspace
leak in a shared tenant). ADR-022-metrics-cache-key-workspace-scoped (Law 10 documented deviation from brief's per-tenant wording).

## Gates
ruff 0 · ruff format clean · mypy 0/432 · bandit 0 · coverage 89% (aggregate_metrics 97%, metrics_cache 53% unit — Redis
get/set exercised by docker lane, met-by-inference; router 90%, schemas 100%). 7 unit + 4 integration (docker, fresh stack).
Full unit suite green. Engineer found+fixed a fixture role bug (author-role for the apply-using test).

## Commits (feature/CE-V1-EPIC-005, not pushed): db5fe7e (WIP bundle) · fe5fae1 (fixture fix) · 9f7d0fb (ADR, HEAD).

## Epic status
EPIC-005 root. Restack onto ba818b9 at epic-close.

## QA round 1 (2026-07-11, af33b7f) — FAIL on AC-007-05 perf ONLY (SYSTEMIC, escalated)
5/6 ACs PASS (contract shape, canonical kind-source, pending-honesty, M1-diff-reuse, 401/empty-zeros). QA added
cross-workspace cache-isolation integration test `bcee446` (real multi-tenancy leak check — cache key (tenant,workspace)
confirmed isolated). Gates: ruff 0, mypy 0/432, 944 unit, 5/5 integration. **AC-007-05 perf FAIL = SYSTEMIC, not task fault:**
ZERO locust infra exists anywhere in repo; brief DoD ("unit+integration+perf") + m2-delta §9 ("measured like §1") require
it, but testing-strategy §6 locust table never updated for the 5 M2 endpoints (spec DRIFT). Class = spec-ambiguity →
escalate, NOT retry. Close HELD on the locust-harness decision (PROJ-002).

## Retry 2 — cold-path perf FIXED (2026-07-11, a31eac6) — re-QA pending
XT-CE007-1 resolved: `draft_published_delta` rewritten from whole-graph rdflib parse → SPARQL count-diff.
**Benchmark @100k: cold p95 59.5ms (was 2075ms, ≤500ms target, 35x headroom), cached 3.3ms — BOTH PASS.**
Engineer ALSO found+fixed a correctness bug: `run_query_multi` sent two `named-graph-uri` params but Oxigraph honors
only the LAST → "before" graph dropped → all-added wrong counts. Fix: use `run_query_unscoped` (query scopes via
explicit `GRAPH <iri>` blocks). Counts now correct (fixture {added:2,removed:1,modified:1}). 6/6 integration + full
unit suite green (shared oxigraph_client regression clean). mypy 0/433, ruff 0. Commits a02b3d7 + 6c62121. HEAD 6c62121.
**AC-007-04 intent-vs-literal:** SPARQL count-diff replaces literal `diff_graphs` reuse — intent (internal, correct
counts, NOT CE-DIFF-1 HTTP) preserved; QA/architect confirm the trade. re-QA focus: added/removed/MODIFIED semantics
match diff_graphs across edge cases.
