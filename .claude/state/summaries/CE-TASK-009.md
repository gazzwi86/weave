# GE-TASK-001 — SPIKE: Cytoscape 10k-node Benchmark + Aurora Layout Schema

**Status:** engineer-complete, AWAITING HUMAN/ARCHITECT SIGN-OFF (AC-2/3/4/5 are manual artefacts) ·
**Epic:** GE-EPIC-001 · **Branch:** feature/GE-EPIC-001 (off main) · **Date:** 2026-07-05
*(coordinator summary from lane report per ADV-004)*

## What this spike decides

OQ-01: can Cytoscape.js + fcose hit the 10k-node force-canvas budget? OQ-05: is the WebGL escape
hatch needed? Plus: design + approve the Aurora `explorer_layout_positions` schema that unblocks
GE-TASK-004.

## Benchmark result (real prototype fcose params — final)

Params recovered by coordinator from `prototypes/weave-prototype/frontend/src/lib/cytoscape.ts:106-114`
(`animationDuration:600, nodeSeparation:90, idealEdgeLength:110, nodeRepulsion:6500`) — the
spec-cited `prototype-findings.md` never existed (ledgered spec defect). First run used library
defaults (invalid comparison per the brief); this is the corrected run.

| Size | p95 load | Target | p95 mem |
|---|---|---|---|
| 1,000 | 5,261 ms | ≤ 3,000 ms | 127 MB |
| 5,000 | 136,404 ms (~2.3 min, 1 rep) | interpolated | 237 MB |
| 10,000 | 506,796 ms (~8.4 min, converged under a 10-min cap) | ≤ 8,000 ms | 943 MB |
| Drag @ 1k | p95 270 fps | ≥ 60 fps | — |

Caveats: Apple-Silicon dev box (not reference hardware); headless Chromium, no vsync (inflates the
fps reading — real-browser drag will differ). Real params are 6–13× faster than defaults but the
residual gap is 1.8× (1k) to ~63× (10k) — not tunable margin.

## Engineer recommendation (NOT self-signed — ADR-001 stays pending-approval)

**no-go** on Cytoscape+fcose for the 10k force canvas → name the OQ-05 WebGL renderer (sigma.js or
G6), suspend TASK-002 AC-7 (perf) until that renderer decision is signed. Drag FPS at 1k passes
comfortably; the load-time wall is the blocker.

## Deliverables

- `docs/specs/weave/engines/graph-explorer/decisions/ADR-001-render-engine.md` — status
  `pending-approval`, `confirmed_by: none`.
- `packages/frontend/benchmarks/ge-oq01-spike/` — harness (`bench-load.mjs`, `bench-drag.mjs`,
  `fcose-params.mjs`), `report.md`, raw results. Throwaway/lint-excluded.
- `packages/backend/migrations/0008_explorer_layout_positions.sql` — the Aurora layout schema
  (composite PK, RLS `tenant_id = current_setting('app.current_tenant_id')::uuid`). One disclosed
  divergence from 0001_tenancy.sql convention: UUID + hard-error-if-unset vs TEXT + missing_ok —
  flagged in the file header for Architect review (AC-4).

## Commits (feature/GE-EPIC-001)

0126837, 2e0c160, d756186, 626cb49, ed4635c (first pass) · f0c68d0, 5a7e3af, 2d08190 (real-params rerun).

## Blocks / what needs the human

- **AC-2/AC-3 (go/no-go + OQ-05 renderer):** human/Architect decision — unblocks GE-TASK-002.
- **AC-4/AC-5 (schema approval + migration committed):** Architect review — unblocks GE-TASK-004.
- GE work is graph-explorer/phase-1 (a later engine phase); the spike ran early under the recorded
  cross-engine opt-in, but its sign-off is a genuine HITL gate. TASK-002/004 do NOT start until signed.
