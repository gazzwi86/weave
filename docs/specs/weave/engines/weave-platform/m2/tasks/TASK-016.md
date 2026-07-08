---
type: Task Brief
title: "Task: TASK-016 — Widget-library category bindings: 10 CE/platform-sourced categories (EPIC-002)"
description: "The data-binding layer behind every M2 widget category: ontology health (S1),
  completeness/gaps (S2), token/AI spend (S3-token), compliance (S5), ontology issues (S7-CE),
  operational health (S10), agent activity (S11), graph growth (S13), RBAC coverage (S14),
  onboarding progress (S15). Includes the daily growth snapshot, tunable thresholds, per-story
  honest degradation, and the not-yet-available regression."
tags: [weave-platform, arch, task]
timestamp: 2026-07-08T12:00:00Z
status: Backlog
priority: Must Have
entity: weave-platform
epic: EPIC-002
milestone: M2
created: 2026-07-08
blocked_by: [TASK-010, TASK-012]
unlocks: [TASK-017]
adr_refs: [ADR-013, ADR-014]
---

# Task: TASK-016 — Widget-library category bindings: 10 CE/platform-sourced categories (EPIC-002)

**Spec:** [weave-platform.md](../../../weave-platform.md) · **Delta:** [m2-delta.md](../../tech-spec/m2-delta.md) · **Contracts:** [contracts.md](../../../../contracts.md)

> **Scope traceability:** the roadmap M2 table lists 9 EPIC-002 stories (S1, S2, S5, S7-CE,
> S10, S11, S13, S14, S15) and omits E2-S3, whose token portion the epic marks
> "Must — token MVP". Coordinator ruling 2026-07-08: **S3-token is included here** (roadmap
> row is a transcription miss); S3's per-run dimension stays dark until Events ships.

## Story

**Epic:** EPIC-002 Widget Library
**Priority:** Must Have (S11 rows: Should)

**As a** workspace member using the dashboard (fixed tiles, generated widgets, or role-home)
**I want** every widget category backed by its real contract with honest thresholds and
degradation
**So that** any number on my dashboard is live, cited, tunable, and never fabricated.

## Acceptance Criteria

| ID | EARS Criterion | Test Mapping |
|----|----------------|--------------|
| AC-1 | WHEN any category binding resolves, THE SYSTEM SHALL bind only published contract IDs (`CE-METRICS-1`, `CE-READ-1`, `CE-VERSION-1`, `CE-EVENT-1`, `PLAT-AUDIT-1`, `PLAT-BILLING-1`, `PLAT-SETTINGS-1`, `PLAT-IDENTITY-1`) and every rendered widget SHALL cite its contract(s) in the data-source footer — no category sources an uncontracted engine surface (epic AC). | unit: `test_bindings_cite_published_contracts_only` |
| AC-2 | WHEN a category is requested (via resolver, fixed tile, or role-home), THE SYSTEM SHALL resolve it per the normative binding table below — fields, windows, and thresholds exactly as listed. | integration: `test_category_bindings_table` (parametrised, one case per category) |
| AC-3 | WHEN a compliance-widget entry (S5) is selected, THE SYSTEM SHALL deep-link the entity via `CE-READ-1` `/resource/{iri}` (FR-016). | e2e: `test_compliance_deep_link` |
| AC-4 | WHEN the operational-health category (S10) aggregates, THE SYSTEM SHALL compute error/retry/agent-failure rates per engine exclusively from `PLAT-AUDIT-1` `event_type` + `engine` fields over a rolling window (default 7 d) — no NLP, no inferred signals; WHEN any rate exceeds the spike threshold (default 2× the 7-day baseline, tunable), THE SYSTEM SHALL fire the alert-banner widget listing the driving audit entries ranked by frequency. | integration: `test_ops_health_aggregation_and_spike` |
| AC-5 | WHERE a binding uses a threshold or window (version-lag amber ≥ 2 / red ≥ 4; spike 2×; stagnation 14 d; burn-rate alert at 90% projected; growth window 30/90 d; refresh lag ≤ 5 min), THE SYSTEM SHALL resolve it through `PLAT-SETTINGS-1` with the stated default — never hard-coded (epic AC). | unit: `test_thresholds_resolve_via_settings` |
| AC-6 | IF a category's source errs, THEN THE SYSTEM SHALL degrade per its story-specific honesty rule (table below: cached-series+staleness for S13; unavailable-never-zero-gaps for S14; last-%-never-false-0/100 for S15; last-known+timestamp for S3; last-snapshot+"refresh delayed" for S10) — extending TASK-010's single degradation sweep, one parametrised case per category (epic AC). | integration: `test_degradation_sweep_per_category` |
| AC-7 | WHERE a row within a category depends on a non-GA engine (S3 per-run, S7 Build issues, S11 non-CE engine rows), THE SYSTEM SHALL render the defined "source engine not yet available" state with no fabricated/zeroed rows — one regression test covers all such rows simultaneously (epic AC). | integration: `test_not_yet_available_regression` |
| AC-8 | WHEN a `CE-METRICS-1` fetch succeeds, THE SYSTEM SHALL upsert one `metrics_daily_snapshots` row per (tenant, day); the growth chart (S13) SHALL render from snapshots (entity counts only at M2 — see flag) and the stagnation advisory SHALL be suppressed until ≥ 14 days of samples exist (no false "stagnating" on young workspaces). | integration: `test_growth_snapshot_upsert_and_suppression` |

