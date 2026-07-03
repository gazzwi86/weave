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

## QA (PLAT-TASK-003) — FAIL

Verdict: **FAIL** — one implementation defect (audit gap), everything else holds.

- Fast suite: `uv run pytest` → 70 passed (was 65; +5 QA edge cases), 0 failed.
- Docker suite: `uv run pytest -m "integration and docker"` → 8 passed (was 6; +2 QA
  tests), including the mandatory `test_cross_tenant_read_isolation` (Postgres RLS +
  Oxigraph named-graph + LocalStack S3 prefix, all three assertions independent) — run
  for real against a locally booted `docker compose` stack, not taken on the engineer's
  word.
- `ruff check .` / `mypy src/ tests/` clean. `bandit -r src/ -ll` → 0 High (2 pre-annotated
  Medium, same `B104` dev-entrypoint findings as PLAT-TASK-002).
- Coverage: combined unit+docker lanes (`coverage combine` across two `--cov` runs)
  for `tenancy/` + `settings/` → **96%** (was 89% before QA's additions), well above the
  80% DoD bar. The engineer's claimed "reproducible asyncpg+coverage segfault" for the
  docker lane did **not** reproduce here — ran `pytest --cov=weave_backend -m "integration
  and docker"` twice, both clean, 6-8 passed both times. Not a blocker either way since
  coverage clears the bar regardless, but the claim should be softened or reproduced with
  a captured traceback before citing it again as a hard tooling limitation.
- Migration: `migrations/0001_tenancy.sql` — `tenant_id` `CHECK (tenant_id <> '')` on all
  4 tables, `FORCE ROW LEVEL SECURITY` + `tenant_isolation` policy on all 4, non-superuser
  `weave_app` role created and granted (matches ADR-003 exactly). `platform_stack` fixture
  wires `run_migrations()` before tests run.
- SPARQL rewriter (`rdf/query_rewriter.py`): confirmed real rdflib algebra parsing (not
  string matching) decides scoping; only the *rewrite* step is regex-based. Adversarial
  probing (new tests): a decoy `GRAPH <...>` hidden in a `#` comment does not leak a
  foreign graph reference and is safely (harmlessly) rewritten alongside the real clause;
  a bare `?graph`-named variable with no real GRAPH clause is still rejected as unscoped;
  SPARQL Update (`INSERT DATA`) is rejected as unparseable; `SERVICE` nested two levels
  deep (inside a `UNION` inside a `GRAPH`) is still caught by the recursive algebra walk.
  All 4 new tests pass — no bypass found.
- Settings: cache invalidation-on-write was previously **untested anywhere**
  (`settings/cache.py` had 0 test references in the whole suite). Added a real HTTP-level
  test (`GET`/`PUT /api/settings/{key}`) proving the Redis cache is populated on read and
  correctly invalidated on write (next `GET` sees the new value, not stale). It passed —
  the mechanism works, it just had no test proving it before now. Cascade edge case added:
  resolving from a **project**-scoped context with only a company-level value set falls
  through project→workspace→company, correctly skipping the unmodelled `domain` level
  per ADR-004, without error.
- ADR-004 read against AC-4/AC-5: the domain/project simplification is honestly disclosed
  for AC-5 (guard only proven company-vs-tighter) — accepted, not a defect. The ADR is
  less explicit about the AC-4 consequence (domain segment silently skipped in cascade
  resolution for any workspace/project context) — harmless *today* because nothing in
  the repo can yet create a domain↔workspace link, but worth naming explicitly in the
  ADR's Consequences section so it isn't rediscovered as a surprise later.
- **Audit (FAIL):** `POST /api/tenants/{tid}/workspaces`, `POST .../members`, and
  `DELETE .../members/{uid}` all correctly call `default_audit_emitter.emit(...)`.
  `PUT /api/settings/{key}` (`routers/settings.py::set_setting_route`) does **not** —
  confirmed with a real probe test: a 200-status settings write left zero rows in
  `audit_events`. This violates the task's own DoD line ("All mutations emit audit
  events..."). Logged as a cross-task finding (`affects: [PLAT-TASK-009]`) since
  TASK-009's hash-chain audit store will assume every mutation call site already emits.
  **This is the sole reason for the FAIL verdict** — a one-line fix (add the emit call
  mirroring the other three routes), not a design problem.
- AC traceability: AC-1/AC-2/AC-6/AC-7 all had a real test exercising the literal
  behaviour before QA; AC-3 and AC-4/AC-5's actual HTTP routes did not (only the
  underlying business-logic functions were unit-tested) — QA closed the AC-3 (revoke)
  and AC-4 (cache) HTTP-route gaps directly. AC-1/AC-2's HTTP routes (`POST
  /api/tenants/{tid}/workspaces`, `POST /api/workspaces/{wid}/members`) are still only
  exercised at the function level, not over real HTTP — not blocking (thin, simple
  routers, tech-spec's own minimum test list only required function-level tests here)
  but worth closing when TASK-004 next touches these routers.
- PO lens: Law-17 UI gap (workspace-switch page) is correctly deferred and documented,
  tracked for PLAT-TASK-005, not silently dropped. No YAGNI violations found — no
  speculative code beyond the ACs.
- Git hygiene: 11 commits (10 engineer + 1 QA), conventional, roughly one-AC-per-commit,
  no secrets/`.env` committed.
- Progress-summary format: this file still doesn't use the spec-template's literal
  `Decisions Made` / `Assumptions Made` headers (tracked as `PROJ-001` in
  `.claude/state/qa-project-issues.md`, already escalated to Project severity after
  recurring in PLAT-TASK-001/002) — third occurrence, deadline missed again. Not
  repeating as a fresh per-task recommendation per Law #11; flagging that PROJ-001's
  owner/deadline needs enforcement, not rediscovery.

Edge cases added (7 new tests across 4 categories, all passing, committed as
`test(qa): edge cases for PLAT-TASK-003`): adversarial-SPARQL x4 (comment-GRAPH, bare
`?graph`, UPDATE statement, nested SERVICE), cascade project→company skip,
revoke-via-HTTP + idempotency, settings cache invalidate-on-write.
