# Progress: CE-V1-TASK-032 — Query & ask v2 (lifecycle states + Graph/Table/Raw results)

`constitution-engine` v1 EPIC-024 (sole task, closes the epic). Worktree
`../weave-CE-V1-EPIC-024`, branch `feature/CE-V1-EPIC-024` (off origin/main). Frontend-only.

## Outcome

DONE — 9/9 AC, all specified unit/integration tests passing (14 new + full 1261-test
suite green), lint 0 errors (304 pre-existing warnings unrelated to this task), typecheck
clean, backend ruff/mypy/pytest unaffected (frontend-only diff) but re-verified green anyway.

## Dependency check

`blocked_by: PLAT-V1-TASK-026` (Storybook design-system foundation) — confirmed merged to
`origin/main` via `PLAT-V1-EPIC-011` (`bbff92b7`), present in this branch's history. DoR
satisfied; `AskBar`, `GlassPanel`, `CanvasLegend` all existed and were reused.

## What shipped (3 commits, feature/CE-V1-EPIC-024)

- `test:` failing tests first — `use-ask-lifecycle.test.ts` (unit, AC-2 classification),
  `result-frame.test.tsx` (unit + AC-5/6/7), `page.test.tsx` (integration, AC-1/2/3/4/8/9).
- `feat:` the implementation —
  - `use-ask-lifecycle.ts` — explicit `submitting`/`provider-missing`/`timeout`/`error`/
    `success` state machine for `POST /api/query/nl`, replacing the old single-branch
    `use-nl-query.ts` (deleted). 503/502 classify as `provider-missing` (never generic
    `error`); a 15s `AbortController` timeout (tunable via a `timeoutMs` param, ponytail
    comment names the upgrade path to a server-advertised header) distinguishes `timeout`
    from `error`.
  - `result-frame.tsx` — Graph/Table/Raw toggle over one fetched result, local state only
    (test asserts `fetch` is never re-called on toggle), always-available "View SPARQL"
    `<details>` disclosure. Shared by both the NL ask panel and the hand-typed SPARQL
    editor's `runQuery` path (editor's `runPattern`/coverage-gap path is untouched,
    still plain `ResultsTable`, since it carries no single executed-SPARQL string).
  - `grounded-graph-view.tsx` — reuses the Explorer canvas's existing
    `highlightNodes`/`resetOpacity` adapter primitive (no new highlight mechanism, per the
    brief's hint) to glow grounded IRIs and dim non-matches; empty `grounded_iris` dims the
    whole canvas with a "No grounded matches for this answer" note instead of an error or
    blank canvas.
  - `version-select.tsx` — labelled `<select>` (`Version:`) fed by the existing
    `useVersions()` hook (`/api/proxy/ontology/versions`), replacing the unlabeled version
    text input on both the ask panel and the SPARQL editor.
  - `AskPanelTemplate.tsx` (new, `components/templates/`) — wraps the `AskBar` molecule +
    `GlassPanel` organism so `app/ce/query` stays inside the app-layer-boundary ESLint rule
    (`app/**` may only import templates/pages, never a raw molecule/organism directly —
    PLAT-V1-TASK-026's own AC-3/AC-6). Data-only props, no fetch/state, per the brief's
    "atomic-design constraint" design decision.
  - AC-9 (Run sole primary, Explain/coverage-gap secondary) needed **no editor change** —
    `SparqlEditorCard`'s buttons were already `variant="primary"`/`"secondary"` correctly;
    only added the named test.
- `test:` e2e — updated `tests/e2e/ce-query.spec.ts` for the new DOM (AskBar's "Ask a
  question" label, `result-frame`/`grounded-graph-canvas` testids, "View SPARQL"
  disclosure) and added `test_analyst_asks_question_sees_progress_then_grounded_graph_result`
  (AC-1/AC-6/AC-7) plus a provider-missing scenario (AC-2). Preserved the existing
  copy-to-editor and zero-gap-message E2E tests from CE-TASK-007 (not scoped to change,
  Law 3).

## Known gap — flag for backend follow-up (not a blocker)

The brief documents CE-READ-1's `POST /api/query/nl` success shape as including
`grounded_iris` (additive). The **actual deployed backend response** (per
`weave_backend`'s `NlQueryResponse` schema and the existing E2E mock) does **not**
populate this field today. Per the brief's Law 8 (brief is the contract-of-record) and
the "no new backend endpoints, UI-only" scope, I built AC-7's glow/dim path against the
brief's documented shape (`groundedIris` defaults to `[]` when absent) and tested both
branches with mocks. In production right now, every NL answer will show the **empty-case**
(whole-canvas-dimmed, "No grounded matches" note) until a backend task adds
`grounded_iris` to the real response. This is a backend follow-up, not a frontend defect —
flagging here since I can't touch `.claude/state/**` beyond this summary.

## Field-name note (brief hint confirmed)

The brief's pseudocode names the response fields `sparql`/`columns`/`grounded_iris`; the
**actual wire shape** (confirmed against `use-nl-query.ts`'s prior implementation and the
existing E2E mock) is `sparql_generated`/`column_names`(+ the new additive
`grounded_iris`). Built against the real shape, mapped to the existing camelCase
`AskResult`/`QueryResult` internal types, as the brief's own hint instructed.

## Gates run (this session)

- Frontend: `npm run lint` (0 errors, 304 pre-existing warnings across the repo,
  unrelated to this task), `npm run typecheck` (clean), `npm test` (250/250 files,
  1261/1261 tests green).
- Backend (unaffected by this frontend-only diff, re-verified anyway): poison-endpoint
  `pytest -m "not docker and not e2e"` (exit 0, 100%), `uv run ruff check .` (all checks
  passed), `uv run mypy src/ tests/` (no issues, 625 files).
- OKF validate (`docs/wiki`): conformant, 1 pre-existing tolerated warning.
- `ui_verify.sh --full` against a local dev server: **did not complete cleanly** — the
  script's own Playwright webServer spins up the full backend, which failed on
  `asyncpg.exceptions.InvalidAuthorizationSpecificationError: role "weave_app" does not
  exist` (local Postgres role not provisioned in this worktree's environment) across
  *every* spec in the suite (brand, build, canvas, ce-authoring, etc.), not just
  `ce-query` — a pre-existing local-env condition, not caused by this task's diff. Per the
  coordinator's guidance this is flagged, not treated as a blocking result; I did not
  force it green by weakening anything.
- Pre-commit/pre-push hooks (real gates, not bypassed): all 3 commits passed
  backend ruff+mypy, frontend lint+typecheck, anatomy/OKF/manifest checks at push.

## Files touched

`packages/frontend/app/ce/query/{page.tsx,ask-panel.tsx,result-frame.tsx,
grounded-graph-view.tsx,use-ask-lifecycle.ts,use-sparql-editor.ts,sparql-editor-card.tsx,
version-select.tsx,example-questions.ts}`, deleted `nl-question-card.tsx`/`use-nl-query.ts`,
new `packages/frontend/components/templates/AskPanelTemplate.tsx`, updated
`packages/frontend/tests/e2e/ce-query.spec.ts`, new tests under
`packages/frontend/app/ce/query/__tests__/`.
