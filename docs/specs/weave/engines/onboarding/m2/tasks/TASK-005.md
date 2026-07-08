---
type: Task Brief
title: "Task: TASK-005 — M2 Overlay Release-Gate Suite (a11y, resilience, role matrix, tile flip)"
description: "The v1-interim release evidence for the Onboarding M2 window: axe-with-overlay-open
  across all M2 surfaces, absent-anchor resilience + all-anchors-shipped gate over the M2 anchor
  set (ADR-008), role-tailoring matrix, manual competency-guidance lifecycle, and the E3-S2
  CE-METRICS-1 starter-tile un-omit assertion (Platform E1-S6 / M2 TASK-010 behaviour)."
tags: [onboarding, arch, task, m2]
status: Backlog
priority: Must Have
entity: onboarding
epic: EPIC-002
milestone: m2
created: 2026-07-08
blocked_by: ["TASK-002", "TASK-003", "TASK-004"]
unlocks: []
adr_refs: [ADR-005, ADR-008]
source: hand-authored
confirmed_by: none
confirmed_on: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: n/a
---

Engine spec: [onboarding.md](../../../onboarding.md) §M2 window (gating note) · Delta:
[m2-delta.md](../../tech-spec/m2-delta.md) §7 · Invariants:
[invariants.md](../../tech-spec/invariants.md) §M2 · M1 precedent: m1/tasks/TASK-015.

## Story

As the release approver, I want one suite that proves every M2 overlay invariant on the built
app, so the v1-interim overlay release inherits the M1 gate floors with evidence, not claims
(OQ-M2-4: no separate HITL gate — sign-off folds into the program gate).

## Scope Note

Test-only task (m1/TASK-015 pattern): Playwright E2E lane + the seeded fixtures it needs.
Covers exactly the m2-delta §7 E2E list plus the §9/invariants.md M2 entries. No product code —
a failure here is fixed in TASK-002/003/004, never patched in the suite. Law F throughout:
in-process app, stubbed CE/PLAT clients, no cloud.

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-005-01 | WHEN the suite runs THE SYSTEM SHALL execute one tour E2E per M2 surface (role-home, completeness map, trust-mechanics GE, rules-policies CE) with axe WCAG 2.1 AA zero-violations asserted at every step, with each overlay open on its owning page, and with the welcome-modal focus trap asserted (Tab cycle, Esc close, focus return). |
| AC-005-02 | WHEN anchors are removed from a test build one at a time across the 11-anchor M2 set THE SYSTEM SHALL observe skip/hide + warn for each, zero blocked tours, zero orphaned tooltips (absent-anchor resilience re-run, M1 invariant over M2 set). |
| AC-005-03 | WHEN the role-tailoring matrix runs (4 paths × offered overlays) THE SYSTEM SHALL match the TASK-001 config tags exactly — no dead "Take tour" CTA and no missing proactive offer on any path. |
| AC-005-04 | WHEN the competency-guidance lifecycle runs THE SYSTEM SHALL show the tile beacon while the manual item is open, hide it after self-mark (exactly-once completion; idempotent re-mark), and make zero CE calls on any competency path (m2-delta §5 — there is no count read to fail). |
| AC-005-05 | WHEN the Business-path dashboard renders under a live-stubbed CE-METRICS-1 THE SYSTEM SHALL no longer omit the ontology-health/completeness starter tile (E3-S2 flip — asserts the Platform availability-registry + starter-widget behaviour owned by **Platform E1-S6, Platform M2 TASK-010 AC-8**; onboarding implements nothing). |
| AC-005-06 | WHEN the suite completes THE SYSTEM SHALL report coverage ≥ 80% and mutation ≥ 60% (defaults, tunable) over the M2-touched onboarding modules, and every invariants.md §M2 verify-by selector SHALL resolve (file exists, pattern matches). |
| AC-005-07 | WHEN the release-gate check runs THE SYSTEM SHALL FAIL if any m2-delta §3 registry anchor is `shipped: false` — an unshipped Must-Have surface is a red gate, never a quietly-absent overlay (ADR-008; replaces the former "phase flags on" assumption). |

## Pseudocode

