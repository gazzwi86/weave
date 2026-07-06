---
type: Task
title: "Task: TASK-003 — Anchor Registry + Content Config Package with CI Checks"
description: "packages/shared onboarding config: the typed data-tour-id anchor registry with
  phase tags, zod schemas for tours/beacons/modals/exercises/checklist/training/widget-mapping,
  i18n key discipline, and the CI checks (dead-CTA, copy budgets, anchor validity, registry↔code
  audit)."
tags: [onboarding, arch, task, phase-1, m1]
status: Backlog
priority: Must Have
entity: onboarding
epic: EPIC-002
milestone: m1
created: 2026-07-06
blocked_by: []
unlocks: ["TASK-007", "TASK-008", "TASK-009", "TASK-010", "TASK-012", "TASK-014"]
adr_refs: [ADR-005, ADR-006]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [onboarding.md](../../../onboarding.md) · Data model:
[data-model.md](../../tech-spec/data-model.md) §Content Config Schemas

## Story

As the onboarding content admin, I need tours, beacons, modals, exercises, checklist items, and
training entries defined as typed, CI-checked config, so content curation is a reviewed PR and
the cross-story defects (dead CTAs, half-enabled areas, over-budget copy, drifted anchors) fail
before merge instead of in front of a user.

## Scope Note

`packages/shared` only — no UI, no backend. Ships: (1) the `ANCHORS` registry
(anchor id → engine/area/phase) seeded with the M1 CE/Explorer anchor set plus phase-tagged
entries for known M2/post-v1 surfaces; (2) zod schemas per data-model.md §Content Config
Schemas; (3) the M1 content itself — CE + Explorer tour definitions, beacon set, welcome modals
(incl. no-tour areas Compliance/Settings with the no-tour CTA set), exercise definitions
(CE-01/02/03/03b, GE-01/02 with completion signals), per-path checklist item sets, training
library entries (placeholder cards + written-walkthrough metadata), What's-new items, and the
role→starter-widget mapping with engine-availability tags (E3-S2); (4) the CI checks as Vitest
suites + the repo-wide `data-tour-id` audit script. All copy = i18n keys with an `en` catalogue.
Rendering is TASK-007/008/010/012; `data-tour-id` attributes land in owning features' code as
those surfaces are touched.

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-003-01 | WHEN config references an anchor THE SYSTEM SHALL only admit registry keys — an unknown anchor id is a TypeScript compile error AND a zod/CI failure. |
| AC-003-02 | WHEN a welcome modal declares a "Take a tour" CTA THE SYSTEM SHALL fail CI unless a tour exists for that area; no-tour areas SHALL carry only "Explore freely" / "Read the guide" (dead-CTA reconciliation, EPIC-002 epic AC). |
| AC-003-03 | WHEN a tour tooltip exceeds 40 words or a beacon tooltip exceeds 60 (defaults, tunable constants beside the schema) THE SYSTEM SHALL fail CI, resolving budgets against the `en` catalogue. |
| AC-003-04 | WHEN any tour, beacon, exercise, or checklist item lacks a phase tag or role/path tag THE SYSTEM SHALL fail CI; CE-03 SHALL be tagged Technical-only and CE-03b Business (FR-016). |
| AC-003-05 | WHEN the audit script runs THE SYSTEM SHALL diff `data-tour-id` values in the frontend against the registry both ways and fail on unregistered attributes or shipped-phase registry entries missing from code. |
| AC-003-06 | WHEN any user-facing string is added as a literal instead of an i18n key THE SYSTEM SHALL fail the config lint (no hardcoded copy, PRD i18n NFR). |
| AC-003-07 | WHEN the widget mapping is read THE SYSTEM SHALL expose per-path widget sets each carrying an engine-availability tag; the Business CE-METRICS-1 tile is tagged `m2` (graceful-omit until then). |

## API Contracts

None at runtime — config is build-time input. The exercise completion signals cite `CE-READ-1`
(sparql_ask), `CE-WRITE-1` (write_commit), `GE-CANVAS-1` (canvas_state) by contract ID in data.

## Diagram

architecture.md §Level 2 — the "Content + anchor config" container; schema excerpts in
data-model.md §Content Config Schemas.

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| `data-tour-id` + typed registry, phase tags | Kills anchor drift at PR time; phase tags drive uniform flag-off | ADR-005 |
| Content as code, PR-curated, zod-validated | Cross-story defects become deterministic CI failures | ADR-006 |
| Copy budgets as tunable constants | PRD "default X, tunable" discipline | PRD §2.4 |
| Post-v1/M2 anchors registered now, no DOM | Tours authorable early; flagged off by phase, nothing dangles | ADR-005 |

## Test Requirements

| Layer | Scenario | AC |
|---|---|---|
| Unit | Each CI check has a failing fixture (dead CTA, over-budget copy, unknown anchor, missing tag, literal string) | AC-003-01..04/06 |
| Unit | Audit script: unregistered attribute fixture + missing-anchor fixture both fail | AC-003-05 |
| Unit | M1 content passes all checks (the real config is its own green test) | all |
| Unit | Widget mapping shape + availability tags | AC-003-07 |

## Dependencies

- **blocked_by**: none
- **unlocks**: TASK-007 (tours render config), TASK-008 (beacons/modals), TASK-009 (exercises),
  TASK-010 (checklist), TASK-012 (training), TASK-014 (widget mapping hand-off)

## Cost Estimate

**M** — schemas and checks are compact; the M1 content authoring (tour steps, exercise copy,
checklist sets, per the PRD's stories) is the volume.

## DoR Checklist

- [ ] ADR-005 and ADR-006 approved
- [ ] Design-system tokens available for reference in copy/structure guidelines
- [ ] CE/Explorer M1 screen inventory available to name the anchor set
- [ ] i18n key convention confirmed with the frontend package

## DoD Checklist

- [ ] All ACs pass; failing fixtures committed beside each check
- [ ] M1 anchor set + full M1 content committed and review-approved
- [ ] Audit script wired into frontend CI (fails PRs, not just nightly)
- [ ] `en` catalogue complete; zero literal user-facing strings
- [ ] Coverage ≥ 80%, mutation ≥ 60% on check modules

## Implementation Hints

Word-count budgets: count on the resolved `en` string, splitting on whitespace — don't count the
key. Keep the registry flat (`as const satisfies`) so `keyof` typing flows into the zod enums.
The audit script is a grep + set-diff — keep it dependency-free so it runs in any CI lane. Tour
step counts 5–12 are an authoring *guideline*: warn, don't fail (PRD tunable).
