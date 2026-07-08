---
type: Task Brief
title: "Task: TASK-003 — Role-Home Guidance + Competency-Question Guidance Item"
description: "'What can Weave do for you' guidance on the Platform M2 role-home (welcome modal +
  tour, role-tailored) plus the manual competency-question guidance item: checklist item
  (self-mark, M1 OQ-08 machinery) with a completeness-tile beacon keyed off the item's
  server-side state. Red-team remediated 2026-07-08: the former ce_signal poller evaluator and
  its CE TASK-010 FR-037 count dependency are removed — CE ships no per-tenant count (see
  m2-delta §1 OQ-M2-1 amendment + escalation); this task is now frontend-only."
tags: [onboarding, arch, task, m2]
status: Backlog
priority: Must Have
entity: onboarding
epic: EPIC-003
milestone: m2
created: 2026-07-08
blocked_by: ["TASK-001"]
unlocks: ["TASK-005"]
adr_refs: [ADR-003, ADR-005, ADR-006, ADR-008]
source: hand-authored
confirmed_by: none
confirmed_on: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: n/a
---

Engine spec: [onboarding.md](../../../onboarding.md) §M2 window rows 2/4, EPIC-003 · Delta:
[m2-delta.md](../../tech-spec/m2-delta.md) §2, §4–§5 · Owning surface: Platform M2 TASK-017
(role-home route). No CE dependency (OQ-M2-1 amended — no count query exists to consume).

## Story

As a signed-in user landing on my role-home, I want guidance tailored to my resolved path
("what can Weave do for *you*") and a clear, persistent prompt to declare my company's 2–5
domain competency questions, so I understand my next highest-value modelling action.

## Scope Note

Frontend-only, one surface. **Guidance:** role-home welcome modal (first visit) +
`tour.plat.role-home` (nav-entry → capabilities → completeness tile → next-action → summary
tiles), variant copy selected by the M1 resolved path (m1/TASK-006); attribute planting on the
five `plat.role-home.*` anchors (Platform TASK-017 components — single planting owner per
m2-delta §3, `shipped` flipped in this PR; TASK-002's tile beacon consumes the
`completeness-map` anchor once flipped). **Competency guidance:** the manual
`checklist.add-competency-questions` item (TASK-001 config; existing `autoCompleteOn: "manual"`
+ M1 self-mark endpoint, `source=manual`) and the completeness-tile beacon shown while the item
is open, hidden once complete. No backend change of any kind — no poller extension, no CE read,
no endpoint, no table, no schema (m2-delta §5/§6/§8).

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-003-01 | WHEN a user first visits role-home THE SYSTEM SHALL show the welcome modal with a "Take the tour" CTA that starts `tour.plat.role-home`; tour copy variant SHALL match the user's resolved path (4 paths; multi-role/zero-role handling inherited from m1/TASK-006 — no new resolution logic). |
| AC-003-02 | WHEN the role-home tour runs THE SYSTEM SHALL step nav-entry → capabilities → completeness-map tile → next-action → summary tiles with all M1 TourEngine invariants (skip/resume server-side, keyboard, absent-anchor skip+warn, ≤ 200 ms transitions — defaults, tunable). |
| AC-003-03 | WHILE `checklist.add-competency-questions` is open for a Business/Technical-path user THE SYSTEM SHALL show the guidance beacon on `plat.role-home.completeness-map` ("Declare your domain competency questions", deep-link to the training-library article per TASK-001 AC-001-04); WHEN the user self-marks the item complete (M1 `source=manual` write — idempotent under the existing PK, ADR-003 family) or dismisses the beacon THE SYSTEM SHALL hide it on next render. |
| AC-003-04 | WHEN beacon visibility is computed THE SYSTEM SHALL derive it solely from the checklist item's server-side open/complete state plus anchor `shipped`/presence — no client-side evaluation of model content and no CE read on any path of this task. |
| AC-003-05 | WHILE any `plat.role-home.*` anchor is `shipped: false` THE SYSTEM SHALL not offer the tour/modal/beacon that references it (per-anchor gating, ADR-008); WHEN an anchor is absent at runtime THE SYSTEM SHALL skip/hide with a logged warning — never a broken or half-rendered overlay. |
| AC-003-06 | WHEN the modal, tour, or beacon renders THE SYSTEM SHALL pass axe WCAG 2.1 AA zero-violations and remain keyboard-navigable; the welcome modal SHALL trap focus while open (focus moves into the modal on open, cannot Tab out, Esc closes, focus returns to the trigger element); i18n keys + design tokens only, `ui_verify` passes. |

## Pseudocode

