# PLAT-TASK-002: SPA shell, auth, design system, AI routing, one-command dev stack

Branch: `feature/PLAT-EPIC-000`. Builds on PLAT-TASK-001 (monorepo scaffold, IaC, CI/CD).

## What this task added

- **AC-1**: `GET /api/health` reports `postgres`/`redis`/`oxigraph` status via a raw
  TCP-connect check (`health_checks.py`); `make dev` boots backend + mock-oidc +
  frontend; `make up`/`docker compose up` boots postgres/redis/oxigraph. Verified for
  real: ran the docker-marked `test_dev_stack_healthy` against a live `docker compose up`
  (not skipped) — passed.
- **AC-2/AC-3**: a from-scratch mock OIDC provider (`mock_oidc/`, RS256 + JWKS, real HTML
  login form, `/authorize` → `/login` → `/token` → `/userinfo`) standing in for Cognito's
  hosted UI; `auth/verify.py` verifies bearer tokens against the issuer's JWKS;
  `POST /api/auth/refresh` proxies to the OIDC token endpoint. Frontend: next-auth v5
  (`auth.ts`) with the built-in `Cognito` OIDC provider, `middleware.ts` route guard +
  redirect-with-`return_to`, `/auth/login` (Server Action calling `signIn`), `/dashboard`
  (protected page proving real backend-verified session via `/api/whoami`).
- **AC-4**: `ai/` — `Protocol`-based `ModelProvider` with `AnthropicProvider` (direct SDK)
  and `BedrockProvider` (`invoke_model`) implementations, routed by tier
  (`"fable"`/`"sonnet"`) through a single lookup table (`ai/config.py`) — no model ID
  appears anywhere else.
- **AC-5**: `observability/` — OTel spans on every request carrying `tenant_id`, `engine`,
  `principal_iri`; missing `tenant_id` raises in test mode. See ADR-002 for the
  non-obvious middleware/instrumentation timing this required.
- **AC-6**: `globals.css` design tokens (color/space/radius/typography/motion, dark-first
  + `prefers-color-scheme: light` override) + `Button`/`Input`/`Badge`/`Card` (cva-based,
  zero ad-hoc hex/px/duration) + Storybook (`.storybook/`, addon-a11y, addon-vitest).
  Verified for real: `npx vitest run --project=storybook` renders all 4 components in a
  real Chromium instance via the addon-vitest browser provider (10/10 passing);
  `npx storybook build` succeeds.
- **AC-7**: `make test` now runs `pytest -m "not docker and not e2e"` (previously silently
  unit-only due to default addopts) + `npm test`; `test_local_test_suite_offline.py` locks
  this in structurally and asserts no cloud-credential env var is required.
- **Law 18**: security headers (`next.config.ts`), rate limiting on both the frontend's
  `/api/auth/*` proxy (`lib/rate-limit.ts`) and the backend's `POST /api/auth/refresh`
  (`rate_limit.py`) — same sliding-window shape in both languages, zero new dependencies.
- **Law 17**: `/auth/login` and `/dashboard` are real page routes (not API-only), driven
  end-to-end by a real Playwright spec (`tests/e2e/auth.spec.ts`) against the actual
  frontend + backend + mock-oidc processes (`playwright.config.ts` `webServer` array) —
  run for real, 1/1 passing, not just authored.

## Decisions / deviations from the brief

1. **Token TTL is 300s, not the brief's stated 60s (per ADR-001, PLAT-TASK-001).** The
   mock OIDC issues 300s access tokens and the refresh threshold is `exp - now < 30s`, to
   match the real AWS Cognito floor already locked in by ADR-001. Carried forward, not a
   new decision.
2. **`/health` → `/api/health`.** The task brief's contract names `/api/health`; the
   scaffold from PLAT-TASK-001 had it at `/health`. Moved to match the contract exactly —
   **breaking change, flag for anyone else depending on the old path.**
3. **Custom FastAPI mock OIDC provider, not `oauth2-mock-server` or similar npm package.**
   AC-2 requires Playwright to drive an actual interactive login form (Law B — real
   browser automation asserting backend state, not a stub), and a properly RS256+JWKS
   signed token means swapping to real Cognito later is an env-var change, not a rewrite.
4. **Mock OIDC's `state` param is optional, not required (fix, found by running the E2E
   for real).** next-auth's default OAuth flow is PKCE-only — `state` is only added when
   `redirectProxyUrl` is configured, which we don't use. My first version of `/authorize`
   required `state` unconditionally and 400'd before Playwright ever reached the login
   form. A real Cognito endpoint tolerates missing `state` the same way; fixed the mock to
   match, not the test.
