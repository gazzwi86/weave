# ONB-TASK-004 — Sandbox Provisioning

Status: implemented, tests green, pushed to `feature/ONB-EPIC-001c`. Partial-epic build — TASK-005 (reset) and TASK-015 deferred, per instructions.

## What shipped

- `packages/backend/src/weave_backend/onboarding/sandbox.py` (new) — canonical
  Hammerbarn template provisioning (`provision_canonical_template`) and
  lazy per-user sandbox fork (`ensure_sandbox`), sharing one apply/publish
  code path (`_apply_and_publish`) per ADR-002's "one implementation, three
  uses" (reset is TASK-005's still-deferred third use).
- `POST /api/onboarding/sandbox` route (`routers/onboarding.py`) —
  provisions the canonical template (idempotent, first caller only) then
  forks/reuses the caller's own sandbox, returns `{workspace_id, reused}`.
- `tenancy/workspaces.get_workspace_by_slug` (new) — idempotent
  canonical/sandbox lookup keyed on the existing `(tenant_id, slug)` unique
  constraint. No new tracking table.
- `onboarding/store.get_sandbox_workspace_id` / `set_sandbox_pointer` (new)
  — the pointer is written *last*, only after fork+publish succeeds, so a
  failed fork never leaves a half-seeded sandbox visible (AC-004-03).
- `packages/backend/tests/integration/test_onboarding_sandbox.py` (new,
  6 tests, all green against the real local docker stack) — fork+reuse,
  fork-failure/publish-failure leave the pointer null and retry succeeds,
  and the three ADR-002 isolation boundaries (per-user, canonical
  403+audited, cross-tenant zero-leak), using the real HTTP routes
  (`/api/sparql`, `/api/workspaces/{id}/switch`) and the PLAT-AUDIT-1 read
  surface (`audit.listing.list_entries`), not mocks or log-grepping.

## Decisions made (not pre-specified in the brief)

1. **No new migration.** TASK-001's `0082_onboarding_state.sql` already
   added the `sandbox_workspace_id` / `sandbox_batch_semver` /
   `sandbox_forked_at` columns with a comment marking them for this task —
   confirmed and reused as-is.
2. **In-process pipeline call, not HTTP.** `_apply_and_publish` calls
   `apply_operations_request` directly (the same function the
   `/api/operations/apply` route calls) rather than looping back over HTTP
   into the same running app — avoids a pointless second network hop for a
   server-triggered internal operation.
3. **Demo service principal via PLAT-IDENTITY-1.** Fork/canonical writes
   are attributed to a real minted principal (`ensure_agent_principal`),
   never a fabricated string, per `ApplyContext.principal_iri`'s own
   documented attribution concern.
4. **Sandbox membership grant.** The forking user is given `role="author"`
   on their *own* sandbox workspace via the existing `invite_member` +
   `activate_member` (email synthesized as `{user_sub}@sandbox.weave.local`,
   idempotent — `MemberAlreadyActive` on retry is swallowed). This wasn't
   explicit in the brief's pseudocode but is required for AC-004-05/06/07 to
   actually hold: without it, the user's own read of their own sandbox 403s
   the same as anyone else's. The canonical template deliberately gets
   **no** membership row — that's what keeps it 403-to-everyone via the
   existing RBAC gate, no new permission code (ADR-002).

## Bug found and fixed (not scoped to this task, but blocking it)

`operations/versioning.mint_version`'s "latest version" read
(`ORDER BY created_at DESC LIMIT 1`) is unsafe when a caller mints more
than one version inside a single open transaction — which is exactly what
`_apply_and_publish`'s per-batch loop does. Postgres's `now()` is frozen at
*transaction* start, not per-statement, so every version minted inside one
transaction got an identical `created_at`, and the tie-break could
re-select a stale row and re-mint an already-used semver
(`UniqueViolationError` on `graph_versions_tenant_id_workspace_id_semver_key`).
Fixed by inserting with `clock_timestamp()` instead of relying on the
column's `now()` default — a one-line fix in the shared function every
caller routes through, not a per-caller workaround. No prior caller had
hit this because no prior caller minted more than one version per
transaction.

## Not done / deferred

- **Frontend seam (AC-004-01/04/08)** — switcher entry, Practice-mode
  banner, feature-flagged "Coming soon", GE-CANVAS-1 embed — **not
  started**. `packages/frontend` has no existing switcher/banner component
  to extend; combined with PLAT TASK-027 AC-8 having retired the header
  workspace switcher for non-super-admin users (relocated to Settings →
  Workspaces), the brief's "demo switcher entry" AC needs a scope
  reinterpretation this task did not resolve. Recommend a follow-up
  task/ADR before building the frontend seam rather than guessing the UI
  location.
- **Coverage measurement** — `pytest --cov` segfaults (exit 139) in this
  sandboxed macOS worktree specifically when coverage instrumentation
  wraps the `platform_stack` fixture's asyncpg SSL connection during
  migration setup — reproduced twice, including with
  `COVERAGE_CORE=sysmon`. The same tests pass cleanly (exit 0) without
  `--cov`. This looks like an environment-level coverage.py/asyncpg
  C-extension interaction, not a code defect. By inspection the 6 tests
  exercise every path in `sandbox.py` (canonical create+reuse, sandbox
  fork+reuse, both induced-failure branches, all three isolation
  boundaries) — well above the 80% target — but this is not a measured
  number.
- **Mutmut baseline** — not run. No scoped test command is configured in
  `[tool.mutmut]` (defaults to the full suite per mutant), and this task's
  tests are docker-integration-only, making a full mutmut pass
  prohibitively slow within this session's remaining budget. Flagging as
  an explicit open gate rather than a silently-skipped one.
- **OKF conformance** — ran clean as part of the pre-push hook (171
  pre-existing warnings, all tolerated under §5.3, zero new ones from this
  change).

## Test/gate results

- `uv run pytest tests/integration/test_onboarding_sandbox.py -m "integration and docker"` — **6 passed**.
- `uv run ruff check .` — clean.
- `uv run mypy src/weave_backend/onboarding/sandbox.py src/weave_backend/onboarding/store.py src/weave_backend/routers/onboarding.py src/weave_backend/schemas/onboarding.py src/weave_backend/tenancy/workspaces.py src/weave_backend/operations/versioning.py` — clean.
- Pre-commit (`make lint` backend+frontend) — passed.
- Pre-push (OKF conformance, semgrep) — passed.

## Commits

- `test: add failing integration tests for TASK-004 sandbox provisioning`
- `feat: TASK-004 sandbox provisioning (canonical fork + per-user sandbox)`

Both pushed to `feature/ONB-EPIC-001c` (origin).
