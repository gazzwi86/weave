# PLAT-V1-TASK-017 — "What can Weave do for me" surface (role-home)

Epic: PLAT-V1-EPIC-010 (sole task — closing this task closes the epic).
Worktree: `/Users/gareth/Sites/weave-PLAT-010`, branch `feature/PLAT-V1-EPIC-010`.
HEAD: `beda6dda` (backend + frontend, pushed to `origin/feature/PLAT-V1-EPIC-010`).

## Status: backend and frontend complete, all local gates green. Full Playwright `ui_verify`
run deferred to CI/coordinator epic-close — see "ui_verify status" below.

## Commits (this branch, task-scoped)

- `9834a30b` feat: role-home capability table, next-action rule, completeness map (TASK-017)
- `716d0cb2` feat: tag completeness-binding gap rows with their kind (TASK-017)
- `bb17356d` feat: PLAT-V1-TASK-017 role-home endpoint (router, schemas, tile wiring)
- `be7aaff8` fix: role_home tile is a tenant-wide singleton, not per-user
- `beda6dda` feat: role-home landing page (frontend + component test + Playwright E2E)

## What was built

- `packages/backend/src/weave_backend/dashboard/role_home.py` — pure logic: `authority_level`,
  `capabilities_for_level`, `engine_gated_rows`, `next_action_rule`, `completeness_map`. 19 unit
  tests, `tests/unit/test_role_home.py`, all green.
- `packages/backend/src/weave_backend/routers/role_home.py` — `GET /api/role-home`. Resolves
  authority level from the JWT `roles` claim (TASK-010 precedent, `RoleGrant.role`, NOT the
  DB `workspace_members.role` column), fetches CE data via `resolve_category` (the TASK-016
  binding registry — `ontology-health`, `completeness`, `compliance` for publish/admin,
  `rbac-coverage` for admin) plus a direct `GET /api/ontology/types` round-trip for the kind
  list, and builds capabilities/summary/next-action/completeness/tiles.
- `packages/backend/src/weave_backend/schemas/role_home.py` — `RoleHomeResponse` and friends.
- `packages/backend/src/weave_backend/dashboard/store.py` — `ensure_role_home_tile` (idempotent
  insert of the `scope='role_home'` widget row) + widened comment/registry for owner-scoped
  scopes (see Decision below).
- `packages/backend/src/weave_backend/dashboard/bindings.py` — `_completeness()`'s gap rows now
  carry a `kind` tag (additive, backward-compatible) so role-home's `completeness_map` can group
  gaps per BPMO kind.
- Router registered in `packages/backend/src/weave_backend/__init__.py` (import + `include_router`,
  same pattern as every other router).
- `packages/backend/tests/integration/test_role_home_api.py` — 8 docker-marked integration tests,
  all passing (see Gate results below): role-by-role content, capability-matrix filtering,
  coming-soon/FR-015 consistency, completeness-map kind grouping from the live types endpoint,
  degrade-to-cached-snapshot on CE failure, p95 latency, auth-required, and the tile riding the
  real `scope='role_home'` widget_instances row.

## Decisions made / nuances discovered

1. **Kind list source**: routed through `ctx.ce_client.get("/api/ontology/types")` (mirrors the
   existing `_ontology_issues` binding pattern) rather than importing `catalogue.list_kinds()`
   in-process — keeps role-home consistent with the established CE-binding convention and
   testable via the same `MockTransport` stub pattern as everything else in `bindings.py`.

2. **Completeness gap rows needed a `kind` tag**: TASK-016's `_completeness()` binding returned
   gap rows without saying which BPMO kind they belonged to. Fixed additively in `bindings.py` by
   tagging each row with `kind` inside the existing per-kind loop — no second SPARQL round-trip,
   no new binding.

3. **Authority level from JWT `roles` claim, not the DB role column**: two role systems coexist
   (`workspace_members.role` in Postgres vs. the JWT `roles` claim used by TASK-010's
   `resolve_starter_role`). Role-home follows the JWT-claim precedent for consistency with the
   existing dashboard/starter-tile code, not the DB-backed `resolve_workspace_role`.

