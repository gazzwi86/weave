---
type: Task Brief
title: "Task: TASK-002 — Model-Completeness Map Tour + Beacons (Explorer overlay + role-home tile)"
description: "tour.ge.completeness-map on the GE M2 coverage_gap overlay plus beacons on the
  Explorer overlay controls/legend and the Platform role-home completeness tile — GE anchors
  planted here (shipped flag flipped in the same PR, ADR-008), tile anchor consumed from
  TASK-003, rendering via the M1 TourEngine/beacon machinery, zero new data reads."
tags: [onboarding, arch, task, v1]
status: Backlog
priority: Must Have
entity: onboarding
epic: EPIC-002
milestone: v1
created: 2026-07-08
blocked_by: ["TASK-001"]
unlocks: ["TASK-005"]
adr_refs: [ADR-001, ADR-005, ADR-006, ADR-008]
source: hand-authored
confirmed_by: none
confirmed_on: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: n/a
---

Engine spec: [onboarding.md](../../../onboarding.md) §M2 window row 1 · Delta:
[m2-delta.md](../../tech-spec/m2-delta.md) §2–§3 · Owning surfaces: CE v1 TASK-021 (overlay
panel) + TASK-008 (completeness overlay), Platform v1 TASK-017 (role-home completeness tile).

## Story

As an author or BA, I want a guided tour and persistent beacons on the model-completeness map,
so I can find and understand the gaps view (which entities lack required links) the first time
I meet it, in Explorer or on my role-home.

## Scope Note

Pure overlay wiring: tour + beacons from TASK-001 config rendered by the M1 TourEngine
(m1/TASK-007) and beacon machinery (m1/TASK-008), plus planting `data-tour-id` attributes on
the two GE anchors this task owns per m2-delta §3 — `ge.overlay.controls` and
`ge.overlay.completeness-legend` (additive attribute-only edits, `shipped` flipped in the same
PR, ADR-008). The tile anchor `plat.role-home.completeness-map` is **planted by TASK-003**
(single planting owner); this task only wires the tile beacon against it, which renders once
TASK-003 flips it shipped. No data reads: the GE overlay renders `CE-READ-1 coverage_gap`; the
Platform tile renders `CE-METRICS-1` + `coverage_gap`; onboarding points at them. The
competency-guidance beacon on the same tile is TASK-003 (it keys off checklist state).

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-002-01 | WHEN a user on any path opens Explorer with the completeness overlay available THE SYSTEM SHALL offer `tour.ge.completeness-map` (welcome-modal CTA + help-launcher entry), covering overlay controls (enable Completeness here) → legend → gap-drill, spotlight + tooltip + Back/Next + step indicator, skippable and resumable (all M1 TourEngine invariants inherited). |
| AC-002-02 | WHEN the Explorer overlay panel renders THE SYSTEM SHALL show beacons on `ge.overlay.controls` ("New: Completeness overlay") and `ge.overlay.completeness-legend` until dismissed; dismissal SHALL persist server-side per `(tenant, user)` (M1 TASK-008 machinery). |
| AC-002-03 | WHEN the role-home completeness tile renders THE SYSTEM SHALL show a first-visit beacon on `plat.role-home.completeness-map` linking "See gaps in Explorer" — a plain deep-link to the Explorer route (CE v1 TASK-027 exposes no overlay-on URL state); the `ge.overlay.controls` beacon (AC-002-02) picks the user up there, and the beacon copy SHALL say the overlay is enabled from the Layers panel. |
| AC-002-04 | IF any anchor is absent at runtime THEN THE SYSTEM SHALL skip/hide with a logged warning; WHILE any anchor a tour/beacon references is `shipped: false` THE SYSTEM SHALL not offer it (per-anchor gating, ADR-008) — never a broken or half-rendered overlay. |
| AC-002-05 | WHEN the tour or any beacon is open THE SYSTEM SHALL pass axe WCAG 2.1 AA zero-violations and remain fully keyboard-navigable; step transition ≤ 200 ms (default, tunable); i18n keys + design tokens only, `ui_verify` passes. |

## Pseudocode