### Normative binding table (AC-2)

| Story | Category | Contract(s) + fields | Thresholds / windows (defaults, tunable) |
|---|---|---|---|
| S1 | Ontology health | `CE-METRICS-1`: all five fields | — |
| S2 | Completeness / knowledge gaps | `CE-METRICS-1` `entity_count_by_kind` + `CE-READ-1` `coverage_gap` rows; kinds from `GET /api/ontology/types`, never hand-copied | — |
| S3-token | Token & AI spend | `PLAT-BILLING-1` per-token dims (by engine/user/project, 7d/30d trend) + `PLAT-SETTINGS-1` budget caps | burn-rate alert at 90% projected; data lag ≤ 5 min; per-run dims dark until Events GA |
| S5 | Compliance status | `CE-METRICS-1` `shacl_errors_by_severity` + `CE-READ-1` (deep-link, self-audit) | — |
| S7-CE | Ontology issues | `CE-METRICS-1` `owl_inconsistencies` + `CE-READ-1` + `CE-VERSION-1` canonical lag | stale = lag ≥ 2; Build-project issues dark until Build GA |
| S10 | Operational health | `PLAT-AUDIT-1` aggregate on `event_type` + `engine` only | window 7 d; spike 2× baseline → alert banner |
| S11 | Agent activity feed | `PLAT-AUDIT-1` filtered to agent-principal IRIs (`PLAT-IDENTITY-1` scheme) reverse-chronological | CE rows only at M2; other engines not-yet-available |
| S13 | Graph growth trend | `metrics_daily_snapshots` (sampled from `CE-METRICS-1`) | window 30/90 d; stagnation advisory 14 d flat/declining |
| S14 | RBAC & access coverage | `PLAT-SETTINGS-1` RBAC + `PLAT-IDENTITY-1`: users w/o role, areas w/o owner, role changes (7 d), broad-scope agent principals | — |
| S15 | Onboarding progress | `CE-METRICS-1` completeness (per-kind population over BPMO kinds) + next recommended action | auto-dismiss at 100%; connector item appears v1.0 |

## Implementation

### Pseudocode

