# BE-TASK-007 — Quality Gates: DoR / DoD / Pre-Scaffold (E12-S1/S2/S6)

**Epic:** BE-EPIC-012 · **Branch:** `feature/BE-EPIC-012` (worktree `lane-be007`) · **Status:** DONE — QA PASS (0 retries)
**Base:** origin/main (rebased) · **Tip:** `71ada78` (QA edge cases)
Coordinator-authored lane receipt (ADV-004: lanes never write `.claude/state/**`).

## Commits (7, TDD-shaped + QA edge cases)

1. `9a539c3` test: failing tests for BE-TASK-007 quality gates (DoR/DoD/pre-scaffold)
2. `e77d1fc` feat: gate_results table migration (0013)
3. `f4b83bc` feat: QA agent command runner + gate result store
4. `984e394` feat: DoR/DoD/pre-scaffold quality gates
5. `7e57ba1` feat: wire quality gate routes
6. `090d82d` docs: ADR-004 gate_results table merge decision
7. `71ada78` test(qa): edge cases — pre-scaffold HTTP route persist+proceed, gate_results RLS tenant isolation

## What was built

DoR gate (brief completeness before PLAN), DoD gate (QA agent self-runs lint/type/coverage/mutation/sast),
pre-scaffold cascade gate (M1 pass-through stub — records findings, always PROCEEDs, fires `spec_gap_critical`
warnings). Three functions (not class methods) so TASK-006 orchestrator calls them at loop positions.

- `migrations/0013_gate_results.sql` — merged `gate_results` table (nullable task_id/project_iri/run_id,
  one required via CHECK, JSONB payload, open TEXT result enum, tenant_id TEXT + FORCE RLS). ADR-004 rationale.
- `build/{qa_agent,gate_store,gates}.py`, `schemas/gates.py`, `routers/gates.py` (wired in `__init__.py`).
- `build/store.py` +ProjectSpecRecord, get/upsert_project_spec.

## QA outcome — PASS (0 retries)

Live mutation testing (not static review) proved the tests genuinely enforce ACs despite the non-RED authoring order:

1. DoR failing-list forced empty → broke 4 tests (AC-1/AC-7 genuinely enforced).
2. DoD overall never flips to FAIL → broke 2 tests (AC-3 genuinely enforced).
3. pre-scaffold PROCEED→BLOCKED → broke 2 tests (AC-5/AC-6 genuinely enforced).
4. hardcoded wrong-tenant in `insert_gate_result` → broke 3 integration tests, caught by Postgres FORCE RLS
   (`InsufficientPrivilegeError`), NOT an app-level assertion — revealed `gate_results` had no dedicated
   tenant-isolation test. QA added one (`71ada78`).

All mutations reverted; source bit-identical to HEAD. Deviations (a)–(g) all adjudicated ACCEPTABLE
(mutation proof for non-RED; module-boundary patch backed by real-shell-out test in `test_qa_agent.py`;
no AC/contract violations for project_iri passthrough / default project spec / DoD task-existence).

DoD checks QA ran: ruff clean, mypy clean, unit 18/18, integration 5/5 (3 orig + 2 QA-added, docker-marked
remapped ports), coverage 86% combined on changed modules, bandit 0 High/Med + 2 Low (subprocess, noqa'd),
complexity within budget (radon not installed — first occurrence, aggregation-rule non-escalating),
build-package-scoped regression clean.

## WARN follow-ups (recorded in qa-cross-task-findings ledger — NOT this task's AC)

- **XT-BE007-1 (urgent):** `TaskBrief` schema (BE-002, `briefs/schema.py`) has no `design_decisions` field, yet
  `routers/briefs.py:96` stores `content=brief.model_dump(...)`. Every real brief created via BE-002's API will
  PERMANENTLY fail DoR's `design_decisions` check — DoR can never return READY on production data until BE-002 is
  extended. BE-007's logic is correct; the defect is BE-002's schema. affects [BE-TASK-002, BE-TASK-009].
- **XT-BE006-1:** POST /runs 202+dispatch happy path STILL OPEN — BE-007 never touched `routers/runs.py`.
  Re-target to BE-TASK-009 (wrong prediction that BE-007 would close it).
- **XT-002:** spike-mode write-back guard — correctly absent from BE-007 (already wired to `/api/operations/apply`).

## Downstream

Unlocks BE-TASK-009 (deploy/demo + graph write-back) once BE-TASK-008 lands. Gate functions are the loop
positions the BE-006 orchestrator calls DoR-before-PLAN / DoD-before-Done.
