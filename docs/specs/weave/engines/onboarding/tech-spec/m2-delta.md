---
type: TechSpec
title: "Onboarding — M2 Tech-Spec Delta"
description: "Changes-only delta over the M1 tech spec for the Onboarding M2 window: three
  legibility/trust overlays (completeness-map tour, role-home guidance, trust-mechanics tours)
  plus the competency-question guidance item. No new services, contracts, endpoints, schema or
  infra — M1 machinery (Driver.js wrapper, anchor registry, content config, checklist) attached
  to committed CE/Platform/GE M2 surfaces. Red-team remediated 2026-07-08 (per-anchor shipped
  signal ADR-008; competency flag descoped to manual — CE ships no per-tenant count)."
status: Draft
date: 2026-07-08
entity: onboarding
milestone: m2
---

# Onboarding — M2 Tech-Spec Delta

Changes-only. Everything not stated here is unchanged from
[`architecture.md`](architecture.md), [`data-model.md`](data-model.md),
[`business-process.md`](business-process.md), [`testing-strategy.md`](testing-strategy.md) and
ADR-001..007.

**Governing principle (binding on every M2 task):** Onboarding M2 is pure overlay content — no
new services, no new contracts, no new framework. Every task attaches M1 machinery (tour engine
M1 TASK-007, beacons/modals M1 TASK-008, anchor registry + content CI M1 TASK-003, checklist
M1 TASK-010) to a named other-engine M2 surface. A task that invents infrastructure is out of
scope.

## 1. Open questions closed at M2

| # | Question | Disposition (coordinator-approved 2026-07-08) |
|---|---|---|
| OQ-M2-1 | Where does the "< 2 domain competency-questions" flag (CE M2 TASK-010 AC-010-07) render? | *(Amended 2026-07-08, red-team.)* Checklist item **"Add domain competency questions"** (manual self-mark — the existing `autoCompleteOn: "manual"` member, M1 OQ-08 machinery) **plus** a beacon on the role-home completeness tile keyed off the item's open/complete state. The original auto-clear rested on a phantom "FR-037 named count query": CE M2 TASK-010 ships the framework question **set**, not a per-tenant **count** — "declared domain competency question" is not modelled as a countable individual and no query id/shape exists. Auto-clear is a **post-v1 upgrade** contingent on CE modelling declared CQs as countable individuals + publishing a named count query (escalated to CE). Deep-link: the onboarding training-library article "Declare your domain competency questions" (no CE authoring surface exists — escalated). |
| OQ-M2-2 | Do trust-mechanics tours cover CE glossary/brand UIs (CE M2 TASK-002/004)? | **No.** Those are authoring surfaces, not trust mechanics; their tours are v1/post-v1 content. M2 stays at the roadmap's three overlays. |
| OQ-M2-3 | New ADR needed? | **No.** ADR-001 (Driver.js wrapper), ADR-005 (anchors), ADR-006 (code-shipped content) cover all M2 mechanics; M2 is content on new surfaces. |
| OQ-M2-4 | Gate posture (roadmap: "no separate HITL gate") | Ships as a **v1-interim overlay release inheriting the M1 gate floors** (WCAG 2.1 AA zero axe violations, coverage ≥ 80% / mutation ≥ 60%, defaults tunable); human sign-off folds into the program gate. |

## 2. Surface map (normative — every M2 overlay attaches here)

| Overlay | Owning surface (committed brief) | Data the surface renders | Onboarding consumes |
|---|---|---|---|
| Model-completeness map tour + beacons (EPIC-002) | GE M2 TASK-008 completeness overlay (Explorer); Platform M2 TASK-017 role-home completeness tile | GE overlay: `CE-READ-1` `coverage_gap` rows only; Platform tile: `CE-METRICS-1` + `coverage_gap` | Anchors on the owning panels only (§3); no data reads of its own |
| "What can Weave do for you" role-home guidance (EPIC-003) | Platform M2 TASK-017 role-home route (EPIC-010) | `CE-METRICS-1`, availability registry, M1 RBAC role matrix | Resolved role path (M1 TASK-006) selects the guidance variant |
| Trust-mechanics tours (EPIC-002) | GE M2 TASK-003 (versions panel + diff), TASK-002 (overlay engine: heatmap/domain colour), TASK-001 (governed-content filters); CE M2 TASK-006 (rules & policies screen + full validation report) | `CE-VERSION-1`/`CE-DIFF-1`, `GET /api/validate` | Anchors only |
| Competency-question guidance (EPIC-003) | Rendered by onboarding itself: manual checklist item + role-home-tile beacon | None — no CE read (§5; OQ-M2-1 amended) | Item state via the M1 checklist API; beacon keys off the same state |