```text
# Binding registry (packages/backend/dashboard/bindings.py)
# One declarative dict — the resolver (TASK-012), fixed tiles (TASK-010) and
# role-home (TASK-017) all read it. Each entry:
CATEGORIES = {
  "ontology-health":   Binding(contracts=["CE-METRICS-1"], fetch=metrics_all, shapes=[scalar, categorical]),
  "completeness":      Binding(contracts=["CE-METRICS-1","CE-READ-1"], fetch=completeness, shapes=[matrix, ranked]),
  "token-spend":       Binding(contracts=["PLAT-BILLING-1","PLAT-SETTINGS-1"], fetch=spend, shapes=[series, categorical, scalar]),
  ... one per table row ...
}
# fetch fns reuse: TASK-010 ce_metrics client; M1 billing/audit/settings/identity query modules.
# NEW upstream calls are ONLY: CE-READ-1 coverage_gap + /resource deep-link URL build,
# CE-VERSION-1 lag read, PLAT-AUDIT-1 aggregate query, PLAT-BILLING-1 spend query,
# PLAT-SETTINGS-1/IDENTITY-1 RBAC coverage query.

# Ops-health aggregation (S10)
def ops_health(tenant, window=settings("ops.window", "7d")):
  rows = audit.query(tenant, group_by=["engine","event_type"], since=window)   # M1 FR-037 API
  rates = {engine: {error_rate, retry_rate, agent_failure_rate}}               # pure field counts
  baseline = same aggregation over prior window
  spikes = [e for e in rates if rate > settings("ops.spike_factor", 2.0) * baseline[e]]
  if spikes: attach alert_banner rows = top driving entries ranked by frequency

# Growth snapshot (S13)  # ponytail: sampled on fetch, no scheduler — a workspace nobody
#                        # looks at needs no history; upgrade to EventBridge cron if
#                        # gap-free series ever becomes a requirement
on successful metrics fetch (TASK-010 client hook):
  upsert metrics_daily_snapshots(tenant_id, day=today, entity_count=sum(by_kind),
                                 counts_by_kind=by_kind)   # UK (tenant_id, day)
growth_series(window): select last N days; advisory only if samples >= 14 and flat/declining

# Not-yet-available rows (AC-7)
row availability checks the ONE registry (m2-delta §1); dark rows render state, never zeros
```

### API Contracts

No new public endpoints — bindings are an internal layer consumed by TASK-010/011/017 routes.
Upstream calls per the binding table; all cited contracts are published in
[`contracts.md`](../../../../contracts.md). `PLAT-AUDIT-1` queries use the M1 query API
(FR-037: filter by date/actor/type/engine, paginated ≤ 500/page).

### Diagram References

| Diagram | Notes |
|---------|-------|
| Component delta | [`tech-spec/m2-delta.md`](../../tech-spec/m2-delta.md) §1 — Category Bindings box + its contract edges |
| Data-model delta | [`tech-spec/m2-delta.md`](../../tech-spec/m2-delta.md) §4 — incl. `metrics_daily_snapshots` (§4.4) |
| Honest-state matrix | [`tech-spec/m2-delta.md`](../../tech-spec/m2-delta.md) §6 — per-category degradation maps onto it |

### Design Decisions

| Decision | Source | Impact on This Task |
|----------|--------|---------------------|
| S3-token included; per-run dark until Events GA | Coordinator ruling 2026-07-08 (roadmap omission = transcription miss) | One extra binding; PLAT-BILLING-1 query module is live M1 code |
| One declarative CATEGORIES registry | Arch Law 6; epic AC "every category cites real contracts" | Resolver/tiles/role-home cannot drift; AC-1 test walks the dict |
| Growth history = platform-side daily snapshot sampled on fetch | CE-METRICS-1 exposes no history (contract shape is point-in-time) | New small table (m2-delta §4.4); no scheduler at M2; advisory suppressed < 14 samples |
| S13 charts entity counts only at M2 | CE-METRICS-1 has no relationship-count field | Relationship counts need a CE contract field — flagged to coordinator, not invented here |
| S10 reads only `event_type` + `engine` fields | E2-S10 AC ("no NLP, no inferred signals") | Aggregation is pure counting; anything smarter is out of scope by spec |
| All thresholds via PLAT-SETTINGS-1 | epic AC | One `settings(key, default)` helper (M1); grep finds zero literal thresholds in binding code |

## Test Requirements

### Unit Tests (minimum 3)

- `test_bindings_cite_published_contracts_only` — walk CATEGORIES: every contract ID ∈ the published set; every binding declares ≥ 1 component-compatible shape
- `test_thresholds_resolve_via_settings` — override spike factor / stagnation window via settings fixture; bindings honour overrides
- `test_growth_advisory_suppressed_when_young` — 13 samples ⟹ no advisory; 14 flat samples ⟹ advisory
- `test_s11_filters_agent_principals_only` — feed mixed human/agent audit rows; feed contains only `urn:weave:principal:agent:*` actors

