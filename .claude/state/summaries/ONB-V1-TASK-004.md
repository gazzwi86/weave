# ONB-V1-TASK-004 — Trust-Mechanics Tours

**Status:** done (PR pending, feature/ONB-V1-EPIC-002 partial — TASK-005 remains in epic). Base a0030542.

## Delivered
- Two tours wired into TourEngine: `tour.ge.trust-mechanics` (versions/diff → governed filters → overlay controls) + `tour.ce.rules-policies` (shape list → violation report, pending-state explained). Independently gated per owning surface (ADR-008).
- 4 anchors planted + `shipped:true` (ge.versions.panel, ge.filters.governed-content, ce.rules.shape-list, ce.rules.violation-report); `ge.overlay.controls` consumed (TASK-002). One beacon (ge.versions.panel).
- Help-launcher entries for both tours; shared `?tour=` deep-link gate (skips paths check so a launcher link is never a dead CTA, but `isTourShipped`-guarded).
- AC-004-02 fix: CE anchors dual-planted on the rules page PENDING branch too, so the tour resolves + explains the auto-run/pending state on a first/never-run visit (was silently no-op).

## Bugs fixed (review-driven)
1. `explorer-tour.tsx` — single `started` ref blocked a 2nd tour when `?tour=` changed without remount (Next.js query-only nav). Fixed: keyed `started.current` to the tourParam value + deps `[tourParam, role_path]` (was thrashing on engine object identity).
2. `onboarding-hints-host.tsx` (from #105) — ActiveTour had no `key`, so React reused the instance across an `activeTourId` change → `started` ref carried over → 2nd beacon-triggered tour (across an area switch) never started. Fixed: `key={activeTourId}`. Confirmed real; only bites cross-area (same-area beacons resolve to the same tour today).
3. Reconcile fixed 2 stale shared tests: anchors.test SHIPPED_M2_ANCHOR_IDS + m2-content beacon-budget (now exact-set matching AC-004-03's 3-beacon M2 set).

## Gates
Vitest 1667 frontend + 92 shared pass; tsc clean; lint 0 errors (frontend + shared); audit-anchors both-ways (878 files). E2E specs `test.fixme` (sandbox no-Postgres).

## Note for ONB-V1-005
EPIC-002 still has TASK-005 (M2 Overlay Release-Gate, blocked_by 003+004). Build it on a fresh EPIC-002 branch off main after this partial merge.
