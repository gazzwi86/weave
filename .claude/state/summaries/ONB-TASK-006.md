---
name: summary_ONB-TASK-006
description: Role-Path Resolution + Choose-Path + Change-Path (ONB-EPIC-003) — engineer progress summary
metadata:
  type: summary
  timestamp: 2026-07-12
---

## What shipped

- **Backend resolver** (`packages/backend/src/weave_backend/onboarding/path_resolver.py`):
  `resolve_role_path(conn, principal)` maps the caller's `workspace_members.role` (via the active
  workspace) to one of 4 onboarding paths through a config-data table (`ROLE_TO_PATH`, 10 canonical
  slugs -> path/variant). Zero-role, unmapped-role, and unreachable-role-source (Redis/Postgres
  failure) all degrade to the Business read-only fallback, unpersisted on the unreachable path
  (AC-006-03/06).
- **Routes**: `GET /api/onboarding/path` (resolves + persists, unless already manually chosen or
  the source was unreachable) and `PUT /api/onboarding/path` ("change my onboarding path" —
  AC-006-04), both in `routers/onboarding.py`, schemas in `schemas/onboarding.py`
  (`OnboardingPathOut`, `OnboardingPathChoiceRequest`).
- **Frontend**: `app/api/onboarding/path/route.ts` (Next.js proxy, zod-validated PUT body — Law 13),
  `app/settings/onboarding-path/{page.tsx,use-onboarding-path.ts}`, `components/onboarding/
  path-picker-dialog.tsx` (Radix Dialog, design tokens only, axe-clean), a Settings nav entry
  (`components/shell/nav-items.ts`), and a Playwright scene appended to
  `tests/e2e/settings-members-notifications.spec.ts`.
- **Shared**: `packages/shared/onboarding/role-paths.ts` — the 4-path display-label table (`RolePath`
  already existed in `types.ts`).
- No new migration: TASK-001's `0082_onboarding_state.sql` already has `role_path`/`path_variant`/
  `path_chosen_manually` — migration numbers 0097/0098 were **not needed**.

## Key decision: role source (escalated mid-task, coordinator-resolved)

The brief assumed PLAT-IDENTITY-1 exposes a role array to resolve against. The only role-resolution
precedent in this codebase (`notifications` router's `_resolve_principal_role`, TASK-030) reads a
**single scalar role** from `workspace_members.role` via the active-workspace lookup — not the JWT
`roles` grant claim (which carries coarse tenant/domain/project grants like `admin`/`owner`/`editor`,
not personas). I escalated this before writing code; coordinator confirmed **option 2**: build
AC-006-01/03/04/05/06 fully against the real single-role data shape, and defer AC-006-02 (the
multi-role choose-path prompt) — no speculative multi-membership query. `needs_choice` is wired
end-to-end (schema, routes, UI) and is always `false` in M1. Noted in
`.claude/state/overnight-queue.md` under "ONB-006 AC-006-02 deferred" for the architect to reactivate
when PLAT-IDENTITY-1 grows a real multi-role source.

## AC coverage

| AC | Status | Test(s) |
|---|---|---|
| AC-006-01 (10->4 total mapping) | Pass | `test_onboarding_path_resolver.py` matrix + totality test; integration test seeds a real `compliance_officer` membership row |
| AC-006-02 (multi-role prompt) | **Deferred** — see above; `needs_choice` always `false`, never wrong, never triggers | n/a (no multi-role source to test against) |
| AC-006-03 (zero-role/viewer -> business read-only) | Pass | resolver unit test, parametrized None/viewer |
| AC-006-04 (change path persists, reflected everywhere) | Pass | integration test (PUT then GET), frontend hook/page/e2e tests |
| AC-006-05 (no IdP SDK import) | Pass | import-level assertion test on the resolver module |
| AC-006-06 (unreachable role source -> session-only fallback) | Pass | resolver unit test raising `ConnectionError` from the role lookup |

## Gates run (this worktree only — ignore any proactive-context noise from sibling worktrees)

- Backend poison-endpoint pytest (`LOCALSTACK_ENDPOINT_URL=http://127.0.0.1:1 OXIGRAPH_URL=http://127.0.0.1:1 uv run pytest -m "not docker and not e2e"`): **green**.
- `uv run ruff check .`: **green**. `uv run mypy src/ tests/`: **green** (634 files).
- Frontend `npm run lint` (0 errors, only pre-existing warnings), `npm run typecheck`: **green**.
- Frontend `npm test`: **253 files / 1273 tests, all green**.
- OKF (`okf_validate.py docs`): **conformant** (171 pre-existing tolerated warnings, none new).
- Docker-gated integration tests for this task (`test_get_path_resolves_and_persists_from_workspace_role`,
  `test_put_path_sets_manual_choice_and_persists_across_reads`): run once locally against an
  isolated port-remapped stack (`WEAVE_PG_PORT`/`WEAVE_REDIS_PORT` overrides, torn down after) —
  **both pass**. Did **not** touch/restart the shared default-port docker stack (contended by sibling
  worktree lanes), per coordinator instruction — CI runs the full docker-gated suite in isolation.
- Playwright: new scene (`test_settings_onboarding_path_change_persists_across_reload`) added.
  Local run hits a pre-existing mock-OIDC redirect-timing failure shared by every test in this spec
  file — confirmed by running the pre-existing sibling test
  (`test_settings_members_page_invite_and_revoke_work`), which fails identically. Not a regression;
  environmental. Deferred to CI.
- `ui_verify`: requires a live dev server + full OIDC login (same environmental blocker as
  Playwright) — deferred to CI/pre-push hook rather than spending budget fighting a local-only
  redirect-timing issue unrelated to this change.

## Notable simplification (ponytail, documented inline)

`@weave/shared` is not wired as a frontend workspace dependency anywhere in this codebase yet (no
`tsconfig` path, no `package.json` dependency). Rather than adding that cross-package wiring for one
4-entry label table, `path-picker-dialog.tsx` duplicates the table locally with a `ponytail:` comment
pointing at `packages/shared/onboarding/role-paths.ts` as the source to wire up for real if/when the
frontend starts consuming `@weave/shared` more broadly.

## No ADR needed

The role-source design decision (workspace-role lookup, not JWT claim) is a bug-fix-shaped
correction of a stale brief assumption, resolved via escalation + coordinator confirmation, not a
net-new architectural choice — documented here and in the resolver's module docstring instead.
