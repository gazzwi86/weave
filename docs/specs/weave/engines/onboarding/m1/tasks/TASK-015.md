---
type: Task
title: "Task: TASK-015 — M1 Exit-Criteria E2E Suite (Gate 1 evidence)"
description: "The cross-epic Playwright suite that produces Gate 1's evidence: first-sign-in
  journey, persistence + reset, role-resolution matrix E2E, exercise round-trips, exactly-once
  activation, and the WCAG axe gate over every overlay — each asserting backend state (Law B)."
tags: [onboarding, arch, task, phase-1, m1]
status: Backlog
priority: Must Have
entity: onboarding
epic: EPIC-001
milestone: m1
created: 2026-07-06
blocked_by: ["TASK-005", "TASK-009", "TASK-011", "TASK-013"]
unlocks: []
adr_refs: [ADR-002, ADR-003]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [onboarding.md](../../../onboarding.md) §4 M1 exit criteria · Strategy:
[testing-strategy.md](../../tech-spec/testing-strategy.md) §4

## Story

As the Gate 1 approvers (Product Owner + Tech Lead + Security reviewer), we need every M1 EARS
exit criterion demonstrated by a runnable suite, so sign-off is evidence, not assertion.

## Scope Note

Playwright specs + CI wiring only — no product code. Implements testing-strategy.md §4
verbatim: `first-sign-in.spec`, `tour.spec`, `persistence-reset.spec`, `exercise.spec`,
`activation.spec`, `help-launcher.spec`, all Page Object Model, all with backend-state
assertions (Law B), `@axe-core/playwright` in every overlay spec, Lighthouse CI budgets on the
demo/overlay surfaces. Also wires the integration-level release gates (isolation trio from
TASK-004, `test_reset_known_state`, `test_activation_exactly_once`, `test_rls_fail_closed`,
role matrix) into one named CI job (`onboarding-release-gates`) that Gate 1 references.
**Descope note:** the roadmap's "role-segmented analytics dashboard" delivered-artefact is NOT
asserted — EPIC-008 deferred (human decision 2026-07-06); the artefact list this suite proves
is: demo workspace, 4 role paths, CE/GE exercise set, checklist widget.

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-015-01 | WHEN a brand-new user signs in THE SUITE SHALL verify: the active workspace resolves to the seeded demo sandbox ("Demo — fictional data"), CE + Explorer areas render seed content, Build/Automate are flagged off — asserting the sandbox pointer server-side (roadmap exit 1). Note: the workspace-switcher UI was retired by the workspace≡company tenancy realignment; assert the server-side sandbox pointer, not a switcher control. |
| AC-015-02 | WHEN the persistence + reset spec runs THE SUITE SHALL verify edits survive sign-out/sign-in and only an explicit reset restores canonical within the default 30 s target, exercise flags cleared, activation retained (roadmap exit 4). |
| AC-015-03 | WHEN the role-matrix E2E runs THE SUITE SHALL verify path resolution end-to-end for representative roles (single, multi → prompt, zero → Business read-only) against seeded identities (roadmap exit 5). |
| AC-015-04 | WHEN the activation spec runs THE SUITE SHALL verify a first own-workspace outcome fires toast + checklist + one PLAT-NOTIFY-1 publish exactly once, and a re-trigger produces nothing (roadmap exit 6). |
| AC-015-05 | WHEN any overlay renders in any spec THE SUITE SHALL run axe with zero WCAG 2.1 AA violations (roadmap exit 7); Lighthouse budgets (Perf ≥ 90 · A11y ≥ 95 · BP ≥ 90) enforced on PR. |
| AC-015-06 | WHEN the `onboarding-release-gates` CI job runs THE SUITE SHALL include the three isolation-boundary tests, reset known-state, exactly-once, RLS fail-closed, and role matrix — one job Gate 1 can cite (roadmap exits 2–3 included via TASK-004's tests). |
| AC-015-07 | WHEN the suite runs in CI THE SYSTEM SHALL use the local stack only (in-process backend + dockerised Oxigraph + stubbed PLAT-*) — no real cloud (Law F). |

## API Contracts

None — test-only. Exercises every consumed contract through the product surfaces.

## Diagram

testing-strategy.md §1 pyramid; the specs map 1:1 to the roadmap's M1 exit-criteria list.

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| One named CI job aggregates the gate evidence | Gate 1 approvers cite a job, not a scavenger hunt | roadmap HITL gates |
| E2E asserts backend state, not just DOM | Law B; a ticked checkbox proves nothing about the graph | plugin-laws.md |
| Suite lands last in the DAG | Every journey it drives must already exist | DAG construction |

## Test Requirements

This task IS the tests; its own quality bar: zero flaky retries tolerated in the gate job
(retries=0 for gate specs), deterministic seeds per spec, and each spec runnable in isolation.

## Dependencies

- **blocked_by**: TASK-005 (reset), TASK-009 (exercises), TASK-011 (activation),
  TASK-013 (launcher — last UI aggregate)
- **unlocks**: none (Gate 1 evidence; terminal)

## Cost Estimate

**M** — the journeys exist; the work is POM discipline, seeded-identity fixtures, timing
assertions, and CI job wiring.

## DoR Checklist

- [ ] All four blocking tasks merged and green
- [ ] Seeded identity fixtures available for the role matrix (PLAT-IDENTITY-1 stub)
- [ ] Lighthouse CI budgets configured for the demo/overlay routes

## DoD Checklist

- [ ] All ACs pass; `onboarding-release-gates` job green and linked from the Gate 1 checklist
- [ ] Every spec asserts at least one backend-state change (Law B audit)
- [ ] Zero flaky-retry configuration on gate specs
- [ ] Suite runtime documented; specs runnable individually

## Implementation Hints

Reuse the page objects the per-task E2E specs already created (TASK-007/008/010/012/013) — this
suite composes journeys, it does not re-model pages. For the exactly-once assertion, count
PLAT-NOTIFY-1 stub calls AND outbox rows — both must equal one. The 30 s reset timing asserts
the server-reported op duration, not wall-clock browser time (CI machines vary).
