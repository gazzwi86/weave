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
