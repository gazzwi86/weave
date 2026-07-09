---
type: Task Brief
title: "Task: TASK-029 — Audit & compliance surfaces v2 (tiles/charts rebuild)"
description: "Rebuild the audit dashboard (/audit) and compliance page (currently /compliance) as
  tiles/charts per the generative-ui catalogue, replace the '▲ 1' text trend with a real chart,
  give the logs table relative-time/friendly-actor/tabular-nums treatment, add the full
  PLAT-AUDIT-1 7-dimension filter bar, and resolve the compliance-route conflict between the
  binding /audit/compliance ruling and the existing /compliance route via an additive redirect."
tags: [weave-platform, arch, task, v1, design-system, audit, compliance]
timestamp: 2026-07-09T00:00:00Z
status: Backlog
priority: Should Have
entity: weave-platform
epic: EPIC-009
milestone: v1
created: 2026-07-09
blocked_by: [TASK-026]
unlocks: []
adr_refs: []
---

# Task: TASK-029 — Audit & compliance surfaces v2 (tiles/charts rebuild)

**Spec:** [weave-platform.md](../../../weave-platform.md) ·
**Contracts:** [contracts.md](../../../../contracts.md) ·
**Design inputs:** [v1-design-requirements.md](../../../../../../design/v1-design-requirements.md),
[design-assessment-2026-07-09.md](../../../../../../design/design-assessment-2026-07-09.md)

> **Scope traceability:** bundle R8 (`v1-design-requirements.md` R8, findings F-D21/22/23). M1's
> `PLAT-TASK-009` built the `PLAT-AUDIT-1` backend (hash-chained log, `GET /api/audit`,
> `GET /api/audit/compliance`, `POST /api/audit/verify`) and a working-but-plain frontend at
> `packages/frontend/app/audit/page.tsx`, `app/audit/logs/page.tsx`, and `app/compliance/page.tsx`
> (the last extended again in commit `db5cd1f`, "compliance month-over-month trends + SHACL
> conformance hub"). Reading that code confirms every F-D21/22/23 finding still holds: both
> dashboards are a `Card` with plain `<ul>` text lists (F-D21 — no `KpiCard`/`BarChart`, and the
> month-over-month trend literally renders as a `▲`/`▼` glyph plus a number, `CategoryDelta` in
> `app/compliance/page.tsx`); the logs table shows a raw `principal_iri` and a raw ISO timestamp per
> row with exactly one filter input (event type only) (F-D22); and the compliance page lives at
> `/compliance`, not `/audit/compliance` as the binding ruling requires (F-D23). **A genuine conflict
> was found while grounding this brief**: `components/shell/nav-items.ts` documents a deliberate
> decision that "existing green routes keep their URLs ... rather than moving them, so the
> per-feature Playwright suites stay untouched" and lists `/compliance` by name as one of them —
> directly contradicting `visual-direction.md`'s binding ruling ("Compliance placement: stays under
> Audit trail; route fixed to `/audit/compliance` (F-D23)"). This task resolves it additively (see
> AC-6) rather than picking a side silently. No M1 or existing v1 task owns "rebuild these two pages
> as tiles/charts" — TASK-009 shipped the backend and a functional-but-plain first cut; this task is
> the presentation-layer follow-up the assessment found still outstanding.

## Story

**Epic:** EPIC-009 Audit & Compliance Surfaces v2 (successor of M1 Immutable Audit)
**Priority:** Should Have

**As a** compliance officer or workspace admin reviewing the audit trail
**I want** the dashboard and compliance page to show me trends and totals at a glance (tiles and
charts, not a wall of list items), and the logs table to show me readable times and actors with a
real filter bar
**So that** I can spot an anomaly or answer an auditor's question in seconds instead of manually
scanning raw IRIs and a text list.

## Acceptance Criteria

