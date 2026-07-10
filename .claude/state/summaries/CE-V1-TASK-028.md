# Progress: CE-V1-TASK-028 — Closure Config + Drift Guard + Pinned Impact Overlay (EPIC-016, 2nd task)

`constitution-engine` EPIC-016 (Graph Explorer). **PARALLEL LANE** worktree `../weave-CE-V1-EPIC-016`, branch
`feature/CE-V1-EPIC-016` (has TASK-021's overlay engine). Frontend-only. Coordinator-authored from receipt, pre-QA.
**Built NARROW** (coordinator call — brief self-contradicts on scope; see below).

## Outcome — engineer reports DONE (QA pending)

All AC/DoD-of-record green. Coverage 97%+ line on lib/explorer + components/explorer, eslint 0, tsc clean,
/simplify nothing, self-code-review no blockers/majors. E2E passes against real chromium.

## SCOPE DECISION (coordinator, logged for morning architect)

Brief self-contradicts: the dated "Scope correction (2026-07-08 red-team)" prose says TASK-028 owns the LIVE
SPARQL traversal client (fetch/highlight/badges, delivers orphaned M1 AC-6/AC-7, unlocks TASK-030) — but the AC
table / Test Requirements / pseudocode / DoD / cost ($0.32) all describe only config+guard+overlay-consuming-a-
traceResult, with NO traversal-client tests. Built NARROW per the testable AC/DoD of record. **Live SPARQL client
= tracked follow-up + HARD TASK-030 prereq** (see overnight-queue). Architect to reconcile the brief in the morning.

## Per-AC (all PASS per engineer)

- **AC-1** closure config: `OQ09_PREDICATE_CLOSURE` (13 ADR-018 entries, 9 fwd/4 inverse, verbatim from ADR;
  no predicate IRI literal anywhere else in traversal code). Snapshot test. `5a32bbe`/`69cc953`.
- **AC-2** drift guard: `validateClosure()` (MISSING-ONLY fails — additive CE growth is fine) + `useClosureGuard`
  boot hook (degrades to "drift" state on fetch failure/timeout/503 — NEVER silent pass; loud banner). `292c785`…`428143b`.
- **AC-6** mirror consistency: `isReversedLeg()` is ONE rule shared by `build-traversal-path.ts` (SPARQL string)
  AND `traversal-walk.ts` (in-memory BFS) → dependency/impact mirror BY CONSTRUCTION, not two hand-synced lists.
  Property test walks both directions, asserts symmetry incl. "Policy change reaches the governed Process". `11eee44`…`ab90b2d`.
- **AC-3/4/5/7** pinned overlay: `createPinnedImpactOverlay()` on TASK-021's OverlayEngine (reuses
  activate/deactivate/legendFor — NO fork; NO exclusiveGroup so pin coexists with a colour overlay, AC-7). AC-4
  auto-clear on source-node removal (`adapter.onElementRemoved`). AC-5 legend live hidden-by-filter count. 6 unit
  cases. `c8b89e4`…`7a372ed`.
- **AC-3 E2E** (`test_pinned_impact_survives_pan_zoom_filter`): `usePinnedImpact` hook → real canvas via dev hook
  `__explorerPinImpactTrace`; traceResult via genuine `walkClosure()` over an in-file fixture (no live fetch per
  the narrow call); proves amber trace border (new `__explorerNodeInfo.borderWidth`) survives pan+zoom+unrelated
  filter toggle, clears on unpin. **PASSES against real chromium** (no backend needed — pure fixture). `e6b212d`…`5294a8d`.

## KNOWN GAP (drift guard correctly surfaces it — logged)

The shipped SHACL declares only 2 of 13 ADR-018 closure predicates → the drift guard correctly reports drift
against the currently-shipped CE (banner + disabled traversal, exactly AC-2). Completing the 11 predicate shapes
is a governed ontology follow-up (queued). The guard makes it loud, not a silent empty trace.

## Commits (17, feature/CE-V1-EPIC-016, not pushed)

5a32bbe 69cc953 292c785 d50a476 091f4a2 cc16f78 428143b 11eee44 be6ef2b ab90b2d c8b89e4 4b9c541 4bae5f9 7a372ed
e6b212d c800abb 5294a8d.

## Epic status

EPIC-016 has TASK-030 (M2 Release-Gate Suite) remaining, blocked_by many (022/024/026/027/028/029) → NOT ready →
**CE-016 lane PARKS after this QA.** TASK-030 also gated on the live-traversal-client follow-up.
