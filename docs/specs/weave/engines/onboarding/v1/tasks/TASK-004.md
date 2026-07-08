---
type: Task Brief
title: "Task: TASK-004 — Trust-Mechanics Tours (versions/diff, overlays, governed filters, rules screen)"
description: "tour.ge.trust-mechanics over the GE M2 versions panel (incl. compare/diff),
  overlay controls and governed-content filters, plus tour.ce.rules-policies over the CE M2
  rules & policies screen — the provenance/confidence-signal guidance of the M2 legibility
  window. Red-team remediated 2026-07-08: diff-toggle and run-report anchors removed (owners
  ship no such discrete DOM elements — re-anchored per m2-delta §3)."
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

Engine spec: [onboarding.md](../../../onboarding.md) §M2 window row 3 · Delta:
[m2-delta.md](../../tech-spec/m2-delta.md) §2–§3 · Owning surfaces: GE v1 TASK-001 (filters),
TASK-002 (overlay engine), TASK-003 (versions + diff); CE v1 TASK-006 (rules & policies screen).

## Story

As a compliance officer or sceptical stakeholder, I want guided tours of the trust surfaces —
version history, diffs, governed-content filters, overlays, and the rules & policies screen —
so I can verify for myself where an answer came from and which rules it currently violates.

## Scope Note

Two tours, pure wiring on M1 machinery: `tour.ge.trust-mechanics` (Explorer area: versions
panel incl. compare/diff → governed-content filter → overlay controls) and
`tour.ce.rules-policies` (CE area: shape list → violation report, whose step copy explains the
auto-run/"validation pending" report state — CE ships no run-report control). One beacon on
`ge.versions.panel` (compare/diff is the least-discoverable trust mechanic; the former
diff-toggle and run-report beacon targets do not exist as DOM elements — m2-delta §3
re-anchoring note). Attribute planting on the **four** anchors this task owns per m2-delta §3
(`ge.versions.panel`, `ge.filters.governed-content`, `ce.rules.shape-list`,
`ce.rules.violation-report` — `shipped` flipped same PR, ADR-008); `ge.overlay.controls` is
consumed only (planted by TASK-002). Glossary/brand UIs explicitly excluded (OQ-M2-2). No data
reads — owning surfaces render `CE-VERSION-1`/`CE-DIFF-1`/`GET /api/validate`; onboarding
points.

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-004-01 | WHEN a user starts `tour.ge.trust-mechanics` THE SYSTEM SHALL step versions panel (covering version selection and two-version compare/diff in its copy) → governed-content filter → overlay controls with all M1 TourEngine invariants (skip/resume server-side, keyboard, step indicator, ≤ 200 ms transitions — defaults, tunable). |
| AC-004-02 | WHEN a user starts `tour.ce.rules-policies` THE SYSTEM SHALL step shape list → violation report, and the violation-report step SHALL explain that the full report runs automatically with a "validation pending" state — instructing without requiring any interaction (M1 never-requires-interaction invariant; no run-report control exists). |
| AC-004-03 | WHEN the versions panel renders THE SYSTEM SHALL show the compare/diff-discoverability beacon on `ge.versions.panel` until dismissed, dismissal persisted server-side per `(tenant, user)`. |
| AC-004-04 | WHILE any anchor a tour references is `shipped: false` THE SYSTEM SHALL not offer that tour (per-anchor gating, ADR-008) — the GE tour and CE tour flip independently (different owning surfaces), never a half-enabled tour; IF an anchor is absent at runtime THEN THE SYSTEM SHALL skip/hide with a logged warning. |
| AC-004-05 | WHEN tours are offered THE SYSTEM SHALL role-tailor: trust-mechanics tagged for all four paths; rules-policies tagged Compliance + Technical (Business/Admin reach it from the help launcher, not proactive offer) — tags from TASK-001 config, no dead "Take tour" CTA on any path. |
| AC-004-06 | WHEN either tour or beacon renders THE SYSTEM SHALL pass axe WCAG 2.1 AA zero-violations, keyboard-navigable, i18n keys + design tokens only, `ui_verify` passes. |

## Pseudocode

```text
plant data-tour-id on: ge.versions.panel, ge.filters.governed-content,
                       ce.rules.shape-list, ce.rules.violation-report
  -- additive attribute-only edits; flip shipped: true for all four in this same PR (ADR-008)
consume ge.overlay.controls (planted + shipped by TASK-002 — do not re-plant)
wire tour.ge.trust-mechanics (Explorer area) + tour.ce.rules-policies (CE area) into TourEngine
wire 1 beacon (ge.versions.panel); add help-launcher entries for both tours
```

