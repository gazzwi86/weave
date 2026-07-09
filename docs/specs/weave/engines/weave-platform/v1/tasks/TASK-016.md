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
milestone: v1
created: 2026-07-08
blocked_by: [TASK-010, TASK-012]
unlocks: [TASK-017, TASK-024]
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

**As a** domain member using the dashboard (fixed tiles, generated widgets, or role-home)
**I want** every widget category backed by its real contract with honest thresholds and
degradation
**So that** any number on my dashboard is live, cited, tunable, and never fabricated.

## Acceptance Criteria

| ID | EARS Criterion | Test Mapping |
|----|----------------|--------------|
| AC-1 | WHEN any category binding resolves, THE SYSTEM SHALL bind only published contract IDs (`CE-METRICS-1`, `CE-READ-1`, `CE-VERSION-1`, `CE-EVENT-1`, `PLAT-AUDIT-1`, `PLAT-BILLING-1`, `PLAT-SETTINGS-1`, `PLAT-IDENTITY-1`) — plus, for S10 only, the platform's own CloudWatch ops-metrics namespace (an internal telemetry source, labelled "platform ops metrics" in the footer, not a contract) — and every rendered widget SHALL cite its source(s) in the data-source footer; no category sources an uncontracted *engine* surface (epic AC). | unit: `test_bindings_cite_published_contracts_only` |
| AC-2 | WHEN a category is requested (via resolver, fixed tile, or role-home), THE SYSTEM SHALL resolve it per the normative binding table below — fields, windows, and thresholds exactly as listed. | integration: `test_category_bindings_table` (parametrised, one case per category) |
| AC-3 | WHEN a compliance-widget entry (S5) is selected, THE SYSTEM SHALL deep-link the entity via `CE-READ-1` `/resource/{iri}` (FR-016). | e2e: `test_compliance_deep_link` |
| AC-4 | WHEN the operational-health category (S10) aggregates, THE SYSTEM SHALL compute error/retry/agent-failure rates per engine exclusively from the **CloudWatch metrics emitted by the structured-log/OTel pipeline** (E0-S7 scaffold; namespace `Weave/Ops`, dimensions `engine` + metric name) over a rolling window (default 7 d) — **never from `PLAT-AUDIT-1`** (audit is tamper-evident provenance, not ops telemetry: contracts.md PLAT-AUDIT-1 altitude note), no NLP, no inferred signals; WHEN any rate exceeds the spike threshold (default 2× the 7-day baseline, tunable), THE SYSTEM SHALL fire the alert-banner widget listing the driving metric series ranked by magnitude. Tests use LocalStack CloudWatch (Law F). | integration: `test_ops_health_aggregation_and_spike` |
| AC-5 | WHERE a binding uses a threshold or window (version-lag amber ≥ 2 / red ≥ 4; spike 2×; stagnation 14 d; burn-rate alert at 90% projected; growth window 30/90 d; refresh lag ≤ 5 min), THE SYSTEM SHALL resolve it through `PLAT-SETTINGS-1` with the stated default — never hard-coded (epic AC). | unit: `test_thresholds_resolve_via_settings` |
| AC-6 | IF a category's source errs, THEN THE SYSTEM SHALL degrade per its story-specific honesty rule (table below: cached-series+staleness for S13; unavailable-never-zero-gaps for S14; last-%-never-false-0/100 for S15; last-known+timestamp for S3; last-snapshot+"refresh delayed" for S10) — extending TASK-010's single degradation sweep, one parametrised case per category (epic AC). | integration: `test_degradation_sweep_per_category` |
| AC-7 | WHERE a row within a category depends on a non-GA engine (S3 per-run, S7 Build issues, S11 non-CE engine rows), THE SYSTEM SHALL render the defined "source engine not yet available" state with no fabricated/zeroed rows — one regression test covers all such rows simultaneously (epic AC). | integration: `test_not_yet_available_regression` |
| AC-8 | WHEN a `CE-METRICS-1` fetch succeeds, THE SYSTEM SHALL upsert one `metrics_daily_snapshots` row per (tenant, day); the growth chart (S13) SHALL render from snapshots (entity counts only at M2 — see flag) and the stagnation advisory SHALL be suppressed until ≥ 14 days of samples exist (no false "stagnating" on young workspaces). | integration: `test_growth_snapshot_upsert_and_suppression` |

### Normative binding table (AC-2)