| ID | EARS Criterion | Test Mapping |
|----|----------------|--------------|
| AC-1 | WHEN the audit dashboard (`/audit`) or compliance page renders, THE SYSTEM SHALL present the chain-status, entries-checked, and SHACL-validated/rejected figures as `KpiCard` tiles (generative-ui catalogue) rather than plain `<p>` text rows — closing the tile portion of F-D21. | unit: `test_audit_dashboard_renders_kpi_tiles_not_text_rows` |
| AC-2 | WHEN the compliance page renders its by-event-category month-over-month comparison, THE SYSTEM SHALL render it as a `BarChart` (current period vs previous period, per category) instead of the `▲ 1`/`▼ 1` text-glyph `CategoryDelta` treatment — closing F-D21's trend-specific finding. | unit: `test_compliance_trend_renders_as_bar_chart_not_text_glyph` |
| AC-3 | WHEN a user clicks an event-category tile or bar-chart segment on either dashboard, THE SYSTEM SHALL navigate to `/audit/logs` pre-filtered to that `event_type` — a regression-lock and extension of the existing category-to-logs link in today's `app/audit/page.tsx`. | E2E: `test_dashboard_tile_click_drills_into_prefiltered_logs` |
| AC-4 | WHEN the logs table (`/audit/logs`) renders a row, THE SYSTEM SHALL show a relative-time value for `ts` (raw ISO-8601 available on hover/expand) and a friendly actor label via `EntityRef` for `actor_principal_iri` (raw URN available on expand) — replacing today's raw-ISO and raw-URN columns; numeric/ID columns SHALL use `--font-mono`/tabular-nums. | unit: `test_logs_table_shows_relative_time_and_entity_ref_not_raw` |
| AC-5 | WHEN a user opens the logs filter bar, THE SYSTEM SHALL expose all seven `PLAT-AUDIT-1` query dimensions — `engine`, `event_type`, `actor_principal_iri`, `target_iri`, `date_from`, `date_to`, `q` (substring) — each independently settable and combinable in one `GET /api/audit` call, replacing today's single event-type-only input. | integration: `test_logs_filter_bar_exposes_all_seven_query_dimensions` |
| AC-6 | WHEN a user or bookmark navigates to `/compliance` (the legacy path), THE SYSTEM SHALL redirect (HTTP 307) to `/audit/compliance` (the canonical path per the binding ruling), which SHALL render the same compliance content; WHEN the nav rail highlights the active section for `/audit/compliance`, THE SYSTEM SHALL highlight "Audit" (not a separate top-level entry) — resolving the ruling/nav-items.ts conflict additively, without breaking any existing `/compliance`-addressed Playwright suite. | E2E: `test_legacy_compliance_route_redirects_and_nav_highlights_audit` |

## Implementation

### Pseudocode

```text
# packages/frontend/next.config.ts — additive redirect (AC-6), resolves the route conflict
redirects: [
  { source: "/compliance", destination: "/audit/compliance", permanent: false },
]
# app/audit/compliance/page.tsx becomes the canonical page (moved from app/compliance/page.tsx);
# nav-items.ts's PRIMARY_NAV entry for Audit gains a group item pointing at /audit/compliance;
# the legacy app/compliance/** directory is removed once the redirect is verified in E2E.

# components/organisms/AuditDashboard/kpi-tiles.ts — pure presentation, data via useCompliance()
function renderComplianceTiles(summary):
  return [
    KpiCard(label="Chain status", value=summary.chain_status, variant=summary.chain_status=="valid" ? "success" : "danger"),
    KpiCard(label="Entries checked", value=summary.entries_checked),
    KpiCard(label="SHACL validated", value=summary.shacl_validated),
    KpiCard(label="SHACL rejections", value=summary.shacl_rejections, variant=summary.shacl_rejections > 0 ? "warn" : "default"),
  ]  # AC-1 — same useCompliance() hook (TASK-009), no backend change

function renderCategoryTrendChart(summary, previous):
  if not previous: return null  # first period on record, no prior to compare -- omit chart, not a fake zero bar
  categories = Object.keys(summary.by_event_category)
  return BarChart(
    series=[
      { label: previous.period, values: categories.map(c => previous.by_event_category[c] ?? 0) },
      { label: summary.period, values: categories.map(c => summary.by_event_category[c] ?? 0) },
    ],
    categories=categories,
  )  # AC-2 -- replaces CategoryDelta's text glyph entirely

# app/audit/logs/use-audit-log.ts — extend query params (AC-5), same GET /api/audit endpoint
function buildAuditQuery(filters):
  # filters: { engine?, event_type?, actor_principal_iri?, target_iri?, date_from?, date_to?, q? }
  return new URLSearchParams(compact(filters))  # only set params are sent; server already accepts all 7
```

