---
type: Task Brief
title: "Task: TASK-010 — Widget-state foundation + fixed CE-sourced default dashboard (E1-S0, E1-S6)"
description: "Create the three Aurora widget-state tables (RLS), the CE-METRICS-1 client with
  pending handling, the SWR read/refresh path, the fixed tenant-default tile set (seeded at
  tenant provisioning + one-time backfill), and role-appropriate Suggested starters."
tags: [weave-platform, arch, task]
timestamp: 2026-07-08T12:00:00Z
status: Backlog
priority: Must Have
entity: weave-platform
epic: EPIC-001
milestone: v1
created: 2026-07-08
blocked_by: []
unlocks: [TASK-011, TASK-014, TASK-016, TASK-017]
adr_refs: [ADR-013, ADR-014]
---

# Task: TASK-010 — Widget-state foundation + fixed CE-sourced default dashboard (E1-S0, E1-S6)

**Spec:** [weave-platform.md](../../../weave-platform.md) · **Delta:** [m2-delta.md](../../tech-spec/m2-delta.md) · **Contracts:** [contracts.md](../../../../contracts.md)

> **Milestone preconditions (not DAG entries):** M1 gate passed; CE GA with `CE-METRICS-1`
> published. First M2 task — everything else in M2 builds on these tables and this read path.

## Story

**Epic:** EPIC-001 Dashboard
**Priority:** Must Have

**As a** workspace member
**I want** a useful default dashboard of live model-health tiles the moment CE is GA, plus
role-appropriate suggested widgets on my first login
**So that** my home screen is never blank and surfaces real ontology health without any setup.

## Acceptance Criteria

| ID | EARS Criterion | Test Mapping |
|----|----------------|--------------|
| AC-1 | WHEN migrations run, THE SYSTEM SHALL create `widget_instances`, `widget_library_items`, `widget_refinements` exactly per m2-delta §4 (columns, CHECKs, indexes — **tenant-scoped only, no `workspace_id` column**; workspace ≡ tenant per data-model.md §Workspace), each with `tenant_id` NOT NULL and the **DB-enforced Postgres RLS policy family** applied (backstop independent of the app-layer predicate). | integration: `test_widget_tables_rls_enforced` |
| AC-2 | WHEN a tenant (company workspace) is provisioned, THE SYSTEM SHALL seed the fixed default tile set as `scope='tenant_default'` rows (owner NULL); a one-time backfill migration SHALL seed all existing tenants. | integration: `test_default_tiles_seeded_on_tenant_create`, `test_backfill_seeds_existing_tenants` |
| AC-3 | WHEN the dashboard loads at M2, THE SYSTEM SHALL render the fixed tiles from `GET /api/dashboard/widgets` with no prompt bar dependency, each tile showing a data-source footer naming `CE-METRICS-1` (FR-000, FR-014). | e2e: `test_fixed_dashboard_renders_ce_tiles` |
| AC-4 | IF `CE-METRICS-1` errors on load, THEN THE SYSTEM SHALL render each affected tile in the defined `unavailable` state with named reason + retry, while unaffected tiles still load — never a blank tile (E1-S0 failure AC). | integration: `test_metrics_error_renders_unavailable_state` |
| AC-5 | WHEN `shacl_errors_by_severity` returns `{ "pending": true }` (canonical shape, contracts.md CE-METRICS-1), THE SYSTEM SHALL render a "counts pending" chip on that metric and SHALL NOT render zeros; other fields on the same response render normally (per-field pending, m2-delta §6). | unit: `test_pending_shape_never_renders_zeros` |
| AC-6 | WHEN `GET /api/dashboard/widgets?scope=…` is called, THE SYSTEM SHALL return widget state including `last_result` + `fetched_at` + `status` at p95 ≤ 200 ms; the client SHALL paint the stored payload immediately and revalidate in the background (ADR-013 SWR). | integration: `test_widget_read_returns_swr_payload` |
| AC-7 | WHEN a background refresh fails, THE SYSTEM SHALL retain `last_result`, set `status='stale'`, and render the stale badge + timestamp; a payload older than 2× `refresh_interval_s` SHALL render the stale badge even without a failed refresh (ADR-013). | integration: `test_refresh_failure_sets_stale_retains_payload` |
| AC-8 | WHEN a user first loads the dashboard, THE SYSTEM SHALL create role-appropriate CE-sourced starter widgets (`scope='user'`, `suggested=true`) labelled "Suggested", each individually removable; WHEN the user pins or removes any widget, THE SYSTEM SHALL clear the Suggested state (E1-S6, FR-012); IF the starter's source contract errors on first load, THEN the tile shows the unavailable state with retry. | integration: `test_starters_role_appropriate_and_clearable` |
| AC-9 | WHEN any widget query runs in tenant A's context, THE SYSTEM SHALL return zero rows from tenant B's widget state — verified **with the app-layer tenant predicate disabled**, proving the DB RLS policy alone holds (extends the M1 cross-tenant-read test to all three tables). | integration: `test_widget_state_cross_tenant_isolation` |

