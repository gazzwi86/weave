# TASK-001 OQ-01 benchmark report — Cytoscape.js + fcose at 1k/5k/10k nodes

**Status:** evidence + recommendation prepared by Engineer. **Go/no-go sign-off is
Architect/human-level** (AC-2/AC-3) — nothing here is self-signed. See
`docs/specs/weave/engines/graph-explorer/decisions/ADR-001-render-engine.md` for the decision
record awaiting approval.

## Reference hardware disclosure (required by task brief hint)

AC-1 asks for "the reference hardware profile (desktop Chrome latest, 16 GB RAM, no GPU
acceleration)". This benchmark ran on the **actual dev machine available in this environment**, not
a controlled reference box:

- **Actual hardware:** Apple Silicon (arm64) dev laptop, Chromium (headless-shell, bundled with
  Playwright 1.61), `--enable-precise-memory-info` launch flag for `performance.memory`.
- **Not verified:** RAM ceiling, GPU-acceleration-off enforcement, "desktop Chrome latest" (headless
  shell tracks Chromium but isn't identical to full desktop Chrome).
- The numbers below are **real measurements**, not simulated, but treat the reference-hardware
  clause as **unverified** — flag this explicitly at sign-off. Given the scale of the gap between
  measured and target (see below), hardware variance would need to be ~100x in this benchmark's
  favor to change the verdict, which is not plausible for like-for-like consumer hardware.

## fcose param provenance (required disclosure)

The task brief and `graph-explorer.md` both cite `prototype-findings.md` as the source of the
"prototype-tuned" fcose params, warning that any deviation invalidates the comparison. **That file
does not exist anywhere in this repo** (`find . -iname "*prototype*finding*"` — no hits).

Per Engineer Law 12 ("never read files from `prototype/`"), this benchmark does **not** read
`prototypes/weave-prototype/` to recover the real tuned values — a coordinator instruction offered
that as a fallback mid-task, but an agent message cannot lift my own operating law. Instead:

**Substitution used:** the published `cytoscape-fcose@2.2.0` package's own documented defaults,
taken verbatim from `node_modules/cytoscape-fcose/src/fcose/index.js` (not from any prototype
source) — see `fcose-params.mjs` for the exact param object and full provenance comment. Full
detail and the escalation options: `.claude/state/escalations/TASK-001-blocker.md`.

This is a **disclosed substitution, not a silent guess.** If the real prototype params differ
enough to change the verdict, a re-run is warranted once `prototype-findings.md` exists — but see
the "how bad is bad" section below for why that's unlikely to flip the outcome.

## Benchmark table

| Size | Reps | p95 load time | p95 memory peak | Notes |
|---|---|---|---|---|
| 1,000 nodes / 2,998 edges | 5/5 | **19,222.8 ms** (~19.2 s) | 144.05 MB | target: ≤ 3 s (p95) |
| 5,000 nodes / 14,996 edges | 1/5 | **751,211.4 ms** (~12.5 min) | 208.42 MB | reps capped — see below |
| 10,000 nodes / 29,997 edges | 0/5 | **did not converge** (>42 min, killed) | n/a | reps capped — see below |
| Drag fps @ 1,000 nodes | 1 pass, 26 samples | p95 (ascending, per brief's literal formula) = **222.2 fps** | — | see "drag fps caveat" below |

Raw data: `raw-results.json` (assembled summary), `raw-results-drag.json` (full 27-sample drag fps
array), `small-run-console.txt` (raw console transcript of the load-rep run, including the crash
message when the 10k probe was deliberately killed).

### Why reps were capped at 5k (1/5) and 10k (0/5)

The brief's protocol asks for 5 reps per size. I ran the full 5 at 1k first: **already ~19s p95 —
6x over the 3s/1k target and more than double the 8s/10k target**, using nothing but library
defaults. Rep 1 at 5k took ~12.5 minutes — roughly a 40x jump for a 5x increase in node count,
consistent with the O(n²)-ish repulsion-force cost typical of non-spatially-partitioned force
layouts. A single 10k rep (verified via `ps` on the Chromium renderer process: steady 99-100% CPU,
not deadlocked) ran for **over 42 minutes** without firing `layoutstop`, at which point I killed it.

Given that trajectory, 4 more 5k reps (~50 more minutes) and 5 reps at 10k (3+ hours, extrapolating
from the observed scaling) would cost hours of wall-clock for **zero decision-relevant new
information** — the gap between measured and target is already 2-4 orders of magnitude at every
tier. This is a disclosed, deliberate deviation from the literal 5-rep protocol, not a shortcut
taken silently. `bench-load.mjs` documents how to re-enable the full rep count and 10k tier if the
Architect wants a completed 10k number regardless (budget ~40+ min per rep observed).

### Drag fps caveat

The 27-sample drag-fps array is highly bimodal: alongside plausible in-range readings (many
110-145 fps, a few 45-65 fps), it contains implausible spikes (up to ~9,999 fps) that are almost
certainly headless-Chromium `requestAnimationFrame` coalescing artifacts after a scheduling gap —
not real frame-to-frame render cost. The brief's pseudocode literally specifies `p95(fps_readings)`
(ascending-sort convention), which is what's reported above (222.2 fps) — but for an FPS metric,
ascending-p95 rewards the *good* tail, not the *bad* one; a low percentile (p5) would better capture
worst-case jank. Of the 26 usable samples (first dropped as a sampler-start artifact), 4 read below
60 fps (min ~31.7 fps), median ~122 fps. **This benchmark did not reach the point where drag fps was
the limiting factor** — load time alone already fails the gate — so this caveat doesn't change the
verdict; it's flagged for methodology honesty, not because it's load-bearing here.

## Go/no-go recommendation

**Recommend: no-go** on Cytoscape.js + fcose at library-default params, at these node counts, on
this hardware.

**Rationale:**
- AC-2 requires <= 8s p95 load at 10k **and** >= 60fps drag at <= 1,000 visible nodes. Neither the
  1k nor 5k tier meets even their own, smaller-scale equivalent budgets (1k target 3s; measured
  19.2s p95 — over 6x). 10k never converged inside 42 minutes against an 8s target — roughly
  **300x** over budget by the time it was killed, likely far more if left to finish.
- The scaling trend (1k -> 5k: ~40x time increase for 5x nodes) means 10k would almost certainly be
  worse than 5k's already-catastrophic 12.5 minutes, not better — there's no plausible reading of
  "it just needs more patience" that lands inside an 8s budget.
- This is with the **published library defaults**, not the (missing) prototype-tuned params. Param
  tuning (fewer `numIter`, `quality: "draft"`, disabling `animate`) can materially cut convergence
  time — this is a real, standard mitigation path — but the gap here is multiple orders of
  magnitude, not the 20-40% improvement typical of parameter tuning alone. I don't think
  recovering the actual prototype params would flip this verdict, but I can't rule it out with
  certainty given they're genuinely missing from the repo (see provenance section above).
- Per AC-3, this recommendation means: **the Architect should raise the OQ-05 WebGL escape-hatch
  decision** (sigma.js or G6) and treat TASK-002 AC-7 (performance) as suspended until that renderer
  decision is approved.

**What would change this recommendation:** if the Architect re-runs with the real prototype-tuned
fcose params (once `prototype-findings.md` exists or is reconstructed) and gets a result within,
say, 5-10x of target rather than 100-300x, it's worth a real re-benchmark before committing to a
WebGL rewrite. Given the current gap size, I don't think that's the likely outcome, but it's a
cheap, disclosed hedge to name.

## What we could not measure

- A completed 10k load-time sample (killed at >42 min, no convergence).
- 5k/10k p95 across 5 reps (only 1 rep at 5k, 0 at 10k — see rep-capping rationale above).
- Drag fps at the (unreached) point where load time itself wasn't already the binding constraint.
- True reference-hardware-profile compliance (RAM ceiling, GPU-off enforcement) — ran on whatever
  hardware this environment provided (Apple Silicon dev laptop), not a controlled reference box.

## Harness inventory

- `fixtures/generate.mjs` — synthetic fixture generator (1k/2,998 edges; 5k/14,996 edges;
  10k/29,997 edges), matching the CE-READ-1 row shape (`node_iri`, `bpmo_kind`, `label` /
  `source_iri`, `target_iri`, `predicate`) converted to Cytoscape element JSON.
- `harness.html` — static, no-framework page loading Cytoscape + fcose (and its `layout-base` /
  `cose-base` UMD dependencies) as browser globals via `file://`. Not production UI.
- `fcose-params.mjs` — the exact param set used, with full provenance disclosure.
- `bench-load.mjs` — load-time + memory benchmark script (`npm run bench:load`).
- `bench-drag.mjs` — drag-fps benchmark script (`npm run bench:drag`).
- Everything in this directory is a **throwaway spike artifact** (own `package.json`, own
  `node_modules`, not linked from the production frontend). Cytoscape/fcose are not added to
  `packages/frontend/package.json`.
