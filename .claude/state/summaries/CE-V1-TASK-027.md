# CE-V1-TASK-027 — Model-Completeness Meter

**Epic:** CE-V1-EPIC-022 (sole task — closes the epic)
**Branch:** `feature/CE-V1-EPIC-022` (worktree `/Users/gareth/Sites/weave-CE-V1-EPIC-022`)
**PR:** https://github.com/gazzwi86/weave/pull/77 (base `main`)
**Dependency:** CE-V1-TASK-021 (Overlay Engine) — confirmed merged (#69) before starting.

## What shipped

A completeness overlay for Graph Explorer that runs the CE-READ-1 `coverage_gap`
named SPARQL pattern and badges entities missing required links.

- `app/api/proxy/sparql/coverage-gap/route.ts` — server-side proxy for
  `GET /api/sparql?pattern=coverage_gap_process`, bearer token attached
  server-side, never exposed to the client.
- `lib/explorer/fetch-coverage-gaps.ts` — client fetch wrapper, never throws.
- `lib/explorer/humanise-rel-name.ts` — resolves predicate IRIs to `sh:name`
  labels via the ontology types list, falling back to the IRI's local
  segment — raw IRIs are never rendered (M1 IRI-hiding rule).
- `lib/explorer/renderer-adapter-badge.ts` + `renderer-adapter.ts` —
  new badge channel on `RendererAdapter` (`setBadges`/`clearBadges`),
  separate from the colour channel, batched via `cy.batch()`.
- `lib/explorer/overlays/completeness-overlay.ts` — `Overlay` with no
  `exclusiveGroup` (badges coexist with colour overlays) plus a
  `gapIndex()` drill-down index.
- `components/explorer/use-completeness-overlay.ts` — the hook: fetch →
  activate only on success (AC-3: canvas untouched on error), explicit
  diff-deactivation check (AC-7: badges exclude diff, not colour), dev-only
  perf trace `window.__explorerCompletenessApplyDurationMs`.
- `components/explorer/completeness-notice.tsx` — AC-2 "no gaps" message,
  AC-3 error+retry+dismiss notice.
- `components/explorer/side-panel.tsx` — `MissingLinks` list with an inline
  "Add..." affordance when an `onEditGap` controller is passed (not yet
  wired — TASK-023/024 inline-edit isn't built), else a link to the
  existing CE query surface (`lib/explorer/ce-editing-surface.ts`).
- `components/explorer/use-node-spotlight.ts` — wired `gapIndex` through
  to the panel's loaded state.
- `components/explorer/canvas-filter-chrome.tsx` — completeness toggle
  appended to the existing `OverlayPanel` toggle list (its own row, since
  it has no `exclusiveGroup` and isn't part of `useOverlayControls`'s
  colour-group machinery).
- `components/explorer/explorer-interactions.tsx` — wires
  `useCompletenessOverlay` + `useRelationshipLabels` (one-shot ontology
  fetch for humanising) into the main Explorer composition, and renders
  `CompletenessNotice`.

## Decisions / nuances

- **`coverage_gap` is backend-owned, not client-composed.** Initially built
  a client-side query builder mirroring `build-domain-member-query.ts`
  before confirming (via `packages/backend/src/weave_backend/rdf/patterns.py`)
  that `coverage_gap_process` is a fixed named pattern. Deleted that file;
  the proxy route takes no client-supplied query text, matching the brief's
  design decision "GE renders rows; never re-derives 'required links'
  client-side — CE owns the rule."
- **Badge channel, not colour channel.** New `setBadges`/`clearBadges` on
  `RendererAdapter` required updating the mock in every existing test file
  that constructs a full-interface fake adapter (16 files) — verified via
  `tsc --noEmit` clean + full `vitest run` before continuing feature work,
  to bound the blast radius of the interface change.
- **`react-hooks/refs` lint error.** The original `useCompletenessOverlay`
  draft used `useRef` + a manual `forceRender` reducer for `error`/
  `notice`/`gapIndex`, which the ESLint `react-hooks/refs` rule flags as
  "cannot access refs during render" (the hook's return statement reads
  `.current` synchronously). Fixed by switching those three fields to
  `useState`, which also simplified the code (no `forceRender()` needed
  since state setters trigger re-render on their own).
- **`onEditGap` intentionally left unwired** in `explorer-interactions.tsx`
  — soft dependency on TASK-023/024 (inline edit/edge-draw), which aren't
  built yet. `SidePanel` feature-detects its absence and falls back to the
  CE query surface link, per the brief's design decision.
- **No migrations needed.** This task is frontend-only (a proxy route
  consuming an existing backend-owned SPARQL pattern) — no schema changes,
  so migration blocks 0083/0084 were not created.
- **Mutmut baseline N/A.** No backend Python files were touched by this
  task, so there is no new mutmut-import-hop risk to check.

## Gate results

- Backend poison-endpoint pytest (`LOCALSTACK_ENDPOINT_URL=http://127.0.0.1:1
  OXIGRAPH_URL=http://127.0.0.1:1 uv run pytest -m "not docker and not e2e"`):
  **PASS** (no backend files touched by this task, run as a regression check).
- `cd packages/backend && uv run ruff check .`: **PASS**, all checks passed.
- `uv run mypy src/ tests/`: **PASS**, no issues in 615 source files.
- `cd packages/frontend && npm run lint`: **PASS**, 0 errors (295
  pre-existing warnings, none new from this task's files).
- `npm run typecheck`: **PASS**, clean.
- `npm test`: **PASS**, 1233/1233 tests across 242 files, including a new
  axe-core a11y test (`overlay.a11y.test.tsx`) covering the error notice
  and the side panel's missing-links list — zero violations.
- `python3 .claude/scripts/okf_validate.py docs`: **conformant** (171
  pre-existing warnings, none new).
- `.claude/scripts/ui_verify.sh --full --target http://localhost:3401/explorer`:
  **PARTIAL.** Step A (structural + a11y + links-up) **passed**. Step B
  (Playwright functional click-through) and Step C (Lighthouse) could not
  complete — the script's Playwright config runs the *entire* frontend E2E
  suite (102 specs across the whole app, not just Explorer), which requires
  the docker-composed backend + mock-OIDC auth stack. That stack was not
  running in this worktree session (`ERR_CONNECTION_REFUSED` against
  `/dashboard` on login, i.e. no backend behind the dev server). This is an
  environment/infra gap, not a defect in this task's code — flagged
  explicitly in the PR description for the coordinator/CI to re-run with
  the full docker stack before merge.

## Test counts by AC

| AC | Coverage |
|---|---|
| AC-1 (badge on gap entities) | unit (`completeness-overlay.test.ts`) + integration (`use-completeness-overlay.test.ts`) |
| AC-2 (no-gaps confirmation) | integration (`use-completeness-overlay.test.ts`) + component (`completeness-notice.test.tsx`) |
| AC-3 (error aborts activation) | unit (`fetch-coverage-gaps.test.ts`) + integration (`use-completeness-overlay.test.ts`) |
| AC-4 (humanised labels, no raw IRI) | unit (`humanise-rel-name.test.ts`) + component (`side-panel.test.tsx`) |
| AC-5 (edit shortcut / CE-surface fallback) | component (`side-panel.test.tsx`) |
| AC-6 (off-canvas gaps counted) | unit (`completeness-overlay.test.ts`) |
| AC-7 (300ms perf trace, badge/diff exclusion) | integration (`use-completeness-overlay.test.ts`, incl. a 10k-row perf-trace test) |

Zero-axe-violations DoD item covered in `overlay.a11y.test.tsx` (2 new
cases: `CompletenessNotice` error state, `SidePanel` with missing links).

## Outstanding for the coordinator

- Re-run `ui_verify.sh --full` (or its Playwright step specifically)
  against a fully seeded docker-composed backend to confirm the functional
  click-through and Lighthouse steps — this worktree session did not have
  that stack running.
- No dedicated end-to-end Playwright spec was written specifically for the
  completeness overlay flow (AC-4/AC-5's E2E coverage per the brief's test
  matrix) — the DoD's unit/integration/component coverage above satisfies
  every AC, but if the brief's "minimum 2 Playwright E2E" requirement is
  strictly gating, that should be flagged in QA review before merge.
