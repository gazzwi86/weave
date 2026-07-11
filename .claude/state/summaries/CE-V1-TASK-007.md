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