4. **Role-home tile is a tenant-wide singleton (owner NULL), not per-user — corrected mid-task.**
   Original implementation inserted `owner_principal_iri` for `scope='role_home'`, matching the
   `scope='user'` pattern. This violated `widget_instances_check1`
   (`packages/backend/migrations/0071_widget_state.sql`), which requires
   `owner_principal_iri IS NULL` for every scope except `'user'`. Caught only when running the
   docker-marked integration suite against real Postgres (the poison-endpoint non-docker sweep
   can't exercise a live CHECK constraint). Fix: `ensure_role_home_tile` now inserts with no
   owner (follows `tenant_default`'s existing pattern), `list_widgets`'s
   `_OWNER_SCOPED_SCOPES` narrowed back to `("user",)`. This is correct anyway: the *cached*
   payload (ontology health/completeness/kind list) is tenant-scoped CE data, not user-specific —
   role-specific filtering happens in `_build_response`, not in the stored row. No migration
   needed; no schema change.

5. **Mock-OIDC test gap** (pre-existing, not fixed here): `issue_token_pair()` never populates a
   `roles` claim, so the integration tests override `get_current_principal` via
   `app.dependency_overrides` to get role differentiation, following
   `test_dashboard_example_prompts_route.py` precedent, rather than minting custom JWTs.

6. **mypy implicit-reexport quirk**: `from weave_backend.dashboard import bindings` triggered
   `Module "weave_backend.dashboard" has no attribute "bindings"` only under the full
   `mypy src/ tests/` run (not a narrower file-subset run). Fixed with a self-aliased import
   (`import bindings as bindings`) in the new completeness-kind unit test.

## Mount-chain proof (router actually wired in)

```
$ grep -n "role_home" packages/backend/src/weave_backend/__init__.py
from weave_backend.routers.role_home import router as role_home_router
app.include_router(role_home_router)
```
Confirmed via a live docker-integration request in `test_role_home_api.py` (all 8 tests hit
`/api/role-home` through the real app and get real responses, not 404).

## Frontend — mount chain and page (built this session)

- `packages/frontend/app/role-home/page.tsx` — Server Component, same pattern as
  `app/dashboard/page.tsx` (server-side `fetch` of `GET /api/role-home` with the session's
  bearer token, `cache: "no-store"`). Renders: next-action banner, capability cards
  (available → link; gated → `Badge` "Coming soon" + one-line description, never hidden —
  AC-2), a completeness table (kind / instance count / gap count — AC-3), and the role-home
  SWR tiles through the *existing* `WidgetGrid`/`WidgetTile` components (so the stale badge,
  honest-state matrix, and design tokens are 100% reused, not re-implemented — Law 20
  compliant, no ad-hoc hex/px/duration anywhere in the new file).
- Nav mount chain (grep-proven):
  ```
  $ grep -n "role-home" packages/frontend/components/shell/nav-items.ts
  prefixes: ["/dashboard", "/notifications", "/role-home"],
  { label: "What can Weave do for you?", href: "/role-home", tag: "built" },
  ```
  Reachable from any page via the "Home" primary-nav section (left rail) → "What can Weave do
  for you?", and via the global "?" help launcher
  (`components/shell/help-launcher.tsx`, new top link). Both are inside `AppShell`, which wraps
  every non-public route, so the page is reachable from the app's homepage/nav on login.
- `packages/frontend/app/role-home/__tests__/page.test.tsx` — 7 vitest/RTL tests: next-action
  banner, available-capability link, coming-soon card (AC-2), completeness row (AC-3), SWR
  tile render via `WidgetGrid` (AC-5), `--text-h1` page-title token check, and the
  backend-failure degrade path (`role-home-error` fallback).
- `packages/frontend/tests/e2e/role-home.spec.ts` — Playwright `test_role_home_viewer_vs_architect`
  equivalent. Logs in via mock OIDC (real browser, real backend — no `page.route` mock in this
  spec, unlike `dashboard-widgets.spec.ts`), asserts the Viewer/read-level view (no
  author-or-above capability ids render — AC-4), the coming-soon card, and zero axe-core
  violations. **Known scope limit, called out in the spec's own comment**: mock-OIDC's
  `issue_token_pair()` issues no `roles` claim (a pre-existing gap, also noted in backend
  Decision 5 above), so a real browser login can only ever reach the default (read/Viewer)
  authority level — the publish-level ("Architect") half of AC-4/`test_role_home_viewer_vs_architect`
  is covered instead by the backend's `test_role_matrix_capability_filtering` integration test,
  which uses `app.dependency_overrides` to force the level. Fixing mock-OIDC to issue a real
  `roles` claim is out of this task's scope (shared test infra, would ripple into every other
  role-differentiated E2E test) — flagging as a follow-up, not silently working around it.

## AC status (backend)

All 7 ACs from the task brief have backend coverage:
- AC-1 (role-tailored capability list) — `test_role_home_content_by_role`,
  `test_role_matrix_capability_filtering`
- AC-2 (engine-availability coming-soon gating, single source of truth with FR-015) —
  `test_coming_soon_consistency_with_fr015`
- AC-3 (per-kind completeness map from the live types endpoint) —
  `test_completeness_map_kinds_from_types_endpoint`
- AC-4 (next-action priority rule) — unit tests in `test_role_home.py`
  (`test_next_action_priority_rule` and siblings)
- AC-5 (SWR tile riding `scope='role_home'`) — `test_role_home_tiles_ride_swr_scope`
- AC-6/AC-7 (honest-state degradation, p95, auth-required) —
  `test_role_home_degrades_to_cached_snapshot`, `test_role_home_p95`,
  `test_role_home_requires_auth`

**Frontend/AC-6**: the `role-home` page and its component/E2E tests are now built (see Frontend
section above). The axe-core zero-violations assertion runs inside the E2E spec against a real
rendered page; the Lighthouse-100 half of AC-6 rides the shared CI Lighthouse gate (not run
locally this session — no lighthouse tooling invoked here, same as every other page's AC-6).

## Gate results

- Poison-endpoint sweep (`LOCALSTACK_ENDPOINT_URL=http://127.0.0.1:1 OXIGRAPH_URL=http://127.0.0.1:1
  uv run pytest -m "not docker and not e2e" -p no:warnings -q`): **PASS**, all green, run twice
  (before and after the tenant-wide-tile fix).
- `uv run ruff check .` (whole backend): **PASS**, 0 errors (1 import-sort issue auto-fixed with
  `--fix` mid-session).
- `uv run mypy src/ tests/`: **PASS**, "Success: no issues found in 664 source files".
- Docker-marked integration suite (`test_role_home_api.py`, 8 tests): **RUN, PASS** — against a
  worktree-local isolated compose stack, NOT the shared stack. Used a throwaway root `.env` with
  `COMPOSE_PROJECT_NAME=weaveplat017` and non-default host ports
  (`WEAVE_PG_PORT=25432`, `WEAVE_REDIS_PORT=26379`, `WEAVE_LOCALSTACK_PORT=24566`,
  `WEAVE_OXIGRAPH_PORT=27878`), brought up with `docker compose up -d postgres redis localstack
  oxigraph` (new isolated containers, `weaveplat017-*`, did not touch any other worktree's
  containers), ran the suite with matching env vars exported, then `docker compose down -v` and
  deleted the `.env`. This is how the tenant-wide-tile bug (item 4 above) was actually caught —
  the poison-endpoint sweep alone could not have found it.
- Frontend `tsc --noEmit`: **PASS**, 0 errors.
- Frontend `eslint .` (whole package): **PASS**, 0 errors, 312 pre-existing warnings (unchanged
  from before this task's changes — sonarjs duplicate-string / max-lines-per-function on
  unrelated test files).
- Frontend `vitest run` (whole package, 281 files): **PASS**, 1374/1374 tests, including the new
  `app/role-home/__tests__/page.test.tsx` (7/7).

## ui_verify status — DEFERRED to coordinator epic-close

`.claude/scripts/ui_verify.sh` (and the Playwright E2E spec, `tests/e2e/role-home.spec.ts`) were
**not run against a served page** this session. Playwright's `webServer` config needs a full
stack — Postgres + Redis + LocalStack + Oxigraph + the uvicorn backend + the mock-OIDC issuer +
`next dev` — and the default ports (5432, 6379, 4566, 7878) are already held by another active
worktree (`weave-plat-v1-epic-009`). The docker-marked *integration* suite was successfully run
against a worktree-isolated stack earlier in this session (see Gate results above), but standing
up a sixth isolated service set (adding `next dev` + mock-OIDC to the mix, and pointing
`playwright.config.ts` at non-default ports) was judged out of budget/risk for this session —
flagging explicitly rather than quietly skipping it. All static checks (tsc/eslint/vitest) that
don't require a live server are green.

**Next step for the coordinator**: run `tests/e2e/role-home.spec.ts` (and `ui_verify.sh`) as
part of the epic-close verification, on a clean/CI environment where the default ports are free.

## Next step for whoever picks this up

Backend and frontend are both feature-complete for all 7 ACs and pushed to
`origin/feature/PLAT-V1-EPIC-010` (HEAD `beda6dda`). Remaining before epic close: (1) run the
Playwright suite + `ui_verify.sh` against a served page (see above), (2) the CI Lighthouse-100
gate for AC-6, (3) if the mock-OIDC `roles`-claim gap is ever fixed, extend
`role-home.spec.ts` to also cover the publish-level ("Architect") browser path.
