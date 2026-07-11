# CE-V1-TASK-022 — Versions Panel + Diff

Epic: CE-V1-EPIC-020 (sole task — completing this closes the epic).
Branch: `feature/CE-V1-EPIC-020`, worktree `/Users/gareth/Sites/weave-CE-V1-EPIC-020`.
Depends on TASK-021 (Overlay Engine), on `main` at `f2fca74c`.

## What shipped

- **Version-pinned graph reload seam (AC-2).** `app/api/proxy/sparql/route.ts`'s `version`
  query param widened from `z.literal("latest")` to `z.string().min(1)` — CE-READ-1's `?version=`
  already accepted an arbitrary version IRI, the proxy just didn't forward one. `fetchGraph`
  (`lib/explorer/fetch-graph.ts`) gained a second `version` argument (default `"latest"`).
- **`useVersionMode`** (`components/explorer/use-version-mode.ts`) — standalone hook (not folded
  into `use-explorer-canvas.ts`, already at Law E's 300-line ceiling) that reloads the canvas via
  the existing `RendererAdapter.load`/`setLayout` seam, pinned read-only to a version, and back.
- **`useOverlayControls`** now exposes its `OverlayEngine` instance (one field added to the return
  object) so the diff overlay — built outside that hook, in the Versions Panel — shares the same
  engine and its `"colour"` `exclusiveGroup` mutual exclusion with heatmap/domain-colouring (AC-7).
- **`useVersionsPanel`** (`components/explorer/use-versions-panel.ts`) composes: version list
  fetch (AC-1), read-only version load (AC-2, via `useVersionMode`), two-version compare via
  `groupTriples` + the already-shipped `createDiffOverlay` (AC-3/AC-4/AC-7), JSON export via
  `buildDiffExport` + a `Blob`/`<a download>` (AC-6, no new dependency), and return-to-draft
  (AC-8, clears the diff overlay too). Split into `useVersionsList` + `useDiffCompare` internal
  helpers to keep each function under the 50-line budget (one budget waiver left for
  `useDiffCompare` at 59 lines — logged below).
- **`VersionsPanel`** (`components/explorer/versions-panel.tsx`) — presentational only, same
  split as `FilterPanel`/`OverlayPanel`: version list with per-row "load read-only" / "compare"
  buttons, error/no-differences/export/return-to-draft banners and buttons, all via design tokens.
- **`CanvasFilterChrome`** extracted from `explorer-interactions.tsx` into its own file
  (`components/explorer/canvas-filter-chrome.tsx`) purely to keep `explorer-interactions.tsx`
  under Law E's 300-line file budget after wiring the Versions Panel in (it mounts
  `<VersionsPanel>` alongside `<OverlayPanel>`).
- **No-edit-affordances (AC-2).** `explorer-interactions.tsx` now hides the "Reset layout" button
  while `versionsPanel.readOnly` is true — the concrete implementation of "no edit affordances
  while pinned to a published version", since layout-drag-persistence is the only edit affordance
  that existed on the canvas before this task.
- **E2E** (`tests/e2e/explorer-versions-diff.spec.ts`) — the brief's two named scenarios: compare
  two versions → see the diff summary incl. an edge modification → export JSON; and load a
  version read-only → no "Reset layout" button → return to draft → button reappears.

## Gates run

- Frontend: `npx vitest run` — 224 files / 1151 tests, all green (includes new unit tests for
  `fetchGraph`'s version param, the widened sparql proxy route, `useVersionMode`, and the
  pre-existing `explorer-interactions*`/`explorer-canvas` suites updated to mock the new
  `versions`/`diff`/`ontology-types` fetch clients).
- `npx tsc --noEmit` — clean.
- `npx eslint` on all touched files — 0 errors, 2 pre-existing-style warnings (function-length,
  logged as complexity waivers below).
