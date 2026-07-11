# Progress: CE-V1-TASK-026 — Saved Views UI + Share + Comments + Live-Refresh Poll (EPIC-018, sole task → closes epic)

`constitution-engine` EPIC-018. Worktree `../weave-CE-V1-EPIC-018`, branch `feature/CE-V1-EPIC-018` (off `origin/main`).
Frontend consumer of the backend built in TASK-025/EPIC-019 (`POST/GET /api/views`, `DELETE /api/views/{id}`,
`POST /api/views/{id}/share`, `POST/GET /api/comments`). 17 commits, TDD throughout.

## What shipped

- `use-filter-panel.ts` — new `replaceFilterState(next)`: sets plain filter fields directly, reconciles `layersOn`
  via the existing side-effecting `toggleLayer(layer)` per differing layer (layer toggle triggers a real CE-READ-1
  fetch, so it can't be a plain state write).
- `use-domain-focus.ts` — new reactive `domainIri` (`useState`, was previously only a non-reactive ref) + `clearFocus()`
  (calls `adapter?.resetOpacity()`, resets ref/state, returns `state` to `inactive`).
- `use-saved-views.ts` — `useSavedViews`/`useSaveAndOpen` hook: save (with 409-collision overwrite flow), open
  (restores filters/overlays/domain-focus/layout from a saved definition), remove, share. DI seam (`saveView`/
  `listViews`/... injectable) for unit testing without stubbing network modules.
- `use-saved-views-wiring.ts` — composition/glue hook adapting `useFilterPanel`/`useOverlayControls`/`useDomainFocus`
  into `useSavedViews`'s expected shape, keeping `ExplorerInteractions` thin. Real reconciliation logic exported as
  pure functions (`reconcileActiveOverlays`, `applyDomainFocus`) and unit tested directly.
- `saved-views-panel.tsx` — presentational UI: save form (name + 409 inline overwrite), tenant library list
  (open/delete), freeform share-recipient chip picker (**Option-2**, coordinator-confirmed — see Deviations).
- `use-event-poll-wiring.ts` — composition hook wiring `useEventPoll` into the canvas (delta fetch + reload +
  drag-guard). Pure `matchesDelta(element, ids)` extracted/unit tested.
- Mounted `SavedViewsPanel` into `canvas-filter-chrome.tsx` alongside `VersionsPanel`; `ExplorerInteractions` composes
  all panel/wiring hooks via a `useCanvasChromePanels` helper (extracted to stay under Law E's 50-line function budget).
- `saved-views.a11y.test.tsx` — axe coverage for `SavedViewsPanel` (populated library) and `CommentsPanel` (existing
  thread), both zero violations.
- `tests/e2e/saved-views.spec.ts` — two-user Playwright E2E (env-deferred, see below): user A saves a view with a
  toggled-off filter, user B opens it and reproduces identical `aria-pressed` state; user A comments on a spotlighted
  node, user B sees it via poll.

## Deviations (flag for QA / reviewer)

1. **Option-2 freeform share recipients** (coordinator-confirmed this session) — `ShareChips` accepts freeform
   recipient strings + displays `authorToken(iri)` (`iri.split(/[/#]/).pop()`), rather than the brief's Implementation
   Hints calling for a tenant-member picklist with resolved display names. Server (`POST /api/views/{id}/share`) still
   authoritatively decides share eligibility — no security regression, matches the TASK-025 precedent set in
   `comments-panel.tsx`.
2. **Backend `ViewOut.definition` widening** (prior session, included in this PR) — `schemas/views.py` / `routers/views.py`
   list endpoint was missing `definition` on `ViewOut`, a genuine TASK-025 contract gap (list rows had no definition to
   open with). Fixed as the scope-respecting minimum; not a new route.
3. **`fetchDelta` full-fetch-then-filter** — `useEventPoll`'s `fetchDelta(entityIris)` implies an IRI-filtered delta
   endpoint; no such CE-READ-1 endpoint exists. `use-event-poll-wiring.ts` calls the full `fetchGraph()` then filters
   client-side (`matchesDelta`). Correct but not incremental — a real cost on large graphs. `ponytail:` comment names
   the ceiling; upgrade path is a CE-READ-1 `ids=` filter.
4. **`unsavedDragIds: () => []`** — permanent empty set; `use-layout-persistence.ts` has no drag-in-progress tracking
   (only save-after-drag-ends). Known risk: a live drag could be visually overwritten by a poll merge mid-drag. Flagged,
   not fixed (out of this task's scope — would require new state in a sibling hook).
5. **Two-user E2E is env-deferred** — `saved-views.spec.ts` is authored against the real (unmocked) backend and
   requires the live docker-compose stack + seeded demo tenant, same lane as `tests/e2e/versions-publish.spec.ts`.
   Not executed this pass (coordinator-sanctioned fallback).

## Gates

- Backend: `pytest -m "not docker and not e2e"` — exit 0, all pass. `ruff check .` clean. `mypy src/ tests/` — clean
  (615 source files).
- Frontend: `npm run lint` — 0 errors (291 pre-existing warnings in untouched e2e spec files, not this task's).
  `npm run typecheck` clean. `npm test -- --run` — 252 files / 1259 tests, 0 errors, 0 unhandled rejections (two
  pre-existing test files — `explorer-interactions-overlay.test.tsx`, `explorer-canvas.test.tsx` — needed
  `comments-client`/`events-client` stubs added since `ExplorerInteractions` now mounts both on every render).
- `ui_verify.sh --full` — **FAIL**, but root-caused to two pre-existing baseline a11y failures unrelated to this task:
  `dashboard has zero axe violations after login` and `explorer force canvas has zero axe violations` (a `heading-order`
  violation: `<h1>Graph Explorer</h1>` → `<h3>Legend</h3>` skips `<h2>`). Confirmed via isolated re-run (reproducible,
  not full-suite concurrency flake) and `git blame` — the `Legend` heading component and `accessibility.spec.ts` were
  last touched by prior epics (EPIC-016, TASK-020), not TASK-026. `SavedViewsPanel`'s own headings (also `<h3>`,
  matching the existing convention) are covered separately by `saved-views.a11y.test.tsx`, which is green. Not fixed
  here — out of scope (base page heading structure, not Saved Views).
- `okf_validate.py docs` — conformant (171 tolerated warnings, unrelated pre-existing cross-link gaps), ran clean via
  the pre-push hook.

## Commits

d469cad3, 5b50572e, c68972e5, e70b948b, 15a9cf48, b7f3f3d5, 1e63dbc9, c1c071f7, f7efeecc, 819d16a0, aaa9f002, 7c15c3eb,
8c274657, 428f1186, a1ef0387 (+2 backend fix commits) — all pushed to `feature/CE-V1-EPIC-018`.
