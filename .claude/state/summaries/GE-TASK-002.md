# GE-TASK-002 — Force Canvas & Explorer Navigation

**Epic:** GE-EPIC-001 · **Branch:** `feature/GE-EPIC-001-task-002` · **Status:** implemented, QA pending
**Commits:** 15 (last: `9227358` fix E2E canvas-height bug · `8bf8bb8` brief-mandated Playwright specs)
**Coverage:** 96% lines changed code · **Tests:** vitest 122/122 + Playwright 2/2 green · tsc/eslint clean

> Coordinator-authored from the lane receipt (ADV-004: lanes never write `.claude/state/**`).

## What was built

Graph Explorer force-directed canvas (Cytoscape + fcose) + Explorer page shell, reading CE graph data
via the proxy routes, with minimap, empty state, and semantic-zoom / key-binding / stylesheet helpers.

- `app/explorer/page.tsx` — Explorer page.
- `components/explorer/{explorer-canvas,use-explorer-canvas,mini-map,empty-state}.tsx`.
- `lib/explorer/*` — `build-stylesheet`, `key-bindings`, `minimap-geometry`, `semantic-zoom`, graph fetch +
  row→element mapping, CE-READ-1 proxy client.
- `tests/e2e/explorer.spec.ts` — the 2 brief-mandated Playwright specs.

## Notable (Law B — real-browser E2E caught a jsdom-invisible bug)

Cytoscape's constructor force-sets its container's inline `position: relative`, which silently nulled the
`absolute inset-0` sizing and collapsed the canvas to `height: 0` **in a real browser only** (jsdom never
renders, so unit tests passed). Caught by the Playwright layer, fixed with a definite-height flex column
(`h-screen` → `flex-1 min-h-0` → `h-full w-full`). This is exactly why Law B mandates real browser E2E.

## Merge-time notes (coordinator)

- Branch is task-scoped (`feature/GE-EPIC-001-task-002`), not the bare epic branch. GE-EPIC-001 is a
  **multi-task epic** (GE-001 spike, GE-002, GE-003, GE-004) — epic PR waits until its M1 tasks land; this
  task's branch will fold into the epic assembly.
- UI-bearing → the `ui_verify` gate must pass on the assembled epic before the epic PR (QA re-executes it).

## Context for downstream tasks

- GE-003/004 build on this canvas (interaction, detail panel). The CE-READ-1 proxy client + row→element
  mapping are the reusable seam.
