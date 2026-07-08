---
type: Task Brief
title: "Task: TASK-014 — Pin widgets, responsive grid, drag-reorder, auto-refresh (E1-S4)"
description: "Server-side (tenant,user) pinning with audit, the 1-4 column responsive dashboard
  grid with persisted drag-reorder, the 5-min auto-refresh client loop over the TASK-010 SWR
  path, and the stale-badge rendering on refresh failure."
tags: [weave-platform, arch, task]
timestamp: 2026-07-08T12:00:00Z
status: Backlog
priority: Must Have
entity: weave-platform
epic: EPIC-001
milestone: M2
created: 2026-07-08
blocked_by: [TASK-010, TASK-011]
unlocks: [TASK-015]
adr_refs: [ADR-013, ADR-014]
---

# Task: TASK-014 — Pin widgets, responsive grid, drag-reorder, auto-refresh (E1-S4)

**Spec:** [weave-platform.md](../../../weave-platform.md) · **Delta:** [m2-delta.md](../../tech-spec/m2-delta.md) · **Contracts:** [contracts.md](../../../../contracts.md)

## Story

**Epic:** EPIC-001 Dashboard
**Priority:** Must Have

**As a** workspace member
**I want** to pin a generated widget so it lives on my dashboard on every device, arrange my
grid by dragging, and trust that data quietly stays current — with an honest badge when it can't
**So that** my dashboard is mine, portable, and never lies about freshness.

## Acceptance Criteria

| ID | EARS Criterion | Test Mapping |
|----|----------------|--------------|
| AC-1 | WHEN a user pins a widget, THE SYSTEM SHALL persist its full definition (resolved spec: intent/parameters, component type, data-source bindings, title, column span) **server-side, scoped (tenant, user)** — never localStorage — so it renders cross-device with live data (FR-008). | integration + e2e: `test_pin_persists_server_side`, `test_pin_cross_device` |
| AC-2 | WHEN a pin or unpin occurs, THE SYSTEM SHALL write a `PLAT-AUDIT-1` entry (`dashboard.widget.pinned` / `.unpinned`, actor, target widget id) in the same transaction as the row change (FR-008 "audit-visible"). | integration: `test_pin_audited_in_txn` |
| AC-3 | WHILE a pinned widget is displayed, THE SYSTEM SHALL auto-refresh it every `refresh_interval_s` (default 300, tunable via `PLAT-SETTINGS-1`) and on demand via a refresh control (FR-009), using TASK-010's refresh endpoint — no widget refreshes while its tab/panel is hidden (visibility-gated). | unit(TS) + integration: `test_autorefresh_timer_visibility_gated` |
| AC-4 | IF a refresh or provider error occurs, THEN THE SYSTEM SHALL retain the last successful render with the stale-data badge + timestamp and SHALL NOT blank the widget (E1-S4 failure AC; states per m2-delta §6 — rendering only, logic ships in TASK-010). | e2e: `test_refresh_failure_shows_stale_badge` |
| AC-5 | WHEN the dashboard grid renders, THE SYSTEM SHALL lay widgets out responsively across 1–4 columns (default breakpoints, tunable) honouring each widget's `column_span`, and SHALL support drag-reorder with the new order persisted to `position` (FR-010). | unit(TS) + e2e: `test_grid_responsive_columns`, `test_drag_reorder_persists` |
| AC-6 | WHEN widgets render in the grid, tenant-default tiles, suggested starters, and user pins SHALL compose in one grid (defaults first, then pins by position); suggested starters carry the "Suggested" label (TASK-010) and pinning any widget clears Suggested state. | integration: `test_grid_composition_order` |
| AC-7 | WHEN pin, reorder, refine, or publish controls render, they SHALL be keyboard-achievable (PRD §2.2 accessibility; grid drag has keyboard alternative: move-up/move-down actions). | e2e (axe + keyboard): `test_grid_keyboard_operable` |

## Implementation

### Pseudocode