### API Contracts

No new endpoints. This task binds the existing `PLAT-AUDIT-1` contracts more fully into the UI:

- `GET /api/audit?tenant_id={tid}&engine=&event_type=&actor_principal_iri=&target_iri=&date_from=
  &date_to=&q=&page=&per_page=` (`PLAT-AUDIT-1`, `contracts.md` "Query filters") — the logs table's
  data source; today's `use-audit-log.ts` only sends `event_type`, AC-5 wires the remaining six
  params already accepted server-side.
- `GET /api/audit/compliance?period=YYYY-MM` (extended in commit `db5cd1f`) — unchanged response
  shape; this task only changes how `summary`/`previous` are rendered (tiles/chart vs text).
- `POST /api/audit/verify` — unchanged, existing "Verify" action stays wired as-is.

No new error shapes. A period with no `previous` (first month on record) is a defined, existing
case in `use-compliance.ts` (`previous: null`) — the chart component must render its "insufficient
history" empty state rather than crash (per TASK-026's `EmptyState` story).

### Diagram References

| Diagram | File | Relevant Section | Summary |
|---------|------|-------------------|---------|
| Sequence | N/A | N/A | No new sequence — same `GET /api/audit`/`GET /api/audit/compliance` calls, presentation-layer only. |
| State | N/A | N/A | No new state — chain-status/SHACL-count states are unchanged from TASK-009's existing model. |
| Data Model | N/A | N/A | No data model change — `ComplianceSummary`/`AuditEntry` shapes are unchanged from TASK-009. |

### Design Decisions

| Decision | Reference | Impact on This Task |
|----------|-----------|----------------------|
| Compliance route conflict resolved additively (redirect, not a breaking move) | Discovery made grounding this brief: `visual-direction.md` "Compliance placement" ruling vs `components/shell/nav-items.ts` "existing green routes keep their URLs" comment | AC-6; `/compliance` keeps resolving (via redirect) so existing Playwright suites addressing it are not broken, while `/audit/compliance` becomes the canonical, nav-highlighted path per the ruling |
| Tiles/charts from the generative-ui catalogue, not bespoke components | [v1-design-requirements.md](../../../../../../design/v1-design-requirements.md) R8 | AC-1/AC-2; `KpiCard`/`BarChart` are catalogue components (owned by `generative-ui.md`, referenced not duplicated by `components.md`) — this task consumes them, it does not define new chart primitives |
| Logs table density/row-height is a TASK-026 advisory, not pinned here | [TASK-026](TASK-026.md) Design requirements, "Advisory" note on `DataTable` density | AC-4; this task is the flagged design-review point TASK-026 deferred — pick the denser variant if the 7-dimension filter bar makes the default row height feel sparse, no separate ADR needed for that call |
| Glass elevation reserved for modal/popover/command-palette/canvas-overlay only | [components.md](../../../../../../standards/design/components.md) "Glass vs flat" | The new KPI tiles and bar chart stay flat (`--color-surface` family); this is a table/dashboard surface, not canvas, per `visual-direction.md`'s "where canvas-first does NOT apply" |

### Design requirements

- `KpiCard`/`BarChart` from the generative-ui catalogue, replacing plain `<p>`/`<ul>` text rows —
  cites F-D21 directly.
- Relative-time component (raw ISO on hover/expand) and `EntityRef` (friendly label + `--font-mono`
  secondary ID) for every timestamp/principal in the logs table — cites F-D22 and F-D08 (the
  repo-wide "never a bare IRI/ISO string" rule already applied in TASK-026/027).
- `--font-mono` / tabular-nums for numeric and ID columns (entry counts, sequence numbers) — cites
  F-D22's "tabular-nums" requirement directly.
- 7-dimension filter bar matching `PLAT-AUDIT-1`'s query-filter contract exactly (no invented eighth
  filter, no fewer than the six named params plus `q`) — cites `contracts.md` PLAT-AUDIT-1 and
  F-D22's "single-filter" finding.