5. **Raw ASGI middleware, not `BaseHTTPMiddleware`, for tenant-context propagation (ADR-002).**
   The single most involved finding this task — `BaseHTTPMiddleware` runs the downstream
   app in a separate task with a copied context, so `ContextVar` writes never propagate
   back after `call_next()`; `FastAPIInstrumentor` also wraps its OTel middleware outside
   all user middleware and ends spans before any "after call_next" code would run; and
   Starlette caches the middleware stack on first request, so instrumenting late is a
   silent no-op unless explicitly reset. All three had to be fixed together. Full detail
   in `docs/specs/weave/engines/weave-platform/decisions/ADR-002.md`.
6. **`vitest-axe`'s `toHaveNoViolations` matcher is incompatible with vitest 4's types**
   (it augments a `Vi` global namespace vitest 4 no longer exposes). Asserted
   `axe(container).violations` length directly instead — identical check, no broken type
   augmentation. Flagged with a `ponytail:` comment; revisit if `vitest-axe` ships
   vitest-4-compatible types.
7. **Health checks are a raw TCP connect, not a real query** (`SELECT 1` / `PING` / SPARQL
   `ASK`). Proves the process is listening, not that it can actually serve a query.
   `ponytail`-flagged in `health_checks.py`; upgrade if a service can accept TCP while
   still being unhealthy in some other way.
8. **No otel-collector docker-compose service added.** No AC/test requires viewing traces
   locally — OTLP export already defaults to `localhost:4317` for real (non-test) runs.
   Skipped rather than building unrequested infra; add a real collector service when a
   dev workflow actually needs to look at traces.
9. **Backend rate limiting is hand-rolled (`rate_limit.py`), not `slowapi`.** Mirrors the
   frontend's `lib/rate-limit.ts` shape exactly, avoids a new dependency for one endpoint.
   `ponytail`-flagged: swap for `slowapi`/Redis once there's more than one backend
   instance.
10. **`declare module "next-auth/jwt"` doesn't merge — augmented `"@auth/core/jwt"`
    instead.** `next-auth/jwt` is a pure `export * from "@auth/core/jwt"` re-export;
    TypeScript's declaration merging needs the augmentation on the module where the
    interface is actually declared. `types/next-auth.d.ts` documents this with a comment
    so a future engineer doesn't hit the same silent-no-merge issue.

## Verification (all run for real, not just authored)

- Backend: `uv run pytest -m "not docker and not e2e"` → **49 passed, 4 deselected**
  (docker/e2e-marked). The docker-marked `test_dev_stack_healthy` (AC-1) was also run
  directly against a live `docker compose up` → passed. Coverage **92%** (target ≥80%).
- `uv run ruff check .` / `uv run mypy src/ tests/` → clean (47 source files).
- `uv run bandit -r src/ -ll` → 0 High, 2 Medium (both `B104` bind-all-interfaces on
  dev-only entrypoints, already `# noqa: S104`-annotated), 1 Low.
- Frontend: `npx vitest run` → **8 files / 24 tests passing**.
  `npx vitest run --project=storybook` (real Chromium via addon-vitest) → **4 files / 10
  tests passing**. `npx storybook build` → succeeds.
- `npx eslint . --max-warnings 0` / `npx tsc --noEmit` → clean.
- `npx playwright test` (real frontend + backend + mock-oidc processes via
  `playwright.config.ts`'s `webServer` array) → **1/1 passing**, driving the actual mock
  OIDC HTML login form and asserting the dashboard's `principal_iri` came from a real
  backend-verified session.

## Notes for QA

- `/health` moved to `/api/health` — check nothing outside this task still points at the
  old path.
- Rate limiters (frontend and backend) are in-memory and per-process — they reset on
  restart and don't coordinate across multiple instances. Fine for the single-dev-process
  target of this task; not production-shaped yet.
- `docker-compose.yml` was not touched this task beyond what PLAT-TASK-001 already had —
  no otel-collector service exists (see deviation #8).
- `AUTH_SECRET` for local dev must be set (`.env.example` documents this;
  `npx auth secret` generates one) — next-auth throws if it's absent outside test/E2E
  runs (Playwright's config generates one fresh per run).

## Notes for PLAT-TASK-004 (RBAC)

- `Principal` (`auth/dependencies.py`) currently carries `sub`, `tenant_id`,
  `principal_iri` — no `roles`/`permissions` field yet. RBAC will need to either extend
  this model or add a parallel lookup keyed on `principal_iri`.
- `get_current_principal` is the single FastAPI dependency every protected route already
  depends on (`/api/whoami` is the only consumer so far) — RBAC's authorization check
  almost certainly composes as a second dependency layered on top of this one, not a
  replacement for it.
- The mock OIDC's `/login` hardcodes `tenant_id="acme-corp"` for every sign-in — if RBAC
  tests need multiple tenants/roles, the mock will need a way to vary that (e.g. an email
  convention or an extra form field), not just a single fixed value.
