# ONB-V1-TASK-002 blocker — beacon/welcome-modal renderer does not exist

## Gap

TASK-002's brief assumes the M1 "beacon machinery" (m1/TASK-008) already renders beacons and
welcome modals, and its DoD forbids building new components ("No new endpoints, reads, or
components beyond attribute edits + config wiring"). That machinery does not exist.

Checked (both empty):
- `grep -rn "content/beacons\|WelcomeModal\|beacon" packages/frontend --include='*.tsx'` — zero
  hits outside the dismissal persistence layer.
- No `.claude/state/summaries/ONB-TASK-008.md`. Git history shows PR #86
  ("ONB-EPIC-002 (partial) — Tour Engine + Beacons (TASK-007/008)") shipped TASK-007's TourEngine
  in full, plus TASK-008's *state + dismissal proxy routes only* (commit `7862cab0`,
  "TASK-008 onboarding state + dismissal proxy routes"). TASK-008's UI half — a per-screen beacon
  provider and welcome-modal renderer, per its own implementation hint — was never built.

What exists: `useDismissals` (bootstrap read + dismiss/persist), the dismissal API routes, and
`BEACONS`/`WELCOME_MODALS` config content (data only, no consumer). `TourOverlay` +
`useTourEngine` (TASK-007) are complete and tested — the tour half of this task is unblocked.

## Why this blocks TASK-002 specifically

- AC-002-02 (Explorer overlay beacons), AC-002-03 (tile beacon), the welcome-modal-CTA half of
  AC-002-01, and the beacon/axe part of AC-002-05 all require a beacon/modal to actually render.
  Nothing renders them.
- Building an a11y-complete, dismissal-wired renderer (TASK-008 was rated **M**) inside this **S**
  wiring task would violate this task's own DoD line and land the work at the wrong altitude —
  it's a shared dependency for the whole M2 overlay wave (TASK-002/003/004/005), not a TASK-002-only
  concern.

## Two secondary gaps to fold into whichever task builds the renderer

1. `BeaconSchema` (`packages/shared/onboarding/content/schema.ts`) has no CTA/href field. AC-002-03
   needs the tile beacon to link "See gaps in Explorer" (plain deep-link, no query param per the
   brief). Additive schema change + ADR (Law 10) once a renderer task claims it.
2. `ge.overlay.completeness-legend`'s DOM target (`OverlayLegendSection` in `canvas-legend.tsx`) is
   conditionally rendered — only when an overlay is active. Interacts with AC-002-04's
   absent-anchor skip-with-warning for both the tour step and the beacon on that anchor.

## Options

- **(a)** Build the renderer inside TASK-002, amending its DoD. Wrong altitude — a beacon/modal
  renderer is shared infrastructure for 4 tasks, not scoped to this one.
- **(b) — recommended** Insert a prerequisite task that finishes M1 TASK-008's UI half (shared
  beacon + welcome-modal renderer, config-driven, dismissal-wired, axe-clean). TASK-002/003/004/005
  then stay pure wiring as their briefs describe.
- **(c) — fallback** Reduce TASK-002 to the tour-only slice (plant `ge.overlay.controls` +
  `ge.overlay.completeness-legend`, flip shipped, wire `tour.ge.completeness-map` into the Explorer
  area, add the help-launcher entry) and move all three beacon ACs + the welcome-modal CTA to
  whichever task builds the renderer. Ships less of TASK-002 now but keeps every commit inside its
  own DoD.

## Recommendation

(b). It unblocks TASK-002 cleanly and every sibling M2 wiring task, rather than one-off patching
each task around a missing shared piece.

## Status

**Decision (coordinator auto-decision during overnight HITL pause): Option (c).**
Shipped the tour-only slice now; deferred the rest. Logged for morning human review — the
shared-renderer question (option (b), still recommended for the real fix) is unresolved.

### Delivered in this pass (tour-only slice)

- Planted `data-tour-id="ge.overlay.controls"` (`OverlayPanel` container,
  `packages/frontend/components/explorer/overlay-panel.tsx`) and
  `data-tour-id="ge.overlay.completeness-legend"` (`OverlayLegendSection` container,
  `packages/frontend/components/explorer/canvas-legend.tsx`) — additive attribute-only edits.
- Flipped both anchors' `shipped: false -> true` in `packages/shared/onboarding/anchors.ts`, same
  commit as the attribute planting (ADR-008 atomicity).
- Wired `tour.ge.completeness-map` into the Explorer page via a new `ExplorerTour` client
  component (query-param deep-link `?tour=completeness-map`, using the existing complete
  `TourOverlay`/`useTourEngine` from m1/TASK-007) and progress persistence against the existing
  `PUT /api/onboarding/tours/{tourId}/progress` proxy route.
- Added the help-launcher entry: `HelpLauncher` now shows "Take the completeness-map tour" (linking
  to `/explorer?tour=completeness-map`) only when the current route is under `/explorer`.

### Deferred — blocked on the missing M1 beacon/modal renderer

**Unblocker for all four items below: the M1 TASK-008 beacon/modal renderer (shared infra across
TASK-002/003/004/005) — never built. See "Gap" section above.**

1. **AC-002-02** — beacons on `ge.overlay.controls` ("New: Completeness overlay") and
   `ge.overlay.completeness-legend` in the Explorer overlay panel. Beacon content
   (`ge-completeness-map` in `packages/shared/onboarding/content/beacons.ts`) already exists from
   TASK-001 but has no consumer.
2. **AC-002-03** — first-visit beacon on `plat.role-home.completeness-map` linking "See gaps in
   Explorer". Also blocked independently on `BeaconSchema` having no CTA/href field (secondary gap
   #1 above) and on TASK-003 planting the tile anchor itself.
3. **AC-002-01's welcome-modal CTA half** — the tour mechanics (spotlight/steps/skip/resume) are
   delivered; the welcome-modal entry point into the tour is not, since `WelcomeModal` also has no
   renderer.
4. **AC-002-05's beacon/axe scope** — axe is verified on the tour (delivered); beacon-state axe
   coverage is deferred with the beacons themselves.

Test rows deferred with their ACs: the beacon-render unit test, the beacon-dismissal integration
test, and the beacon-dismiss-reload E2E test (Test Requirements table rows 3, 4, 6). Delivered
instead: two unit tests on the real `tour.ge.completeness-map` config (shipped-gating,
anchor-skip-with-warning), a component test for the `ExplorerTour` wiring (query-param autostart +
progress persistence — substitutes for the integration-test row), and one E2E spec (tour run +
axe, AC-002-01/05).

### Still open (not part of this pass either way)

Secondary gap #2 from above remains real and independent of the renderer: `OverlayLegendSection`
(`canvas-legend.tsx`) only renders while the completeness overlay is toggled on. In practice this
means the tour's second step (`ge.overlay.completeness-legend`) will anchor-skip-with-warning
(AC-002-04's sanctioned fallback) on a fresh page load, since the tour's `renderableSteps` snapshot
is computed once at `start()`, before the user has toggled the overlay on. The tour is not broken
(AC-002-04 holds — it degrades to a 1-step tour, never blocks), but it is not the 2-step experience
the config implies. Fixing this would mean either making the legend section's container always
present in the DOM (a GE-owned change, out of this task's "attribute edits only" scope) or
re-evaluating `renderableSteps` per-step instead of once at start (a TourEngine/TASK-007 change,
also out of scope here). Flagging for whoever next touches either component.