- `/audit/compliance` canonical route, nav highlight stays under Audit — cites F-D23 and the
  `visual-direction.md` binding ruling.
- Advisory: whether the bar chart should show more than two periods (a real trend line across N
  months) is not pinned by any F-D/R citation — this task ships the two-period (current vs
  previous) comparison the backend already supports; flag a follow-up if product wants a longer
  trend window (would need a backend `GET /api/audit/compliance?periods=N` change, out of scope
  here).

## Test Requirements

### Unit Tests (minimum 4)

- `should render chain-status/entries-checked/SHACL figures as KpiCard tiles, not <p> text rows`
- `should render the category month-over-month comparison as a BarChart, not the ▲/▼ text glyph`
- `should render relative time with raw ISO available on hover, and EntityRef with raw URN available on expand, for every logs-table row`
- `should render an EmptyState (not a crash) when no previous period exists for the trend chart`

### Integration Tests (minimum 2)

- `should send all seven filter params to GET /api/audit when all seven filter-bar fields are set`
- `should redirect /compliance to /audit/compliance and render identical summary content at the canonical path`

### E2E Tests (minimum 2)

- `should click a category tile on the audit dashboard and land on /audit/logs pre-filtered to that event_type`
- `should navigate to /compliance, land on /audit/compliance, and see "Audit" highlighted in the nav rail`

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|----|-----------|-----------|
| AC-1 | Unit | `test_audit_dashboard_renders_kpi_tiles_not_text_rows` |
| AC-2 | Unit | `test_compliance_trend_renders_as_bar_chart_not_text_glyph` |
| AC-3 | E2E | `test_dashboard_tile_click_drills_into_prefiltered_logs` |
| AC-4 | Unit | `test_logs_table_shows_relative_time_and_entity_ref_not_raw` |
| AC-5 | Integration | `test_logs_filter_bar_exposes_all_seven_query_dimensions` |
| AC-6 | E2E | `test_legacy_compliance_route_redirects_and_nav_highlights_audit` |

## Dependencies

- **blocked_by:** [TASK-026] — `KpiCard`, `BarChart`, `EntityRef`, relative-time, and `DataTable`
  all come from the TASK-026 design system; this task binds live audit/compliance data into them.
- **unlocks:** [] — no other v1 task depends on this rebuild.

## Cost Estimate

- **Complexity:** M
- **Estimated tokens:** ~34K input, ~15K output
- **Estimated cost:** ~$2.10
- **Note:** presentation-layer only — `PLAT-AUDIT-1` backend and both React Query hooks
  (`use-compliance.ts`, `use-audit-log.ts`) already exist and are unchanged by this task.

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided (redirect, tile/chart rendering, filter-query builder)
- [x] API contracts defined (existing endpoints, extended param usage — no new surface)
- [x] Diagram references included (N/A rows, reasoned)
- [x] Design decisions noted (including the route-conflict resolution)
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined (blocked_by and unlocks)
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing
- [ ] Coverage >= 80% for changed code
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic <= 10, cognitive <= 15, fn <= 50 lines)
- [ ] JSDoc / prop docs on public APIs
- [ ] Conventional commit(s) created
- [ ] No implementation beyond the task brief's AC and pseudocode (YAGNI)
- [ ] PR references this task and parent epic

## Implementation Hints

- Reuse `use-compliance.ts` and `use-audit-log.ts` exactly as they are — this task changes what
  renders, not how data is fetched.
- Move `app/compliance/page.tsx` to `app/audit/compliance/page.tsx` (AC-6) rather than duplicating
  it; delete the old directory only after confirming the redirect test passes, so no window exists
  where both paths 404 or diverge.
- `# ponytail: two-period bar chart, not an N-period trend line — the backend only returns
  current+previous today; extend to periods=N only if product asks for a longer trend view.`
- Grep the existing `top-actors-list` `data-testid` usages in both pages' tests before refactoring —
  keep the same `data-testid`s where the content is equivalent so existing test selectors don't all
  need rewriting for a presentation-only change.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*
