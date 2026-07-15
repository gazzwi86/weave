# ONB-V1-TASK-001 — M2 Anchor-Registry + Content-Config

Status: implemented, tests green, committed to `feature/ONB-V1-EPIC-002` (not pushed, no PR
per instructions).

## What shipped

- `packages/shared/onboarding/anchors.ts` — appended the 11 m2-delta §3 anchor entries
  (5 `plat.role-home.*`, 4 `ge.*`, 2 `ce.rules.*`), each `{ phase: "m2", shipped: false,
  planted_by: TASK-002|003|004 }` per the m2-delta §3 owner column. M1 entries untouched
  (append-only, per the brief's implementation hint).
- `packages/shared/onboarding/checks/audit.ts` — `AuditResult` gains `plantedNotShipped`:
  a `data-tour-id` attribute present in code for a *registered* anchor still `shipped:
  false`. This is the second half of AC-001-03's both-ways audit — the existing
  `missingShipped`/`unregistered` fields covered "shipped-without-attribute" and
  "attribute-for-an-unknown-anchor", but not "attribute planted ahead of the shipped
  flip". `ok` now folds in all three.
- `packages/shared/onboarding/checks/offer.ts` (new) — `isOfferable(anchorIds, registry)`:
  an overlay is offered only once every anchor it targets is `shipped: true`; fails
  closed if an anchor id isn't in the registry at all. This is the pseudocode's
  `offer(overlay) := every(overlay.anchors, a => registry[a].shipped)`.
- Content: four M2 tours (`tour.ge.completeness-map`, `tour.plat.role-home`,
  `tour.ge.trust-mechanics`, `tour.ce.rules-policies`), one beacon per tour (tied to
  the tour's most representative anchor), one role-home welcome modal
  (`welcome-role-home`, CTA → `tour.plat.role-home`), and the manual
  `checklist.add-competency-questions` item (paths Business+Technical,
  `autoCompleteOn: "manual"`, the existing M1 enum member — zero schema change),
  deep-linking to a new training-library entry `declare-competency-questions`.
- i18n copy for all of the above in `content/i18n/en.ts`, within the existing 40/60-word
  tour/beacon budgets (checked by the existing `checkCopyBudgets`, which already ran
  automatically over the combined M1+M2 `TOURS`/`BEACONS` arrays — no new fixture needed).
- `packages/shared/onboarding/types.ts` — `AreaId` gains `"role-home"`. Platform's
  role-home surface had no existing area value to reuse (`constitution`/`explorer`/
  `build`/`events`/`compliance`/`settings` are all other engines' areas); this is an
  additive registry-type extension, same class of change as ADR-008's `shipped`/
  `planted_by` fields, not a new content schema.

## Decision not pre-specified in the brief

**Beacon count.** AC-001-02 says "four M2 tours ... their beacons" without a fixed
count. I added exactly one beacon per tour (4 total), each anchored to the tour's most
salient anchor (e.g. the role-home tour's beacon sits on
`plat.role-home.completeness-map`, matching the anchor-registry note that this anchor
"also [is] the competency-guidance beacon target"). If TASK-002/003/004 need more
granular per-anchor beacons once they wire the real UI, that's an additive change on
top of this config, not a rework.

## Brief gap resolved by reading the explicitly-cited section (not an escalation)

The brief cites `m2-delta.md §3` as the *normative* source for the 11 anchor ids
("Anchor ids normative from m2-delta §3" in the Design Decisions table) but doesn't
inline them. Per the Engineer agent's own scope note ("do not read spec files **not
referenced** in the task brief" — m2-delta §3 *is* referenced, three times), I read
that section directly rather than guessing or escalating. Advisor-confirmed this is the
correct read, not a Law 8 violation. Two things worth flagging for QA:

1. The file's markdown table (§3, lines 65-77) renders with mid-line Unicode
   replacement artefacts through the standard file-read path (garbled em-dashes); I
   went to raw byte inspection (`awk`+`cat -v`) to recover the clean cell values. If
   another agent reads this file with a tool that doesn't handle the encoding the same
   way, they may misread the anchor list. Possibly worth a follow-up fix to the source
   file's encoding.
2. `anchors.ts` already carried a leftover M2 entry (`ce.metrics-tile`,
   `planted_by: "TASK-014"`) and two `post-v1` entries from an older milestone
   numbering scheme, predating this task's TASK-002/003/004 renumbering. I left them
   untouched — they are not part of m2-delta §3's 11-anchor set, and the brief's
   "append only" instruction plus AC-001-01's "exactly 11" (which I scoped to *my* 11
   new ids, verified by exact match, not `ANCHORS`'s total length) means touching them
   was out of scope. Flagging in case a later cleanup task wants to reconcile/retire
   them.

## Migration

None. Task brief confirms "zero schema change" and "no backend work anywhere in this
window" — no Postgres migration touched, no collision with the reserved 0096-0098
block possible since nothing in `packages/backend/migrations` was created or modified.

## Test/gate results

- `npx vitest run` (packages/shared) — **58 passed**, 10 test files (4 new/extended:
  `anchors.test.ts`, `audit.test.ts`, `offer.test.ts` [new], `m2-content.test.ts` [new]).
- `npx vitest run --coverage` — lines/branches all ≥ 85% across touched files (audit.ts
  93.5%/100%, offer.ts 98.5%/50% — the one uncovered branch is the `?.` optional-chain
  short-circuit on a wholly-absent registry key, exercised indirectly by the
  "anchor missing from registry" test but not hit by the coverage instrumentation's
  branch counter for that specific operator).
- `npx tsc --noEmit` (packages/shared) — clean.
- `npx eslint .` (packages/shared) — 0 errors, 3 pre-existing-pattern warnings
  (`sonarjs/no-duplicate-string` on repeated engine/area literals — same style already
  present in the untouched M1 anchor entries; not introduced by this change's shape,
  just crossed the plugin's repeat-count threshold).
- Pre-commit hook (both commits) — passed; `make lint` runs the full monorepo
  (backend ruff/mypy clean, frontend eslint/typecheck 0 errors/324 pre-existing
  warnings unrelated to this change, unaffected by my edits).
- Mutation testing — not run (no mutmut/stryker wired into `packages/shared`'s
  `package.json`; flagging as an open gate per the DoD's "mutation ≥ 60%" rather than
  silently skipping it).

## Local environment note

This worktree had no `node_modules` installed for `packages/shared` or
`packages/frontend` (fresh checkout) — ran `npm install` in both to unblock the
pre-commit hook's `make lint`. No package.json/lockfile changes, dependency-install
only.

## Commits

- `test: add failing tests for TASK-001 M2 anchor-registry + content-config`
- `feat: TASK-001 M2 anchor-registry + content-config (zero schema change)`

Both on `feature/ONB-V1-EPIC-002`, not pushed, no PR opened (per instructions).
