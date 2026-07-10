# Progress: BE-V1-TASK-012 — cost_events Writer (ADR-008): Per-Dispatch Usage Attribution

`build-engine` EPIC-002. Coordinator-authored from the engineer receipt (engineer was instructed
not to write `.claude/state/**`; this summary is pre-written so QA preflight can run — per
[[process_qa-preflight-vs-parallel-lanes]]).

## Outcome

**QA PASS** (2026-07-10). 20/20 unit green, `build/cost.py` 97% cov, ruff/mypy/bandit clean,
gate-integrity on `af61ab2` PASS. Non-blocking: `cost.py:67-68` (empty-rate-card exception branch)
uncovered; two edge tests (compute_cost zero/None usage; usage-present-run_id-None) not added —
next-touch/phase-gate note, not a blocker (97% ≥ 80% floor).

## What shipped

- `src/weave_backend/build/cost.py` (new) — `resolve_rate_card`, `compute_cost`,
  `DispatchCostContext`, `default_emit_billing`, `record_dispatch_cost`, `RateCardConfigError`.
- `build/orchestrator.py` — rate card resolved once at `run_dark_factory` start, bound onto
  `OrchestratorDeps.record_dispatch_cost_fn` via `functools.partial`; `_dispatch_one` records a
  cost event when `result.usage is not None`; new `_halt_rate_card_error` halt path.
- `schemas/tasks.py` — `DispatchUsage` model; `TypedResult.usage: DispatchUsage | None`.
- `build/state_spine.py` — `Phase` gains `"halted_config_error"`.
- `billing/metering.py` — `TokenUsageRecord` gains optional `task_id` / `run_id`.
- Tests: `tests/unit/test_build_cost.py` (8) + `tests/unit/test_orchestrator.py` (+3, 5 pre-existing
  updated with a `resolve_rate_card_fn` stub). 20/20 green; full unit lane green.

## Decisions made

- **Writes route through the existing `pm/cost_events.py` repo (TASK-010) — NO second migration.**
  cost_events table already exists.
- **Rate card comes only from settings** (`resolve_setting` / PLAT-SETTINGS-1) — no literal USD rate
  anywhere. Missing/invalid rate card → `RateCardConfigError` → `_halt_rate_card_error` halt
  (`halted_config_error` phase), not a silent zero.
- **`DispatchUsage` is optional on `TypedResult`** — the current PDAC stub attaches no usage, so a
  dispatch without usage records no cost event (real usage lands when the dispatcher is wired).
- **Attribution survives non-run / retries (ADR-008):** `run_id`/`task_id` nullable on the event.
- **Narrowed TASK-010 `test_pm_static_no_raw_sql.py`** (commit `af61ab2`): the blanket substring
  grep false-flagged the sanctioned `from weave_backend.pm import cost_events`; narrowed to
  `\b(FROM|INTO|UPDATE|JOIN)\s+<table>\b`. QA gate-integrity check PASSED — still traps raw SQL
  against the v1 tables outside `pm/`, precision fix not a weakened gate.

## Nuances / known gaps

- **Delta mutation ≥70% NOT run this session** (DoD item) — deferred to the phase-gate mutation
  sweep (Step 4), the harness's mutation home. Logged, not silently dropped.
- The 3 "integration" ACs are implemented as fast fake-connection unit tests in `tests/unit/`,
  consistent with the existing `test_orchestrator.py` precedent (AC-7's docker-marked proof already
  exists from TASK-010).

## Coverage / gates

- Unit-lane coverage: `build/cost.py` 97%, `build/orchestrator.py` 100%, `billing/metering.py` 93%
  → combined 97% (200 stmts, 6 miss). ≥80% floor met.
- ruff 0, mypy 0, bandit 0.

## Commits

- `f43e15e` test · `0eb5bbd` feat · `af61ab2` fix (narrow static check)

## Dependencies unlocked

- **TASK-013** (Costs Endpoint + Budget-Cascade Breach Halt — reads the cost_events this writes).
- **TASK-021** (consumes cost attribution transitively).