Explicit non-scope: Build M2 is API-only (SDK, ceremonies — UI lands v1.0) → no Build overlay
this window. CE glossary/brand tours excluded per OQ-M2-2. E3-S2's Business-path
`CE-METRICS-1` starter tile un-omits via Platform's availability registry + starter-widget
behaviour — **owned by Platform E1-S6, Platform M2 TASK-010 (AC-8), not TASK-017** — zero
onboarding build; one E2E assertion verifies it (§7).

## 3. Anchor-registry delta (ADR-005 + ADR-008 — `phase: "m2"` entries with per-anchor `shipped`)

New `packages/shared` `onboarding/anchors.ts` entries — **11 anchors** (red-team 2026-07-08:
three "control" anchors removed; their owning tasks ship no such discrete DOM element — see
re-anchoring note below). IDs are normative; task briefs may add but not rename. Anchors attach
to **DOM panels/controls only — never canvas-rendered internals** (GE canvas nodes have no DOM;
ADR-005 anchors require an element).

Each entry carries `{ engine, area, phase: "m2", shipped: boolean, planted_by: TASK-NNN }`
(ADR-008). `shipped` starts `false` and flips `true` in the **same PR** in which `planted_by`
plants the `data-tour-id` attribute; exactly one planting owner per anchor.

| Anchor id | Engine / surface | `planted_by` (onboarding m2) |
|---|---|---|
| `plat.role-home.nav-entry` | Platform — role-home primary-nav item (Platform TASK-017) | TASK-003 |
| `plat.role-home.capabilities` | Platform — capabilities card section (TASK-017) | TASK-003 |
| `plat.role-home.completeness-map` | Platform — completeness-map tile (TASK-017; also the competency-guidance beacon target; consumed by TASK-002's tile beacon) | TASK-003 |
| `plat.role-home.next-action` | Platform — next-action banner (TASK-017) | TASK-003 |
| `plat.role-home.summary-tiles` | Platform — modelled-summary tile grid (TASK-017) | TASK-003 |
| `ge.overlay.controls` | GE — overlay panel section listing overlay toggles (GE TASK-002 within the TASK-001 panel shell; shared by completeness + trust tours) | TASK-002 |
| `ge.overlay.completeness-legend` | GE — coverage-gap legend (GE TASK-008; renders while overlay active) | TASK-002 |
| `ge.versions.panel` | GE — versions panel incl. version selection + compare/diff affordance (GE TASK-003) | TASK-004 |
| `ge.filters.governed-content` | GE — governed-content filter group (GE TASK-001) | TASK-004 |
| `ce.rules.shape-list` | CE — rules & policies shape list (CE TASK-006) | TASK-004 |
| `ce.rules.violation-report` | CE — per-rule violation coverage (severity + counts + expandable violating-entity list, CE TASK-006 AC-006-03/05) | TASK-004 |

**Re-anchoring note (red-team fix).** Removed: `ge.overlay.completeness-toggle` (GE TASK-002
renders overlay toggles as generated rows, not a discrete completeness element — completeness
tour/beacon re-anchored to `ge.overlay.controls`); `ge.versions.diff-toggle` (GE TASK-003
activates diff by selecting two versions inside the versions panel; no toggle element —
re-anchored to `ge.versions.panel`); `ce.rules.run-report` (CE TASK-006 auto-runs the report
with a "validation pending" state; no run-report control exists — the rules tour steps
shape-list → violation-report, and the CE beacon is dropped). No owning-engine change required.

Placement mechanism per ADR-005/ADR-008: the `data-tour-id` attributes land in the owning
engine's component code via the onboarding task named in `planted_by` (additive attribute-only
edits); the both-ways CI audit fails when (a) a `shipped: true` entry has no matching attribute
in code, or (b) an attribute exists whose entry is missing or still `shipped: false` — so the
flip is atomic with the plant, and a later owner refactor that drops a planted anchor goes red
on that PR. A tour/beacon/modal is offered only when **all** its anchors are `shipped: true`;
tours over different surfaces flip independently. `phase` is descriptive metadata only.

## 4. Content-config delta (ADR-006 — zero schema change)

- New tours: `tour.ge.completeness-map`, `tour.plat.role-home`, `tour.ge.trust-mechanics`
  (versions/diff/filters/overlays), `tour.ce.rules-policies` — existing `Tour` schema,
  role-tailored via existing `paths` tags, copy budgets and step guidelines unchanged.
- New beacons on the §3 anchors; new welcome modal for the role-home area (first visit —
  existing modal machinery, M1 TASK-008).
