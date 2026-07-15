# ONB-TASK-005 — Reset Demo: blue/green re-fork with known-good baseline

Status: **backend fully implemented and tested; frontend (button/dialog)
explicitly NOT built — see "Not done" below.** Partial-epic build on
`feature/ONB-EPIC-001`, worktree `weave-ONB-005w`.

## What shipped (backend)

- `POST /api/onboarding/sandbox/reset` (`routers/onboarding.py`) — the
  explicit-only reset entry point (AC-005-05: no timer/navigation trigger
  anywhere else in the codebase, proven by a source-grep unit test, not just
  documented).
- `sandbox.build_reset_workspace` (new, `onboarding/sandbox.py`) — the
  "green" half of blue/green: builds a brand-new workspace on a *randomised*
  slug (`{sandbox_slug}-reset-{uuid8}`, never the deterministic per-user
  slug, which still names the "blue" workspace the pointer currently
  targets), grants the user membership, and seeds it via the same
  `_apply_and_publish` fork/canonical-materialise already use (ADR-002 "one
  implementation, three uses"). Raises `SandboxForkFailed` on any step.
- `sandbox._grant_sandbox_membership` (extracted from `ensure_sandbox`) —
  shared by fork and reset, per the brief's "one fork implementation, two
  callers" instruction.
- `store.swap_sandbox_pointer` (new, `onboarding/store.py`) — the atomic
  swap: pointer flip (`sandbox_workspace_id`/`sandbox_batch_semver`) +
  `DELETE FROM exercise_completion` for the user, both inside the route's
  single open transaction (`tenant_connection` already wraps one call in
  one transaction) — never a window where the new pointer is visible with
  stale exercise flags still attached. `activation` rows are never touched
  (ADR-003).
- `tenancy.workspaces.delete_workspace` (new) — best-effort delete of the
  old "blue" workspace.
- `schemas.onboarding.SandboxResetOut` — `{workspace_id, orphaned_workspace_id}`.

## Decisions made (not pre-specified in the brief)

1. **Three separate transactions, not one held open across the whole
   reset.** I initially assumed the route's single `tenant_connection` block
   made fork+swap+delete atomic "for free" — wrong: `_apply_and_publish`
   writes triples to Oxigraph (a separate, non-Postgres store), so a
   Postgres rollback never undoes those writes. Advisor-consulted (not a
   harness change, just a design sanity check) before committing to a
   design. The actual safety property is **pointer-last ordering**
   (ADR-002 §4's own rationale: "no cleanup logic on failure — falls out of
   ordering"), not transactional wrapping. Implementation is therefore three
   sequential `tenant_connection` blocks in the route: (a) build the green
   workspace, (b) swap pointer + clear exercises, (c) best-effort delete the
   old workspace. A failure in (a) leaves the pointer on the old workspace
   with zero DB writes to unwind; a failure in (c) can't unwind (b) because
   it's already a separate, committed transaction by the time (c) runs.
2. **Old-workspace delete is expected to almost always FK-fail, and that's
   correct, not a bug.** `workspace_members` (and `identity`'s `principals`)
   reference `workspaces.id` with the default `RESTRICT` `ON DELETE`, and
   every sandbox workspace has a `workspace_members` row (granted on fork).
   So `delete_workspace` will raise `ForeignKeyViolationError` on
   essentially every reset. AC-005-06 is written exactly for this case —
   log the orphan, keep going, never treat it as reset failure. I did not
   add cascade-delete machinery to make the delete "succeed" — that would be
   solving a problem the brief doesn't ask for (no cleanup-sweep task is in
   scope here).
3. **Sync endpoint, no job table/polling**, per the task brief's own
   ponytail comment in the Implementation Hints — confirmed this is still
   correct for M1 (green build + swap completed well under a second in
   local testing; nowhere near the 30s target).
4. **No new migration.** Reused TASK-001's `0082_onboarding_state.sql`
   columns and TASK-004's tables verbatim, per the brief's expectation.

## Not done / deferred

- **Frontend (SPA button + confirm dialog, AC-005-01)** — **not built**.
  TASK-004's summary already flagged that no sandbox-entry-point UI exists
  anywhere in `packages/frontend` (the header workspace switcher was
  retired to Settings → Workspaces per PLAT TASK-027, and TASK-004
  explicitly deferred the frontend seam pending a follow-up task/ADR on
  where sandbox UI should live). Building a hostless `ResetDemoButton` with
  no route to mount it in would not satisfy Law B (E2E driving the journey
  from homepage nav) and would be dead code. **This means TASK-005's DoD is
  NOT fully satisfiable in this build**: AC-005-01 (confirm dialog +
  in-progress-exercise warning), the `ui_verify` gate, i18n dialog copy, and
  the E2E test ("Edit → reset → canonical restored; warning shown") are all
  blocked on that same missing UI host. Recommend the same follow-up
  task/ADR TASK-004 recommended, sized to place the sandbox
  switcher/banner/reset-button together in one pass, before either AC can
  be closed out.
- **Coverage measurement** — same environment-level `pytest --cov` segfault
  documented in TASK-004's summary (coverage.py/asyncpg C-extension
  interaction on this sandboxed macOS worktree) reproduces here too; not
  re-litigated. By inspection the 5 new integration tests exercise every
  branch in the reset code path (success, pre-fork-missing, build failure,
  publish failure, delete-failure-as-orphan) — well above 80% — but this is
  not a measured number.
- **Mutmut baseline** — not run, same reason as TASK-004 (no scoped
  `[tool.mutmut]` command, docker-integration-only tests, full pass
  prohibitively slow in-session).

## Test/gate results

- `uv run pytest tests/integration/test_onboarding_sandbox.py
  tests/integration/test_onboarding_sandbox_reset.py
  tests/unit/test_onboarding_sandbox_reset_entrypoint.py -m "integration and
  docker or not integration"` — **13 passed** (7 pre-existing TASK-004 +
  5 new TASK-005 integration + 1 new TASK-005 unit).
- Ran against an isolated compose stack (`COMPOSE_PROJECT_NAME=weaveonb005`,
  custom ports `WEAVE_PG_PORT=5450`/`WEAVE_REDIS_PORT=6397`/
  `WEAVE_LOCALSTACK_PORT=4578`/`WEAVE_OXIGRAPH_PORT=7886`) to avoid a port
  collision with other concurrently-running worktree stacks; torn down
  (`docker compose down -v`) after the run, no `.env` file left behind (env
  vars were exported inline, not written to disk).
- `uv run ruff check .` (backend, repo-wide) — clean.
- `uv run mypy src/weave_backend/onboarding/sandbox.py
  src/weave_backend/onboarding/store.py
  src/weave_backend/routers/onboarding.py
  src/weave_backend/schemas/onboarding.py
  src/weave_backend/tenancy/workspaces.py` — clean.
- `uv run ruff check --select C901,PLR0912,PLR0915` on the same files —
  clean (complexity budget, Law E).
- Pre-commit (`make lint` backend+frontend) — passed on both commits
  (frontend: 0 errors, pre-existing warnings only; typecheck clean once
  `packages/frontend` and `packages/shared` npm deps were installed in this
  fresh worktree — neither had `node_modules` yet, unrelated to this task's
  changes).
- Pre-push hooks not run (not pushing/opening a PR per instructions).

## Multi-tenancy confirmation

Every new/changed query is tenant-scoped: `store.swap_sandbox_pointer`'s
two statements both carry `WHERE tenant_id = $1 AND user_id = $2`;
`tenancy.workspaces.delete_workspace` carries `WHERE tenant_id = $1 AND id
= $2`; `sandbox.build_reset_workspace` reuses `create_workspace`'s existing
tenant-scoped insert and RLS-backed `workspace_members`/`principals` writes.
No cross-tenant enumeration surface was added (no new listing endpoint). No
`created_at`-ordered read was added, so `clock_timestamp()` FIFO wasn't a
consideration here (that fix from TASK-004 already covers the only
per-transaction multi-mint path this task's fork reuses).

## Migration

None. Reused TASK-001's `0082_onboarding_state.sql` columns
(`sandbox_workspace_id`, `sandbox_batch_semver`) and TASK-004's/TASK-001's
existing tables (`exercise_completion`, `activation`, `workspaces`,
`workspace_members`) verbatim. Reserved block 0092–0093 not used, no
collision.

## Commits

- `6728f10a` `test: add failing tests for TASK-005 sandbox reset (blue/green)`
- `3cf24f5a` `feat: TASK-005 sandbox reset (blue/green re-fork, known-good baseline)`

Both on `feature/ONB-EPIC-001` (local only, not pushed, per instructions).
