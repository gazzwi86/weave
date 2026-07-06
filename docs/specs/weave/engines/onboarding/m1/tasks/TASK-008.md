---
type: Task
title: "Task: TASK-008 — Beacons & Welcome Modals with server-side dismissal"
description: "Contextual pulsing beacons on complex UI elements and first-visit welcome modals
  per shipped area: Radix-based, config-driven, dismissals persisted server-side, 'Show all
  hints' restore, dead-CTA-safe by construction."
tags: [onboarding, arch, task, phase-1, m1]
status: Backlog
priority: Must Have
entity: onboarding
epic: EPIC-002
milestone: m1
created: 2026-07-06
blocked_by: ["TASK-001", "TASK-003"]
unlocks: ["TASK-013"]
adr_refs: [ADR-005, ADR-006]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [onboarding.md](../../../onboarding.md) E2-S2/E2-S3

## Story

As a new user, I want pulsing hints on complex elements and a short welcome the first time I
enter an area, so I get oriented exactly where confusion happens — and once I dismiss a hint it
stays dismissed on every device, unless I ask for all hints back.

## Scope Note

Frontend + state calls. Radix Popover/Dialog components (no new deps — ADR-001 scope: Driver.js
is tours-only). Config-driven from TASK-003: beacon set (M1 complex elements, e.g. SPARQL
canvas, SHACL validation panel, PROV chain) and welcome modals per area — including no-tour
areas (Compliance, Settings) with the "Explore freely"/"Read the guide" CTA set. Dismissals via
the TASK-001 `dismissal` table; "Show all hints" bulk-restore. "Take a tour" CTAs invoke
TASK-007's engine (config-level dead-CTA safety already CI-enforced by TASK-003).

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-008-01 | WHERE a configured complex element is present, WHEN its screen renders THE SYSTEM SHALL display a pulsing beacon; WHEN clicked THE SYSTEM SHALL open a tooltip (≤ 60-word budget, i18n) with a "Learn more" link to the relevant walkthrough (FR-010/FR-011). |
| AC-008-02 | WHEN a beacon is dismissed THE SYSTEM SHALL persist the dismissal server-side per user; WHEN "Show all hints" is invoked THE SYSTEM SHALL restore all dismissed beacons (bulk delete of the user's beacon dismissals). |
| AC-008-03 | IF a beacon's target element is absent or unmounts while its tooltip is open THEN THE SYSTEM SHALL hide beacon and tooltip with a logged warning — no orphaned tooltip (E2-S2 failure mode). |
| AC-008-04 | WHERE an area is shipped, WHEN a user visits it for the first time THE SYSTEM SHALL show its welcome modal (name, 2–3 sentence description, CTAs per config); WHEN dismissed THE SYSTEM SHALL never fire it again for that user (server-side dismissal). |
| AC-008-05 | WHERE an area has a tour THE SYSTEM SHALL show "Take a tour" + "Explore freely"; WHERE it has none THE SYSTEM SHALL show only the no-tour CTA set — no dead CTA (config-CI-guaranteed, asserted again at render). |
| AC-008-06 | IF an area is feature-flagged off (unshipped engine) THEN THE SYSTEM SHALL render no beacon and no welcome modal for it (uniform flag-off, EPIC-002 epic AC). |
| AC-008-07 | WHEN any beacon or modal renders THE SYSTEM SHALL pass the axe zero-violations gate, carry `aria-label`s, and be keyboard-operable; all copy i18n, all styling tokens. |

## API Contracts

Engine-internal only: `PUT /api/onboarding/dismissals/{kind}/{ref_id}`,
`DELETE /api/onboarding/dismissals/beacon` (TASK-001).

## Diagram

architecture.md §Level 2 (overlay container); the beacon reduced state machine is described in
business-process.md §Tour Lifecycle notes.

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Radix primitives, not Driver.js, for beacons/modals | Non-sequential overlays need no spotlight engine; zero new deps | ADR-001 scope |
| One `dismissal` table for beacons + modals | Same semantics (fire once, restorable); one shape | data-model.md |
| CTA sets from config, CI-reconciled | Dead-CTA class eliminated pre-merge | ADR-006 / TASK-003 |

## Test Requirements

| Layer | Scenario | AC |
|---|---|---|
| Unit | Beacon render/dismiss/restore; unmount-while-open hides both + warns | AC-008-01/02/03 |
| Unit | Modal first-visit gating from dismissal state; CTA set per config kind | AC-008-04/05 |
| Unit | Flagged-off area renders neither | AC-008-06 |
| Integration | Dismissal round-trip + bulk restore against state API | AC-008-02 |
| E2E | Beacon on SHACL panel: click, learn-more link, dismiss, restore via hints toggle; axe pass | AC-008-01/02/07 |
| E2E | Welcome modal fires once across sign-out/sign-in | AC-008-04 |

## Dependencies

- **blocked_by**: TASK-001 (dismissal persistence), TASK-003 (config + anchors)
- **unlocks**: TASK-013 ("Show hints" launcher entry)

## Cost Estimate

**M** — two config-driven component families with persistence; the unmount edge case and a11y
polish are the care points.

## DoR Checklist

- [ ] TASK-003 merged (beacon/modal config schemas + M1 content)
- [ ] Radix Popover/Dialog patterns confirmed against the design system
- [ ] Beacon target elements present on M1 screens (anchor audit green)

## DoD Checklist

- [ ] All ACs pass; axe zero-violations on beacon tooltip and every modal
- [ ] Dismissals survive sign-out/sign-in in E2E; restore verified
- [ ] No hardcoded copy or hex/px; `ui_verify` passes
- [ ] Coverage ≥ 80%, mutation ≥ 60% on gating logic

## Implementation Hints

Mount beacons via a per-screen provider that reads the config for the active area and filters by
the dismissal set from the bootstrap read — one query, no per-beacon fetches. Use a
`MutationObserver`-light approach: anchor presence is checked on mount and on tooltip open only;
the unmount case is handled by Radix's anchor-ref becoming null. First-visit detection for
modals is "no dismissal row", not a separate visited flag.
