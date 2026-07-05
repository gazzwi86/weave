# BE-TASK-005 — Spec Lifecycle & HITL Gate

**Epic:** BE-EPIC-006 · **Branch:** `feature/BE-EPIC-006` · **Status:** implemented, QA in progress
**Commits:** `069f269` fix (.gitignore) · `2b46568` test · `07a840f` feat · `a4eda68` docs (ADR-002)
**Coverage:** 92% aggregate (9/9 files ≥80%) · **Tests:** 280 fast-lane green · **Migration:** none (ADR-002)
**Status:** QA PASS (1 retry) — epic COMPLETE, PR-ready
**Commits:** +`550bdb0` test(qa) edge cases · `09b05d0` fix (AC-5 fail-closed + ADR refs)

> Coordinator-authored from the lane receipt (ADV-004: lanes never write `.claude/state/**`).

## QA outcome (retry 1/3, logic)

7/8 ACs passed with real enforcement (FSM 409, retry-ceiling→HITL, no-self-approval, spike guard
unit-tested). **One blocking FAIL — AC-5 (logic):** the fail-closed HITL gate had an uncaught escape —
`pool = await get_app_pool()` sat outside the try/except, so a pool-creation failure (audit DB fully
down — the exact outage the gate exists for) crashed open instead of failing closed. **Fixed** `09b05d0`
(moved into the try; strict-xfail regression `550bdb0` now passes as a normal test; stale ADR-001→ADR-002
docstring refs corrected). Full fast lane 280 passed, ruff/mypy clean, 92% coverage.

RLS/no-migration verified (module dict store is real, audit → real `audit_entries`). `.gitignore` change
`069f269` confirmed correct+minimal (un-hides `src/weave_backend/build/` from a bare `build/` ignore).

**WARN (cross-task, logged XT-002):** AC-7's spike-write-back guard is unit-tested but **unwired** — no
`/api/operations/apply` route exists yet; whichever task ships CE-WRITE-1 must wire it + add an HTTP 403
test. Left unwired here per YAGNI (correct).

## What was built

Spec lifecycle state machine + HITL gate for the dark-factory build flow — guarded transitions,
typed run results, and the human-approval seam between phases.

- `guards.py` (100%) — transition guards, incl. `assert_not_spike_write_back`-style invariants.
- `lifecycle.py` (100%) — the lifecycle state machine.
- `store.py` (97%) — persistence.
- `hitl.py` (82%) — HITL action handling (`resumed` / `halted` / `replan` literals).
- `typed_result.py` (85%) — `TypedResult` with `failure_class` Literal ('logic'/'syntax'/'dependency'/'spec_ambiguity').
- `routers/specs.py` (100%), `routers/tasks.py` (84%), `schemas/specs.py` (100%), `schemas/tasks.py` (100%).
- `docs/specs/weave/engines/build-engine/decisions/ADR-002.md`.

## Decisions (ADR-002) & coordinator-guided fixes

- **No migration needed** (ADR-002) — lifecycle state persisted without a new table/schema change.
- Coordinator-guided mypy fixes at last mile: narrowed `HitlActionResponse` action to its `Literal`
  set (not a loose `dict[str,str]` splat); test asserts on the None-returning guard call bare (raises
  on violation) rather than on its return; `failure_class` uses the allowed Literals.

## Merge-time notes (coordinator)

- Wires `routers/specs.py` + `routers/tasks.py` in `__init__.py` — expect an `__init__.py` merge with
  sibling BE lanes (BE-002 briefs, BE-003 requests) at serial-merge; resolve in alpha import order.
- `069f269` touched `.gitignore` — verify at code-review it only adds intended ignores, no over-broad
  pattern hiding real files.
- BE-EPIC-006 is a **single-task epic** (only BE-TASK-005) → epic completes on QA pass → open PR.

## Context for downstream tasks

- The HITL gate here is the spec-phase approval seam consumed by the run engine (BE-TASK-006).
- `TypedResult.failure_class` mirrors the `/implement` loop's QA failure taxonomy.
