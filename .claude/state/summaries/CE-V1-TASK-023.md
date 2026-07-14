# Progress: CE-V1-TASK-023 — Edit Controller + Write Proxy + Quick-Add + Draw-Edge (EPIC-017 root) — ⚠️ ESCALATED, NOT DONE

`constitution-engine` EPIC-017. **PARALLEL LANE D** worktree `../weave-CE-V1-EPIC-017`, branch `feature/CE-V1-EPIC-017`.
Frontend. Built across 4 engineer passes (3 overflows). **PARKED pending 2 decisions — see below.** HEAD `62bf816`, not pushed, tree clean.

## ⚠️ Honest state (4th engineer caught prior mis-reports)
Prior continuations claimed "all 7 ACs pass" — WRONG. The brief has **9 ACs, not 7**, and the built hooks are
**unit-tested in isolation but NEVER MOUNTED** into the canvas → unreachable in a real browser. E2E was correctly NOT
written (would be a fake pass against unmounted hooks).

## What IS genuinely done (committed, unit-tested)
- AC-1 server-side actor from JWT (`6a4bc42`,`470c8b3`), AC-2 spoofed-actor 400, AC-4 422-rollback logic in `commitOp`,
  AC-5 timeout-rollback, AC-8 reconcile — all in the Edit Controller + write proxy, unit-tested.
- Hooks built + unit-tested but UNMOUNTED: `useQuickAdd`+`QuickAddPopover`+`QuickAddOverlay` (AC-3), `useDrawEdge`
  (`62bf816`, AC-6) + cytoscape-edgehandles gesture, `canEditCanvas` pure fn (AC-7). `cytoscape-edgehandles@^4.0.1`
  is a real package.json dep. 695 frontend tests green, tsc 0, use-draw-edge coverage 86%.

## ⚠️ NOT met — needs decisions + build (the escalation)
1. **AC-3/AC-6 unreachable** — `ExplorerInteractions` (the canvas composer) imports NONE of the hooks/overlays. Mounting
   is buildable BUT gated on the AC-7 role decision (edit affordances gate by role).
2. **No rel-type picker UI** for draw-edge — pseudocode's `relTypePicker(paletteRels)` unimplemented (only `fetchRelTypes`).
3. **AC-7 role-source = ARCHITECTURAL DECISION** (spec-ambiguity): `canEditCanvas` needs a client-side `role`, but
   `app/explorer/page.tsx` is a plain client component with no session/role threaded from the server.
   `getCognitoRoleClaim`/`getSessionClaims` exist server-side only. **DECISION: how does the client get role?**
   (likely thread a server-fetched session prop into `ExplorerPage` — needs confirming, not assuming.)
4. **AC-9 glass inspector panel — DOES NOT EXIST** (4-tab Properties/Edges/PROV + Edit entry, own D-1..D-7 design reqs).
   A whole Complexity-L UI organism. **DECISION: in this task's scope, or split?** (brief says splitting = circular dep,
   so probably in-scope → this task is L-sized, not the S/M it was laned as.)

## Resume plan (after decisions)
Settle AC-7 role-threading + AC-9 scope → build rel-type picker (mirror QuickAddPopover) → mount overlays + canEditCanvas
into ExplorerInteractions → build the inspector organism → THEN the 2 Playwright E2E become writable for real.

## Lesson
Continuation summaries inherited a wrong AC count (7 vs 9) + counted unit-tested-unmounted hooks as "met." A UI task
isn't done until it's MOUNTED + reachable + E2E-provable. QA would have caught it (as PLAT-012's did); engineer self-caught.

## Commits (feature/CE-V1-EPIC-017, not pushed): 15 total, HEAD 62bf816.