```text
# frontend only
plant data-tour-id on 5 plat.role-home.* anchors (Platform TASK-017 components)
  -- additive attribute-only edits; flip shipped: true for all five in this same PR (ADR-008)
wire welcome modal + tour.plat.role-home (variant by resolved path, m1/TASK-006)
guidance_beacon.visible = item.open && anchor.shipped && anchor.present && !dismissed
  -- item state from M1 GET /api/onboarding/checklist; completion via existing
  -- self-mark endpoint (source=manual, ON CONFLICT DO NOTHING — no new write path)
```

## API Contracts

None new. Checklist state via M1 `GET/PUT /api/onboarding/checklist`; manual completion via the
M1 self-mark endpoint (m1/TASK-010, `source=manual`). No CE contract consumed (the former
FR-037 named-query reference was a phantom — m2-delta §1 OQ-M2-1).

## Diagram

m2-delta.md §2 (rows 2/4) and §5 (competency-guidance path — manual); business-process.md
§Checklist (self-mark write path, unchanged from M1); Platform m2-delta §7 (role-home sections
the tour walks).

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Competency item is manual self-mark, not auto-clear | CE M2 ships the framework question set only — no per-tenant count of declared domain CQs exists to evaluate; a Must-Have cannot rest on a phantom query in a Should-Have task | m2-delta §1/§5 (OQ-M2-1 amended); red-team fix 2/3 |
| Beacon derives from checklist server state | One source of truth; client never computes trust/model signals | m2-delta §5 |
| All five role-home anchors planted here, shipped flipped same PR | Single planting owner ends the TASK-002/003 double-plant; audit-enforced atomicity | ADR-008, m2-delta §3 |
| Guidance variant keyed off M1 resolved path | No new role logic; EPIC-003 totality invariant untouched | m1/TASK-006 |
| Auto-clear deferred post-v1 behind a CE escalation | Reinstate `ce_signal` only when CE models declared CQs as countable individuals + publishes a named count query id/shape | OQ-M2-1 escalation |

## Test Requirements

Minimum: 4 unit, 2 integration, 2 E2E.

| Layer | Scenario | AC |
|---|---|---|
| Unit | should select tour copy variant per resolved path (4-path matrix) | AC-003-01 |
| Unit | should show guidance beacon only while item open, anchor shipped+present, not dismissed | AC-003-03/04/05 |
| Unit | should hide beacon when item complete or beacon dismissed | AC-003-03 |
| Unit | should not offer tour/modal/beacon while any referenced anchor is shipped false | AC-003-05 |
| Integration | should complete item exactly once via self-mark (idempotent re-mark) and serve beacon-hidden state after | AC-003-03 |
| Integration | should serve beacon visibility from checklist API with zero CE client calls (stub asserts no CE traffic) | AC-003-04 |
| E2E | should run role-home tour per path with axe zero-violations per step and modal focus trap asserted (Tab cycle + Esc + focus return) | AC-003-01/02/06 |
| E2E | should show guidance beacon while item open, self-mark from the deep-linked article flow, and see the beacon gone | AC-003-03 |

## Dependencies

- **blocked_by**: TASK-001 (checklist item, anchors, copy, training article)
- **unlocks**: TASK-005
- **External (DoR, not DAG):** Platform M2 TASK-017 merged (role-home exists to plant on).
  Until this task plants and flips the five anchors they stay `shipped: false`, so nothing
  renders (ADR-008) — config-first merge stays safe. **No CE dependency** (CE M2 TASK-010 is
  authority-descoped and ships no count; nothing here consumes it).

## Cost Estimate

- **Complexity:** S (was M — the backend half is gone; role-variant tour + beacon wiring on M1
  rails)
- **Estimated tokens:** ~9k input, ~4k output (claude-sonnet-5)

## DoR Checklist

- [ ] TASK-001 merged (manual checklist item + anchors + training article in config)
- [ ] Platform TASK-017 merged, or task explicitly deferred with anchors left `shipped: false`
- [ ] Training-library article route confirmed (deep-link target, onboarding-owned)
- [ ] Per-path guidance copy approved (4 variants)

## DoD Checklist

- [ ] All ACs pass incl. self-mark idempotency and the no-CE-traffic assertion
- [ ] data-tour-id attributes merged in Platform role-home components with `shipped` flipped
      same PR; both-ways audit green
- [ ] Zero backend changes in this task's diff (no endpoints/tables/schema/poller edits)
- [ ] axe zero-violations on modal (incl. focus trap), every tour step, and beacon state
- [ ] Coverage ≥ 80%, mutation ≥ 60% on new wiring logic (defaults, tunable)

## Implementation Hints

The beacon must derive from the checklist item's server state, not any second fetch or local
flag — one source of truth. Reuse the M1 modal machinery's focus-trap implementation
(m1/TASK-008) and assert it explicitly in E2E rather than trusting the library default. Plant
all five attributes and the five `shipped` flips in one commit so the audit passes atomically.
Do not reintroduce any count logic "while you're in there" — auto-clear returns only via the
OQ-M2-1 CE escalation, post-v1.
