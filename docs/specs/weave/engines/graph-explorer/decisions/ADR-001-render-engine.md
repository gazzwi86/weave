---
type: Decision
title: "ADR-001: Graph Explorer render engine — Cytoscape.js + fcose (default, spike-gated)"
description: "Engine-local decision for the Explorer force-canvas renderer. Defaults to Cytoscape.js + fcose (prototype-proven), pending the TASK-001 10k-node benchmark; names sigma.js/G6 (WebGL) as the contingency and estimates the renderer-swap rework delta on TASK-002..005 (council ENG-3). Disambiguates GE-local OQ-01/OQ-05 from program OQ-01."
tags: [decision, adr, graph-explorer, rendering, cytoscape, webgl, spike, m1]
status: pending-approval
timestamp: 2026-07-01T00:00:00Z
resource: docs/specs/weave/engines/graph-explorer/decisions/ADR-001-render-engine.md
source: hand-authored
confirmed_by: none
confirmed_on: null
last_verified_sha: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: graph-explorer
---

# ADR-001: Graph Explorer render engine — Cytoscape.js + fcose (default, spike-gated)

**Scope:** [Graph Explorer](../../graph-explorer.md) only. Output of the
[TASK-001 benchmark spike](../m1/tasks/TASK-001.md). Clears council **ENG-3** (renderer-swap
rework-delta estimate).

> **Label disambiguation (important).** GE's task briefs use **GE-local** OQ numbers:
> **GE OQ-01** = "does Cytoscape hit the 10k-node perf target?"; **GE OQ-05** = "which WebGL
> renderer if not?". These are **distinct** from the **program-level OQ-01 = tenant isolation**
> ([program ADR-001](../../../decisions/ADR-001-tenant-isolation.md)). This ADR concerns the
> renderer only.

## Status

**pending-approval** — TASK-001 benchmark evidence is in (see below); the Engineer-recommended
verdict is **no-go**, but this is a prepared recommendation only. **Sign-off is
Architect/human-level (AC-2/AC-3) — `confirmed_by: none` until then, per governance: an Engineer
never self-signs a spike verdict.** Build phase: **M1**.

## TASK-001 benchmark evidence (2026-07-05)

Full report, raw data, and harness: `packages/frontend/benchmarks/ge-oq01-spike/` (report.md +
raw-results*.json). Summary:

| Size | Reps completed | p95 load time | Target |
|---|---|---|---|
| 1,000 nodes | 5/5 | 19,222.8 ms | ≤ 3,000 ms |
| 5,000 nodes | 1/5 (capped — see report) | 751,211.4 ms (~12.5 min) | n/a (interpolated gate) |
| 10,000 nodes | 0/5 (did not converge, killed at >42 min) | — | ≤ 8,000 ms |

Drag fps @ 1k: p95 (ascending, per brief's literal formula) = 222.2 fps — but see the report's
"drag fps caveat"; this benchmark never reached the point where drag was the binding constraint.

**Two disclosed deviations from the literal protocol, both explained in full in report.md:**
1. **fcose params are not the prototype-tuned set** — `prototype-findings.md` does not exist in
   this repo. Used `cytoscape-fcose`'s own published library defaults instead, verbatim, with full
   provenance in `fcose-params.mjs`. See `.claude/state/escalations/TASK-001-blocker.md`.
2. **Reps capped at 5k (1/5) and 10k (0/5)**, not the full 5 — 1k already measured ~19s p95 (6x
   over its own 3s target); 5k's first rep took ~12.5 minutes; a 10k rep ran >42 minutes at steady
   100% CPU without converging. The gap is 2-4 orders of magnitude at every tier already measured;
   the remaining reps would cost hours for no decision-relevant new information.

**Engineer recommendation: no-go.** Cytoscape.js + fcose at library-default params misses target by
100-300x+ at every tier tested, not by a tunable margin. Recommend the Architect proceed to name
the OQ-05 WebGL renderer (sigma.js or G6) per the "Decision" section below, and treat TASK-002 AC-7
as suspended until that renderer decision is signed. Full rationale, caveats, and the (unlikely but
disclosed) condition that would change this recommendation: `report.md`.

## Context

The whole-company force canvas must render up to **10k nodes** (M1 target, unverified —
[graph-explorer §2.2](../../graph-explorer.md#22-non-functional-requirements)). Cytoscape.js +
fcose is **prototype-proven** at smaller scale (`prototype-findings.md`) but 10k on a
no-GPU desktop profile is not yet measured. Committing production code to a renderer before the
benchmark risks a costly mid-build swap.

## Decision

**Default to Cytoscape.js + fcose**, gated by the TASK-001 benchmark (go = render ≤ 8 s @ 10k,
drag ≥ 60 fps @ ≤ 1k visible). If the target is missed, swap the **render layer only** to a
WebGL engine (**sigma.js** preferred for force graphs; **G6** if richer interaction is needed),
keeping the graph *model*, data flow, and interaction contracts stable.

**Isolation of the renderer (why the swap is survivable):** TASK-002..005 must treat the
renderer as an adapter behind a stable internal interface (`load(elements)`,
`onNodeClick`, `getViewport`, `setLayout`, `pin(node)`), so a swap touches the adapter, not the
features. This is a hard architectural invariant for the Explorer tech spec.

### Renderer-swap rework-delta estimate (council ENG-3)

Assumes the adapter-boundary invariant above holds. Delta = *additional* rework if TASK-001 is a
no-go and the renderer swaps to sigma.js/G6.

| Task | Feature | Renderer coupling | Rework delta on swap |
|------|---------|-------------------|----------------------|
| TASK-002 | Force canvas + navigation | **High** — layout, pan/zoom, drag are renderer-native | **~40–60%** re-implement against WebGL API (fcose→sigma force / G6 layout); the adapter interface itself is reusable |
| TASK-003 | Node spotlight + search overlay | **Low** — overlay is DOM/React above the canvas; needs node→screen-coords projection from the adapter | **~10–15%** (re-wire coordinate projection) |
| TASK-004 | Server-side layout persistence | **None** — persists `(x,y)` positions; renderer-agnostic (Aurora schema unchanged) | **~0–5%** (position-read hook only) |
| TASK-005 | Drill-in / expand-collapse / impact traversal | **Medium** — show/hide + sub-layout are renderer calls behind the adapter | **~20–30%** (re-map traversal → WebGL show/hide + re-layout) |

**Blended:** with the adapter boundary, a full no-go swap is a **~25–35%** rework of the
Explorer M1 canvas tasks, concentrated in TASK-002 — **not** a rewrite. Without the adapter
boundary it approaches a rewrite; hence the invariant is mandatory, not advisory.

## Consequences

**Positive:** ship the prototype-proven default immediately; the WebGL path is a bounded,
pre-estimated contingency, not an open risk; features TASK-003/004/005 are largely renderer-
agnostic by construction.

**Negative:** the adapter boundary adds a thin indirection layer (small complexity cost, well
inside Law E); the real 10k verdict is deferred to TASK-001 — until signed, TASK-002 AC-7
(performance) must **not** be asserted as settled.

## Alternatives considered

- **Commit to a WebGL renderer up front (skip Cytoscape)** — rejected: throws away the
  prototype-proven path and its tuned fcose params for an unmeasured need; premature.
- **No adapter boundary (call the renderer directly)** — rejected: turns a possible no-go into a
  near-rewrite; the estimate above only holds behind the adapter.
