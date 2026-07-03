# TASK-PLAT-003 progress summary

Company admin creates workspaces, invites/revokes members, cascading settings,
mandatory cross-tenant isolation, workspace switch with SPARQL scope rewrite.

Branch: `feature/PLAT-EPIC-003` (stacked on `feature/PLAT-EPIC-000`). Not pushed, no PR
per task brief instruction — HITL will push/PR when ready.

## Decisions

- **Invite gateway is a `Protocol` seam** (`tenancy/invite_gateway.py`) with a
  recording-fake implementation. No real Cognito/email integration exists yet in
  this repo — wiring a real provider is out of scope and would touch live AWS
  (forbidden, Law F). Swap the singleton when Cognito invite email lands.
- **S3 Vectors stood in by LocalStack S3** with app-layer prefix isolation
  (`tenant/{tenant_id}/...`), not IAM policy — matches the MVP's Oxigraph/local-only
  stance elsewhere in the codebase. Documented as the intentional MVP shortcut.
- **RLS requires a non-superuser role.** Postgres never applies row-level security
  to superuser connections, even with `FORCE ROW LEVEL SECURITY`. Added a
  `weave_app` app role separate from the migration-running superuser. Verified for
  real (not assumed) by running `test_cross_tenant_read_isolation` against local
  Postgres. See `docs/specs/weave/engines/weave-platform/decisions/ADR-003.md`.
- **Domain/project settings scope levels are addressable, not modeled as entities.**
  `ancestor_chain()` is IRI-grammar-driven; the looser-override guard (AC-5) is only
  enforced for company-scope writes since domain/project have no backing table yet.
  See `docs/specs/weave/engines/weave-platform/decisions/ADR-004.md`.
- **AC-7 (workspace switch) shipped as an API-level integration test, not Playwright.**
  No workspace-switcher UI page exists yet — that's PLAT-TASK-005. The test exercises
  the identical scope-rewrite path at the API layer and is documented in-file as a
  deviation to replace with a real Playwright spec once TASK-005 lands the UI. This
  is a known, acknowledged Law 17 gap for this task, not silently skipped.
- **Retroactive TDD ordering.** Session was interrupted mid-implementation in an
  earlier context window; tests for the already-written implementation slices were
  authored and run against existing code rather than strict red-first for those
  slices. New slices in this session (settings cascade, query rewriter, isolation,
  audit emitter) followed strict red→green.

## Bugs found and fixed (via actually running tests, not assumption)

1. **Event-loop-bound Redis client singleton** (`tenancy/sessions.py`): redis-py's
   asyncio client binds real sockets to the event loop live at creation. pytest-asyncio
   hands each test function a fresh loop, so a plain module-global singleton raised
   `RuntimeError: Event loop is closed` on the second test that touched it. Fixed by
   tracking the loop the client was created on and recreating when the running loop
   differs.
2. **Identical bug in the asyncpg pool singleton** (`db/pool.py`) — same root cause,
   same fix pattern. Found only once the new integration tests exercised a second
   test function sharing the pool.
3. **`redis.exceptions.RedisError` not in the except tuple** in
   `get_session_version()`. `RedisError` is NOT a subclass of builtin `OSError`/
   `TimeoutError`; catching only builtins let real Redis connection errors crash
   6 previously-pure unit tests (`test_mock_oidc*.py`) once `issue_token_pair` started
   depending on Redis for session_version embedding.
4. **mypy "Duplicate module named conftest"** when a second `tests/integration/conftest.py`
   was added — `tests/` has no `__init__.py` anywhere so mypy can't disambiguate two
   same-named modules. Fixed by merging the new `platform_stack` fixture into the
   single existing `tests/conftest.py` instead of adding package markers (which broke
   unrelated import resolution when tried).

## Known limitation (tooling, not a code defect)

`pytest --cov=...` combined with the `platform_stack` fixture's
`asyncio.run(run_migrations())` reproducibly segfaults inside asyncpg's C extension
during threaded DNS resolution (`_create_ssl_connection` → `getaddrinfo`), with both
the default and `sysmon` coverage tracers. The identical code path runs clean to
completion twice with `--cov` removed, confirming this is a coverage-instrumentation/
sandbox limitation, not a logic bug. Docker-only-exercised modules (isolation,
workspace-switch e2e) are therefore not represented in the coverage number reported
by `--cov`; they are proven correct by the tests passing, just not coverage-counted.

## Notes for QA

- Run the docker-marked suite (`pytest -m "integration and docker"`) separately —
  CI's default job skips it (`not integration and not e2e`), matching
  `test_local_stack.py`'s existing precedent.
- Cross-tenant isolation test is the MANDATORY one per the brief
  (`test_cross_tenant_read_isolation`) — covers Postgres RLS, Oxigraph named-graph
  scoping, and S3 prefix isolation in one test, all three assertions independent.
- Law 17 gap: no `/workspaces` UI page yet. Flag if QA's UI-completeness gate runs
  against this task alone; the brief scoped this task to the API layer with the
  workspace-switch UI explicitly deferred to PLAT-TASK-005.

## Notes for PLAT-TASK-004 (RBAC)

- `Principal.session_version` (in `auth/dependencies.py`) and `require_active_session`
  (`tenancy/session_guard.py`) are available now — RBAC checks should compose with
  `require_active_session` rather than re-deriving session validity.
- Workspace membership rows (`tenancy/members.py`) already carry a `role` column
  seeded for this task's role-scoped invite ACs — RBAC can read from the same table,
  no new membership model needed.
