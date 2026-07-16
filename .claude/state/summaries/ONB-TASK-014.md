# ONB-TASK-014 — Role -> Starter-Widget Mapping handed to Platform

## Status: done (tests-only closure)

## What was found

The mapping this task specs (`WIDGET_MAPPING`, `WidgetMappingSchema`, `WidgetSchema` with the
`shipped | m2 | post-v1` availability enum) was **already shipped** as part of
`ONB-TASK-003`'s content-config package (`packages/shared/onboarding/content/widget-mapping.ts` +
`schema.ts`), tagged `AC-003-07` in the code, and already had a unit test
(`packages/shared/tests/widget-mapping.test.ts`) covering AC-014-02/03 (per-path widget lists,
availability tags present, `CE-METRICS-1` tagged `m2`).

## What TASK-014 actually needed

The one gap against the task brief's Test Requirements table was the **Integration** row:
"Platform-side read returns mapping for resolved path (stub Platform reader)" (AC-014-01), plus an
explicit test that AC-014-04 ("fail CI if any entry lacks an availability tag") is enforced, not
just structurally implied.

Added `packages/shared/tests/widget-mapping-seam.test.ts`:

- `WidgetMappingSchema.parse(...)` throws when an entry omits `availability` (AC-014-04).
- A stub Platform reader (`(resolvedPath) => WIDGET_MAPPING[resolvedPath]`) resolves a widget list
  for every one of the 4 `ROLE_PATHS`, each entry carrying a valid availability tag (AC-014-01/02).

No production code changed — per the brief's Implementation Hint ("keep it plain exported const...
do not build endpoint speculatively"), no Platform-facing endpoint or reader function was built;
the stub lives only in the test, standing in for how Platform E1-S6 will consume the const.

## DoD

- All ACs covered by tests (AC-014-01/02/03/04); AC-014-03 already covered by the pre-existing
  TASK-003 test.
- "Platform team sign-off recorded on seam" is a process/DoD item outside engineer scope — flagging
  for the Platform team's own review of the seam, not resolved by this task.
- CI green: shared vitest (34/34 passing), frontend/shared eslint+tsc, backend ruff+mypy all clean.

## Notes for QA / next task

- No migration, no UI, no new endpoint — this was a documentation/test-completeness task closing
  out work TASK-003 had already substantially done.
- Branch `feature/ONB-EPIC-003` was fast-forwarded to `origin/main` (picked up TASK-004 sandbox
  provisioning + TASK-007/008 tour engine, already merged) before this commit — no conflicts with
  this task's file.

## Remediation (2026-07-12) — the "already shipped" mapping was wrong

A non-authoring review on PR #88 found the above closure was **incorrect**: the pre-existing
`WIDGET_MAPPING` from TASK-003 had 5 ad-hoc widget IDs (`CE-METRICS-1`, `CE-OVERVIEW-1`,
`CE-QUERY-1`, `GE-CANVAS-1`, `CE-RULES-1`) that did not match FR-015's actual widget list at all —
the earlier "tests-only closure" verified schema shape and availability-tag *presence*, but never
checked the widget IDs against FR-015's AC verbatim, so it passed a structurally-valid but
spec-incomplete mapping.

**Fix** (worktree `/Users/gareth/Sites/weave-ONB-003b`, commit `91bc4cf9`): replaced
`packages/shared/onboarding/content/widget-mapping.ts` with the verbatim FR-015 list, cross-checked
against `docs/specs/weave/engines/onboarding.md` E3-S2, the widget catalogue in
`weave-platform.md` E2-S1..S15, and `docs/specs/weave/contracts.md` for availability tags:

| Role | Widgets (id -> engine, availability) |
|---|---|
| Business | `ontology-health` -> constitution, `m2`; `graph-completeness` -> constitution, `m2` |
| Technical | `token-spend` -> platform, `shipped`; `active-projects` -> build, `post-v1`; `agent-activity` -> platform, `shipped` |
| Compliance | `compliance-status` -> constitution, `m2`; `audit-feed` -> platform, `shipped`; `self-improvement-findings` -> build, `post-v1` |
| Admin | `rbac-coverage` -> platform, `shipped`; `connector-health` -> platform, `post-v1`; `onboarding-progress` -> constitution, `m2` |

Widget IDs are kebab-case concept names (not opaque contract IDs) specifically so tests can assert
them verbatim against the spec's own wording.

**Availability-tag reasoning** (derived from contracts.md / weave-platform.md, not stated
verbatim in the task brief):

- `m2` — anything backed by `CE-METRICS-1` (ontology health, graph completeness, compliance
  status, onboarding progress). contracts.md pins CE-METRICS-1 GA at CE M2 regardless of the PRD
  story's own "MVP" label — contracts.md is authoritative per repo convention.
- `shipped` — backed by Platform services that ship at M1 with no upstream engine dependency
  (`PLAT-AUDIT-1`, `PLAT-IDENTITY-1`, `PLAT-SETTINGS-1`): audit feed, agent activity (CE-only
  slice per E2-S11's "WHERE only CE GA, show CE activity only"), RBAC coverage. Token spend is
  `shipped` because FR-034 pins the token *count* dimension to M1 explicitly (only the dollar-cost
  figure is post-v1).
- `post-v1` — Build-engine-gated (active projects, self-improvement findings — `BE-SELFIMPROVE-1`
  is a Build-owned contract) and connector health (`PLAT-CONNECTOR-1` "deferred to v1.0" verbatim
  in contracts.md).

No `EngineAvailabilitySchema` value exists for a "Build-GA-but-pre-v1.0" state — the schema only
has `shipped | m2 | post-v1`, so Build-gated items are tagged `post-v1` as the closest fit;
flagging in case Platform's E1-S6 consumer needs a finer-grained tag later.

**Test changes**: `packages/shared/tests/widget-mapping.test.ts` gained an AC-014-02 test that
asserts each role's widget-id array equals the FR-015 list verbatim (`toEqual`, order-sensitive),
not just schema-validity/availability-presence — this is what makes the test fail on an incomplete
mapping going forward. The pre-existing `CE-METRICS-1 m2`-tag test was updated to check both
`ontology-health` and `graph-completeness` (it previously checked a single literal `CE-METRICS-1`
id that no longer exists).

**Verification**: `npx vitest run` in `packages/shared` (8 files / 35 tests passed), `tsc --noEmit`
clean, `eslint .` 0 errors (2 pre-existing warnings in unrelated files). Full monorepo
pre-commit/pre-push hooks (backend ruff+mypy, frontend eslint+typecheck, semgrep,
anatomy-freshness) passed. Pushed to `origin/feature/ONB-EPIC-003`.

Did not touch `packages/backend`, auth, or migrations. Did not open/merge PR #88 — left for the
coordinator.