- Backend poison-endpoint pytest (`LOCALSTACK_ENDPOINT_URL=http://127.0.0.1:1
  OXIGRAPH_URL=http://127.0.0.1:1 uv run pytest -m "not docker and not e2e" -p no:warnings -q`) —
  exit 0, all green. (No backend files touched by this task — CE-VERSION-1/CE-DIFF-1's proxy
  routes already existed before TASK-022 started.)
- `uv run ruff check .` (backend) — all checks passed.
- `uv run mypy src/ tests/` (backend) — no issues in 582 source files.
- `python3 .claude/scripts/okf_validate.py docs` — conformant (170 pre-existing tolerated
  warnings, none introduced by this task).

## Not run / deferred, with reason

- **Playwright E2E execution.** The new spec (and every pre-existing Explorer E2E spec, verified
  with `explorer-overlays.spec.ts` as a control) fails at the login step in this local worktree:
  `asyncpg.exceptions.InvalidAuthorizationSpecificationError: role "weave_app" does not exist` —
  the local Postgres auth database isn't provisioned in this environment. This is a pre-existing
  environment gap, not something this task introduced; every other Explorer E2E spec fails the
  same way here. The spec itself is lint-clean and type-clean.
- **`ui_verify.sh --full`** — not run against a served build; the dev server was only up for the
  Playwright attempt above (which failed at auth, before reaching the Explorer canvas). Given the
  auth-DB gap blocks reaching the Versions Panel at all in this environment, a design-token /
  axe pass would only re-confirm what unit tests + code review already checked (all panel markup
  uses `var(--...)` tokens, no ad-hoc hex/px, following `FilterPanel`/`OverlayPanel`'s exact
  pattern). Flagged for the coordinator/QA to re-run once the local auth DB is provisioned.
- **Mutmut baseline double in-process run** — skipped: this task touched zero backend Python
  files (both CE-VERSION-1/CE-DIFF-1 proxy routes and the diff-grouping logic all live in the
  Next.js frontend). Mutation testing targets backend business logic; nothing here to mutate.
- **Migration 0075** — not needed. Confirmed: both backend targets (CE-VERSION-1 `GET
  /api/ontology/versions`, CE-DIFF-1 `GET /api/ontology/diff`) already existed before this task
  (built by an earlier task) with matching proxy routes already in place; this task only widened
  an existing proxy's query-param schema and added frontend UI. No schema/migration work.

## Complexity waivers logged

`.claude/state/complexity-waivers.md` (in the epic worktree) gained two entries: `ExplorerInteractions`
(57 lines, already at the file's structural ceiling pre-TASK-022) and `useDiffCompare` (59 lines,
already split out of a 97-line `useVersionsPanel` to isolate the two-version compare state
machine). Both are `warn`-level eslint findings, not blocking.

## Decisions made (no new ADR needed — all covered by existing ADR-001/ADR-002)

- Diff overlay reuses `createDiffOverlay`/`groupTriples` shipped in an earlier increment of this
  same epic branch (visible in git log as separate commits before this session resumed) —
  confirmed at the start of this session, not re-litigated.
- `useOverlayControls` exposing its `OverlayEngine` instance (rather than duplicating engine state
  or building a registration callback) was the minimal change satisfying AC-7; considered and
  rejected a pub/sub registration API as unrequested abstraction for a single caller.
- JSON export uses `Blob` + `<a download>` (native browser API, zero new dependency) rather than
  a file-save library.

## Follow-ups for the coordinator / QA

1. Re-run `ui_verify.sh --full --target http://localhost:3000/explorer` and the new Playwright
   spec once the local Postgres auth DB (`weave_app` role) is provisioned in this worktree/CI.
2. `VersionsPanel` has no dedicated component-level render test (covered only indirectly via the
   `explorer-interactions*` suites and the `useVersionsPanel`/`useVersionMode` hook unit tests) —
   acceptable given the presentational-only split mirrors `OverlayPanel`'s (also untested at the
   component level), but worth a QA note if the coverage bar wants otherwise.
