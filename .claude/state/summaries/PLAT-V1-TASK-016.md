# PLAT-V1-TASK-016 — Widget-library category bindings

Status: DONE. Built in worktree `weave-PLAT-V1-EPIC-002`, branch `feature/PLAT-V1-EPIC-002`,
epic PLAT-V1-EPIC-002 (partial delivery — TASK-023/024 deferred, blocked on this task).

## What shipped

- `dashboard/bindings.py` — the single `CATEGORIES` registry (10 category bindings: S2 completeness,
  S3 token-spend, S5 compliance, S7 ontology-issues, S10 operational-health, S11 agent-activity,
  S13 graph-growth, S14 rbac-coverage, S15 onboarding-progress, plus ontology-health), each declaring
  its published contracts, shapes, and a `fetch` function. Resolver (TASK-012), fixed tiles
  (TASK-010), and role-home (TASK-017, not yet built) all consume this one dict — no drift possible.
- `dashboard/thresholds.py` — `threshold()` resolves every numeric cutoff via PLAT-SETTINGS-1's
  cascade, falling back to a named `DEFAULTS` dict. Zero literal thresholds in `bindings.py` (grep-verified).
- `dashboard/snapshots.py` — `metrics_daily_snapshots` upsert/series/stagnation-advisory for S13
  growth history (CE-METRICS-1 has no history field; this is the platform-side sampling table,
  migration `0081_metrics_daily_snapshots.sql`, RLS matching the `0071_widget_state.sql` precedent).
- `dashboard/ops_health.py` — S10's CloudWatch `GetMetricData` aggregation (one batch call, current +
  baseline window, spike detection), reading `Weave/Ops` namespace — never `PLAT-AUDIT-1` (contracts.md
  altitude note: audit is provenance, not telemetry).
- `dashboard/coverage_gap.py` — extended with `contraventions()`: a SHACL `sh:ValidationResult` SPARQL
  query submitted via the existing `POST /api/sparql` endpoint (no new CE route), returning per-row
  `/resource/{iri}` deep-link hrefs for AC-3 (reuses the href convention already established in
  `routers/requests.py`'s grounding-entity links).
- `dashboard/availability.py` — added a `"platform"` / `"PLAT"` entry to the Engine-Availability
  Registry. Without this, every PLAT-* contract (billing/settings/audit/identity) was silently
  treated as not-GA (fell through to the "unknown engine defaults false" rule), which is wrong —
  the platform shell's own contracts are always available; only the four roadmap engines (CE/Build/
  Events/Explorer) are gated by this registry. Locked with a new unit test
  (`test_plat_contracts_are_always_ga`). This file is shared with TASK-012 — reran TASK-012's full
  existing dashboard/resolver/example-prompts suite after the change, all still green.

## AC-3 scope decision (coordinator-confirmed)

The brief's Test-Requirements section names `test_compliance_deep_link` as a Playwright E2E test
(click a compliance widget → navigate to `/resource/{iri}`), but the brief's own API-Contracts
section says this task ships "no new public endpoints... internal layer consumed by TASK-010/011/017
routes." The existing dashboard frontend (`widget-tile.tsx`, built by TASK-010/012) only renders
`bar_chart`/`table`/KPI shapes today — its own code comment says a richer per-type renderer
(including whatever a clickable compliance row needs) is explicitly "a later task's scope."

Per coordinator decision: AC-3 is satisfied at the binding level. `test_compliance_deep_link`
(integration test, `tests/integration/test_dashboard_bindings_api.py`) asserts the `compliance`
binding's `contraventions` rows carry the correct `/resource/{iri}` href for a seeded SHACL
violation. The Playwright click-through is deferred to TASK-017 (role-home is the page that will
actually render this widget grid). Escalation note (superseded by the coordinator's ruling, kept for
audit trail): `.claude/state/escalations/TASK-016-blocker.md`.

## Other decisions

- **ADR-019** (new): S3 token-spend binds to M1's existing workspace-scoped `get_usage_summary()`,
  not PLAT-BILLING-1's documented `group_by=engine|user|project` parameter (which the M1 billing
  router doesn't implement). Flagged as a follow-up for whoever extends the billing router, not
  invented here. Replaces an earlier dangling "ADR-015" code comment reference (ADR-015 already
  exists and is a different decision — that was a citation mistake, fixed).
- S10 (`operational-health`) legitimately has `contracts=[]` in the registry — CloudWatch is
  explicitly not a contract (contracts.md altitude note). AC-1's "cite published contracts" test
  special-cases this one category.
- Growth-trend relationship counts (S13) are entity-count-only at M2 — CE-METRICS-1 has no
  relationship-count field. Flagged in-brief already, not re-litigated here.

## Test results (all green)

- Unit (`tests/unit/test_dashboard_bindings.py`, `test_dashboard_availability.py`): AC-1, AC-5
  (+ fallback), AC-8 (stagnation suppression), S11 filter, new PLAT-availability lock test.
- Integration (`tests/integration/test_dashboard_bindings_api.py`): `test_category_bindings_table`
  (×9), `test_degradation_sweep_per_category`, `test_not_yet_available_regression`,
  `test_growth_snapshot_upsert_and_suppression`, `test_ops_health_aggregation_and_spike` (LocalStack
  CloudWatch `PutMetricData`/`GetMetricData` is environment-broken — see `operations/metrics.py`'s
  existing `WEAVE_DISABLE_MUTATION_METRICS` docstring precedent — so this test monkeypatches
  `ops_health.cloudwatch_client()` with a fake `get_metric_data` returning canned current/baseline
  responses, exercising the real `aggregate()`/spike-detection logic instead of skipping it),
  `test_compliance_deep_link` (AC-3, binding-level).
- Targeted dashboard/bindings/availability/resolver/example-prompt suite: 159 passed.
- Backend poison-endpoint pytest (`-m "not docker and not e2e"`, LocalStack/Oxigraph pointed at
  unreachable ports): all green.
- Backend ruff (`packages/backend`), mypy (`src/ tests/`): clean.
- Frontend lint (0 errors, pre-existing warnings only), typecheck, `npm test` (228 files / 1170
  tests): all green.
- OKF validate (`docs/wiki --strict`): conformant (1 pre-existing tolerated warning, unrelated to
  this task).
- Mutmut-baseline cleanliness: grepped all new/changed dashboard modules for `Path(__file__).parents[N]`
  — no matches, clean.
- `ui_verify`: not run — no new UI shipped this task (see AC-3 scope decision above); N/A rather
  than skipped.

## Migration

`0081_metrics_daily_snapshots.sql` — new table only, RLS + grants pattern matching `0071_widget_state.sql`.

## Deferred

TASK-023/024 (blocked on this task) are not built — separate PR when picked up.
