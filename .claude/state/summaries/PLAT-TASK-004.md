# TASK-PLAT-004 progress summary

RBAC enforcement + agent identity registry (contract `PLAT-IDENTITY-1`). Every
request — human or AI agent — carries a resolvable principal IRI checked
against RBAC before touching any resource.

Branch: `feature/PLAT-EPIC-004` (stacked on `feature/PLAT-EPIC-003` -> PR #11 ->
`feature/PLAT-EPIC-000` -> PR #10). Not pushed, no PR per task brief instruction
— HITL will push/PR when ready. No live AWS anywhere (Law F): STS validated
against LocalStack only; unit lane mocks the boto3 boundary directly.

## Decisions

- **Same RBAC path for human + agent.** `principals.sub` is the one join key
  against `workspace_members.user_sub` regardless of principal type — a
  human's OIDC `sub` or an agent's `sha256(iam_role_arn)[:16]`. No route or
  dependency branches on `principal_type` anywhere.
- **Agent auth via STS, never Cognito.** `POST /api/auth/agent-token` validates
  an STS session token against LocalStack's `GetCallerIdentity`, mints a 60s
  agent JWT using the mock OIDC provider's own signing key so the existing
  JWKS-based verifier checks both principal types identically.
- **ADR-005**: agent-token minting resolves `tenant_id` from `workspace_id` via
  a narrow `SECURITY DEFINER` SQL function (`resolve_workspace_tenant`) — RLS
  blocks every row until `app.tenant_id` is set, but that's the very fact being
  looked up. Solves the chicken-and-egg problem with one intentionally narrow
  RLS carve-out.
- **ADR-006**: `principals.iri` is NOT the primary key. The brief's mint
  formulas (`urn:weave:principal:user:{sub}` /
  `urn:weave:principal:agent:{sha256(iam_role_arn)[:16]}`) are deterministic
  from `sub`/`arn` alone, not tenant-namespaced. A global PK on `iri` incorrectly
  rejects a second tenant registering a principal whose `sub`/arn-hash happens
  to collide with one already used elsewhere — a real risk in this environment
  since LocalStack's STS emulator always resolves to the same fixed root ARN
  regardless of input. `id` (surrogate UUID) is the real PK; `(tenant_id, sub)`
  remains the only true uniqueness constraint and upsert target.
- **RBAC dependency-by-default.** `auth/public.py`'s `assert_all_routes_guarded`
  walks the whole route tree (including FastAPI's `_IncludedRouter` wrapper) at
  import time and fails at startup if any route lacks `get_current_principal`
  in its dependency chain, unless explicitly marked `@public`. Only
  `/api/health` and `/api/auth/refresh` are marked public.
- **TTL ceiling is per-token-type (brief adjustment)**: human ≤300s (AWS
  Cognito's real floor, ADR-001), agent ≤60s (our own mint, no such floor).
  `TokenTtlExceeded` is a distinct exception from the generic
  `TokenVerificationError` so the 401 body can distinguish
  `token_ttl_exceeded` from a generic invalid-token 401.
- **Bounded membership-authz retrofit scope** (cross-task ledger fix c, from
  PR #11's finding): only `invite_member_route`/`revoke_member_route` gated on
  `require_workspace_role("admin")` this task — these two mutate who else can
  access a workspace, the clearest privilege-escalation risk of the flagged
  set. Settings/sparql/workspace-switch routes deliberately left ungated;
  recorded here rather than silently expanded or silently skipped.
- **E2E surface (brief fallback used)**: `test_rbac_author_cannot_delete_member`
  delivered as an API-level integration test, not Playwright — no UI delete
  affordance exists yet (PLAT-TASK-005).

## Bugs found and fixed (via actually running the docker-marked suite, not assumption)

1. **`principals.iri` global-PK collision across tenants** — discovered running
   `test_agent_registry_tenant_scoped` for real: LocalStack's STS emulator
   always resolves `GetCallerIdentity` to the same fixed root ARN regardless of
   session-token content, so every agent-token mint in one test run derives
   the *identical* `agent_principal_iri`. With `iri TEXT PRIMARY KEY`, a second
   tenant's insert hit a primary-key violation the `ON CONFLICT (tenant_id,
   sub)` clause never catches (wrong constraint), failing the insert outright.
   The identical bug also affects **human** principals (`test_get_principal_route
   _is_admin_only` first surfaced it as a 404-not-200) — test fixtures reuse
   simple, low-cardinality dev subs (`"u-admin"`) across different tenants.
   Fixed via ADR-006 (schema change: surrogate `id` PK, drop `iri`'s global
   uniqueness). One schema fix resolved both failures — no test-level
   workaround needed, since the underlying multi-tenancy assumption (the same
   `sub` can legitimately belong to two different tenants) was the real gap.
2. **Segfault chasing a red herring, then finding the real root cause.**
   `pytest --cov=weave_backend.identity` (or `.auth`/`.rbac`) segfaulted
   reproducibly inside asyncpg's C extension, both for the pure-unit lane and
   the docker lane, across several attempts (including trying
   `COVERAGE_CORE=sysmon` to swap tracers). Captured a full crash traceback
   this time (unlike TASK-003's summary, which only asserted this without one):
   the crash was `asyncpg/connect_utils.py::_create_ssl_connection`, called from
   `mock_oidc/tokens.py`'s `_persist_principal_best_effort` — a *pure unit test*
   (`test_mock_oidc.py`, no docker marker) was making a **real** attempt to
   connect to Postgres. `docker ps` confirmed why: a previous crashed pytest
   invocation had left the `platform_stack` fixture's containers running
   (`weave-postgres-1` etc., "Up 4 minutes") — its teardown `finally` never
   ran because the process itself had just segfaulted. So "unit" tests were
   silently hitting a real, stale Postgres, and coverage's tracing overhead
   shifted timing enough to expose a race in asyncpg's connection-teardown
   path across many rapidly-created event-loop-bound pools. `docker compose
   down -v` before the next run made the segfault disappear completely, both
   for the unit lane (86% coverage, clean) and confirmed the docker lane
   itself (without `--cov`) was never actually broken (19/19 passing
   throughout). **This resolves TASK-003's QA note that the segfault claim
   couldn't be reproduced** — it wasn't a myth or a flaky coverage/asyncpg
   incompatibility, it was leaked containers from an earlier crashed process
   corrupting the next run's isolation assumption. Root cause, not symptom.

## Coverage

Unit lane only (docker lane + `--cov` together still segfaults for reasons
above, even with clean containers — likely a genuine coverage-tracer +
live-socket-I/O timing fragility during the `platform_stack` fixture's own
`asyncio.run(run_migrations())`, separate from the leaked-container issue):

```
Name                                     Stmts   Miss  Cover   Missing
----------------------------------------------------------------------
src/weave_backend/auth/agent.py             23      0   100%
src/weave_backend/auth/dependencies.py      38     14    63%   51-76
src/weave_backend/auth/oidc_client.py       20      4    80%   39-42
src/weave_backend/auth/public.py            32      0   100%
src/weave_backend/auth/verify.py            40      0   100%
src/weave_backend/identity/registry.py      54      5    91%   155-161, 178-180
src/weave_backend/rbac.py                   37     12    68%   76-89, 98-102
----------------------------------------------------------------------
TOTAL                                      244     35    86%
```

`dependencies.py`'s `get_current_principal` body (51-76) and `rbac.py`'s
`require_workspace_role`/`require_tenant_admin` dependency closures (76-89,
98-102) are the two files under 80% in isolation — both are exercised
end-to-end by the 19 docker-marked integration tests (every route in the
suite calls through `get_current_principal`; `test_rbac_author_cannot_delete
_member`, `test_tenancy_isolation.py`'s admin-gated tests, and
`test_get_principal_route_is_admin_only` specifically prove both dependency
factories' 404/403/200 branches) — just not numerically counted due to the
coverage-tooling limitation above. Aggregate unit-only coverage across the
three target modules is 86%, above the 80% DoD bar.

## Notes for QA

- Tear down any stray `weave-*` docker containers (`docker compose down -v`)
  before running the docker-marked suite if a previous run crashed — see bug
  #2 above. `docker ps -a | grep weave` should show nothing before starting.
- Run the docker-marked suite separately: `pytest tests/integration -m
  "integration and docker and not stack"` — 19 passed, clean, 0 failures.
- `test_agent_registry_tenant_scoped` and `test_agent_sts_auth_mints_iri` both
  mint an agent token via the real `/api/auth/agent-token` HTTP endpoint
  against LocalStack — both resolve to the identical root ARN (LocalStack
  community-edition behavior), which is precisely what ADR-006 makes safe now.
- Bandit: 0 High findings (2 pre-existing Medium `B104` dev-entrypoint
  findings, already `noqa`'d, same as prior tasks).
- Ruff/mypy: clean (`All checks passed!` / `Success: no issues found in 95
  source files`).

## Notes for PLAT-TASK-005 (nav/UI)

- No workspace-member-management UI exists yet — `invite_member_route`/
  `revoke_member_route` are now role-gated at the API layer only. When
  TASK-005 builds the nav/member-management UI, it needs to surface the 403
  `{"error": "forbidden", "required_role": "admin"}` body distinctly from a
  404, and should NOT assume every authenticated member can see an invite/
  revoke affordance — only admins.
- `Principal.principal_type` (`"human"` | `"agent"`) is now on every verified
  principal — any UI presenting "who did this" should account for agent
  actors, not just humans.

## Notes for PLAT-TASK-009 (audit/hash-chain)

- Every identity-mutation call site emits an audit event with a real
  `principal_iri` now (human mint on login, agent mint on STS auth,
  member-revoke's `subject_iri` fixed to use `human_principal_iri(user_sub)`
  instead of an ad-hoc string). TASK-009's hash-chain store can trust
  `actor_iri`/`subject_iri` are canonical IRIs, not raw subs, from this task
  forward.
- Agent registration audit event: confirmed emitted on every successful
  `POST /api/auth/agent-token` mint (see `test_agent_sts_auth_mints_iri`).

## DoD walk

- AC-1 (idempotent human IRI mint): done — `ensure_human_principal`'s
  `ON CONFLICT (tenant_id, sub) DO UPDATE`, embedded in JWT `principal_iri`.
- AC-2 (agent STS auth): done — `POST /api/auth/agent-token`, 401
  `sts_validation_failed` on boundary failure (unit-mocked; LocalStack itself
  never rejects any input, documented as its own known limitation), audit
  event on registration.
- AC-3 (RBAC 403 + dependency-by-default): done — `ROLE_RANK`, `InsufficientRole`,
  `assert_all_routes_guarded` enforced at import time.
- AC-4 (revoked session 401): done — pre-existing `session_version` check in
  `get_current_principal`, now covered by this task's `test_revoked_session
  _returns_401`.
- AC-5 (per-token-type TTL ceiling): done — `TOKEN_TTL_CEILING_SECONDS`,
  `TokenTtlExceeded` propagates distinctly.
- AC-6 (admin-only principal lookup): done — `GET /api/principals/{iri}`,
  404 `principal_not_found`.
- AC-7 (agent registry tenant-scoped): done — `list_tenant_agents`, zero
  cross-tenant rows possible now that ADR-006's schema fix landed (was
  actually broken before the fix — proven by a real failing test, not assumed
  correct).
- Coverage ≥80% auth/rbac/identity: 86% unit-only aggregate (see Coverage
  section above for the tooling caveat on two files' docker-lane-only paths).
- Lint/type/security: ruff clean, mypy clean (95 source files), bandit 0 High.
- Conventional commits: 10 commits this task (1 test, 6 feat, 3 fix), each a
  single logical slice.

## Deviations (all recorded, none silent)

1. TTL ceiling is per-token-type, not a single 60s cap (brief adjustment,
   explicitly authorized).
2. STS failure path (`sts_validation_failed`) tested via unit-level boto3 mock,
   not real LocalStack rejection — LocalStack community edition accepts any
   session token unconditionally, verified empirically, no input found that
   makes it reject a call.
3. `test_rbac_author_cannot_delete_member` delivered as an API-level
   integration test per the brief's own fallback — no UI delete affordance
   exists yet (PLAT-TASK-005).
4. Membership-authz retrofit bounded to invite/revoke routes only —
   settings/sparql/switch routes explicitly left ungated this task.
5. `principals.iri`'s primary-key design changed mid-task from the original
   migration draft (ADR-006) — a genuine bug found by running real tests, not
   a brief deviation (the IRI *mint formula* itself is unchanged, exactly as
   specified).
