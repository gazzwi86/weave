---
type: Task Brief
title: "Task: TASK-023 — Connector-health dashboard widget rows (E2-S8, v1 activation)"
description: "Activate the E2-S8 widget category: per-connector status rows sourced from
  GET /api/connectors, honest-state fallbacks ('Connectors not yet available' / 'health
  unknown' + last poll time), degraded/disconnected rows deep-link to Settings → Connectors.
  Automation rows remain Events-gated (post-v1)."
tags: [weave-platform, arch, task, v1, connectors, dashboard, widgets]
timestamp: 2026-07-08T00:00:00Z
status: Backlog
priority: Must
entity: weave-platform
epic: EPIC-002
milestone: v1.0
created: 2026-07-08
blocked_by: [TASK-006, TASK-016]
unlocks: []
adr_refs: []
---

# Task: TASK-023 — Connector-health dashboard widget rows (E2-S8, v1 activation)

**Spec:** [weave-platform.md](../../../weave-platform.md) §EPIC-002 E2-S8 / FR-032 ·
**Contracts:** [contracts.md](../../../../contracts.md) `PLAT-CONNECTOR-1`, `PLAT-NOTIFY-1` ·
**Tech spec:** [v1-delta.md](../../tech-spec/v1-delta.md) §5, §6 ·
[m2-delta.md](../../tech-spec/m2-delta.md) §2 (component library), §6 (honest-state matrix)

## Story

**Epic:** EPIC-002 Widget Library — E2-S8 connector-health rows (v1 slice; automation rows
stay Events-gated post-v1)
**Priority:** Must

**As a** workspace admin
**I want** connector health visible on my dashboard
**So that** a degraded data source is seen where I already look, not discovered when a sync
silently stops feeding the graph.

## Acceptance Criteria

| ID | EARS Criterion | Test Mapping |
|----|----------------|--------------|
| AC-1 | WHERE `PLAT-CONNECTOR-1` is live, THE SYSTEM SHALL render one row per configured connector showing type, status (`healthy`/`degraded`/`offline`), `last_sync`, and `error_count`, sourced from `GET /api/connectors` (never a bespoke endpoint). | integration: `test_connector_widget_renders_rows_from_list_api` |
| AC-2 | WHERE no connector is configured for the tenant, THE SYSTEM SHALL render the honest empty state "No connectors configured" with a link to Settings → Connectors — never fabricated rows, never a blank panel. | unit: `test_connector_widget_empty_state` |
| AC-3 | IF `GET /api/connectors` is unreachable or errors, THEN THE SYSTEM SHALL render "Connector health unknown" with the last successful poll time (SWR last-result, ADR-013 machinery) — never a false "healthy" (E7-S2 failure AC). | integration: `test_connector_widget_unreachable_shows_unknown_last_poll` |
| AC-4 | WHEN a row's status is `degraded` or `offline`, THE SYSTEM SHALL style it with the design-system status tokens and deep-link the row to Settings → Connectors for that connector. | e2e: `connector-widget.spec.ts` |
| AC-5 | WHERE Events is not GA, THE SYSTEM SHALL render the automation sub-rows as "Events Engine not yet available" via the engine-availability registry (m2-delta §2) — the v1 widget SHALL NOT invent automation counts. | unit: `test_automation_rows_events_gated` |
| AC-6 | WHEN the widget refreshes (dashboard auto-refresh cadence, M2 machinery), THE SYSTEM SHALL re-read `GET /api/connectors` within the same SWR pattern as other widgets — no bespoke polling loop. | unit: `test_connector_widget_uses_swr_hook` |

## Pseudocode

```text
# packages/frontend components/widgets/ConnectorHealthWidget.tsx
# One new component in the M2 declarative component library (m2-delta §2) + one category binding.

ConnectorHealthWidget:
    { data, error, lastSuccessAt } = useWidgetSWR("/api/connectors")   # M2 hook, ADR-013
    error and no cached data:        render UnknownState(lastSuccessAt)          # AC-3
    data.connectors is empty:        render EmptyState(link=/settings/connectors) # AC-2
    rows = data.connectors.filter(configured)
    render table rows: [StatusBadge(status), type, relative(last_sync), error_count]
        status != healthy: row styled via design tokens (status.warning/error),
                           href=/settings/connectors#{type}                       # AC-4
    eventsAvailable = availabilityRegistry("events")                              # m2-delta §2
    not eventsAvailable: render NotYetAvailable("Events Engine")                  # AC-5

# packages/backend: category binding registration only (m2-delta §2 CategoryBindings) —
# category "connector-health" -> source GET /api/connectors. No new backend endpoint.
```

## API Contracts

- `GET /api/connectors` (TASK-006, v1-delta §5) —
  `{connectors:[{type, configured, status, last_sync?, error_count?}]}`, p95 150 ms. The ONLY
  data source for this widget. (`last_sync`/`error_count` are in the per-type health row —
  if TASK-006's list shape omits them, extend the LIST response additively there, do not add
  a widget-specific endpoint.)
- No new endpoints. Widget state/pinning/refresh ride M2 `widget_instances` machinery
  (ADR-014) unchanged.

## Diagram References

| Diagram | Path | Summary |
|---|---|---|
| Component delta | `../../tech-spec/v1-delta.md` §1 | E2-S8 widget → Connector Service edge |
| M2 widget pipeline | `../../tech-spec/m2-delta.md` §1 | Component library + SWR + availability registry this slots into |

## Design Decisions

- ADR-013 (m2, SWR last-result) — AC-3's "unknown + last poll time" is exactly the SWR
  stale-state; reuse it, no new cache.
- ADR-014 (m2, Aurora widget state) — pin/publish/refresh unchanged; this is one more
  component + category binding, not a new widget substrate.
- m2-delta §6 honest-state matrix — every state this widget can show maps to a matrix row
  (live / empty / unavailable / engine-gated); no new states invented.

## Test Requirements

Minimum: 3 unit, 2 integration, 1 E2E.

| AC | Type | Test |
|----|------|------|
| AC-1 | Integration | `test_connector_widget_renders_rows_from_list_api` |
| AC-2 | Unit | `test_connector_widget_empty_state` |
| AC-3 | Integration | `test_connector_widget_unreachable_shows_unknown_last_poll` |
| AC-4 | E2E | `connector-widget.spec.ts` (Playwright: pin widget, degrade fixture connector, assert badge + deep-link lands on Settings → Connectors) |
| AC-5 | Unit | `test_automation_rows_events_gated` |
| AC-6 | Unit | `test_connector_widget_uses_swr_hook` |

Frontend: Vitest + Playwright (testing-strategy.md). E2E runs against the compose stack with
the shared fixture server (TASK-019) driving one healthy + one degraded connector. Law B: the
E2E asserts the degraded state originated from backend health rows (fixture-driven), not a
mocked frontend. Coverage ≥ 80 %, mutation ≥ 60 % (component + binding).

## Implementation Hints

- This is a thin task by design: one component, one category binding, zero new endpoints —
  if it grows a backend surface, stop and re-read AC-1/the API section.
- Status colours/spacing/typography come from `docs/standards/design/` tokens
  (`status.success/warning/error`) — no ad-hoc hex/px (ui_verify gate will catch it).
- Accessibility: status must not be colour-only — badge carries the status word (a11y ≥ 95
  page gate, v1-delta §6); rows are links, keyboard-focusable.
- The availability-registry check (AC-5) is the same call every M2 engine-gated widget makes —
  copy an existing gated widget (e.g. the E2-S7 Build rows) rather than writing a new gate.
- Relative time ("2 h ago") for `last_sync` with the absolute timestamp in a tooltip —
  matches existing dashboard widgets.

## Cost Estimate

- **Complexity:** S
- **Estimated tokens:** ~25K input, ~12K output
- **Estimated cost:** ~$1.40

## Definition of Ready Checklist

- [x] ACs mapped to named tests; empty/unreachable/engine-gated states explicit
- [x] Single data source pinned (`GET /api/connectors`); no-new-endpoint rule stated
- [x] Design tokens + a11y requirements named (ui_verify)
- [x] Honest-state mapping to m2-delta §6 confirmed
- [ ] TASK-006 complete (list API live) and v1 TASK-016 complete (category-binding machinery)

## Definition of Done Checklist

- [ ] All ACs green; coverage ≥ 80 %, mutation ≥ 60 %
- [ ] ui_verify gate passes (design tokens, no ad-hoc values)
- [ ] Lighthouse on the dashboard with widget pinned: performance ≥ 90, accessibility ≥ 95
- [ ] No bespoke polling/caching code (SWR hook reuse verified in review)
- [ ] Conventional commit: `feat: add connector-health dashboard widget rows`

## Dependencies

- **blocked_by:** TASK-006 (list/health API), TASK-016 (m2 — category bindings + component
  library). Runs in parallel with 018–022 (needs only config/health, not ingestion).
- **unlocks:** — (v1 gate consumes it; E2-S8 automation sub-rows stay Events-gated post-v1)

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
