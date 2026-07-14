# ONB-TASK-009 — Hands-On Exercises CE-01/02/03/03b + GE-01/02, contract-signal checks

Status: server-side slice implemented, tested (unit + docker-integration), coverage 83% for
changed files. NOT pushed, NOT PR'd, per instruction. UI (exercise panel) not built — see
`.claude/state/escalations/ONB-TASK-009-partial.md`.

Final HEAD on `feature/ONB-EPIC-004`: `db014bce`.

## What shipped

- `packages/shared/onboarding/content/exercises.ts` + `i18n/en.ts` (fixed) — corrected all six
  exercises' completion kinds and copy to match the PRD table (they were wrong before this task:
  wrong completion kinds, and copy describing entirely different exercises).
- `packages/backend/src/weave_backend/onboarding/exercises.py` (new) — server-side mirror of the
  shared TS exercise config (gating shape: `paths`, `completion`). Hand-kept-in-sync with
  `exercises.ts`, not codegen'd — six entries, cheap to review together in one PR, per ADR-006's
  static-content posture.
- `packages/backend/src/weave_backend/onboarding/exercise_checker.py` (new) — dispatches a
  completion check by kind: `sparql_ask` calls `oxigraph_client.run_query` directly against the
  caller's own sandbox graph (bypasses the client-facing SPARQL validator, which doesn't allow ASK
  — see ADR-011); `nav_signal`/`canvas_state` match the caller's claimed signal strings (no
  independent server verification — see ADR-012); `write_commit` is unimplemented (no M1 exercise
  uses it) and raises `UnsupportedCompletionKindError`, mapped to a 422 at the route.
- `packages/backend/src/weave_backend/onboarding/store.py` (extended) —
  `record_exercise_completion_with_retry`: upserts `exercise_completion` keyed on its existing
  `(tenant_id, user_id, exercise_id)` primary key, `clock_timestamp()` not `now()` (avoids the
  frozen-per-transaction FIFO bug from TASK-004), retries once on failure.
- `packages/backend/src/weave_backend/schemas/onboarding.py` (extended) — `ExerciseCheckRequest`
  (`signals: list[str]`, `max_length=20`, Law 13 bound) / `ExerciseCheckResult`.
- `packages/backend/src/weave_backend/routers/onboarding.py` (extended) —
  `POST /api/onboarding/exercises/{exercise_id}/check`: 404 unknown exercise → server-side gate
  check (403 if path/read-only blocked) → resolve sandbox graph server-side if the completion kind
  needs one (never client-supplied) → dispatch check → persist on success → return result.
