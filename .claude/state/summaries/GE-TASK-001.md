# GE-TASK-001: SPIKE — Cytoscape 10k-node benchmark + Aurora layout schema

Branch: `feature/GE-EPIC-001` (off `origin/main`). Architect-owned spike; Engineer prepared
evidence + recommendation, nothing here is self-signed.

## What this task produced

- `packages/frontend/benchmarks/ge-oq01-spike/` — throwaway benchmark harness (own
  `package.json`/`node_modules`, not linked from production frontend; Cytoscape.js + fcose are
  dev-only in this harness, never added to `packages/frontend/package.json`).
  - `fixtures/generate.mjs` — synthetic 1k/5k/10k fixtures matching the CE-READ-1 row shape.
  - `harness.html` — no-framework static page loading Cytoscape + fcose (and its `layout-base`/
    `cose-base` UMD deps) via `file://`.
  - `fcose-params.mjs` — the exact param set used, with a provenance comment (see below).
  - `bench-load.mjs` / `bench-drag.mjs` — the two benchmark scripts (`npm run bench:load` /
    `bench:drag`), driven directly via `@playwright/test`'s chromium launcher (not the Playwright
    test-runner wrapper — a 10k rep alone can run 40+ minutes, which doesn't fit a sane
    single test-timeout alongside fast 1k/5k reps).
  - `report.md` — full benchmark report (table, methodology caveats, go/no-go recommendation).
  - `raw-results.json`, `raw-results-drag.json`, `small-run-console.txt` — raw data.
- `packages/backend/migrations/0008_explorer_layout_positions.sql` — Aurora layout-positions
  schema, per AC-4 verbatim. Verified parseable + correct (composite PK, RLS policy) against an
  isolated throwaway `docker run postgres:16` (never touched the shared `docker compose` stack;
  container removed after verification).
- `docs/specs/weave/engines/graph-explorer/decisions/ADR-001-render-engine.md` — updated (not a
  new file) with the benchmark evidence and an Engineer **no-go recommendation**. `status:
  pending-approval`, `confirmed_by: none` — awaiting Architect/human sign-off, per AC-2/AC-3 being
  manual sign-off artefacts.
- `.claude/state/escalations/TASK-001-blocker.md` — escalation note re: `prototype-findings.md`
  not existing in this repo (see decisions below).

## Decisions made / nuances discovered

1. **`prototype-findings.md` does not exist anywhere in this repo**, despite being cited by the
   task brief, `graph-explorer.md`, and this ADR as the source of "prototype-tuned" fcose params.
   Per Engineer Law 12 ("never read files from `prototype/`"), I did not read
   `prototypes/weave-prototype/` to recover the real params, even though a coordinator message
   offered that as a fallback — an agent instruction mid-task cannot lift my own operating law.
   Used `cytoscape-fcose@2.2.0`'s own published library defaults instead (verbatim, from
   `node_modules/cytoscape-fcose/src/fcose/index.js`), disclosed prominently in the report/ADR.
   **Recommend the Architect backfill `prototype-findings.md` for TASK-002/005 to cite going
   forward** — this SPIKE doesn't need to block on that, but future tasks citing the same missing
   file will hit the same gap.

2. **Benchmark reps capped below the literal 5-per-tier protocol**, disclosed in full in
   `report.md`: 1k ran the full 5/5 (p95 19.2s — already 6x over its own 3s target). 5k's first rep
   took ~12.5 minutes; a 10k rep ran >42 minutes at steady 100% CPU (verified not deadlocked via
   `ps`) without converging, and was killed. Given the gap is already 2-4 orders of magnitude at
   every tier measured, burning hours more for the remaining reps would not have changed the
   verdict. `bench-load.mjs` documents how to re-enable full reps if the Architect wants a
   completed 10k number regardless.

3. **AC-4's RLS policy diverges from the repo's platform-tenancy convention** (0001_tenancy.sql
   etc. use `tenant_id TEXT` + `current_setting('app.tenant_id', true)`; AC-4 specifies
   `tenant_id UUID` + `current_setting('app.current_tenant_id')::uuid`, no `missing_ok`). Followed
   AC-4 verbatim since it's the task brief's explicit, repeated, quoted spec — flagged this
   divergence in the migration's own header comment for the Architect's sign-off review, since it's
   a real inconsistency worth a conscious decision, not silently reconciled either way.

4. **Drag-fps methodology caveat**: the brief's pseudocode literally specifies `p95(fps_readings)`
   using an ascending-sort convention, which for an FPS metric rewards the *good* tail rather than
   worst-case jank. Reported the number as literally specified (222.2 fps) but flagged in the
   report that ~15% of samples read below 60fps and that a `p5` convention would be a more honest
   worst-case metric — didn't change the convention without being asked, since the benchmark never
   reached the point where drag fps was the binding constraint anyway (load time already fails the
   gate at every tier).

## Edge cases / risks for TASK-002 and TASK-004

- **TASK-002 AC-7 (performance)**: per this ADR's evidence, should be treated as suspended pending
  the Architect's OQ-05 WebGL renderer decision (sigma.js or G6) — do not build against the
  Cytoscape/fcose performance assumption until that's signed.
- **TASK-004**: schema is approved-pending-Architect-review, not yet unblocked in the formal sense
  (AC-5 requires Architect approval). The `SET LOCAL app.current_tenant_id = '{tenant_id}'` note
  from the task brief hints applies verbatim — must be called inside every
  `async with session.begin()` block, not once at pool-checkout, since SQLAlchemy async pools
  reuse connections and `SET LOCAL` is connection-scoped.