### Integration Tests (minimum 4)

- `test_category_bindings_table` — parametrised ×10: each category resolves its table row's fields against seeded fixtures (CE fixture + M1 audit/billing/settings seeds)
- `test_ops_health_aggregation_and_spike` — seeded audit rows ⟹ correct per-engine rates; injected error burst ⟹ spike + ranked driving entries; below threshold ⟹ no banner
- `test_degradation_sweep_per_category` — parametrised ×10 (extends TASK-010 sweep): each category's story-specific honest state; explicit negative assertions (S14 never "0 gaps", S15 never 0%/100%, S13 never empty chart)
- `test_not_yet_available_regression` — availability fixture (CE-only GA): S3 per-run, S7 Build, S11 non-CE rows all render not-yet-available; flip Build GA in fixture ⟹ S7 Build rows activate (proves gating is registry-driven)
- `test_growth_snapshot_upsert_and_suppression` — two fetches same day ⟹ one row; series over seeded 30 days renders

### E2E Tests (minimum 1)

- `test_compliance_deep_link` — Playwright: compliance widget lists seeded contravention; click ⟹ navigates to `/resource/{iri}` view of the entity (CE fixture serves it) (Plugin Law B)

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|----|-----------|-----------|
| AC-1 | Unit | `test_bindings_cite_published_contracts_only` |
| AC-2 | Integration | `test_category_bindings_table` |
| AC-3 | E2E | `test_compliance_deep_link` |
| AC-4 | Integration | `test_ops_health_aggregation_and_spike` |
| AC-5 | Unit | `test_thresholds_resolve_via_settings` |
| AC-6 | Integration | `test_degradation_sweep_per_category` |
| AC-7 | Integration | `test_not_yet_available_regression` |
| AC-8 | Integration + Unit | `test_growth_snapshot_upsert_and_suppression`, `test_growth_advisory_suppressed_when_young` |

## Dependencies

- **blocked_by:** TASK-010 (CE client, tables, state matrix, availability registry), TASK-012 (resolver consumes the registry's shapes for mapping)
- **unlocks:** TASK-017 (role-home composes completeness/SHACL/RBAC bindings)

## Cost Estimate

- **Complexity:** L
- **Estimated tokens:** ~75K input, ~30K output
- **Estimated cost:** ~$5

## Definition of Ready Checklist

- [x] User story clear
- [x] All ACs have mapped tests
- [x] Pseudocode provided
- [x] All 10 bindings enumerated with contracts, fields, thresholds (normative table)
- [x] S3 inclusion + roadmap omission traced to coordinator ruling
- [x] Growth-history gap resolved in-brief (snapshot table) with the relationship-count flag surfaced, not silently invented

## Definition of Done Checklist

- [ ] All ACs met
- [ ] CATEGORIES registry is the single binding source (resolver/tiles/role-home import it)
- [ ] Zero literal thresholds in binding code (settings-resolved, grep-verified)
- [ ] Degradation sweep covers all 10 categories with negative assertions
- [ ] Not-yet-available regression proves registry-driven activation (fixture flip)
- [ ] `metrics_daily_snapshots` carries RLS like the other widget tables
- [ ] Coverage ≥ 80%; mutation ≥ 60%
- [ ] Conventional commit: `feat: add widget category bindings for CE and platform sources`

## Implementation Hints

- Each binding's `fetch` should return `(data_shape, rows)` so TASK-012's compatibility matrix
  applies mechanically — bindings never name components.
- The audit aggregate for S10/S11 is one GROUP BY query via the M1 query API — do not export
  raw audit rows into Python to count them.
- S15's completeness score reuses S2's per-kind computation with a different projection —
  one function, two views.
- Baseline for spike detection = the window immediately preceding the current one; store
  nothing — compute both aggregates in one query with a CASE on the time bucket.
- Snapshot upsert lives in the TASK-010 client's success hook — one line, no new call site.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*
