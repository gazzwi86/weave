# Progress: CE-V1-TASK-020 — Filters & Layers Panel + shared legend/toolbar shell (EPIC-015, first task)

`constitution-engine` EPIC-015 (Graph Explorer canvas UI). **PARALLEL LANE** worktree
`../weave-CE-V1-EPIC-015`, branch `feature/CE-V1-EPIC-015`. Frontend-only. **QA PASS** (1 non-blocking WARN).

## Outcome — QA PASS (2026-07-11)

All 8 ACs verified against running code (not self-report). Vitest 636/636 green (634 + QA edge test
`d0468aa` FilterState JSON round-trip). tsc clean, lint 0 errors (155 pre-existing warnings). Engineer
self-caught + fixed a real AC-2 bug (isEmpty fired on any empty canvas incl. loading, not just all-off).

## What shipped (24 commits + QA `d0468aa`)

- **FilterState** (plain JSON-serialisable arrays: entityTypesOff/relTypesOff/propertyFilters/layersOn —
  TASK-026 saved-views dependency holds) + pure `evalFilter/evalFilters` + `computeFilterVisibility`.
- **RendererAdapter.applyFilterVisibility** — single `cy.batch()` (AC-7): AC-1 real-hide (`.hide()`/display:none)
  nodes+incident edges; AC-3 dim (`.style(opacity)`, never hide) rel-type edges + orphaned nodes; property-filter
  non-match dim — orphan-dim unioned with filter-dim (both survive one batch).
- **FilterPanel + FilterEmptyState** (AC-2 all-off→empty+one-click recovery), **CanvasLegend** (colour+label),
  **CanvasToolbar** (search reuses M1 `useSearchOverlay`/Cmd+K — no 2nd impl). Shared legend/toolbar SHELL —
  TASK-021's overlay legend mounts into THIS shell (don't build a second).
- **useLayerToggle** (AC-6 governed layer fetch/add/remove via CE-READ-1, `fetch-layer-nodes.ts`).
- z-index tokens `--z-base/--z-canvas-overlay/--z-modal` gap-filled to globals.css (`6590851`, coordinator-committed
  post-collision — engineer left uncommitted). Shipped no-hyphen convention.

## Per-AC (all PASS)

AC-1 real-hide ✓ · AC-2 empty+recovery (isEmpty bug fixed) ✓ · AC-3 dim-not-remove + orphan-dim ✓ ·
AC-4/AC-5 property filters **logic-complete, DATA-LATENT by design** ✓ · AC-6 governed layers ✓ ·
AC-7 batched single-call perf ✓ · AC-8 keyboard + axe-clean ✓.

## ACCEPTED DEFERRALS (coordinator-endorsed, queued — do NOT re-raise as bugs)

- **Property filters (AC-4/5) data-latent:** M1 bulk load never maps `key_properties` (only lazy per-node on
  click). Pure evalFilter logic tested; real value-match waits on a filed follow-up (plumb bounded key_properties
  into bulk load over CE-READ-1). Property-path input is free-text (no dead-options crash).
- **D-2 legend = colour+label only** (WCAG 1.4.1 met, label is non-colour carrier). 14 shape-glyph SVGs are a
  filed separate design-owned icon-authoring task (PRD OQ-08). Shape seam left in `canvas-legend.tsx`.
- **AC-7 measured at M1's ~1000-1400 node cap (ADR-002), not the literal 10k** (M1 visible-node cap is below 10k).
- **Frontend mutation ≥60% not run** — no stryker config in packages/frontend (pre-existing tooling gap).

## WARN (non-blocking — follow-up)

`renderer-adapter.ts` over Law E file-cap (330 lint-counted/436 raw) — was ALREADY over pre-task (323 at
e74dbe8), TASK-020 added +115. Waiver logged to complexity-waivers.md; candidate for extraction (queued).

## Dependencies unlocked (within EPIC-015)

TASK-021 (Overlay Engine + Heatmap — mounts overlay legend into THIS task's shared legend shell), TASK-022.
