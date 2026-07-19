# UI-refit burn-down — session handoff (2026-07-19, coordinator session)

**TL;DR:** 21 PRs merged (#170–#193 range). All review-findings bug fixes + data wiring DONE.
Remaining = design-shaped rebuilds + A2, resuming **Tuesday 2026-07-21** (weekly token limit).
Canonical state: `docs/design/remediation-2-api-gaps.md` (checkboxes) + `ISSUES.md` (queue).

## Tuesday pickup list (priority order)

1. **A2** — busiest-entities label resolution. First CHECK LIVE (stack must be up): #182's
   `friendlyEntity` may already be good enough; if raw UUIDs persist, resolve target_iri →
   weave:label via a small lookup (SPARQL proxy or a label cache).
2. **H6** — /notifications full-width list page (mock §notifications carries reference design).
3. **SE6** — user profile surface ("Profile & preferences" currently lands on workspace General).
4. **C9** — new-instance authoring per mock pattern (replaces bare kind-select).
5. **SE4** — billing page (usage by engine/user/project + budget burn vs cap; FR-034/035
   counts-only note; mock §billing has the budget-bar reference, "PART A" markup).
6. **SE5** — operator console to the signed-off mock screen (role-gated UI; backend endpoints
   were scoped as a tail lane — check what exists first).
7. **C8** — bind Branding & standards page + G14 conformance KPI (data seeded by #184).
8. **C5 + V3b/V3b-3** — explore label cleanup + ask-bar wiring + KPI true-total + default
   filters/clustering. Hardest; AskBar is now click-transparent-wrapped (#192) and
   fetch-ask-answer scaffold exists per tracker notes.
9. Then: T5 (Home consolidation, absorbs H7), T6 (project-scoped Explore), G17 (needs a data
   source decision).

## Process facts that saved/cost time today (reuse them)

- **Sonnet engineer lanes cap at ~100 tool uses.** Scope ≤2–3 items per lane; instruct
  "COMMIT AFTER EACH ITEM" (one lane lost ALL work when its worktree vanished uncommitted).
  Continuation lanes in the SAME worktree work well (deps already installed).
- **Fresh worktrees need `npm ci` in BOTH packages/frontend AND packages/shared** before
  tests/hooks run (shared publishes zod).
- **Visual baselines are amd64-CI-only**: after any UI-visible change, dispatch
  `gh workflow run ci.yml --ref <branch> -f update_visual_baselines=true`, download the
  `visual-baselines` artifact, commit into `packages/frontend/tests/visual/__screenshots__/`.
- **axe-m2 stays rerun-first** (base-sensitivity; real race fixed #167). Two false reds today.
- **Playwright port-3000 trap**: reuseExistingServer attaches to the MAIN checkout's dev
  server — lanes must run their own `next dev` on another port for before/after proof.
- **Compose port traps**: worktree `docker compose` projects collide with primary (5432…) and
  slot stacks (5532–5832/8078/8178/8278); pick lsof-verified free ports; platform_stack
  fixture runs `down -v` at teardown unless `WEAVE_KEEP_STACK=1`.
- **Roles**: legacy "admin" = super-admin sentinel; never canonicalize
  (`.claude/memory/reference_legacy-admin-role-sentinel.md`).

## Ops / user manual steps (told to user in-session)

- A1 banner: reseed acme-corp audit_entries once the seed session is done (delete tenant rows →
  rerun seed → Verify chain). Code fixed (#177/#184); data-only.
- S3: one human first-click on the icon rail; drop the item if it navigates.
- Primary stack was DOWN at session end (parallel seed session's operation) — verify it's back
  before Tuesday's live checks.

## Coexistence

A parallel session works the main checkout (`feature/demo-seed-enrichment`, merged seed
commits directly). Coordinate via main; don't switch that checkout's branch. This session's
worktrees/branches were pruned at close.
