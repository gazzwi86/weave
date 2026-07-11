# Progress: BE-V1-TASK-018 — Run-Log Sink + Task Detail 5-Tab Panel (FR-019/FR-020) (BE-EPIC-005, sole task → closes epic)

`build-engine` BE-EPIC-005. Worktree `../weave-BE-V1-EPIC-005b`, branch `feature/BE-V1-EPIC-005` (off green main). Full-stack.
Built across overflow + 2 continuations. Coordinator-authored pre-QA. HEAD `b2613e97`, not pushed, tree clean, docker torn down.
**NO migration** (0018 already had log_location_ref) → auto-merge eligible.

## What shipped (7 ACs, all DONE per engineer)
- **AC-1 RunLogSink** (`build/run_log_sink.py`) — append-only, tenant-scoped, wired into `orchestrator.py::run_dark_factory`
  (emit at dispatch_start/end/halted_budget/halted_turn_cap/run_phase, close in finally). 23/23 orchestrator unit.
- **AC-2** task-detail assembly + `routers/task_detail.py` + proxy + `TaskDetailPanel` 5-tab UI.
- **AC-3** captures 8-cell grid (`tests-tab.tsx` CAPTURE_STATES) + honest absence (`captures-not-available`).
- **AC-4** console log: finished-run path fetches `/console-log`; live path = honest disclosed degraded (`console-live`) — NO SSE
  hook exists in codebase yet, `ponytail:`-commented (ceiling = polling only, upgrade path named). QA confirm acceptable per brief.
- **AC-5** audit tab, `audit-unavailable` on 503. **AC-6** ADR link (prior). **AC-7** visual capture producer (prior, 4cea4e47).

## MOUNTED (grep-proven)
settings/page.tsx "Tasks" link → `/build/projects/[id]/tasks` (task-list-panel, kanban-lite cards) → click → `/build/projects/[id]/
tasks/[taskId]` (task-detail-panel, 5 tabs role=tablist).

## Per-AC tests
AC-1 orchestrator 23/23 · AC-2 test_task_detail_api 9/9 docker + panel 4/4 · AC-3 component + E2E · AC-4 console-log route + component
+ E2E · AC-5 component + E2E · AC-6/7 prior. **E2E `task-detail.spec.ts` 2/2 ran REAL** (live trio, real backend+PG+LocalStack+oidc):
reaches task list via UI link + switches all 5 tabs + asserts honest-absence testids.

## Gates
ruff 0 · mypy 0/520 · tsc 0 · eslint 0-err (202 pre-existing warns) · pytest tests/unit exit 0 · vitest 737/737. Backend integration
9/9 docker (prior). **PROJ-011 sdkgen node10 fails NOT present in this scope (not in tests/unit).** decision-log/project-settings
E2E 5-fail = PROJ-009/010 pre-existing (settings link add didn't touch that form).

## ⚠️ QA FOCUS
Tenant-scoping (RunLogSink S3 key + task_detail queries JWT-only); AC-4 console-live honest-degraded acceptable per brief (no SSE
yet); AC-3 captures honest-absence; mount chain reachable; orchestrator RunLogSink wiring doesn't break the PDAC loop (23/23);
E2E-met-by-inference where PROJ-009/010 blocks. **Give QA the ABSOLUTE summary path** `/Users/gareth/Sites/weave/.claude/state/summaries/BE-V1-TASK-018.md`.

## Commits (feature/BE-V1-EPIC-005, not pushed): 598b18be + earlier (backend base) · a028d970 (orchestrator wiring) · 839ac653 (console/captures routes) · 5eb200b7 (proxies) · cef08621 (5-tab panel) · b2613e97 (E2E, HEAD).

## Epic status — BE-EPIC-005 = BE-018 sole task → CLOSES on QA-pass → auto-merge eligible (NO migration)
On QA PASS: reconcile onto green main (**after PROJ-011 hotfix lands** — else CI red on sdkgen), push, PR, review, CI green → auto-merge (non-risky). Run ui_verify on the task-detail route before close (UI-gate, phase-gate deferred).