## Implementation

### Pseudocode

```text
# Migration (packages/backend/migrations/xxxx_widget_state.py)
create widget_instances / widget_library_items / widget_refinements per m2-delta §4
for each: ALTER TABLE ... ENABLE ROW LEVEL SECURITY
          CREATE POLICY tenant_isolation USING (tenant_id = current_setting('app.tenant_id')::uuid)
          GRANT to weave_app (ADR-003 pattern — copy an M1 table's policy verbatim)

# Fixed default tile catalogue (packages/backend/dashboard/default_tiles.py)
DEFAULT_TILES = [  # hand-composed, CE-METRICS-1-sourced (FR-000); WidgetSpec shapes per m2-delta §3
  kpi_card("Entities in model", binding=sum(entity_count_by_kind)),
  bar_chart("Entities by kind", binding=entity_count_by_kind),
  kpi_card("Latest published version", binding=latest_version),
  kpi_card("Draft vs published changes", binding=draft_published_delta),
  bar_chart("SHACL errors by severity", binding=shacl_errors_by_severity),  # pending-aware
  kpi_card("OWL inconsistencies", binding=owl_inconsistencies),
]
STARTERS_BY_ROLE = {  # E1-S6; specs drawn from the same catalogue
  "publish": ["SHACL errors by severity", "Entities by kind"],       # enterprise architect
  "author":  ["Draft vs published changes", "Entities by kind"],     # analyst/SME
  "read":    ["Entities in model", "Latest published version"],      # viewer
}  # role = highest authority_level from M1 role_bindings

# Provisioning
on tenant_provision(t):                      # hook into the operator-console tenant-create service (FR-045)
  insert DEFAULT_TILES as widget_instances(scope='tenant_default', owner NULL, position=i)
backfill migration: for t in tenants without tenant_default rows: same insert
on first dashboard load per user (no user-scope rows exist):
  insert STARTERS_BY_ROLE[user_role] as widget_instances(scope='user', suggested=true)

# SWR read + refresh (packages/backend/dashboard/widgets.py)
GET /api/dashboard/widgets?scope=:
  rows = select widget_instances where scope matches (+ owner = caller when scope='user')
  return rows with spec, last_result, fetched_at, status   # no upstream call — ≤200ms
POST /api/dashboard/widgets/{id}/refresh:
  result = ce_metrics_client.fetch(widget.spec.bindings)   # 60s CE-side cache
  if ok: update last_result, fetched_at=now(), status=derive(result)  # 'pending' if any {pending:true} field
  else:  status='stale' (keep last_result); if last_result is NULL: status='unavailable'
derive_status also applied client-side per field for pending chips

# CE-METRICS-1 client (packages/backend/dashboard/ce_metrics.py)
def fetch(bindings): GET {CE_BASE}/api/metrics/ontology (JWT service call)
  validate response shape per contracts.md; pass {pending:true} sub-fields through untouched
```

