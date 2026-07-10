# Progress: BE-V1-TASK-007 — Full QA Category Suite (E12-S3, FR-054)

`build-engine` EPIC-012. **Built in PARALLEL LANE** worktree `../weave-EPIC-008`→ no, `../weave-EPIC-012`,
branch `feature/BE-V1-EPIC-012` (off main 5b25304). Coordinator-authored from the lane engineer's
receipt (lane engineers never write state).

## Outcome

Impl complete + committed on `feature/BE-V1-EPIC-012`. Unit lane 10/10 new + full 729 pass, coverage
97%, ruff/mypy/bandit clean. Docker lane: 3 tests WRITTEN + collect-verified, NOT run (coordinator
docker-slot serialization + cross-branch shared-DB schema mismatch — deferred to epic-close). QA
pending.

## What shipped

- `packages/backend/src/weave_backend/build/qa_suite.py` (new, ~243 lines) — the 9-category QA suite.
- `packages/backend/src/weave_backend/build/gates.py` — promoted `_record_gate`→`record_gate`, added
  `run_id` to `GateRecord`.
- Tests: `tests/unit/test_qa_suite.py` (10), `tests/integration/test_qa_suite_gates.py` (3 docker,
  unrun). ADR-015 (renamed from the lane's ADR-010 to avoid collision with EPIC-002's ADR-010–014).

## Decisions / nuances

- **Params grouped into `QARunContext`/`QAProject` dataclasses** (Law E budget) → `run_full_qa_suite(conn, *, run_ctx, project)` (3 params).
- **No migration** — `gate_results.gate` is open TEXT, `run_id` column already exists; `qa_*` gate
  names slot in. (Lane migration block was 0025+, unused.)
- **`progress_cb` sink** for long-lane streaming, NOT new run-log storage — the real run-log owner is
  **TASK-008** (not built). Documented in ADR-015.
- **`edge_case_extension` "no tests collected → pass"** is a `ponytail:`-flagged heuristic
  (evidence-empty check, not exit-code-5 — `CommandOutcome` lacks the return code). Upgrade path noted.
- **Worktree env fix:** the worktree's `packages/frontend/node_modules` was absent (worktrees don't
  share it) → blocked the repo-wide pre-commit lint gate → engineer ran `npm ci` there (no code change).
  **Lesson: each new worktree needs `npm ci` in packages/frontend for the pre-commit hook to pass.**

## Commits (feature/BE-V1-EPIC-012)

- `4cc407b` refactor (record_gate/run_id) · `6bc781c` test RED · `fec6096` feat GREEN ·
  `6659ff9` test (docker integration, unrun) · ADR renamed → ADR-015 + `chore` renumber commit.

## Cross-lane coordination notes (for the lane-log / future)

- **ADR numbers must be pre-assigned per lane** (like migrations) — off-main lanes can't see EPIC-002's
  ADR-010–014, so they collide. Fixed post-hoc here (→ADR-015). Assign ADR blocks going forward.
- Docker verification for off-main lanes deferred — shared-DB schema differs per branch.

## Dependencies

- **blocked_by:** [] · No downstream unlock recorded; the run-log storage this streams to lands in TASK-008.

## Retry 1 (2026-07-10) — VERDICT: PASS
QA FAIL (edge_case_extension masked real test failures — reported "passed" on nonzero exit with empty
stderr). Fixed: `returncode` threaded through `CommandOutcome` (`qa_agent.py`); `_run_edge_case_extension`
now keys off exit code (5=n_a, other nonzero=failed), not evidence-emptiness. QA red test `d0d43a9` now
passes. M1 DoD gate unaffected (27 tests green). Full unit lane 719, +2 gap tests (perf NOT_VERIFIED,
browser passed=False). Commits `6787135` fix, `81a88c7` gap tests. retry=1/3.
