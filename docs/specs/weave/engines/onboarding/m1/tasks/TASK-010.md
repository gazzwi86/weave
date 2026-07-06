---
type: Task
title: "Task: TASK-010 — Onboarding Checklist Widget on the Dashboard"
description: "The role-configurable checklist that drives a user to first outcome: per-path item
  sets, auto-complete wiring, locked not-shipped items, 100% celebration + relabel, 7-day
  auto-dismiss (tunable), dismiss/restore."
tags: [onboarding, arch, task, phase-1, m1]
status: Backlog
priority: Must Have
entity: onboarding
epic: EPIC-005
milestone: m1
created: 2026-07-06
blocked_by: ["TASK-001", "TASK-003", "TASK-006"]
unlocks: ["TASK-013"]
adr_refs: [ADR-003, ADR-006]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [onboarding.md](../../../onboarding.md) E5-S1, E4-S2

## Story

As a new user, I want a checklist on my Dashboard that tracks me from exploring the demo to my
first real outcome, so I always know the next step — and it gets out of my way once I'm done.

## Scope Note

Frontend widget + read-side wiring. Renders per-path item sets from TASK-003 config: explore
demo (auto-complete on first demo visit), complete a tour, complete ≥ 1 exercise, reach the
activation milestone (auto-completed by TASK-011's row), plus Admin-only invite/connector items
— the invite item with the "pending platform signal" badge + **manual self-mark** (OQ-08), the
connector item **locked** (PLAT-CONNECTOR-1 is v1.0). Item states derive from the TASK-001
bootstrap read (tour_progress, exercise_completion, activation) — the widget computes, it never
stores its own truth. Widget hosts in the Platform Dashboard slot (Platform owns the Dashboard;
onboarding supplies the widget). Restore entry point surfaces in TASK-013.

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-010-01 | WHEN the Dashboard renders THE SYSTEM SHALL show the checklist with the user's path-configured items, each with checkbox state, label, "Why this matters", and a "Do it now" deep-link (FR-019). |
| AC-010-02 | WHEN a tracked signal exists (first demo visit, tour completion, exercise completion, activation row) THE SYSTEM SHALL show the matching item complete with timestamp — detection and widget can never disagree because both read the same state rows (EPIC-005 epic AC). |
| AC-010-03 | IF an item's engine has not shipped THEN THE SYSTEM SHALL show it locked with a prerequisite note (FR-019); the Admin invite item SHALL show the "pending platform signal" badge and support manual self-mark (`source=manual`, OQ-08). |
| AC-010-04 | WHEN all items complete THE SYSTEM SHALL show the celebration state and relabel; the widget SHALL auto-dismiss after a default 7 days (tunable per workspace via the settings cascade) — config-driven, not hard-coded (FR-020). |
| AC-010-05 | WHEN the user dismisses the checklist THE SYSTEM SHALL persist the dismissal and the widget SHALL be restorable from the Help launcher (FR-021). |
| AC-010-06 | WHEN the widget renders THE SYSTEM SHALL be axe-clean, keyboard-operable, i18n/tokens throughout. |

## API Contracts

Engine-internal: reads the TASK-001 bootstrap state; `PATCH /api/onboarding/state` for
dismissal timestamps; `POST /api/onboarding/milestones/{id}/self-mark` (Admin manual mark —
writes through TASK-001's activation PK with `source=manual`; TASK-011 owns the recorder it
routes through). Consumes `PLAT-SETTINGS-1` (7-day auto-dismiss tunable resolution).

## Diagram

architecture.md §Level 2 (overlay container → API); the widget is a pure projection of the
data-model.md state tables.

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Widget computes from state rows, stores nothing | The detection/widget agreement AC by construction | EPIC-005 AC / ADR-003 |
| Admin invite = self-mark + badge | OQ-08 uncontracted; do not over-claim PLAT-IDENTITY-1 | FR-022 / OQ-08 |
| Auto-dismiss window via settings cascade | "default X, tunable" discipline | PRD decision E4 |

## Test Requirements

| Layer | Scenario | AC |
|---|---|---|
| Unit | Item-state derivation matrix per signal kind; locked/badge variants | AC-010-02/03 |
| Unit | 100% → celebration + relabel; auto-dismiss window arithmetic | AC-010-04 |
| Integration | Self-mark writes activation row `source=manual`, idempotent under the PK | AC-010-03 |
| Integration | Dismiss + restore round-trip | AC-010-05 |
| E2E | Complete an exercise → checklist item ticks with timestamp; axe pass | AC-010-02/06 |

## Dependencies

- **blocked_by**: TASK-001 (state), TASK-003 (item config), TASK-006 (path)
- **unlocks**: TASK-013 (restore entry; the exit-suite activation E2E inherits via TASK-013)

## Cost Estimate

**M** — a projection widget; the derivation matrix and the Dashboard-hosting seam with Platform
are the care points.

## DoR Checklist

- [ ] Platform Dashboard widget slot/contract confirmed (Platform owns rendering host)
- [ ] TASK-003 checklist config reviewed against E5-S1 items
- [ ] Auto-dismiss tunable registered in the settings cascade

## DoD Checklist

- [ ] All ACs pass; derivation matrix fully covered
- [ ] Self-mark proven idempotent (double-click ⇒ one row)
- [ ] Widget passes `ui_verify`; axe zero-violations
- [ ] Coverage ≥ 80%, mutation ≥ 60% on derivation logic

## Implementation Hints

"First demo visit" auto-complete: derive from `onboarding_state.sandbox_workspace_id IS NOT
NULL` — the lazy fork *is* the visit; no extra event needed. Deep-links come from config; run
them through the same phase-tag check as tours so a locked item's link renders disabled, not
404. Celebration: reuse the design system's success motion tokens — no bespoke confetti.
