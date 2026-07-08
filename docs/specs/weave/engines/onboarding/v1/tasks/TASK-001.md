---
type: Task Brief
title: "Task: TASK-001 — M2 Anchor-Registry + Content-Config (zero schema change)"
description: "The full M2 content foundation: 11 phase-m2 anchor registry entries with the
  ADR-008 per-anchor shipped signal, four M2 tours + beacons + role-home welcome modal as typed
  config, the manual checklist.add-competency-questions item, i18n copy, and CI fixtures.
  Red-team remediated 2026-07-08: ce_signal schema delta removed (CE ships no per-tenant count);
  three control anchors removed (owners ship no such discrete DOM element)."
tags: [onboarding, arch, task, v1]
status: Backlog
priority: Must Have
entity: onboarding
epic: EPIC-002
milestone: v1
created: 2026-07-08
blocked_by: []
unlocks: ["TASK-002", "TASK-003", "TASK-004"]
adr_refs: [ADR-005, ADR-006, ADR-008]
source: hand-authored
confirmed_by: none
confirmed_on: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: n/a
---

Engine spec: [onboarding.md](../../../onboarding.md) §M2 window · Delta:
[m2-delta.md](../../tech-spec/m2-delta.md) §3–§4 · M1 foundation: m1/tasks/TASK-003.

## Story

As the onboarding content owner, I want every M2 overlay (tours, beacons, modal, checklist
item) to exist as typed, CI-checked config before any rendering work starts, so the three
overlay tasks are pure wiring and no anchor, copy, or phase tag can drift.

## Scope Note

