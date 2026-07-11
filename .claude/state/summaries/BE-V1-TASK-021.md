# Progress: BE-V1-TASK-021 — Direct Project Prompt (FR-065) (EPIC-003, LAST task → closes epic)

`build-engine` EPIC-003. Worktree `../weave-BE-V1-EPIC-003`, branch `feature/BE-V1-EPIC-003` (same branch as BE-019, sequential).
Full-stack. Built across overflow + continuation (backend WIP recovered/committed first). Coordinator-authored pre-QA. HEAD
`ea78b00e`, not pushed, tree clean, docker torn down.

## What shipped (8 ACs)
- **Backend** `briefs/prompt_synthesis.py` + `routers/prompts.py` + `schemas/prompts.py` + `state_spine.py`/`orchestrator.py`
  edits + **migration `0067_state_spines_trigger.sql`** (correct next number; 0065=BE-019 this branch, no 0066). Persists a
  prompt trigger on the state spine + enqueues a `trigger='prompt'` run. **Reuses `run_dark_factory` via
  `start_or_resume_run(prompt_context=...)` — NO second cost path / no new orchestrator/dispatch loop** (ADR reuse).
- **Frontend** `prompt-box.tsx` + `use-prompt-status.ts` + `use-prompt-access.ts` + proxy routes (prompts + state, zod-validated).
  Dashboard prompt box (on the TASK-019 project page).

## MOUNTED (grep-proven)
`page.tsx` (TASK-019 route, linked from Registry grid) → `<ProjectDashboard>` → `project-dashboard.tsx:165 <PromptBox>`.
Design tokens only (stripped an invented `--opacity-disabled`).

## Per-AC (engineer-reported — QA re-verify; 8 ACs)
AC-1 persist+enqueue trigger='prompt' (integration `test_editor_submit_persists...`, ran real docker) · AC-2 **reader 403 +
audit** (`test_reader_submit_is_refused_and_audited` — authz_denied row + zero project_prompts rows, ran real) · AC-3 PRs on
external repo (met-by-inference: rides run_dark_factory, TASK-012 covers PR path; E2E written not run) · AC-4 visible run status
(component test queued→running poll + E2E) · AC-5 identical caps/gates (met-by-inference: reused entry point, TASK-013 covers) ·
AC-6 reject empty/oversized (unit backend + proxy shape guard) · AC-7 Architect brief synthesis (unit) · AC-8 DoR-fail hold (unit).

## ⚠️ QA FOCUS
- **AC-2 reader-403 + audit** (RBAC/tenancy — a reader must NOT be able to trigger a build; verify the authz + audit row + no
  project_prompts write). **AC-5 no-second-cost-path** — confirm the prompt run reuses the SAME budget/gate/metering path (no
  fork). Tenant-scoping (JWT only).
- **E2E adjudication:** `project-prompt.spec.ts` WRITTEN but NOT run this session (budget — NOT a PROJ-009/010 block; engineer
  says he didn't launch the full trio). QA decide: AC-1/2/4 backend+component tests prove real state → E2E-met-by-inference OK,
  OR require the E2E run. AC-3/5 are structural-reuse met-by-inference.
- Migration 0067 correct + applies.

## Gates
tsc 0 · eslint 0-err · mypy 0/501 · ruff 0 · coverage met-by-inference (full unit+integration pass). Backend integration ran
real (docker isolated, torn down).

## Commits (feature/BE-V1-EPIC-003, not pushed): 31bd6974 (persist trigger + migration 0067) · 94baf6ad (Law-E refactor) · b4604155 (prompt box frontend) · ea78b00e (integration + E2E, HEAD).

## Epic status — EPIC-003 CLOSES on QA-pass → HELD PR (migrations 0065 + 0067 = schema tier)
BE-019 + BE-021 both done on this branch. On QA PASS: reconcile onto green main (BE-019 dashboard + BE-021 prompt; check for
main-drift), push, PR, review + CI green, then **HOLD for human merge** (2 migrations). Run ui_verify on /build project page +
task dashboard before close (UI-gate w/ BE-019).