### API Contracts

**Endpoint:** `GET /api/dashboard/widgets?scope=tenant_default|user`

**Response (200):**

```json
{
  "widgets": [
    {
      "id": "<uuid>",
      "scope": "tenant_default",
      "spec": { "component_type": "bar_chart", "title": "SHACL errors by severity",
                "data_source_contracts": ["CE-METRICS-1"],
                "bindings": { "field": "shacl_errors_by_severity" }, "column_span": 1 },
      "position": 4,
      "last_result": { "violation": 3, "warning": 12 },
      "fetched_at": "2026-07-08T12:00:00Z",
      "status": "fresh",
      "suggested": false
    }
  ]
}
```

**Endpoint:** `POST /api/dashboard/widgets/{id}/refresh` → 200 `{ "status": "fresh|stale|pending|unavailable|source_not_ga", "fetched_at": "…" }` (full §6 matrix union — canonical underscore tokens)
**Endpoint:** `DELETE /api/dashboard/widgets/{id}` (starter removal; user-scope + owner only) → 204
Errors: 401 no JWT · 403 wrong owner/tenant · 404 unknown id. p95 targets per m2-delta §5.

### Diagram References

| Diagram | Notes |
|---------|-------|
| M2 component delta | [`tech-spec/m2-delta.md`](../../tech-spec/m2-delta.md) §1 — Widget Service + SWR path placement |
| Widget-state ERD | [`tech-spec/m2-delta.md`](../../tech-spec/m2-delta.md) §4 — three tables + relationships |
| M1 container context | [`tech-spec/architecture.md`](../../tech-spec/architecture.md) — Aurora RLS + API placement |

### Design Decisions

| Decision | Source | Impact on This Task |
|----------|--------|---------------------|
| Widget state in Aurora under M1 RLS; last_result JSONB is the render cache | ADR-014 | New tables copy the M1 RLS policy pattern; no DynamoDB/Redis anywhere in this task |
| SWR over persisted last-result; 2× staleness bound (10 min default, tunable) | ADR-013 | Read path never calls CE inline; refresh is the only upstream call; stale never blanks |
| `{pending:true}` is per-field and never renders zeros | contracts.md CE-METRICS-1 note; m2-delta §6 | `derive_status` + a pending chip branch in the tile renderer |
| Provisioning = seed at tenant-provision + one-time backfill | HITL decision 2026-07-08 | No lazy first-load creation for tenant_default rows; starters (user-scope) ARE lazy first-load |
| Fixed default is read-only-composed at M2 | E1-S0 AC | No add/remove/reorder UI on tenant_default tiles; members customise via user-scope only |
| Tenant-scoped tables, DB-enforced RLS backstop | data-model.md §Workspace (workspace removed 2026-07-08); m2-delta §4 | No `workspace_id` anywhere; cross-tenant test runs with the app predicate disabled |

## Test Requirements

### Unit Tests (minimum 4)

- `test_pending_shape_never_renders_zeros` — feed `{"shacl_errors_by_severity": {"pending": true}}`; assert status/chip `pending`, rendered value is not `0`
- `test_derive_status_matrix` — parametrised over fresh/stale/pending/unavailable inputs per m2-delta §6
- `test_default_tile_catalogue_shape` — every DEFAULT_TILES spec validates against the WidgetSpec schema and cites `CE-METRICS-1`
- `test_starter_role_map` — publish/author/read roles each resolve to their starter list; unknown role falls back to `read` set
- `test_staleness_bound` — `fetched_at` older than 2× interval ⟹ stale even with no failed refresh

### Integration Tests (minimum 5)