```text
# Pin (packages/backend/dashboard/widgets.py — extends TASK-010 module)
POST /api/dashboard/widgets  { spec, column_span?, position? }
  validate spec against WidgetSpec schema (same validator as SSE path)
  txn:
    row = insert widget_instances(scope='user', owner=jwt.principal_iri, spec,
                                  position=given or max+1, status='fresh',
                                  last_result=client_held_result or NULL)
    audit.emit(actor, "dashboard.widget.pinned", target=row.id)     # same txn (AC-2)
    clear suggested flags for this owner (first pin clears Suggested state)
  return 201 row
DELETE /api/dashboard/widgets/{id} -> unpin: delete + audit "unpinned" same txn (owner only)
PATCH /api/dashboard/widgets/{id}  { position | column_span } -> reorder/resize (owner only)
  # reorder = batch: PATCH /api/dashboard/widgets/order { ids_in_order } — one txn, one audit entry

# Grid (packages/frontend/src/dashboard/Grid.tsx)
CSS grid; columns by container breakpoints (1/2/3/4); widget spans column_span (clamped to cols)
drag via native HTML drag-and-drop (draggable + onDrop) — no dnd library
  # ponytail: native DnD is enough for reorder-only; add dnd-kit only if cross-grid drag ever specced
keyboard alternative: focusable widget header exposes Move up / Move down buttons -> same order PATCH

# Auto-refresh (packages/frontend/src/dashboard/useAutoRefresh.ts)
per-widget timer = refresh_interval_s from row (server-resolved via PLAT-SETTINGS-1)
document.visibilityState === 'hidden' -> pause; visible -> resume + immediate refresh if overdue
on refresh response: update status/badge from returned state (fresh|stale|pending|unavailable)
```

### API Contracts

**Endpoint:** `POST /api/dashboard/widgets` → `201` widget row (shape per TASK-010 GET) ·
`400` invalid spec · `403`/`401`. p95 ≤ 300 ms.
**Endpoint:** `PATCH /api/dashboard/widgets/order` — `{ "ids_in_order": ["<uuid>", …] }` →
`200 { "updated": n }`. p95 ≤ 300 ms.
**Endpoint:** `DELETE /api/dashboard/widgets/{id}` → `204`. p95 ≤ 300 ms.
(Refresh endpoint ships in TASK-010; this task only wires the client loop.)

### Diagram References

| Diagram | Notes |
|---------|-------|
| SWR + state matrix | [`tech-spec/m2-delta.md`](../../tech-spec/m2-delta.md) §6 — badge rendering rules this task implements client-side |
| Widget-state ERD | [`tech-spec/m2-delta.md`](../../tech-spec/m2-delta.md) §4 — `position`, `column_span`, `suggested` columns |
| Component delta | [`tech-spec/m2-delta.md`](../../tech-spec/m2-delta.md) §1 — Grid + Widget Service |

### Design Decisions

| Decision | Source | Impact on This Task |
|----------|--------|---------------------|
| Pins are server-side (tenant,user) rows — never localStorage | FR-008; ADR-014 | Cross-device comes free from the DB; the invariant grep (m2-delta §10) enforces no localStorage widget state |
| Audit in the same transaction as the state change | FR-008; M1 audit pattern | Pin visible in Compliance audit view immediately; no eventual-consistency gap |
| Auto-refresh is client-driven against the refresh endpoint | ADR-013 | No server-side scheduler at M2 — a hidden dashboard costs nothing; visibility-gating stops background hammering |
| Reorder is one batch PATCH, one audit entry | FR-010; audit noise discipline | Dragging across 6 positions ≠ 6 audit entries |
| Native HTML drag-and-drop, keyboard move buttons | Plugin Law A (no new deps); PRD accessibility | No dnd library; axe + keyboard E2E gate proves the alternative path |

## Test Requirements

### Unit Tests (minimum 3)

- `test_autorefresh_timer_visibility_gated` (Vitest) — fake timers: hidden ⟹ no fetch; visible + overdue ⟹ immediate refresh
- `test_grid_responsive_columns` (Vitest) — container widths ⟹ 1/2/3/4 columns; span 2 clamps to 1 at single-column
- `test_order_patch_payload` (Vitest) — drop reorders ids; one PATCH with full order
- `test_pin_clears_suggested` — pin call ⟹ suggested=false on all owner rows

