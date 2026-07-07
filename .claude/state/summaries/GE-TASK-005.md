# GE-TASK-005 — Drill-In: Domain Focus + Neighbour Expand/Collapse (graph-explorer, EPIC-002)

**Status:** DONE — recovered from a stalled lane, closed PARTIAL-by-design (see Scope).
This is the LAST task of GE-EPIC-002 and the **last backlog task in the whole M1 spine** (31/31).
**Branch:** `feature/GE-EPIC-002` (rebased onto current `main`). **Original per-commit history
preserved on ref `ge005-backup`.**

## Scope (shippable subset — the rest is spec-gated, not dropped)

Delivered: **AC-1–AC-5, AC-9, AC-10** — domain focus (right-click → focus a domain's members,
empty-state message, error + retry with opacity restore), neighbour expand/collapse with a
>500-node confirm gate, the CE-READ-1 SPARQL domain-member query + IRI-safety guard, and
cross-tenant isolation on the fetch path.

Deferred: **AC-6 / AC-7 / AC-8** (impact/dependency traversal). These are blocked behind **OQ-09**
— the predicate-closure hand-off from the CE M1 data-model (`graph-explorer.md` line ~1032,
"OQ-09 predicate-closure hand-off … gates TASK-005 AC-6/AC-7"). OQ-09 is still open. The task brief
itself authorises shipping AC-1–5/9 independently and holding AC-6–8 for OQ-09. **This is a spec
gate, not a scope cut** — a follow-up task ships impact traversal once OQ-09 lands.

## Recovery narrative (why this needed coordinator surgery)

The building lane died 34h before pickup: last commit `1f6d40f`, one dangling **uncommitted**
`renderer-adapter-test-support.ts` edit (orphan `position`/`fireDragFree` helpers with no consumer,
breaking `tsc`), no summary, `progress.json` never flipped, no PR. The branch had also drifted far
behind `main` (main gained layout-persistence, CE authoring/query E2E, IA skeleton since the branch
forked).

Coordinator actions:
1. Discarded the orphan uncommitted test-support edit (no consumer; broke typecheck).
2. Squashed the 22 GE-005 commits onto their true base (`7dad40d`) into one net-diff commit, then
   `rebase --onto origin/main` so conflicts resolved **once** (10 files) instead of 22 times.
3. Delegated the union-merge of the 10 conflicts to an engineer (keep BOTH main's later features and
   GE-005's additions); verified independently.

## Verification (coordinator-run, on the rebased result)

- `npx vitest run` → **410 passed / 410, 80 files** (main's suite + GE-005's new specs).
- `npx tsc --noEmit` → clean.
- `npx eslint lib components tests` → **0 errors**, 62 warnings (all pre-existing style/line-count).
- Merge-fix knock-ons the engineer made: `graphId` prop now defaults to `config.layoutGraphId`
  (GE-005 tests never passed it — genuine conflict, resolved by making it optional); a pre-existing
  duplicate `bindingsToRows` in `app/api/proxy/sparql/route.ts` renamed to `sparqlResultsToRows`.

## NOT done here (deferred to the phase gate, by the user's sequencing)

- **`ui_verify.sh --full` / Playwright E2E** were NOT re-executed at epic close. The E2E specs exist
  and were last touched in-lane by a QA "fix racy right-click E2E" commit (so they ran green there),
  but the deterministic UI gate is the **phase gate's** job and the user explicitly wants the phase
  gate run after all in-flight work lands. Flagged so it is not assumed-passed.
- Coverage ≥80% not measured as a number; 410 passing tests over the changed code is strong proxy.

## Notes for the phase gate / next task

- GE-EPIC-002 PR carries GE-005 code + this summary + the `progress.json` 31/31 flip. The stale
  per-commit history and any GE-EPIC-001-era state on the old branch were intentionally dropped by
  the rebase-onto-main (that content is already in `main`).
- Impact-traversal follow-up (AC-6/7/8) should be specced as its own task once OQ-09 resolves.
