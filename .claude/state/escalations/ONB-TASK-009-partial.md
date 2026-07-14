# ONB-TASK-009 — partial-slice deferral ledger

EPIC-004 stays **open**. TASK-009's server-side slice (gating, checker dispatch, retry-write, the
`/exercises/{id}/check` route) is done and tested. Two ACs are deferred — not silently skipped,
listed here with the exact missing prerequisite.

| AC | What it asks | Delivered | Deferred | Missing prerequisite | Unblocked by |
|---|---|---|---|---|---|
| AC-009-05 | Reset an exercise → learner can re-earn it | Not built | Whole AC | The reset feature itself (clearing `exercise_completion` rows / re-triggering the checklist) doesn't exist anywhere in the codebase yet | TASK-005 ("not started" per its own prior summary) |
| AC-009-07 | Exercise-panel UI (the on-canvas/on-page component a learner actually clicks "check" from), including GE-01/GE-02 spotlight/overlay triggers | Not built | Whole AC | No UI host component exists for any exercise in any onboarding surface (CE or GE) | A frontend task scoping the exercise-panel component + its mount point — none currently assigned in EPIC-004's task list as of this session |

## What this means concretely for the codebase

- The `/exercises/{id}/check` endpoint is real, tested (unit + docker-integration, including a real
  sandbox write round-trip for the `sparql_ask` case), and enforces gating/read-only-locking
  server-side regardless of what any future UI does or doesn't show. It's just not reachable by a
  human today — no button, no page, no Playwright path exists that calls it.
- `WRITE_EXERCISE_IDS = frozenset({"CE-02"})` in `onboarding/exercises.py` is the only write
  exercise in M1; `gate_exercise()` already blocks it under `path_variant="read_only"`.
- Two trust-model decisions from this task are written up as ADRs (not deferred, just documenting
  what was decided): `docs/specs/weave/engines/onboarding/decisions/ADR-011.md` (ASK bypasses the
  client-facing SPARQL validator) and `ADR-012.md` (`canvas_state`/`nav_signal` completions are
  client-asserted, not server-verified — no backend GE-CANVAS-1 state-read surface exists yet).

## Do NOT

- Do not mark ONB-015 (the M1 exit-criteria E2E this task was meant to unblock) as unblocked. It
  still needs a UI host for these exercises to drive a real browser E2E against.
- Do not close EPIC-004 from this task alone.