| Story | Category | Contract(s) + fields | Thresholds / windows (defaults, tunable) |
|---|---|---|---|
| S1 | Ontology health | `CE-METRICS-1`: all five fields | — |
| S2 | Completeness / knowledge gaps | `CE-METRICS-1` `entity_count_by_kind` + `CE-READ-1` `coverage_gap(kind, required_links[])` — **exact contract signature**, rows `{ entity_iri, missing_link }`; the binding passes explicit pairs: default `coverage_gap(Process, [performedBy, governedBy])` plus `coverage_gap(BusinessCapability, [ownedBy])`; which predicates are "required" per kind is named HERE by the consumer, never derived per-kind in code, never hard-coded in the query; kinds from `GET /api/ontology/types`, never hand-copied | — |
| S3-token | Token & AI usage | `PLAT-BILLING-1` read surface: `GET /api/billing/usage?group_by=engine\|user\|project&from=&to=&granularity=day` → `{ rows: [{ key, tokens, runs, cost }], as_of }` — **counts only; `cost` is `null` until post-v1**, pending the rate-card contract note (2026-07-08 product ruling) (trend = `granularity=day` series; breakdown = `group_by` variants) + `PLAT-SETTINGS-1` budget caps (caps are settings — no billing budget endpoint exists) | burn-rate alert at 90% projected; staleness from `as_of` (lag ≤ 5 min); per-run dims (`runs`) dark until Events GA |
| S5 | Compliance status | `CE-METRICS-1` `shacl_errors_by_severity` + `CE-READ-1` (deep-link, self-audit) | — |
| S7-CE | Ontology issues | `CE-METRICS-1` `owl_inconsistencies` + `CE-READ-1` + `CE-VERSION-1` canonical lag | stale = lag ≥ 2; Build-project issues dark until Build GA |
| S10 | Operational health | CloudWatch ops metrics from the structured-log/OTel pipeline (`Weave/Ops` namespace, `engine` dimension) — never `PLAT-AUDIT-1` | window 7 d; spike 2× baseline → alert banner |
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
# NEW upstream calls are ONLY: CE-READ-1 coverage_gap(kind, required_links[]) with the S2
# pairs + /resource deep-link URL build, CE-VERSION-1 lag read, CloudWatch GetMetricData
# (S10, boto3 — LocalStack in tests), GET /api/billing/usage spend query,
# PLAT-SETTINGS-1/IDENTITY-1 RBAC coverage query, PLAT-AUDIT-1 query (S11 feed ONLY).

# Ops-health aggregation (S10) — CloudWatch, never audit (contracts.md altitude note)
def ops_health(tenant, window=settings("ops.window", "7d")):
  series = cloudwatch.get_metric_data(namespace="Weave/Ops",
             metrics=["error_count","retry_count","agent_failure_count"],
             dimensions={"engine": ALL}, period=window)          # emitted by E0-S7 pipeline
  rates = per-engine rates from series                            # pure metric math
  baseline = same query over the immediately-preceding window
  spikes = [e for e in rates if rate > settings("ops.spike_factor", 2.0) * baseline[e]]
  if spikes: attach alert_banner rows = top driving metric series ranked by magnitude

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
| S10 reads the CloudWatch/structured-log pipeline, never PLAT-AUDIT-1 | contracts.md PLAT-AUDIT-1 altitude note (audit ≠ ops telemetry); E2-S10 as re-sourced 2026-07-08 | boto3 GetMetricData on `Weave/Ops`; LocalStack in tests (Law F); high-volume error/retry signals never touch the append-only audit chain |
| S11 (agent feed) legitimately reads PLAT-AUDIT-1 | S11 is a provenance feed (who did what), not telemetry | The audit query API serves S11 only; S10 and S11 sources must not be swapped |
| All thresholds via PLAT-SETTINGS-1 | epic AC | One `settings(key, default)` helper (M1); grep finds zero literal thresholds in binding code |

## Test Requirements

### Unit Tests (minimum 3)

- `test_bindings_cite_published_contracts_only` — walk CATEGORIES: every contract ID ∈ the published set; every binding declares ≥ 1 component-compatible shape
- `test_thresholds_resolve_via_settings` — override spike factor / stagnation window via settings fixture; bindings honour overrides
- `test_growth_advisory_suppressed_when_young` — 13 samples ⟹ no advisory; 14 flat samples ⟹ advisory
- `test_s11_filters_agent_principals_only` — feed mixed human/agent audit rows; feed contains only `urn:weave:principal:agent:*` actors

### Integration Tests (minimum 4)

