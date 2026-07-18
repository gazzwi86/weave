# G15 escalation — remediation tracker doc doesn't exist here, diverges elsewhere

Task step 3 asked: tick the G15 checkbox in `docs/design/remediation-2-api-gaps.md`.

That file is not on `main` and not on this branch's history. It exists with conflicting content on
two other unmerged branches:

- `feat/build-data-gaps` — G1–G12 ticked with "Closed: ..." notes, no G15 entry at all
- `feature/refit-home-operator` (pushed to origin) — G1–G14 all unticked (stale relative to the
  build-data-gaps snapshot), but has an unticked G15 entry

## Options

(a) Don't touch the tracker in this lane. State "G15 done" in the PR body (already done) and let
    whichever lane owns `feature/refit-home-operator` reconcile the tick when it merges. Least drift —
    touches nothing outside this lane's own scope.

(b) Copy the most-current snapshot (`feat/build-data-gaps`, since it has the most resolution notes)
    onto this branch and append a ticked G15 entry. Risk: this branch and `feat/build-data-gaps` now
    both carry divergent tracker copies, and whichever merges second gets a doc conflict.

(c) Pull the fuller tracker in now, tick G15, accept the merge-conflict cost later.

## Recommendation

(a). PR #148 is the deliverable and it's merged/green regardless of tracker state; the tracker itself
is shared state across parallel lanes, and any edit here is a guess about which lane's snapshot is
current. Reconciling it belongs to whoever merges `feature/refit-home-operator` (the branch that
already carries the G15 line), not to this lane.
