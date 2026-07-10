# Progress: CE-V1-TASK-021 — Overlay Engine + Heatmap/Domain-colouring (EPIC-016, first task)

`constitution-engine` EPIC-016 (Graph Explorer overlays). **PARALLEL LANE** worktree
`../weave-CE-V1-EPIC-016`, branch `feature/CE-V1-EPIC-016` (stacked on EPIC-015 — has TASK-020's canvas +
shared legend/toolbar shell). Frontend-only. Coordinator-authored from receipt, pre-QA.

## Outcome — engineer reports DONE (QA pending)

7/7 ACs proven; 687/687 frontend tests; tsc/eslint clean; coverage all >80%. QA to re-verify (esp. shell
reuse not-forked, token discipline, and the 2 designed-around gaps below).

## What shipped

- **Overlay engine** (`overlays/overlay-engine.ts` + `heatmap-overlay.ts` + `domain-colouring-overlay.ts`) —
  heatmap (value→colour map) + domain-colouring, mutual-exclusion within exclusiveGroup "colour".
- **Shell reuse (D-1, load-bearing):** overlay legend mounts as a SECOND SECTION inside the existing
  `CanvasLegend` (new `overlay` prop) — NOT a second floating panel. `OverlayPanel` sits beside `FilterPanel`
  in the same `CanvasFilterChrome` root. `RendererAdapter` gained `applyNodeColours`/`clearNodeColours` on the
  existing batch-apply seam (one cy.batch() each) — TASK-020's adapter NOT forked.
- **Config-driven** (`config.ts`: heatmapMappings/domainPalette/domainNoneColour/heatNoneColour) — no magic numbers.
- **Tokens:** heat-1..5/heat-none, series-1..6, kind-fallback — all via var(); zero ad-hoc hex/px.

## Per-AC (all PASS per engineer)

AC-1 heatmap batched ✓ · AC-2 mutual-exclusion ✓ · AC-3 domain-colouring + palette-cycle-on-overflow + legend
note (7 domains vs 6 colours) ✓ · AC-4 deactivate restores base ✓ · AC-5 300ms p95 — measured at M1's
MAX_VISIBLE_NODES=1000 cap (not literal 10k, same ADR-002 rescope as TASK-020 AC-7, consistent) ✓ · AC-6
config-driven no magic ✓ · AC-7 axe-clean legend + colour-always-paired-with-text + keyboard-operated ✓.

## Coverage / gates

overlay-engine.ts 100%, overlay-panel.tsx 100%, heatmap-overlay.ts 96.5%, domain-colouring 97.6%,
use-overlay-controls 96.8%, canvas-legend 100%. Full frontend 687/687. tsc clean, 0 eslint errors (2 near-misses
fixed by splitting test files: `9e77fd5` + earlier).

## E2E — type-checked, full-run DEFERRED to epic close

`tests/e2e/explorer-overlays.spec.ts` (3 scenarios) type-checks + eslint-clean. Local full-run hit a timeout on
`getByRole("switch")` focus — engineer reproduced the IDENTICAL timeout on the already-merged TASK-020 baseline
spec in the same sandbox → **pre-existing environment/infra gap, not this spec.** Consistent with "type-check
now, run at epic-close ui_verify." (Same infra class as XT-PLAT010-2's E2E-can't-run, different cause — sandbox
can't drive the explorer canvas E2E; a real served app at epic close will.)

## DESIGNED-AROUND GAPS (escalated + logged; QA: confirm graceful, do NOT fail)

1. **Heatmap value→colour vocab empty** — `DEFAULT_EXPLORER_CONFIG` ships all 4 dimensions with `values: {}`
   (source `prototype-findings.md` missing, only in old `.history`). Every node lands "unmatched" → all-grey +
   legend "no data for this dimension" note (AC-6 graceful, tested). Follow-up queued.
2. **CE-READ-1 rows carry no `key_properties`** (M1 bulk-load gap, first flagged TASK-020) — heatmap can't
   colour real loaded data end-to-end, only the mechanism is provable. Degrades to "no data", not error. Same
   bulk-key_properties follow-up as TASK-020.
3. **Series-palette dark-only** (light-mode WCAG-1.4.11 gap) — coordinator-approved dark-first; design follow-up queued.

## Commits (feature/CE-V1-EPIC-016, not pushed)

Core/config/token: c385cde 47865e0 40ec91c ef12af6 05f12a2 a841275 · hook/panel/legend/wiring: 0ba519f 46619e9
25af40b 2d65e60 · a11y/perf/integration/E2E: 96a8793 c86a25f 73016fe 9e77fd5 be412f2.

## Dependencies unlocked (within EPIC-016)

TASK-028 (blocked_by TASK-021) — next in EPIC-016.

## QA PASS (2026-07-11, retry 0) — TASK-021 CLOSES

task021-qa PASS, clean first pass. 7/7 ACs verified against running code (D-1 shell reuse confirmed REAL by
source read — CanvasLegend `overlay` prop renders 2nd section in same glass panel; RendererAdapter EXTENDED with
applyNodeColours/clearNodeColours delegating to renderer-adapter-colour.ts, NOT forked). 688/688 Vitest, tsc
clean, eslint 0 errors, coverage all files 96.5-100%. Token grep clean (zero hex/px in the 7 files). axe-clean
(2 real scans). Edge test `aa91506` (zero domain-membership edges). E2E deferred to epic-close ui_verify
(sandbox timeout reproduces on merged TASK-020 baseline — infra, endorsed).
Non-blocking: (1) disabled-toggle a11y nit — native `disabled` removes from tab order contra the comment;
PRE-EXISTING (mirrors filter-panel.tsx LayerToggleList), not a WCAG fail (disabled exempt), fix = aria-disabled
→ logged follow-up; (2) PO honesty — heatmap all-grey until vocab+key_properties land (accepted gaps).