- New checklist item `checklist.add-competency-questions` (paths: Business + Technical;
  `autoCompleteOn: "manual"` — the existing M1 enum member and self-mark machinery, OQ-08
  pattern; deep-link: the onboarding training-library article "Declare your domain competency
  questions").
- **Schema delta: none.** The previously planned `"ce_signal"` member is removed with the
  competency-flag descope (OQ-M2-1 amended, §5) — the M1 zod schemas ship M2 unchanged.

## 5. Competency-question guidance path (OQ-M2-1, amended 2026-07-08)

Onboarding renders a **manual** guidance item, entirely on M1 rails: the checklist item is open
by default for Business/Technical paths; the user self-marks it complete (M1 `source=manual`
self-mark, same `ON CONFLICT DO NOTHING` idempotent write as every completion); the role-home
tile beacon shows while the item is open and hides on next render once it completes (or when
independently dismissed — M1 beacon-dismissal machinery). **No CE read, no poller extension, no
count, no fail-quiet path exists** — there is nothing to fail silently. The former design (CE
count auto-clear on the ADR-004 poll cycle) rested on a named count query CE M2 TASK-010 does
not ship; reinstating auto-clear is a post-v1 upgrade gated on the CE escalation recorded in
§1 OQ-M2-1.

## 6. Endpoint + page targets (Arch Laws 2, 3)

- **Endpoints: zero new.** All state rides the M1 `/api/onboarding/*` router (M1 TASK-001);
  existing p95 targets unchanged. The competency-guidance item uses the M1 checklist +
  self-mark endpoints as-is (§5) — no CE read on any onboarding path this window.
- **Pages: zero new.** Overlays render on owning engines' pages and inherit their gates
  (Platform role-home/dashboard: Lighthouse 100 all categories + axe 0, per Platform m2-delta
  §8; GE pages per GE m2-delta §5). Onboarding-specific obligation (M1 invariant, restated):
  with any overlay open, the page still passes axe WCAG 2.1 AA zero-violations and remains
  keyboard-navigable; tour step transition ≤ 200 ms (default, tunable) on the new surfaces.

## 7. Testing delta (extends testing-strategy.md)

- Unit: per-anchor shipped gating (ADR-008 — tour offered iff all anchors `shipped: true`;
  audit fails on shipped-without-attribute and attribute-without-shipped); config CI fixtures
  extended with the §3 anchor set + §4 content.
- Integration: competency-guidance lifecycle (item open → manual self-mark → completed once,
  idempotent re-mark; beacon visibility keyed off the item's server-side state).
- E2E (Playwright, existing lane): one tour E2E per new surface (role-home, completeness map,
  trust-mechanics GE, rules & policies CE); absent-anchor resilience re-run over the M2 anchor
  set; role-tailoring matrix on role-home guidance (4 paths); axe zero-violations with each
  overlay open, incl. welcome-modal **focus trap** (focus enters on open, cannot escape while
  open, Esc closes, focus returns to the trigger); **one assertion** that the Business-path
  CE-METRICS-1 starter tile is no longer omitted (E3-S2 flip, Platform M2 TASK-010 behaviour —
  verify-not-build); release-gate assertion that every §3 anchor is `shipped: true`.
- Floors unchanged: coverage ≥ 80%, mutation ≥ 60% (defaults, tunable). Law F unchanged:
  in-process app, stubbed PLAT-*/CE clients, no cloud.

## 8. Delivery (Arch Law 9 — explicit no-new-infra decision)

No new services, queues, tables, schema members, env vars, or workflows. M2 content and tests
ride the existing CI lanes (content-config checks, anchor audit, E2E). No env-schema or
workflow-stub delta; drift check n/a this window.

## 9. Invariants delta (feeds `invariants.md`, Arch Law 10)

- M2 tours/beacons target only §3 registry anchors; canvas internals are never anchor targets.
- Per-anchor shipped signal (ADR-008): `shipped` flips in the planting PR; audit red on
  shipped-without-attribute AND attribute-without-shipped; overlays gate on all-anchors-shipped.
- Competency-question guidance: rendered by onboarding only (manual checklist item + beacon);
  no CE read, no schema change; beacon derives from the item's server-side state.
- Overlay-open pages keep their owning engine's Lighthouse/axe gate; modals trap focus and
  return it on close.
- E3-S2 tile flip is Platform availability-registry/starter-widget behaviour (Platform M2
  TASK-010, E1-S6) — onboarding asserts, never implements.

---

*Onboarding M2 delta — Technical Architect. Review and approve before task decomposition.*