## API Contracts

None new. Resume/dismissal via M1 `/api/onboarding/*`. Owning surfaces consume `CE-VERSION-1`,
`CE-DIFF-1`, `GET /api/validate` (contracts.md) — onboarding calls none of them.

## Diagram

m2-delta.md §2 (surface map row 3); GE m2-delta §6 (VP Versions Panel, OV Overlay Engine, FP
Filter Panel components); business-process.md §Tour Lifecycle (unchanged).

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Two tours, not one cross-engine tour | Tours gate per-anchor and flip per owning surface; a combined tour would half-enable when one engine lags | ADR-005, ADR-008, AC-004-04 |
| Glossary/brand excluded | Authoring surfaces, not trust mechanics; keeps M2 at the roadmap's three overlays | OQ-M2-2 (m2-delta §1) |
| Diff-toggle/run-report anchors dropped, panel-level re-anchor | Neither exists as a discrete DOM element (GE diff activates via version selection in the panel; CE report auto-runs with a pending state) — anchoring to phantom controls was unverifiable | m2-delta §3 re-anchoring note; red-team fix 4 |
| One beacon, on the versions panel | Beacon budget discipline — beacons are for what users miss, not decoration; with no run-report control the CE beacon has no target | EPIC-002 notes |
| Rules tour never triggers a real report | Advance-requires-interaction is banned (M1); report runs cost CE compute | m1/TASK-007 AC-007-03 |

## Test Requirements

Minimum: 3 unit, 1 integration, 2 E2E.

| Layer | Scenario | AC |
|---|---|---|
| Unit | should gate GE tour off while CE tour stays on when only CE anchors shipped (and inverse) | AC-004-04 |
| Unit | should offer rules-policies proactively only on Compliance/Technical paths | AC-004-05 |
| Unit | should skip an absent trust anchor with warning, never block | AC-004-04 |
| Integration | should persist versions-panel beacon dismissal server-side | AC-004-03 |
| E2E | should run trust-mechanics tour end-to-end with axe zero-violations per step | AC-004-01/06 |
| E2E | should run rules-policies tour without triggering a report run | AC-004-02/06 |

## Dependencies

- **blocked_by**: TASK-001 (config + anchors + copy)
- **unlocks**: TASK-005
- **External (DoR, not DAG):** GE v1 TASK-001/002/003 merged (filters, overlays, versions);
  CE v1 TASK-006 merged (rules screen). Anchors stay `shipped: false` until planted here, so
  each tour gates off independently until its surface set lands (ADR-008). The GE tour's
  overlay-controls step additionally needs TASK-002's `ge.overlay.controls` flip.

## Cost Estimate

- **Complexity:** S (two tours + two beacons on M1 rails; attribute planting across two engines)
- **Estimated tokens:** ~9k input, ~4k output (claude-sonnet-5)

## DoR Checklist

- [ ] TASK-001 merged (anchors + both tour configs green in CI)
- [ ] GE v1 TASK-001/002/003 and CE v1 TASK-006 merged, or tours explicitly left unshipped
      (`shipped: false`)
- [ ] CE rules-screen anchor placement sanity-checked against the built screen (ids inferred from CE TASK-006 prose — m2-delta §3 caveat)
- [ ] Role-tagging for rules-policies (Compliance + Technical proactive) confirmed with PO copy

## DoD Checklist

- [ ] All ACs pass; independent per-tour gating verified both directions
- [ ] data-tour-id attributes merged in GE + CE components with `shipped` flipped same PR;
      both-ways audit green
- [ ] No data reads added; no new endpoints/components beyond attributes + wiring
- [ ] axe zero-violations on every step and beacon state
- [ ] Coverage ≥ 80%, mutation ≥ 60% on wiring logic (defaults, tunable)

## Implementation Hints

The versions panel and overlay controls may be collapsed/closed when the tour starts — reuse
the M1 pattern of tour-step `onBefore` hooks opening the owning panel via its public toggle
(never reaching into panel internals). If the CE screen merged with different control structure
than the inferred anchors, move the attribute, keep the anchor id — the id is semantic, the
audit only cares that registry and code agree. Plant each surface set's attributes and their
`shipped` flips in one commit; never flip an anchor another task owns (`planted_by` is the
single-owner claim).