### Integration Tests (minimum 3)

- `test_pin_persists_server_side` — POST pin; GET from a fresh session returns it with spec intact
- `test_pin_audited_in_txn` — pin ⟹ audit row exists; forced insert failure ⟹ no audit row (txn atomicity both ways)
- `test_grid_composition_order` — defaults first by position, then user pins; suggested labelled
- `test_reorder_batch_single_audit` — order PATCH ⟹ positions updated, exactly one audit entry
- `test_unpin_owner_only` — DELETE by non-owner ⟹ 403 + audited denial (M1 RBAC pattern)

### E2E Tests (minimum 2)

- `test_pin_cross_device` — Playwright two contexts, same user: pin in context A; context B reload shows widget with live data; second tenant context sees nothing (Plugin Law B + isolation)
- `test_refresh_failure_shows_stale_badge` — force refresh endpoint error ⟹ data still displayed + stale badge + timestamp; recovery refresh clears badge
- `test_drag_reorder_persists` — drag widget to front; reload; order kept
- `test_grid_keyboard_operable` — pin/unpin/move via keyboard only; axe scan 0 violations

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|----|-----------|-----------|
| AC-1 | Integration + E2E | `test_pin_persists_server_side`, `test_pin_cross_device` |
| AC-2 | Integration | `test_pin_audited_in_txn` |
| AC-3 | Unit(TS) | `test_autorefresh_timer_visibility_gated` |
| AC-4 | E2E | `test_refresh_failure_shows_stale_badge` |
| AC-5 | Unit(TS) + E2E | `test_grid_responsive_columns`, `test_drag_reorder_persists` |
| AC-6 | Integration | `test_grid_composition_order` |
| AC-7 | E2E | `test_grid_keyboard_operable` |

## Dependencies

- **blocked_by:** TASK-010 (tables, refresh endpoint, state matrix), TASK-011 (a generated widget is what gets pinned; client stream hook)
- **unlocks:** TASK-015 (publish operates on pinned widgets)

## Cost Estimate

- **Complexity:** M
- **Estimated tokens:** ~45K input, ~20K output
- **Estimated cost:** ~$3

## Definition of Ready Checklist

- [x] User story clear
- [x] All ACs have mapped tests
- [x] Pseudocode provided (incl. batch-reorder + visibility gating decisions)
- [x] Persistence columns (`position`, `column_span`, `suggested`) pinned in m2-delta §4
- [x] Keyboard alternative for drag specified (no a11y afterthought)
- [x] Audit event names fixed (`dashboard.widget.pinned/unpinned`)

## Definition of Done Checklist

- [ ] All ACs met
- [ ] `grep -rn "localStorage" packages/frontend/src` shows no widget-state usage (invariant)
- [ ] Pin/unpin/reorder all audit-visible; reorder = single entry
- [ ] Stale badge is text + colour with timestamp (never colour-only)
- [ ] axe 0 violations on the grid; Lighthouse 100 gate green on Dashboard page
- [ ] Coverage ≥ 80%; mutation ≥ 60%
- [ ] Conventional commit: `feat: add widget pinning, grid layout and auto-refresh`

## Implementation Hints

- Reuse the M1 audit emitter helper that already wraps same-transaction emission (TASK-009
  pattern) — do not open a second connection for the audit write.
- Persist `last_result` at pin time when the client already holds streamed data — saves the
  first refresh round-trip and the widget is never skeleton-after-pin.
- One `setInterval` per dashboard, not per widget: tick every 30 s, refresh widgets whose
  `fetched_at + interval` is due — n timers is drift and churn.
- CSS `grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))` gets the 1–4 column
  behaviour without JS breakpoint code; clamp spans with `grid-column: span min(...)`.
- Drag-and-drop: set `dataTransfer.effectAllowed = "move"` and use widget id, not index — index
  drifts under concurrent refresh re-renders.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*