- `test_widget_tables_rls_enforced` — insert as tenant A, select as tenant B via `weave_app` ⟹ zero rows (all three tables)
- `test_default_tiles_seeded_on_tenant_create` / `test_backfill_seeds_existing_tenants` — 6 tenant_default rows, positions 0–5
- `test_widget_read_returns_swr_payload` — seeded last_result returned without any CE call (CE client spied, zero calls)
- `test_refresh_failure_sets_stale_retains_payload` — CE client raises; payload unchanged, status stale; NULL last_result case ⟹ unavailable
- `test_metrics_error_renders_unavailable_state` — one binding errors ⟹ only that tile unavailable
- `test_starters_role_appropriate_and_clearable` — first load creates suggested rows; pin clears suggested flag
- `test_widget_state_cross_tenant_isolation` — AC-9

### E2E Tests (minimum 1)

- `test_fixed_dashboard_renders_ce_tiles` — Playwright: login, dashboard shows 6 tiles with CE-METRICS-1 footers and live values from the seeded CE fixture; one tile forced to error renders unavailable + retry while others render (asserts backend widget rows exist — Plugin Law B)

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|----|-----------|-----------|
| AC-1 | Integration | `test_widget_tables_rls_enforced` |
| AC-2 | Integration | `test_default_tiles_seeded_on_tenant_create`, `test_backfill_seeds_existing_tenants` |
| AC-3 | E2E | `test_fixed_dashboard_renders_ce_tiles` |
| AC-4 | Integration | `test_metrics_error_renders_unavailable_state` |
| AC-5 | Unit | `test_pending_shape_never_renders_zeros` |
| AC-6 | Integration | `test_widget_read_returns_swr_payload` |
| AC-7 | Integration + Unit | `test_refresh_failure_sets_stale_retains_payload`, `test_staleness_bound` |
| AC-8 | Integration + Unit | `test_starters_role_appropriate_and_clearable`, `test_starter_role_map` |
| AC-9 | Integration | `test_widget_state_cross_tenant_isolation` |

## Dependencies

- **blocked_by:** none within M2 (preconditions: M1 gate passed, CE GA with CE-METRICS-1)
- **unlocks:** TASK-011 (generate pipeline writes these tables), TASK-014 (pin/grid), TASK-016 (category bindings reuse the CE client + state matrix), TASK-017 (role-home tiles are `scope='role_home'` rows)

## Cost Estimate

- **Complexity:** L
- **Estimated tokens:** ~60K input, ~25K output
- **Estimated cost:** ~$4

## Definition of Ready Checklist

- [x] User story clear
- [x] All ACs have mapped tests
- [x] Pseudocode provided (incl. provisioning decision: seed + backfill, HITL 2026-07-08)
- [x] Table DDL fully specified (m2-delta §4); RLS pattern named (ADR-003)
- [x] CE-METRICS-1 shape + pending note confirmed canonical in contracts.md
- [x] Fixed tile set and starter role map enumerated (no engineer guessing)

## Definition of Done Checklist

- [ ] All ACs met; migrations reversible
- [ ] Cross-tenant test green across all three new tables
- [ ] Pending shape renders "counts pending" — grep confirms no zero-fallback branch
- [ ] Read path issues zero upstream CE calls (spy-verified)
- [ ] Every tile carries a data-source footer naming its contract
- [ ] Coverage ≥ 80% for dashboard module; mutation ≥ 60%
- [ ] Conventional commit: `feat: add widget-state foundation and fixed CE default dashboard`

## Implementation Hints

- Copy the RLS policy + `weave_app` grant block from the M1 `notifications` migration verbatim — do not hand-write a new policy variant (ADR-003).
- The CE-METRICS-1 client should be one thin module reused by TASK-016's category bindings — resist per-widget fetch functions; one `fetch(bindings)` keyed on response fields.
- `derive_status` is shared server/client logic — implement server-side, ship the per-field pending detection to the client as data (`pending_fields: [...]`), not duplicated logic.
- Starter creation must be idempotent (unique partial index on `(tenant_id, owner_principal_iri, scope)` first-load check) — two parallel first requests must not double-seed.
- Tile renderer: badges are text + colour, never colour-only; skeletons carry `aria-busy` (m2-delta §8; Lighthouse 100/axe 0 gate applies).

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*
