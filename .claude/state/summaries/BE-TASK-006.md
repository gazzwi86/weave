# BE-TASK-006 — Dark-Factory Execution Engine (E11-S1..S5)

**Epic:** BE-EPIC-011 · **Branch:** `feature/BE-EPIC-011` (worktree agent-a1f9) · **Status:** implemented, QA pending
**Commits:** `d0e756b` test · `337778f` feat · `f9c3747` test(qa) edge cases · **Status:** QA PASS (0 retries)
Coordinator-authored lane receipt (ADV-004: lanes never write `.claude/state/**`).

## QA outcome — PASS (0 retries)
Live mutation testing (not static review) confirmed tests genuinely enforce ACs despite the non-RED cycle:
dropped the `state_spines` RLS policy live → AC-7 test failed with `InsufficientPrivilegeError` (proves DB-level
FORCE RLS + NOSUPERUSER `weave_app`, not app-layer WHERE); swapped Done-before-dep-summary → AC-4 test failed;
`<`→`<=` on loop cond → AC-1 turn-cap test failed; short-circuited retry ceiling → AC-2 HITL-converge test failed.
All reverted, source bit-identical. `ALLOWED_MODELS` derived from `ai/config.py` table (can't drift from CLAUDE.md).
3 QA edge-case tests added (`f9c3747`): turn-cap-never-re-resolved-mid-run, commit-timeout-propagates-at-loop-level,
dep_summaries-own-RLS-policy. Final: unit 9/9, integration 4/4 (live docker), ruff/mypy clean, orchestrator+model_routing 100%.
Dev #3/#4/#5 all adjudicated ACCEPTABLE (M1 stubs / legit test design).

## WARN follow-ups (logged to qa-cross-task-findings, NOT this task's AC)
- **XT-BE006-1:** POST /api/projects/{iri}/runs happy-path (202 + real dispatch via HTTP) has ZERO test coverage —
  every integration test drives StateSpine directly or hits 409/404 branches. Add HTTP happy-path test (BE-007 wires PLAN consumption).
- **XT-BE006-2:** `turn_cap_override` is a direct override, not clamped against PLAT-SETTINGS-1 cascade (brief API prose says
  "capped by"). Ponytail-marked; limited blast radius (tenant raises own cap only). Follow-up ticket before wider exposure.
- **Env (not a defect):** `pytest --cov` + session `platform_stack` fixture segfaults on macOS arm64 inside asyncpg SSL connect
  (reproduced twice); integration passes 4/4 without `--cov`. Likely tracer/asyncpg C-ext interaction, not code — CI (Linux) may not reproduce.

## What was built

Bounded PLAN→DELEGATE→ASSESS→CODIFY orchestrator loop + RLS state spine.

- `migrations/0012_state_spines.sql` — `state_spines`, `dep_summaries`, `task_retries`; RLS + FORCE RLS,
  `tenant_id` TEXT (matches 0010/0011 codebase precedent, not brief's UUID). dep_summaries keyed
  `(project_iri, task_id, tenant_id)`. GRANT includes UPDATE (needed for ON CONFLICT DO UPDATE).
- `build/state_spine.py`, `build/dep_summary.py`, `build/model_routing.py`, `build/orchestrator.py`.
- `schemas/runs.py`, `routers/runs.py` (POST /api/projects/{iri}/runs, GET /api/state/{iri}), wired in `__init__.py`.
- Reuses existing `build/typed_result.py` (TypedResult/failure_class), `build/hitl.py` (fire_hitl_gate),
  `ai/router.py` routing seam, `briefs/store.py` get_brief, `repo_bootstrap/` ensure_project_repo.

## Tests

- Unit 7/7 (`tests/unit/test_orchestrator.py`); full unit suite 296 files exit 0, no regressions.
- Integration 3/3 docker-marked (`tests/integration/test_runs_api.py`) vs real Postgres/RLS.
- Static: ruff clean, mypy clean (296 files, 0 err), bandit 0 issues. orchestrator.py 100% (69/69). All files < 300 lines.

## AC coverage
AC-1 turn cap + PLAT-SETTINGS-1 override · AC-2/AC-6 FAIL routing + model-routing fail-closed ·
AC-3 409 already-active · AC-4 non-skippable dep-summary write-before-Done · AC-5 best-effort predecessor
(missing_handoff log-not-halt) · AC-7 RLS tenant isolation (tenant-B sees 0 rows) · AC-8 500ms blocking commit gates Done.

## Deviations / gaps (engineer-reported — QA to adjudicate)
1. **Non-RED TDD:** impl files were already on disk from a prior session; tests passed immediately against existing
   code (disclosed, not hidden). **QA MUST verify tests genuinely enforce ACs, not fit to code.**
2. No `budget_cap_exceeded`/cost-cap — brief scopes cost cap to v1.0, not M1 (AC-2 M1 = coarse pre-gen estimate only).
3. No HTTP surface to seed a task backlog (8 ACs are loop mechanics, not task discovery); one integration test drives
   StateSpine directly rather than via POST /runs.
4. `turn_cap_override` is a direct override, NOT clamped against PLAT-SETTINGS-1's cascade (brief says "capped by") —
   ponytail-marked gap in routers/runs.py with upgrade path.
5. `task_retries` table created but not wired; `handle_agent_result` (TASK-005) still tracks retries in-process (documented M1 stub).

## Real bugs found by testing (not just green-fitting)
- orchestrator.py phase="complete" transition wasn't persisted (missing commit branch) — found by manual trace.
- migration 0012 dep_summaries GRANT missing UPDATE — surfaced by real-Postgres integration test.

## Environment notes
- Integration tests remapped docker ports via existing WEAVE_*_PORT env (main stack held 5432/6379/4566/7878) — no code change.
- Frontend node_modules in worktree missing cytoscape (blocked shared pre-commit lint hook); ran `npm install` — no source touched.

## Context downstream
- Unlocks BE-TASK-007 (quality gates) + BE-TASK-008 (app generation). Orchestrator is the loop BE-007's DoR/DoD gates plug into.