Config only — no rendering (that is TASK-002/003/004), no backend work anywhere in this window.
Extends the M1 TASK-003 assets in `packages/shared`: registry entries, content config, i18n
catalogue, CI fixtures. **Zero schema change** (m2-delta §4): the checklist item reuses the
existing `autoCompleteOn: "manual"` member; the registry entry type gains the ADR-008
`shipped` + `planted_by` fields (a registry-type extension, not a content-schema change).

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-001-01 | WHEN the anchor registry builds THE SYSTEM SHALL contain exactly the 11 m2-delta §3 anchor ids, each `{ phase: "m2", shipped: false, planted_by: <TASK-002\|003\|004 per §3> }` with the owning engine/area; an unknown anchor referenced from config SHALL remain a compile + CI error (M1 AC-003-01 unchanged). |
| AC-001-02 | WHEN config loads THE SYSTEM SHALL provide four M2 tours (`tour.ge.completeness-map`, `tour.plat.role-home`, `tour.ge.trust-mechanics`, `tour.ce.rules-policies`), their beacons, and one role-home welcome modal — all with role-path tags and i18n-key copy within budgets (tooltip ≤ 40, beacon ≤ 60 words — defaults, tunable). |
| AC-001-03 | WHEN the two-way anchor audit runs THE SYSTEM SHALL fail on (a) a `shipped: true` entry with no matching `data-tour-id` in code AND (b) a `data-tour-id` in code whose entry is missing or still `shipped: false` — so the shipped flip is atomic with the attribute plant (ADR-008); phase tags SHALL carry no gating semantics. |
| AC-001-04 | WHEN config defines `checklist.add-competency-questions` THE SYSTEM SHALL tag it paths Business + Technical, set `autoCompleteOn: "manual"` (existing member — no schema change), and deep-link the onboarding training-library article "Declare your domain competency questions" (the article is part of this task's content). |
| AC-001-05 | WHEN the M1 content CI suite runs over the M2 content THE SYSTEM SHALL apply every existing check (dead-CTA, copy budgets, anchor validity, role tags, both-ways data-tour-id audit) unchanged; WHILE an anchor is `shipped: false` THE SYSTEM SHALL keep every tour/beacon/modal referencing it off — per-anchor, so tours over different surfaces flip independently (ADR-008, replaces uniform phase flag-off). |
| AC-001-06 | WHEN any M2 copy renders downstream THE SYSTEM SHALL have only i18n keys in config — a literal user-facing string in config SHALL fail CI (M1 check, re-fixtured for M2 content). |

## Pseudocode

```text
anchors.ts      += 11 entries from m2-delta §3 (phase: "m2", shipped: false, planted_by)
                   registry entry type += { shipped: boolean, planted_by: TaskId }
anchor-audit    := key both-ways check on `shipped` (not phase): shipped-without-attribute
                   FAILS; attribute-without-shipped FAILS
offer(overlay)  := every(overlay.anchors, a => registry[a].shipped)   # per-anchor gating
content/m2/*.ts += 4 Tour configs, Beacon configs, 1 WelcomeModal,
                   1 ChecklistItem (autoCompleteOn: "manual")
training/*      += "Declare your domain competency questions" article (deep-link target)
i18n/en.json    += keys for all of the above (budget-checked)
ci fixtures     += failing fixture per new check path (shipped-true-no-attribute,
                   attribute-no-shipped, m2 anchor unregistered, over-budget m2 copy)
```

## API Contracts

None — config package only. No CE contract is consumed anywhere in this task (the former
FR-037 named-query reference is removed; see m2-delta §1 OQ-M2-1 amendment + escalation).

## Diagram

m2-delta.md §2 surface map (which overlay attaches where); architecture.md §Level 2 "Content +
anchor config" container (unchanged topology).

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| All M2 content lands as config before rendering tasks | Content PRs reviewed once; TASK-002/003/004 become wiring | ADR-006 |
| Anchor ids normative from m2-delta §3; DOM panels/controls only | GE canvas internals have no DOM; audit + runtime skip mitigate owner restructures | ADR-005, m2-delta §3 |
| Per-anchor `shipped` signal replaces phase-flag gating | A milestone flag can't distinguish a dropped anchor from a not-yet-shipped one during the independent-merge window; per-anchor flip closes it with one boolean | ADR-008 |
| Competency item is manual, zero schema change | CE M2 ships the framework question set, not a per-tenant count — auto-clear had no mechanical carrier; manual self-mark reuses M1 OQ-08 machinery | m2-delta §1/§5 (OQ-M2-1 amended) |

## Test Requirements

Minimum: 4 unit, 1 integration (schema-parse round-trip), 0 E2E (no UI in this task).

| Layer | Scenario | AC |
|---|---|---|
| Unit | should register exactly the 11 m2 anchors with shipped false and a planted_by owner | AC-001-01 |
| Unit | should fail audit fixture on shipped-without-attribute and attribute-without-shipped | AC-001-03 |
| Unit | should fail CI fixture when m2 copy exceeds budget / literal string / dead CTA | AC-001-05/06 |
| Unit | should offer a tour only when every one of its anchors is shipped (per-tour independence) | AC-001-05 |
| Integration | should parse full M2 content bundle through zod + CI suite green (incl. manual competency item + training-article deep-link resolving) | AC-001-02/04 |

## Dependencies

- **blocked_by**: none in-milestone (M1 TASK-003 assets shipped and merged)
- **unlocks**: TASK-002, TASK-003, TASK-004
- **External (DoR, not DAG):** none — config merges independently of owning surfaces; every
  anchor starts `shipped: false`, so no overlay referencing it can render until its planting
  task flips it (ADR-008).

## Cost Estimate

- **Complexity:** S (config + registry-field extension + fixtures; pattern fully established by
  M1 TASK-003)
- **Estimated tokens:** ~8k input, ~4k output (claude-sonnet-5)

## DoR Checklist

- [ ] m2-delta.md approved (anchor set §3 as remediated, zero schema delta §4)
- [ ] ADR-008 approved (per-anchor shipped signal)
- [ ] M1 TASK-003 assets merged and CI suite green on main
- [ ] i18n copy drafted for all four tours + modal + checklist item + training article

## DoD Checklist

- [ ] All ACs pass; every new check path has a failing fixture
- [ ] Full M1 content CI suite green over combined M1+M2 content
- [ ] No literal user-facing strings; budgets hold
- [ ] Coverage ≥ 80%, mutation ≥ 60% on schema/check modules (defaults, tunable)

## Implementation Hints

Copy the M1 fixture pattern verbatim — one failing fixture per check, asserted by the existing
test harness. When adding `shipped`/`planted_by` to the registry entry type, grandfather every
M1 entry as `shipped: true` (their surfaces are live) so the audit semantics are uniform.
Don't touch the M1 anchor ids; append only.