- `test_category_bindings_table` — parametrised ×10: each category resolves its table row's fields against seeded fixtures (CE fixture + M1 audit/billing/settings seeds)
- `test_ops_health_aggregation_and_spike` — seeded LocalStack CloudWatch metric data ⟹ correct per-engine rates; injected error-count burst ⟹ spike + ranked driving series; below threshold ⟹ no banner; spy proves zero PLAT-AUDIT-1 queries on the S10 path
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
- **unlocks:** TASK-017 (role-home composes completeness/SHACL/RBAC bindings), TASK-024
  (recent-edits E2-S9 binding joins this registry + degradation sweep)

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
- S10 is one CloudWatch `GetMetricData` batch call (all three metrics, both windows) — do not
  loop per metric/engine. S11's audit read is one filtered query via the M1 FR-037 API — do not
  export raw audit rows into Python to count them.
- S15's completeness score reuses S2's per-kind computation with a different projection —
  one function, two views.
- Baseline for spike detection = the window immediately preceding the current one; store
  nothing — request both windows in the same `GetMetricData` call and compare in memory.
- Snapshot upsert lives in the TASK-010 client's success hook — one line, no new call site.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*

### Design requirements

Source bundle: **R2 — Dashboard** (`docs/design/v1-design-requirements.md`, Blocker F-D10). This
task owns the "Needs you" list content — the category bindings that surface actionable gaps
(completeness, compliance, RBAC coverage, onboarding, ops-health alerts) on the dashboard.

- Each category renders as the generative-ui catalogue component its declared data shape maps to
  (`docs/standards/generative-ui.md` intent-mapping table): scalar → `KpiCard`, categorical →
  `BarChart`, ranked → `RankedList`, matrix → `Heatmap`, event log (S11) → `ActivityFeed`, alert
  (S10 spike) → `AlertBanner`. The binding's own `shapes` declaration (this task's `CATEGORIES`
  registry) is what the resolver uses to pick the component — no per-category hardcoding.
- The S10 spike `AlertBanner` spans full width in the bento grid, per the catalogue's column-span
  rule (`docs/standards/design/layout-grid.md` §Bento dashboard grid: "an `AlertBanner` spans full
  width").
- Every category widget's footer cites its real contract(s) — this is the task's own AC-1;
  the token-level treatment is `--text-caption` `--color-text-muted`
  (`docs/standards/design/components.md` §Data-widget states, footer row).
- S11 (agent activity feed) and S14 (RBAC coverage) rows carry principal/actor IRIs. Every
  principal reference on these rows SHALL render as `EntityRef` (friendly label + mono ID chip),
  never the raw `urn:weave:principal:...` string — no raw principal URN anywhere on this surface
  (R1 bundle primitive; R2's explicit "no raw principal URN" rule; F-D08 finding,
  `design-assessment-2026-07-09.md`).
- Degradation states use the tokens in `docs/standards/design/components.md` §Data-widget states,
  backing this task's own AC-6 story-specific honesty rules: stale (S13, S7-CE, S3) →
  `--color-text-muted` badge + `--font-mono` timestamp; data-source unavailable (S14) →
  `--color-warn` soft-bg + named reason + retry, never "0 gaps"; S15/S10 last-known states use the
  same stale/unavailable tokens per which case applies.
- Status/severity badges (S5 compliance, S14 gaps) are icon + text, never colour-alone
  (`docs/standards/design/components.md` badge/chip rule, satisfies WCAG SC 1.4.1).
- Components are consumed from the Storybook design-system library once `PLAT-V1-TASK-026` (R13
  Storybook foundation) lands (`docs/design/visual-direction.md` R13 delivery approach); the
  resolver/tiles/role-home layers bind data into those components, they do not own presentational
  markup (R13 atomic-design ruling).
- JTBD: these category widgets are the mechanism for "is anything waiting on me?"
  (`docs/design/jtbd.md` Home/Dashboard success criterion) — S2/S14/S15 in particular are the
  "Needs you" content the R2 bundle names.

**Advisory (uncited, not an acceptance criterion):** `components.md` gives `role="alert"` +
`aria-live` treatment explicitly for the LLM-offline data-widget state but does not separately
name it for a threshold-breach `AlertBanner` like S10's spike alert; recommend the same
`role="alert"` semantics for the S10 banner since it is an unprompted, attention-worthy state
change, but this is an extrapolation, not a cited rule — flag for the fable-tier architect to
confirm at sign-off or route to the design-standards owner if it should become an explicit rule.
