---
type: Task
title: "Task: TASK-007 — Tour Engine: Driver.js wrapper + CE/Explorer guided tours"
description: "The owned TourEngine wrapper over Driver.js: config-driven step sequencing,
  server-side resume, role tailoring, absent-anchor skip+log, full keyboard/a11y — plus the
  Constitution and Explorer M1 tours rendered from TASK-003 config."
tags: [onboarding, arch, task, phase-1, m1]
status: Backlog
priority: Must Have
entity: onboarding
epic: EPIC-002
milestone: m1
created: 2026-07-06
blocked_by: ["TASK-001", "TASK-003", "TASK-006"]
unlocks: ["TASK-013"]
adr_refs: [ADR-001, ADR-005]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [onboarding.md](../../../onboarding.md) E2-S1 · Config:
[data-model.md](../../tech-spec/data-model.md) §Content Config Schemas · Flow:
[business-process.md](../../tech-spec/business-process.md) §Tour Lifecycle

## Story

As a new user, I want a step-by-step guided tour of each shipped area that I can skip, resume
on any device, and drive entirely from the keyboard, so I learn the screens in context without
ever being trapped by the guidance.

## Scope Note

Frontend + tiny state calls. Ships: the `TourEngine` React wrapper (ADR-001) — Driver.js invoked
per-step as a dumb spotlight renderer; the wrapper owns sequencing from TASK-003 tour config,
role filtering (TASK-006 path), resume-point persistence via `PUT /api/onboarding/tours/…`
(TASK-001), absent-anchor skip + warn, phase-tag flag-off, and keyboard/a11y. Plus the M1 tour
content wiring: Constitution and Explorer tours live end-to-end, including planting
`data-tour-id` attributes on the CE/Explorer screens named by the registry (coordinated,
additive attribute-only edits in those features). Beacons/modals are TASK-008. Help-launcher
entry points are TASK-013.

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-007-01 | WHERE an area is shipped (M1: Constitution, Explorer), WHEN its tour starts THE SYSTEM SHALL highlight the step's target (dimmed overlay + spotlight), show the tooltip (i18n copy within budget) with Back/Next and a step indicator ("3 of 9") (FR-008). |
| AC-007-02 | WHEN the user clicks "Skip tour" or presses Escape THE SYSTEM SHALL exit without deleting progress; "Resume tour" SHALL pick up at the last completed step, resume point persisted server-side per `(tenant, user)` (FR-009). |
| AC-007-03 | WHEN navigating a tour THE SYSTEM SHALL be fully keyboard-navigable (Tab/Arrow/Enter/Escape), never time-limited, and never require interacting with the highlighted element to advance (E2-S1). |
| AC-007-04 | IF a step's anchor element is absent THEN THE SYSTEM SHALL skip the step with a logged warning (anchor id included) and never block the tour; IF a tour references any anchor whose phase tag exceeds the shipped set THEN THE SYSTEM SHALL flag the whole tour off (ADR-005). |
| AC-007-05 | WHEN a tour is filtered by role THE SYSTEM SHALL show only tours whose `paths` include the user's resolved path; a completed tour SHALL be re-takeable any time. |
| AC-007-06 | WHEN any tour overlay renders THE SYSTEM SHALL pass the WCAG 2.1 AA zero-violations axe gate; step transition ≤ 200 ms (default, tunable). |
| AC-007-07 | WHEN tour copy or styling renders THE SYSTEM SHALL use i18n keys and design tokens exclusively (no Driver.js default theme CSS ships); the `ui_verify` gate passes. |

## API Contracts

Engine-internal only: `PUT /api/onboarding/tours/{tour_id}/progress` (TASK-001). Tours overlay
CE/Explorer screens but call no CE/GE endpoint themselves.

## Diagram

business-process.md §Tour Lifecycle (stateDiagram — the wrapper implements it verbatim);
architecture.md §Level 2 (overlay container).

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Driver.js renders; wrapper owns all state | Library churn can't corrupt tour state; a11y/token tests concentrate in one module | ADR-001 |
| Config-driven from TASK-003 schemas | Content PRs change tours; no code change per tour | ADR-006 |
| Registry-typed anchors, phase flag-off | Unknown anchor is a compile error; unshipped areas can't half-render | ADR-005 |
| Resume server-side, localStorage cache-only | PRD cross-device requirement | PRD §2.4 |

## Test Requirements

| Layer | Scenario | AC |
|---|---|---|
| Unit | Wrapper state machine: start/next/back/skip/resume/complete; re-take | AC-007-02/05 |
| Unit | Absent-anchor skip + warn (anchor id in log); phase flag-off | AC-007-04 |
| Unit | Keyboard bindings; no advance-requires-interaction | AC-007-03 |
| Integration | Resume round-trip against the state API stub | AC-007-02 |
| E2E | CE tour end-to-end with axe per step; step-transition timing | AC-007-01/06 |
| E2E | Explorer tour; skip via Escape then resume from a fresh session | AC-007-02/03 |

## Dependencies

- **blocked_by**: TASK-001 (progress persistence), TASK-003 (config + anchors), TASK-006 (path)
- **unlocks**: TASK-013 ("Take a tour" launcher entries; exit E2E inherits via TASK-013)

## Cost Estimate

**L** — the wrapper is the engineering heart of the overlay layer; two full tours plus attribute
planting across CE/Explorer screens is coordinated volume.

## DoR Checklist

- [ ] ADR-001 approved (Driver.js, licence rationale recorded)
- [ ] TASK-003 merged (config, anchors, CI checks live)
- [ ] CE/Explorer screen owners aware of the attribute-only PRs (registry convention)
- [ ] Design tokens for overlay/popover/spotlight confirmed in `docs/standards/design/`

## DoD Checklist

- [ ] All ACs pass; axe zero-violations on every step of both tours
- [ ] Driver.js pinned; no default theme CSS in the bundle; tokens only
- [ ] Anchor attributes merged in CE/Explorer with registry entries green in the CI audit
- [ ] Resume verified across sign-out/sign-in in E2E
- [ ] Coverage ≥ 80%, mutation ≥ 60% (Stryker) on the wrapper state machine

## Implementation Hints

Drive Driver.js in single-step mode (`highlight` per step) rather than handing it the whole
steps array — that keeps sequencing, skipping, and resume entirely in the wrapper and Driver.js
stateless. Debounce resume-point writes (write on step completion, not on every render). The
"3 of 9" indicator counts *renderable* steps after phase/anchor filtering, so a skipped absent
anchor doesn't leave a ghost count.
