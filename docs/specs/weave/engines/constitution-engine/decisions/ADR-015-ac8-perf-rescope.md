---
type: Decision
title: "ADR-015: TASK-010 AC-8 perf target rescoped to the M1 bounded visible-node budget"
description: "Real-component measurement (not the TASK-009 bespoke harness) confirms Cytoscape.js + fcose misses the 3000ms p95 target at 1k dense nodes. Human decision: rescope AC-8's M1 gate to the bounded visible-node budget fetchGraph already enforces; defer the dense 1k-node case to a later GE milestone."
tags: [decision, adr, graph-explorer, rendering, performance, m1]
status: Accepted
timestamp: 2026-07-05T00:00:00Z
resource: docs/specs/weave/engines/constitution-engine/decisions/ADR-015-ac8-perf-rescope.md
source: hand-authored
confirmed_by: gazzwi86
confirmed_on: 2026-07-05
last_verified_sha: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: constitution-engine
---

# ADR-015: TASK-010 AC-8 perf target rescoped to the M1 bounded visible-node budget

**Scope:** [Graph Explorer](../../constitution-engine.md) TASK-010 (Whole-Company Force Canvas +
Navigation), AC-8 (canvas load performance) only. Builds on [ADR-014](ADR-014-render-engine.md),
which already rescoped the *node-count* target from 10k to "≈1-2k bounded visible nodes" but left
the *3000ms p95* figure unverified against the real component. This ADR settles that figure.

## Status

**Accepted — human sign-off 2026-07-05 (gazzwi86).**

## Context

TASK-010's QA pass flagged AC-8 as unverified: no perf E2E spec existed. The Engineer built one
(`tests/e2e/canvas-load.spec.ts`) measuring first-interactive-render p95 (Cytoscape's `layoutstop`
event, via a dev-only `window.__explorerRenderDurationMs` hook) through the real
`ExplorerCanvas`/`useExplorerCanvas` stack — not the TASK-009 bespoke standalone harness.

**Measured evidence, 1000 nodes / 3 edges-per-node (dense graph), 5 reps per run, 3 separate runs:**

| Run | Measured p95 | Target |
|---|---|---|
| 1 | 6296.0 ms | ≤ 3000 ms |
| 2 | 6032.9 ms | ≤ 3000 ms |
| 3 | 6985.5 ms | ≤ 3000 ms |

All three runs miss the target by roughly 2x, consistent with (and worse than) the TASK-009 OQ-01
spike's 5261.1ms on a bare-Cytoscape harness with no React/DOM overhead — this is not a flake, it
is a reproduced miss on the real production component.

Per the harness's escalation rule ("weakening a gate is never a valid fix"), the Engineer did not
adjust the threshold, mock a faster response, or disable the animation — it committed the failing
test as-is and escalated for a human M1-target rescope decision.

## Decision

**M1's AC-8 gate is rescoped from "≤3000ms p95 at 1k dense nodes" to "≤3000ms p95 at the M1 bounded
visible-node budget"** — the node count `fetchGraph`'s `MAX_VISIBLE_NODES` cap already enforces
(≈1000-1400 nodes, checked at CE-READ-1 page boundaries; see ADR-014's "≈1-2k" framing). This
budget reflects what a domain-focus/LOD-scoped M1 canvas actually renders in practice — sparse,
cap-bounded — not an arbitrary dense random graph with 3 edges per node.

- **Active M1 gate:** `tests/e2e/canvas-load.spec.ts` → `"canvas load performance (AC-8, capped
  visible-node budget)"` — passes (measured p95 in the 600-700ms range against the 3000ms target).
- **Deferred:** the dense 1k-node/3-edges-per-node case is kept as
  `test.describe.skip("canvas load performance (AC-8, dense 1k nodes -- DEFERRED, see ADR-015)")`
  — not deleted, so the measured evidence above stays runnable/re-enable-able, not lost.
- **Deferred to:** a later GE milestone, gated on either the WebGL renderer swap already recorded
  as *preferred* in ADR-014 (sigma.js/G6), or a precomputed-layout path (server-side layout
  persistence, TASK-012, could seed initial positions and skip fcose's iterative convergence on
  first paint). Candidate fix, not yet designed.

## Consequences

**Positive:** AC-8 ships a real, honest, real-component-measured gate for M1 rather than either a
faked pass or an indefinitely-blocked task; the dense-graph miss is preserved as evidence for
whoever picks up the deferred work, with exact reproduction numbers.

**Negative:** M1's whole-company canvas, if a tenant's domain-focus/LOD scoping ever produces a
denser-than-typical bounded set (many edges per node rather than the sparse case implicitly
assumed here), has no verified perf gate for that denser case until the deferred work lands.

## Alternatives considered

- **Waive AC-8 for M1** — rejected: the coordinator's explicit decision was rescope, not waive;
  a rescoped-but-real gate is stronger than an absent one.
- **Optimize Cytoscape/fcose to hit 3000ms at 1k dense nodes within M1** — rejected: the residual
  gap (≈2x, and ≈1.8x on the OQ-01 spike before that) is not tunable-margin territory per ADR-014's
  benchmark; would require the WebGL renderer swap or precomputed layout, both out of M1 scope.
- **Silently narrow the test's node count without renaming/documenting it as a rescope** —
  rejected: fails the "weakening a gate is never a valid fix" rule; this ADR + the kept
  `test.describe.skip` block make the rescope explicit and auditable.
