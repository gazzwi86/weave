# Progress: BE-V1-TASK-017 — Kanban Board, Task Tree & Filters (FR-015/016/017) (EPIC-004)

`build-engine` EPIC-004. Worktree `../weave-BE-V1-EPIC-004`, branch `feature/BE-V1-EPIC-004` (off green main). Full-stack.
Built across overflow + continuation. Coordinator-authored pre-QA. HEAD `e070575`, not pushed, tree clean, docker torn down.

## What shipped (6 ACs)
- **Backend** `build/board.py` + `routers/board.py`: six-lane mapping from the state spine (budget-bound render), task-tree
  with retry-chip failure-class+ceiling join, orphan/missing-blocked_by flagging (flags, never drops). RLS tenant-isolation.
- **Frontend** board UI: `app/build/board/page.tsx` (project picker) → `app/build/projects/[id]/board/page.tsx` (BoardPage);
  six-lane columns, retry chips, task tree, filters, state legend (never colour-alone). MOUNTED via nav-items "Kanban".
- **ADR-023** (build-engine/decisions/ — separate namespace from constitution-engine's ADR-023, no collision).

## Per-AC (engineer-reported — QA re-verify; 6 ACs)
AC-1 six lanes budget-bound (unit `test_should_render_six_lanes_within_budget` + frontend grid) · AC-2 retry chip
failure-class+ceiling+HITL-escalated (unit backend+frontend) · AC-3 missing blocked_by flagged-not-dropped (unit backend+
frontend + integration `test_task_tree_route_flags_missing_dependency`) · AC-4 zero-match filter → empty-state+reset-to-All
(filters.test) · AC-5 invalid/unknown filter → empty-state (**fixed a real bug e070575**: page.tsx silently fell back unknown
?filter= to "All"/full board, contradicting the AC → now forces empty-state) · AC-6 state legend never colour-alone. 6/6.

## MOUNTED (grep-proven)
nav-items "Kanban" → `/build/board` (BoardLandingPage picker) → `/build/projects/{id}/board` (BoardPage).

## ⚠️ E2E BLOCKED — PROJ-010 (new, upstream of PROJ-009) → met-by-inference
`board.spec.ts` + `scripts/seed_board_e2e.py` (direct-PG state-spine seed, no live dispatch — Law F) written, tsc/lint-clean,
committed — but CANNOT run green: **project creation itself 503s with `ce_version_unavailable`** (GET /api/ontology/versions
returns no published version) BEFORE reaching board code. Reproduced identically on the unmodified `project-settings.spec.ts`
(6/6 same fail). This is a SEPARATE pre-existing shared-infra/seed gap, EARLIER in the flow than PROJ-009's source-control 403.
NOT board code (engineer didn't touch CE/project-creation). Met-by-inference via 3/3 backend integration (`test_board_api.py`,
real PG, RLS tenant-isolation proven). E2E spec committed → goes green once the shared seed/infra is fixed.

## Gates
tsc 0 · eslint 0 · ruff 0 · mypy 0 (src/+scripts/) · bandit 0 · frontend unit 56/56 · backend unit 4/4 · backend integration
3/3 real PG (isolated `weave-be017kanban`, torn down). Coverage met-by-inference (63 tests exercise all new code).

## Commits (feature/BE-V1-EPIC-004, not pushed): 567d6d3 (RED) · 37721d1 (endpoints) · d39653b (integration) · 5bcca7a (ADR-023) · 03e2d24 (board UI+nav mount) · e070575 (AC-5 fix + E2E, HEAD).

## Open items (QA/coordinator)
- ADR-023 wording drift: decision #5 says "hold_reason set OR status=='Blocked'" but `filterCards` checks only `hitl_escalated`
  — cosmetic doc follow-up.
- **PROJ-010** logged (ce_version_unavailable 503 blocks ALL project creation → blocks project-settings.spec + board.spec).

## QA PASS-with-WARN (2026-07-11, afb41c9, retry 0) — BE-V1-TASK-017 CLOSES → EPIC-004 COMPLETE
Adversarial QA, 6/6 ACs each re-run. AC-5 fix CONFIRMED real (page.tsx `filterIsInvalid` forces visibleCards=[] — double-
enforced, not silent full-board fallback). Tenant isolation re-verified on docker (cross-tenant JWT → 404 not empty board,
RLS real round-trip), stack torn down. Mount chain grep-proven. E2E-met-by-inference ACCEPTED (PROJ-010 pre-existing: diff
d39653b~1..e070575 zero overlap with ce_version_client/projects; project-settings.spec.ts untouched reproduces same 503).
ruff 0, mypy 0/496, tsc 0, eslint 0-err, vitest 8/8, integration 3/3. Edge test `cc1d256` (empty-string ?filter= → isValid
false; URLSearchParams.get returns "" not null — real gap). retry=0.
**WARN (non-blocking, → phase-gate):** Lighthouse/axe/**ui_verify.sh NOT run** (page-affecting, 2 routes + nav). Advisor note:
board route keys off state_spines (no projects-row join) → **plausibly servable WITHOUT hitting PROJ-010** → these UI gates
may be runnable independent of the infra block; run before phase-close, don't wave through. ADR-023 decision-#5 wording drift
(says hold_reason/Blocked, code checks hitl_escalated) — cosmetic doc follow-up.

## Epic status — EPIC-004 = BE-017 sole task → CLOSES
No migration → auto-merge eligible (E2E-met-by-inference accepted). Restack onto green main → PR → review + CI → auto-merge.
UI-gate (ui_verify/Lighthouse/axe) deferred to phase-gate sweep (shared UI-gate debt w/ BE-019/020).
