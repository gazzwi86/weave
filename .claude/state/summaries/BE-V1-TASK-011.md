# TASK-011 — Role Guard (FR-060): Per-Project Roles Enforced at the API Boundary

Status: implementation done, handed to QA. EPIC-002, branch `feature/BE-V1-EPIC-002`.

## What shipped

- `pm/contributors.get_role` — single indexed lookup, no caching (removed contributor loses
  access next request).
- `auth/dependencies.Principal.roles: list[RoleGrant]`, `_parse_roles_claim` — JWT `roles` claim,
  shape-validated per Law 13, degrades to `[]` on malformed input (additive-only overlay, so
  losing it only narrows access, never over-grants).
- `rbac.py`: `ProjectAction`, `PROJECT_ROLE_ACTIONS` (admin ⊇ all 7, editor ⊇ backlog/specs/
  generate/prompt), `has_admin_grant` (tenant-scope always overlays; domain-scope overlays only
  if `domain` param matches), `enforce_project_role`, `require_project_role` dependency factory.
  No new production route ships — future PM mutation routes wire `Depends(require_project_role(X))`.

## Decisions / gaps (see ADR-012)

1. **`domain_iri` gap**: `projects` has no `domain_iri` column in M1 schema. `has_admin_grant`'s
   domain branch is implemented and unit-tested, but always called with `domain=None` at the real
   route boundary — dormant, not wired. One-line fix once the column lands.
2. **JWT roles claim is new infra**: no production issuer populates `roles` today (PLAT-IDENTITY-1
   issuer-side work not landed). `mock_oidc/tokens.py` deliberately NOT extended (would break the
   pinned `test_claims_shape` test) — integration tests inject a `roles`-bearing principal via
   `app.dependency_overrides[get_current_principal]` instead.

Both documented in `docs/specs/weave/engines/build-engine/decisions/ADR-012.md` per Law 10 (not a
Law 11 blocker — evidence one-sided, same reasoning as ADR-011's precedent).

## Bug found + fixed mid-task

`tenant_connection`'s `conn.transaction()` rolls back the whole transaction if an exception is in
flight when the `async with` exits — the `authz_denied` audit row written by
`_emit_denial_best_effort` was being silently discarded by the same 403 it documents. Fixed by
catching `InsufficientProjectRole` *inside* the connection block and re-raising *after* it exits
cleanly (SHA `bbf5c16`). Caught only by the integration test's DB-level assertion — unit tests
(fake connections) can't see real transaction semantics.

## Test coverage nuance (flagging for QA)

`rbac.py` alone: 78% unit-lane coverage (just under the 80% target — 21 uncovered lines are
pre-existing `require_workspace_role`/`require_tenant_admin` DI-only paths, not new TASK-011
logic). Aggregate across the three touched modules (`auth/dependencies.py` 84%, `pm/contributors.py`
100%, `rbac.py` 78%) = 83% (181 stmts, 30 miss), which clears 80%. Flagging both numbers rather than
rounding up — QA should judge per-file vs aggregate.

AC-4's domain-admin-covering / domain-admin-different-domain scenarios are proven at unit level only
(`test_rbac.py`, direct `has_admin_grant` calls), not integration/HTTP level — no `domain_iri`
column to seed a realistic route-level scenario against. Documented in ADR-012.

## Commits

- `cc306b3` test: TASK-011 add failing tests for project role guard
- `8704f6f` feat: TASK-011 require_project_role guard, PLAT-IDENTITY-1 roles claim
- `bbf5c16` fix: TASK-011 commit denial audit row before re-raising the 403
- `e710c73` test: TASK-011 integration role guard (EPIC-002)
- `48d22a3` docs: TASK-011 ADR-012 project-role guard's domain overlay + roles-claim origin
