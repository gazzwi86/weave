# ONB-TASK-013 — partial delivery (help launcher "Take tour" scope)

## What's deferred

**AC-013-01** ("Take tour" resolves current area's tour) and **AC-013-02** (no-tour
area shows list of available tours) are only delivered for the one area that has a
real host today: Explorer, and only for the single tour that host actually starts.

## Why

Traced every page under `packages/frontend/app/`: the only place a tour engine is
mounted is `components/explorer/explorer-tour.tsx`, wired into `/explorer/page.tsx`.
That component is hardcoded to `tour.ge.completeness-map` — it ignores the *value* of
the `?tour=` query param and starts the completeness-map tour for any truthy param.
No page mounts `useTourEngine` / `TourOverlay` for the two shipped m1 tours
(`ce-overview` on `/ce`, `ge-canvas` on `/explorer`) or for `tour.ge.trust-mechanics`
/ `tour.ce.rules-policies` (m2).

A generic "Take tour" entry that deep-links `?tour=<tourId>` for any area/tourId
combination beyond the existing completeness-map case would render a link with no
listening host — a dead action, which is the exact E7-S1 failure mode AC-013-02 exists
to prevent. Building it would mean shipping dead-code UI rather than a real fix.

## What was delivered instead

- The existing Explorer-only completeness-map deep link (`?tour=completeness-map`,
  pre-existing from ONB-V1-TASK-002) is kept as-is.
- A generic "Take tour" entry was added to the launcher for the Explorer area only
  (the one area with a real host), reusing that same deep link.
- For every other area, "Take tour" is omitted from the launcher entry list rather
  than rendered as a dead link. This is a conservative reading of AC-013-02: "no dead
  action" is satisfied by not offering the action, not by offering a fallback list of
  tours that also can't start (the fallback list has the identical host problem).

## Unblocker

TASK-007 (or a follow-up) needs to either:
1. Generalize `ExplorerTour` (or extract a `TourHost`) to read the `tourId` from the
   query param and look it up in `TOURS`, mounting `useTourEngine`/`TourOverlay` for
   whichever tour matches, and
2. Mount an equivalent host on `/ce` (and any other m1 area with a shipped tour, e.g.
   `ce-overview`).

Once either lands, TASK-013's launcher can be extended with a real per-area "Take
tour" entry and the "list available tours when area has none" fallback (AC-013-02),
without dead links.

## Recommendation

Land this generalization as a small follow-up on TASK-007 (it owns the tour engine
and its page-mounting contract), then re-open TASK-013 to wire the launcher's "Take
tour" entry generically. Filing here rather than guessing at the host's future shape.
