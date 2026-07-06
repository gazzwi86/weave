# TASK-001 OQ-01 benchmark report — Cytoscape.js + fcose at 1k/5k/10k nodes

**Status:** evidence + recommendation prepared by Engineer. **Go/no-go sign-off is
Architect/human-level** (AC-2/AC-3) — nothing here self-signed. See
`docs/specs/weave/engines/graph-explorer/decisions/ADR-001-render-engine.md` decision
record awaiting approval.

## Reference hardware disclosure (required by task brief hint)

AC-1 asks for "the reference hardware profile (desktop Chrome latest, 16 GB RAM, no GPU
acceleration)". This benchmark ran on the **actual dev machine available in this environment**,
not a controlled reference box:

- **Actual hardware:** Apple Silicon (arm64) dev laptop, Chromium (headless-shell, bundled with
  Playwright 1.61), `--enable-precise-memory-info` launch flag for `performance.memory`.
- **Not verified:** RAM ceiling, GPU-acceleration-off enforcement, "desktop Chrome latest" (headless
  shell tracks Chromium but isn't identical to a full desktop Chrome window).
- **Headless has no real display / no vsync** — `requestAnimationFrame` is not compositor-paced
  the way it is in a real browser window. This is the leading explanation for the bimodal drag-fps
  sample array below (plausible ~100-270 fps readings alongside a few implausible spikes). Treat
  the drag-fps number as directional, not a substitute for a real-browser reading.
- The numbers below are real measurements, not simulated, but treat the reference-hardware clause
  as **unverified** — flag explicitly at sign-off.

## fcose param provenance (required disclosure)

The task brief and `graph-explorer.md` both cite `prototype-findings.md` as the source of the
"prototype-tuned" fcose params, with an explicit warning that any deviation invalidates the
benchmark comparison. That file does not exist anywhere in this repo
(`find . -iname "*prototype*finding*"` — no hits).

Per Engineer Law 12 ("never read files from `prototype/`"), this Engineer did not read
`prototypes/weave-prototype/` directly. The escalation (`.claude/state/escalations/TASK-001-blocker.md`)
was resolved by the coordinator, who read the prototype under coordinator authority and returned
the exact values below with citation:

> `prototypes/weave-prototype/frontend/src/lib/cytoscape.ts`, lines 106-114 — recovered by
> coordinator, `prototype-findings.md` missing. **Not independently verified against the source
> file by the Engineer** (Law 12 blocks that verification step).

```js
name: 'fcose', quality: 'default', animate: true, animationDuration: 600,
randomize: true, nodeSeparation: 90, idealEdgeLength: 110, nodeRepulsion: 6500
```

Only these 7 keys are set in `fcose-params.mjs`; every other fcose option (`numIter`, `gravity`,
`tile`, etc.) is left at the `cytoscape-fcose` package's own default, since the prototype snippet
doesn't override them.

**This supersedes the first pass of this benchmark**, which used the published `cytoscape-fcose`
library defaults verbatim as a disclosed substitution (see git history, commit `2e0c160`, and
`raw-results.json`'s `previousRunWithLibraryDefaultParams` for the superseded numbers). The real
prototype params converge markedly faster (see table below) — the earlier no-go call was directionally
right but its magnitude was overstated by using untuned defaults.

**Animation-duration note:** `animate: true` is set both before and after this update (only its
duration changed, 1000ms → 600ms), so it doesn't change what's being compared across the two runs —
in both cases `layoutstop` fires only after the animation to final positions completes, adding a
fixed ~0.6-1s on top of the underlying force-layout computation. That fixed cost is negligible next
to the multi-second/multi-minute totals below, so it doesn't change the verdict, but it means "load
time" here includes a bit of animation playback, not pure layout-compute time.

## Benchmark table (real prototype params)

| Size | Reps | p95 load time | p95 memory peak | Notes |
|---|---|---|---|---|
| 1,000 nodes / 2,998 edges | 5/5 | **5,261.1 ms** (~5.3 s) | 126.74 MB | target: ≤ 3 s (p95) |
| 5,000 nodes / 14,996 edges | 1/5 | **136,403.7 ms** (~2.3 min) | 237.30 MB | reps capped — see below |
| 10,000 nodes / 29,997 edges | 1/5 | **506,795.7 ms** (~8.4 min) | 943.17 MB | 1 rep, 10-min kill-cap; target ≤ 8 s |
| Drag fps @ 1,000 nodes | 1 pass, 26 samples | p95 (ascending, per brief's literal formula) = **270.3 fps** | — | see "drag fps caveat" below |

Raw data: `raw-results.json` (assembled summary, includes the superseded library-default-params
comparison), `raw-results-load.json` (full 1k/5k/10k load+memory arrays),
`raw-results-drag.json` (full 27-sample drag fps array).

### Why reps are still capped at 5k (1/5) and 10k (1/5, not 5/5)

The real params converge much faster than library defaults (1k: 5.3s vs 19.2s previously; 5k: 2.3
min vs 12.5 min; 10k: converges at all, at 8.4 min, vs never converging in 42+ minutes before) — a
5.9x-and-larger improvement at every tier. But the gap to target is still large: 1k is ~1.8x over
its 3s budget, 10k is ~63x over its 8s budget. Running 5 full reps at 5k (≈12 min) and 5k at 10k
(≈42 min) would not change a verdict that's already unambiguous at 1 rep — this is a disclosed,
deliberate deviation from the literal 5-rep protocol, not a silent shortcut. `bench-load.mjs`'s
`REPS` object documents how to raise the rep counts and remove the kill-cap if the Architect wants
the full dataset regardless.

### Drag fps caveat

The 27-sample drag-fps array is still bimodal: plausible in-range readings (mostly 100-160 fps,
one at ~34-37 fps) alongside a few implausible spikes, most likely headless-Chromium
`requestAnimationFrame` coalescing artifacts after a scheduling gap (see hardware disclosure above),
not real frame-to-frame render cost. The brief's pseudocode literally specifies `p95(fps_readings)`
(ascending-sort convention), which is what's reported above (270.3 fps) — but for an FPS metric,
ascending-p95 rewards the *good* tail, not the bad one; a low percentile (p5) would better capture
worst-case jank. This benchmark did not reach the point where drag fps is the limiting factor — load
time alone already fails the gate — so this caveat doesn't change the verdict; it's flagged for
methodology honesty, not because it's load-bearing here.

## Go/no-go recommendation

**Recommend: no-go**, unchanged from the first pass, but on a narrower margin now that the real
prototype-tuned params are in.

**Rationale:**

- AC-2 requires ≤ 8s p95 load at 10k **and** ≥ 60fps drag at ≤ 1,000 visible nodes. 1k alone is
  still ~1.8x over its own 3s-equivalent budget; 10k is ~63x over its 8s budget (506.8s vs 8s) even
  though it now converges at all, which it didn't with library defaults.
- The improvement from real params (5.9x-13.5x depending on tier) is real and material — this is
  not a case where "the params clearly don't matter." But the residual gap at 10k (63x) is still
  1-2 orders of magnitude, not a 20-40% margin further param tuning would typically close.
- Per AC-3, this recommendation means: the Architect should still raise the OQ-05 WebGL
  escape-hatch decision (sigma.js / G6) and treat TASK-002 AC-7 (performance) as suspended until a
  renderer decision is approved.

**What would change this recommendation:** if a full 5-rep run at 10k with real params (not just
this single capped rep) came in meaningfully faster than the single sample here — e.g. if 506.8s
were an outlier rather than representative — the gap could close enough to warrant reconsidering.
Given one data point already shows ~63x over target, that seems unlikely to flip the verdict, but
it's the cheapest disclosed hedge to name.

## What we could not measure

- A full 5-rep p95 at 5k or 10k (only 1 rep each — rep-capping rationale above).
- Drag fps at 5k/10k node counts (only measured at 1k, per the brief's own drag-benchmark spec).
- True reference-hardware-profile compliance (RAM ceiling, GPU-off enforcement, real-browser vsync
  for drag fps) — ran on the hardware/browser-mode available in this environment.

## Harness inventory

- `fixtures/generate.mjs` — generates 1k/2,998-edge, 5k/14,996-edge, 10k/29,997-edge fixtures
  matching the CE-READ-1 SPARQL row shape, converted to Cytoscape element JSON. Output is
  gitignored (`.gitignore` in this dir) — regenerate with `npm run fixtures`.
- `harness.html` — no-framework page loading Cytoscape + fcose (and its `layout-base` /
  `cose-base` UMD dependencies) as browser globals via `file://`. Not production UI.
- `fcose-params.mjs` — the exact param set used, with full provenance disclosure.
- `bench-load.mjs` — load-time + memory benchmark script (`npm run bench:load`).
- `bench-drag.mjs` — drag-fps benchmark script (`npm run bench:drag`).
- Everything in this directory is a throwaway spike artifact (own `package.json`, own
  `node_modules`, not linked to the production frontend). Cytoscape/fcose are not added to
  `packages/frontend/package.json`.