```text
plant data-tour-id on: ge.overlay.controls + ge.overlay.completeness-legend (GE components)
                       -- additive attribute-only edits; flip shipped: true for BOTH in
                       -- this same PR (ADR-008; audit enforces atomicity)
tile anchor plat.role-home.completeness-map: consumed only (planted + shipped by TASK-003)
wire tour.ge.completeness-map into TourEngine area config (Explorer area)
wire beacons (3) into beacon renderer config (tile beacon renders once TASK-003 ships anchor)
add help-launcher + welcome-modal CTA entries for the Explorer completeness tour
```

## API Contracts

None new. Beacon dismissal + tour resume ride the M1 `/api/onboarding/*` router (m1/TASK-001).
The GE overlay consumes `CE-READ-1 coverage_gap`; the Platform tile consumes `CE-METRICS-1` +
`coverage_gap` (contracts.md) — onboarding calls neither.

## Diagram

m2-delta.md §2 (surface map row 1); business-process.md §Tour Lifecycle (unchanged state
machine); GE m2-delta §6 (owning component layout: CG Completeness Overlay, FP Filter Panel).

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Onboarding never reads coverage_gap itself | Owning surfaces render the data; overlay points at it — no duplicate data path | m2-delta §2 |
| GE attributes planted here, shipped flipped same PR | Single planting owner per anchor; shipped-keyed audit makes post-plant drift red and pre-plant no-op impossible | ADR-005, ADR-008 |
| Beacon + tour step target `ge.overlay.controls`, not a completeness toggle | GE renders overlay toggles as generated rows — no discrete completeness-toggle element ships; the panel section is the stable DOM | m2-delta §3 re-anchoring note |
| Tile beacon deep-links to the plain Explorer route | GE-008 has no URL state to auto-enable the overlay; the controls beacon completes the handoff without a GE change | m2-delta §3, AC-002-03 |

## Test Requirements

Minimum: 3 unit, 1 integration, 2 E2E.

| Layer | Scenario | AC |
|---|---|---|
| Unit | should offer completeness tour only when all its anchors are shipped (per-anchor, ADR-008) | AC-002-01/04 |
| Unit | should skip absent completeness anchor with warning, never block | AC-002-04 |
| Unit | should render tile beacon with plain Explorer deep-link when tile anchor shipped + present | AC-002-03 |
| Integration | should persist beacon dismissal server-side and not re-show | AC-002-02 |
| E2E | should run completeness tour end-to-end with axe zero-violations per step | AC-002-01/05 |
| E2E | should dismiss toggle beacon, reload, stay dismissed | AC-002-02 |

## Dependencies

- **blocked_by**: TASK-001 (config + anchors + copy)
- **unlocks**: TASK-005
- **External (DoR, not DAG):** CE v1 TASK-021/027 merged (overlay panel + completeness overlay
  exist to plant on); Platform v1 TASK-017 merged (tile exists — its anchor is planted by
  onboarding TASK-003). Until this task plants and flips its GE anchors they stay
  `shipped: false`, so nothing renders (ADR-008) — this task can still merge config-first; the
  tile beacon activates when TASK-003 flips the tile anchor.

## Cost Estimate

- **Complexity:** S (wiring + attribute planting; engine and machinery all M1)
- **Estimated tokens:** ~9k input, ~4k output (claude-sonnet-5)

## DoR Checklist

- [ ] TASK-001 merged (anchors + tour/beacon config green in CI)
- [ ] CE v1 TASK-021/027 + Platform TASK-017 merged, or explicitly deferred with anchors left
      `shipped: false`
- [ ] Design tokens for beacon/spotlight confirmed unchanged from M1 (`docs/standards/design/`)
- [ ] Plain Explorer deep-link route for "See gaps in Explorer" confirmed against GE routing

## DoD Checklist

- [ ] All ACs pass; axe zero-violations on every step and beacon state
- [ ] data-tour-id attributes merged in GE components with `shipped` flipped same PR; both-ways audit green
- [ ] No new endpoints, reads, or components beyond attribute edits + config wiring
- [ ] Coverage ≥ 80%, mutation ≥ 60% on any new wiring logic (defaults, tunable)

## Implementation Hints

Attribute edits to GE components must be surgical — the attribute and nothing else, so the
owning teams' reviews are trivial; flip `shipped: true` for both anchors in the same commit
(the audit will not let the two diverge). Reuse the M1 "renderable steps" counting so a
not-yet-shipped tile beacon never leaves a ghost step count. The tile deep-link is the plain
Explorer route — do NOT invent an overlay-on query param (GE-008 ships no URL state; if GE
later adds one, upgrading the link is a copy-level change).