```text
e2e/onboarding/m2-overlays.spec.ts:
  for surface in [role-home, completeness-map, trust-ge, rules-ce]:
      run tour; per step: axe(); assert transition <= 200ms budget
  modal: assert focus trap (Tab cycle, Esc, focus return)
  anchor-resilience: for each of 11 anchors: hide anchor → assert skip+warn, tour completes
  role-matrix: for path in 4 paths: assert offered set == config tags
  competency: item open → beacon shown; self-mark → completed once, beacon gone;
              re-mark → no second completion; assert zero CE traffic (stub spy)
  tile-flip: stub CE-METRICS-1 live → assert Business starter tile present (Platform TASK-010)
ci: selector-check script asserts every invariants.md §M2 verify-by resolves
    + shipped-gate: assert every m2 registry anchor has shipped: true (AC-005-07)
```

## API Contracts

None — consumes the app under test. Stubs: CE-METRICS-1 availability, PLAT-* clients (all M1
stub harness, extended fixtures only). No FR-037/count stub exists — the competency path makes
no CE call (m2-delta §5).

## Diagram

m2-delta.md §7 (this suite is that list, one-to-one); invariants.md §M2 (each entry maps to at
least one assertion here).

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| One gate suite, not per-task gate tests | M1 TASK-015 precedent; release evidence lives in one lane the approver can read | m1/TASK-015 |
| Suite never patches product behaviour | A gate that adapts to failures is not a gate | git-safety principle |
| Tile-flip asserted here, not built anywhere | m2-delta §2 verify-not-build decision made testable; behaviour is Platform E1-S6 (Platform M2 TASK-010), not TASK-017 | m2-delta §2/§9; red-team fix 6 |
| Gate asserts all anchors shipped | A Must-Have surface that never shipped must fail the release visibly, not hide behind a gated-off tour | ADR-008; red-team fix 3 |

## Test Requirements

This task IS the test set. Minimum: 4 E2E specs + 1 CI selector-check; unit/integration only
for suite utilities (fixture builders).

| Layer | Scenario | AC |
|---|---|---|
| E2E | should pass axe zero-violations with each M2 overlay open, per step, incl. modal focus trap | AC-005-01 |
| E2E | should skip+warn per hidden anchor across the 11-anchor set, never block | AC-005-02 |
| E2E | should match offered overlays to config tags across 4 paths | AC-005-03 |
| E2E | should walk manual competency lifecycle (open → self-mark → done once, zero CE calls) | AC-005-04 |
| E2E | should render Business starter tile when CE-METRICS-1 stub is live | AC-005-05 |
| CI | should resolve every invariants.md §M2 verify-by selector | AC-005-06 |
| CI | should fail the gate when any m2 registry anchor is shipped false | AC-005-07 |

## Dependencies

- **blocked_by**: TASK-002, TASK-003, TASK-004 (surfaces wired, anchors shipped)
- **unlocks**: none (terminal — v1-interim release evidence)
- **External (DoR, not DAG):** all owning M2 surfaces merged (Platform TASK-010 + TASK-017,
  GE TASK-001/002/003/008, CE TASK-006) — this suite runs against real components with every
  M2 anchor `shipped: true` (AC-005-07 enforces it). CE TASK-010 is NOT a dependency (no
  count query is consumed anywhere in this window).

## Cost Estimate

- **Complexity:** M (matrix breadth, but every pattern exists in the m1/TASK-015 lane)
- **Estimated tokens:** ~10k input, ~6k output (claude-sonnet-5)

## DoR Checklist

- [ ] TASK-002/003/004 merged; every m2 registry anchor `shipped: true` in the test build
- [ ] Owning M2 surfaces merged (no unshipped anchor left in the gate scope — AC-005-07)
- [ ] Stub fixtures for CE-METRICS-1 availability agreed with the M1 stub harness owner
- [ ] Tunable defaults (200 ms, floors) read from one fixture, not hardcoded per spec

## DoD Checklist

- [ ] All ACs pass on the built app in CI; suite green twice consecutively (flake check)
- [ ] Every invariants.md §M2 entry mapped to a named assertion (traceability table in the spec file header)
- [ ] Zero product-code changes in this task's diff
- [ ] Coverage ≥ 80% / mutation ≥ 60% reported over M2-touched modules (defaults, tunable)

## Implementation Hints

Reuse the m1/TASK-015 fixture builders and two-tenant seed; only the M2 stubs are new. For
anchor-resilience, hide anchors via a test-only CSS class toggle rather than 11 separate
builds. Keep the invariants selector-check and the shipped-gate as one tiny script the QA
agent can also run standalone — it doubles as the Arch Law 10 drift check for this window.