- Two new test files: `tests/unit/test_onboarding_exercise_check_route_unit.py` (direct-call,
  mocked collaborators — no docker needed) and
  `tests/integration/test_onboarding_exercise_check_route.py` (real docker stack: nav_signal
  round-trip + idempotent repeat, 403 path-gated, 403 read-only-locked, and a sparql_ask round trip
  that provisions a real sandbox fork, confirms the check is unmet on the bare fork, performs a
  real `CE-WRITE-1` write, then confirms it's met).
- Two ADRs: `docs/specs/weave/engines/onboarding/decisions/ADR-011.md` (ASK-bypasses-validator),
  `ADR-012.md` (canvas_state/nav_signal client-asserted trust model).

## Bug found and fixed during this task

The CE-02 `sparql_ask` string (both in `exercises.ts` and `exercises.py`) checked for a Class
labelled "Outdoor Furniture" -- but that string was never in the seeded Hammerbarn content
(`onboarding/hammerbarn_seed/content.py`'s actual classes are Product, Store, Supplier, Customer,
Order, StockItem, TradeAccount, PurchaseOrder, Promotion, Return). This was invisible until the
route-level docker-integration test actually ran the ASK against a real forked sandbox and got
`verified: false` on the first attempt. Root cause: CE-02 is a *write* exercise (it's in
`WRITE_EXERCISE_IDS`) — the ASK is correctly checking for something the learner is meant to
*create* during the exercise, not something pre-seeded. The bug was in my own earlier assumption
while fixing TASK-003's exercise config, not caught until this task's integration test forced a
real write-then-check round trip. Fixed by adding a real `POST /api/operations/apply` write step to
the integration test (which also newly proves AC-009-02/03's sandbox-write-then-check path works
end-to-end) — no product code changed, only the test's realism.

## Decisions made (not pre-specified in the brief)

1. **ASK strings bypass `validate_query`.** See ADR-011. Static, PR-reviewed, never built from
   request input.
2. **`canvas_state`/`nav_signal` are client-asserted, not server-verified.** See ADR-012. No
   backend GE-CANVAS-1 or UI-event state-read surface exists to check them against in M1; accepted
   because the only consequence is a learner's own progress checklist, not an access/billing gate.
3. **Server-side exercise config duplicated in Python, not codegen'd from the TS source.** Same
   rationale as `exercises.ts` itself under ADR-006 — six entries, hand-review is cheaper than a
   cross-language codegen pipeline for this milestone. Flag for anyone touching exercise content:
   change both files in the same PR.

## Coverage note (an environment issue, documented for whoever hits it next)

Running `pytest --cov=...` together with the `platform_stack` docker-integration fixture segfaults
reliably in this environment (macOS ARM64, Python 3.12.13, asyncpg's SSL connect during migration
setup crashes under coverage's trace hooks — reproduced 3× with different coverage cores
(`legacy`/`sysmon`) and with `PGSSLMODE=disable`, all identical crash). Worked around by measuring
unit-test coverage (safe, no docker) and confirming docker-integration tests pass separately
without coverage instrumentation. Final measured total for this task's changed files
(`exercise_checker.py` 100%, `exercises.py` 100%, `store.py` 94%, `schemas/onboarding.py` 100%,
`routers/onboarding.py` 54% dragged down by pre-existing untouched routes only exercised by
docker-integration tests that can't run with `--cov` here) is **83%** — above the 80% gate. This is
a pytest-cov/asyncpg/macOS interaction, not a product bug; worth a harness-level look if it recurs
on CI (CI runs on Linux, likely unaffected, but flagging in case).

## Tenancy

Every store function this task touches (`record_exercise_completion_with_retry`, and the route's
`get_state`/`patch_state`/`get_sandbox_workspace_id` calls) takes explicit `tenant_id`/`user_id`
bound params; the `exercise_completion` table (from TASK-001's migration `0082`) has RLS
enabled+forced as a belt-and-braces backstop. `clock_timestamp()`, not `now()`, for the completion
timestamp.

## Migration

None. No `0090`/`0091` files created — the `exercise_completion` table already existed from
TASK-001's `0082_onboarding_state.sql`.

## Not built (see escalation file for the full table)

- AC-009-05 (reset → re-earn) — blocked on TASK-005, not started.
- AC-009-07 (exercise-panel UI, any surface) — no UI host component exists for any exercise.
- No Playwright E2E — nothing to drive without AC-009-07.

## QA (2026-07-14)

**Verdict: PASS** (backend slice). Re-ran everything, did not take self-report at face value:
- Unit: `pytest tests/unit -k onboarding` → 82 passed (81 + 1 new edge test).
- Docker integration (isolated `COMPOSE_PROJECT_NAME=weaveonb009`, custom ports, torn down after):
  `pytest tests/integration/test_onboarding_exercise_check_route.py -m integration` → 4 passed,
  confirmed the sparql_ask test does a REAL `POST /api/operations/apply` write (not a stub) —
  unmet on bare fork, met only after the write.
- Coverage: new route lines (`check_exercise_route`, `_resolve_sandbox_named_graph`) covered
  across unit+integration combined (the one line missed in unit-only coverage, `named_graph_iri =
  await _resolve_sandbox_named_graph(...)`, is hit by the integration test). `routers/onboarding.py`
  54% confirmed pre-existing/untouched routes only, not the new code.
- ruff + mypy: clean on all changed files.
- Tenancy: confirmed `check_exercise_route` and `record_exercise_completion_with_retry` are bound
  to `principal.tenant_id`/`principal.principal_iri` throughout, no client-supplied ids, RLS backstop
  on `exercise_completion`, `clock_timestamp()` used. No cross-tenant/cross-user path found.
- ADR-011/012 present, sequential, no collision with ADR-001..010.
- Deferrals (AC-009-05/07) honest and tracked in the escalation file; ONB-015 correctly NOT marked
  unblocked.
- Edge case added: `test_record_exercise_completion_upsert_overwrites_prior_signal` (re-earn upsert
  semantics) — commit `a0e7c82b` on `feature/ONB-EPIC-004`.
- Gap noted, not blocking: no API perf/load test run against `/exercises/{id}/check` this pass
  (Plugin Law #3) — flag for the next QA pass or phase-gate if a perf target exists in the
  onboarding tech-spec.
