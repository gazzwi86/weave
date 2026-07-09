# Progress: BE-V1-TASK-013 — Costs Endpoint + Budget-Cascade Breach Halt (ADR-008 read side, FR-008)

`build-engine` EPIC-002. Coordinator-authored (engineer hit the tool cap before emitting a receipt;
coordinator finished the cleanup + wrote this so QA preflight can run — per
[[process_qa-preflight-vs-parallel-lanes]]).

## Outcome

Impl complete + committed. Coordinator removed a leftover `DEBUG` print and committed the tail
cleanup (`33ef34d`). QA full checklist pending (this summary unblocks preflight).

## What shipped

- `src/weave_backend/build/costs.py` (new) — the costs read model: `compute_forecast`,
  `CostsPayload`, task-cost assembly from the rollup, burn-rate + forecast fields.
- `src/weave_backend/pm/cost_events.py` — added `burn_rate(...)` read query for the endpoint;
  hardened `_ROLLUP_QUERY` with `COALESCE(SUM(...),0)` (empty rollup → 0, not NULL) and fixed the
  burn-rate interval param (`$3::text || ' days'` + `str(window_days)`). Tenancy WHERE clause
  (`tenant_id=$1 AND project_iri=$2`) unchanged — not weakened.
- Router: `GET /api/projects/{id}/costs` (`3c65c52`).
- `src/weave_backend/briefs/store.py` — `BriefEstimate` / `estimates()` feeding the forecast.
- Budget-cascade breach halt (ADR-008 read side, FR-008) wired into the orchestrator, reusing the
  existing PLAT-BILLING-1 budget machinery (not reinvented).
- Tests: `tests/unit/test_build_costs.py`, `tests/integration/test_costs_api.py`,
  `tests/unit/test_orchestrator.py` (breach-halt). Unit lane: 21 pass.

## Decisions made

- **Reads route through `pm/cost_events.py` rollup/burn_rate — NO raw SQL outside the repo, NO new
  migration** (cost_events table exists from TASK-010).
- **Budget breach reuses PLAT-BILLING-1** cascade/budget logic — no parallel budget model.
- **Empty rollup returns zeros** (`COALESCE`), so a project with no spend yet reports 0, not an error.

## Nuances / known gaps

- Coordinator authored this summary + the `33ef34d` cleanup; the engineer's own DoD self-check
  never completed (capped). **QA must do the full AC-1..N walkthrough against the brief** — treat AC
  coverage as unverified-by-engineer, verify from tests.
- Mutation not run (phase-gate's job).

## Coverage / gates (coordinator-run so far)

- `test_build_costs.py` + `test_orchestrator.py` unit lane: 21 pass. ruff + mypy clean on
  `build/costs.py` + `pm/cost_events.py`. Debug print removed (grep-clean).

## Commits

- `e0abc9f` feat (costs endpoint + breach halt) · `3c65c52` feat (router) · `33ef34d` chore (cleanup)

## Dependencies unlocked

- **TASK-019** (consumes the costs read surface).

## QA pass (2026-07-10) — VERDICT: FAIL (logic + interface)

Full AC-1..6 walkthrough run against real tests (docker was up; ran the docker-marked integration
lane, which the engineer/coordinator never executed).

- **AC-1 (payload shape, `estimated` label):** WARN — label assertion passes but the full payload
  shape check is blocked by the finding below (integration test fails before reaching it).
- **AC-2 (forecast formula):** FAIL — `compute_forecast` keys `mean_actual`/`completed_count` off
  `task_id in task_costs` (has any recorded spend) instead of `task_id in done_task_ids` (is
  actually Done). An in-progress task with partial spend is miscounted as "completed," so the
  `completed_count == 0` -> `brief_only` fallback in AC-2 never fires when it should. Proven by a
  new failing test: `test_forecast_excludes_in_progress_task_from_completed_cohort`
  (`tests/unit/test_build_costs.py`).
- **AC-3 (Company->Domain->Project cascade):** FAIL — `resolve_budget_cap`'s `context_iri=project_iri`
  is always the real production project IRI (`urn:weave:project:{tid}:{slug}`), which never parses
  under `settings/scope.py`'s grammar -> always `InvalidScopeIri` -> always falls back to
  company-only. Domain/project cap overrides are dead in production (code's own docstring admits
  it). The unit test proving the cascade uses a fabricated IRI shape the real system never
  produces — tautological relative to the actual call path. Logged as cross-task finding
  `XT-BE013-1` (also affects TASK-012's rate card and TASK-019's Dashboard tile).
- **AC-4 (halt at breach):** PASS — orchestrator wiring is real (injected `check_budget_fn`
  default is the real `check_budget`); the `>=` boundary itself is now directly tested
  (`test_check_budget_halts_exactly_at_cap_not_only_above_it`) and is correct per the brief's
  "Halt >= cap not >" design decision.
- **AC-5 (stay halted on notify failure):** PASS.
- **AC-6 (named error, not zero, on DB failure):** PASS — and now cleanly distinguished from a
  genuinely-empty rollup (new test `test_get_costs_returns_zero_total_when_rollup_has_no_rows_at_all`).
- **Wire-format defect (blocks AC-1 fully, affects TASK-019):** both docker-marked integration
  tests in `tests/integration/test_costs_api.py` FAIL when run for real — `schemas/costs.py` types
  every money field `Decimal`, which Pydantic/FastAPI serialise as a JSON *string*
  (`"1.500000"`), not a number, deviating from the existing `schemas/billing.py` convention
  (`float`). These tests were never actually executed before this QA pass (docker was available
  throughout).

Added 3 edge tests (`test:` commit `6348695`): empty-rollup-zero, in-progress-task-forecast
(fails, proves AC-2 bug), budget-breach-at-exact-threshold (passes, confirms `>=` boundary
correct). Coverage on `build/costs.py`: 93% (up from 89%). Full unit lane: 789 collected, 788
pass / 1 fail (the intentional bug-proving test). Lint/mypy/bandit clean; no debug prints; no raw
SQL in `build/costs.py`; no new migration; tenancy WHERE clause unchanged.

Sent back to Engineer — do not advance to TASK-019 until AC-2, AC-3, and the wire-format defect
are fixed and the two integration tests pass for real.
