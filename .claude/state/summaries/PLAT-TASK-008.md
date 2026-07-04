# Progress: PLAT-TASK-008

## Outcome

FAIL (QA-reviewed) — one Blocker-before-deploy finding in `simulate_ai_call_route` (un-gated real AI
call, caller-controlled `cost_usd`, zero test coverage of the un-mocked path). All 7 ACs otherwise
verified correct against live infra. See QA section below and
`.claude/state/qa-cross-task-findings.md` (PLAT-TASK-008 rows) for full detail.

## QA Findings (2026-07-04)

- **FAIL — Blocker-before-deploy**: `POST /api/billing/simulate-ai-call` (`routers/billing.py`) has
  no environment guard and calls the real `ai_route()` — any author-role workspace member can trigger
  real, billed AI provider calls while self-reporting an arbitrary low `cost_usd`. Every test in the
  repo patches `ai_route`, so this path has never run un-mocked. Ledger row added, `affects:
  [PLAT-TASK-009, first-deploy checklist]`. Must be fixed (env-gated or 404'd in prod) before any
  real-environment deploy of this router.
- **Warn**: `GET /api/billing/usage` (no `workspace_id`) inherits the pre-existing `is_tenant_admin`
  semantic (any-one-workspace-admin sees tenant-wide totals) — technically AC-5-compliant, elevated
  concern given financial data sensitivity. Ledger row added.
- **Warn (Law B / Category 10 gap)**: `billing.spec.ts` / billing case in `accessibility.spec.ts`
  fully mock the network layer via `page.route()` — no Playwright spec proves a real backend
  side-effect for this feature (the Python docker-integration suite does, just not via a browser).
  Ledger row added.
- **AC-6 re-fire-on-every-call-at-threshold** (engineer's own flagged known limitation): confirmed
  as-described, not re-flagged as a new finding — already tracked for PLAT-TASK-009.
- **Verified independently (RAN, not trusted)**: AC-1 cascade + `422 cap_exceeds_parent` (incl. new
  QA boundary test for exact-equal-to-parent, which correctly passes); AC-2 reject-at-exactly-100%
  and 429 body shape (`effective_cap_usd`/`consumed_usd`/`retry_after`, verbatim field names) + new
  QA test proving `>=` still rejects on Redis-drifted values past 100%; AC-2 zero-active-admins edge
  case (new QA test — fan-out over zero rows must not swallow the raise); AC-3 async metering
  <100ms (HTTP-response→row-found timing, live docker stack); AC-4 flat 1-unit run cost; AC-5 tenant
  scoping; AC-6 80%/100% notification dispatch; AC-7 workspace-admin scoping. Migration 0004 RLS
  parity with 0001-0003 confirmed (FORCE ROW LEVEL SECURITY, `tenant_isolation` policy, `weave_app`
  grants, non-empty `tenant_id` CHECK). Redis key format `billing:{tid}:{wid}:{period}:consumed_usd`
  confirmed exact. Lighthouse on `/billing` (desktop preset, production build, full stack up,
  authenticated): 100/100/100/100 — an earlier 96 best-practices reading was a seeding artifact
  (fresh DB, no workspace yet for the mock-oidc identity → 403 console error), not a code defect,
  matching PLAT-TASK-007 precedent.
- **New unit tests added** (commit `fe7fba5`, `test(qa): edge cases for PLAT-TASK-008`):
  `test_enforce_budget_rejects_when_consumed_has_drifted_past_cap`,
  `test_enforce_budget_reached_with_zero_admins_still_rejects`,
  `test_set_cap_allowed_when_exactly_equal_to_parent`, plus a new file `test_billing_period.py`
  (December→January rollover + same-year + zero-pad month, the only consumer being `retry_after`,
  previously untested in December).
- **Coverage/lint/type/security re-verified**: `ruff check` clean, `mypy src/ tests/` clean (124
  files, +1 for the new QA test file), unit lane 15→21 backend tests passing at 97% coverage on the
  billing module, docker-integration lane 8/8 passing, frontend vitest 3/3 passing, E2E 1/1 +
  accessibility 3/3 passing (real-browser axe, zero violations), bandit clean.
- **Law E note**: `simulate_ai_call_route` runs ~58 lines (over the 50-line function budget) with no
  logged waiver in `.claude/state/complexity-waivers.md` — folded into the same fix as the Blocker
  above rather than a separate line item, since the fix will restructure this function anyway.

## Decisions Made

- **AC-5's own EARS field names treated as authoritative over the brief's illustrative JSON
  example**, where the two conflicted (`total_cost_usd`/`total_tokens`/`total_runs`/`by_workspace`
  vs. the example's `cost_usd`/`tokens`/`runs`/`display_name`). The EARS text is the acceptance
  criterion; the JSON block is a worked illustration. Same call for `PUT /caps`: no `key` field,
  since M1 ships exactly one budget-cap key type.
- **AC-2's 429 body field names (`effective_cap_usd`, `consumed_usd`) are quoted verbatim in the
  brief's own AC-2 text** — carried through the exception class, router, and unit test exactly as
  written, not shortened to `cap_usd`.
- **Company/domain-scope cap writes require tenant-admin, workspace-scope caps require
  workspace-admin** — a deliberate departure from `settings.py`'s tenant-match-only precedent,
  because budget caps are a financial control, not a preference. Documented inline in
  `routers/billing.py`.
- **Metering is fire-and-forget**: `record_token_usage`/`record_run_usage` await only the Redis
  `INCRBYFLOAT` (used by the synchronous pre-call gate), then hand the durable Postgres write to an
  un-awaited `asyncio.Task`. This satisfies AC-3's "within 100ms" as a latency budget, not a
  "before the HTTP response" requirement — callers may ignore the task in production.
- **No configured cap => unmetered/fail-open** — recorded as ADR-009
  (`docs/specs/weave/engines/weave-platform/decisions/ADR-009.md`).
- **Frontend billing page is a client component**, unlike `dashboard/page.tsx` (server component) —
  required so Playwright's `page.route()` can intercept the browser-side fetches to the Next.js API
  proxies; server-side fetches aren't interceptable that way.
- **`CardTitle` (hardcoded `<h3>`) avoided on the billing page** — using it directly under the
  page's own `<h1>` skips `<h2>`, an axe `heading-order` violation. `dashboard/page.tsx` already
  carries a comment documenting this same trap; billing page follows the same precedent (plain
  styled `<p>` instead of `CardTitle`) rather than changing the shared `Card` component for one
  caller.

## Assumptions Made

- "Minimal usage dashboard" (brief wording) scoped to tenant-wide usage only, no per-workspace
  drill-down UI and no cap-editing UI — `PUT /caps` is exercised only via the harness
  `simulate-ai-call`/`simulate-run` routes and backend tests, not a frontend form.
- DoD's literal commit message string (`feat: add billing metering and pre-call budget
  enforcement`) was not reproduced verbatim; my commits use more specific conventional-commit
  messages describing what actually shipped in each (`feat: add billing period, caps, gate,
  metering, and usage modules (PLAT-BILLING-1)`, etc.). Same intent and format, different wording —
  flagging as a literal (not substantive) deviation rather than rewriting already-hooked commit
  history.

## Nuances

- **AC-3 fire-and-forget race in the integration test**: the first version of
  `test_simulate_ai_call_under_cap_calls_ai_client_and_records_usage` asserted the metering row
  existed immediately after the HTTP response returned, which is racy by design (the write is a
  background task the route does not await). Fixed by polling in the test
  (`_wait_for_row`), not by changing production code — the fire-and-forget design is correct.
- **The polling helper originally only proved eventual arrival (up to 1s), not the DoD's actual
  100ms budget.** Caught on DoD walk-through and tightened: `_wait_for_row` now times from HTTP
  response to row-found and the test asserts `elapsed_ms < 100` directly, with a 500ms hard stop so
  a real regression fails loudly instead of the test just being slow.
- **`--cov` + docker-lane segfault** (pre-existing, not introduced this task): combining
  `pytest --cov` with the `integration and docker` marker segfaults in asyncpg's SSL/C-extension
  path. I violated this once by mistake mid-session, immediately stopped (did not retry), ran
  `docker compose down -v` to clean up, and re-ran the plain (no `--cov`) docker suite to confirm
  it still passed. Coverage is measured on the unit lane only, scoped to the billing module.
- **Real-browser E2E caught two bugs static checks couldn't**: `getByRole("alert")` is ambiguous in
  a real browser because Next.js always renders a hidden route-announcer with `role="alert"` —
  fixed by scoping the locator with `.filter({ hasText: "Budget cap reached" })`, no production
  change needed. And the `CardTitle` heading-order issue above was only caught by axe running in
  a real browser (jsdom-based vitest-axe can't see it), not by ESLint/tsc.
- **New Law E complexity refactors**: `useBillingUsage` split into `useUsageFetch` +
  `useBillingUsage` (61-line function over budget); `BillingPage` split to extract
  `CapUtilisationBadge` and `UsageCard` (62-line function, plus a `sonarjs/no-nested-conditional`
  from a ternary picking the badge variant).
- **Known limitation, not fixed**: AC-6 notification dispatch re-fires `billing.cap.warning`/
  `billing.cap.reached` on every call once a threshold is crossed, not just on first crossing —
  matches the brief's AC-6 text literally ("at 80%... dispatch") but will spam admins under
  sustained usage at/above a threshold. Flagging for PLAT-TASK-009 (audit/notification consumer) as
  a possible dedup point, not fixing here since the brief doesn't ask for de-duplication.
- Two bugs found and fixed in integration testing before this session's continuation (carried over
  from the prior session, included here for completeness since they're part of this task's history):
  a pydantic dataclass-conversion bug in the cap-resolution path, and a transaction-rollback-
  swallows-notification bug where `HTTPException` raised inside `tenant_connection`'s `async with`
  block triggered a ROLLBACK before the notification dispatched inside the same block could commit
  — fixed by deferring the `raise` until after the block exits.

## Git Commits

- `88de629` -- test: add unit tests for billing caps, gate, metering, usage (TASK-008)
- `1619085` -- test: add docker-marked integration tests for billing enforcement (TASK-008)
- `1cdcc8a` -- feat: add billing period, caps, gate, metering, and usage modules (PLAT-BILLING-1)
- `a3e1207` -- feat: add billing API routes for caps, usage, and harness AI/run simulation
- `7cf850d` -- docs: add ADR-009 for fail-open budget cap when unconfigured (TASK-008)
- `2381996` -- fix: match AC-2's 429 body field names exactly (effective_cap_usd, consumed_usd)
- `20174f5` -- test: add vitest and Playwright coverage for billing usage dashboard (TASK-008)
- `30cb8e0` -- feat: add minimal billing usage dashboard and API proxies (TASK-008)
- `becd9a4` -- test: assert the 100ms metering latency budget, not just eventual arrival (TASK-008)

## Test Results

- Unit (backend, `tests/unit/test_billing_*.py`): 15 passing, 0 failing
- Integration (docker lane, `integration and docker`): 8 passing, 0 failing
- Frontend vitest (`app/billing`): 3 passing, 0 failing (6/6 including the 3 pre-existing
  `app/dashboard` tests, confirming the dashboard link didn't break anything)
- E2E (Playwright, live webServer stack): `billing.spec.ts` 1 passing (the required
  `test_budget_cap_exceeded_shows_error` scenario), `accessibility.spec.ts` 3 passing (2
  pre-existing dashboard a11y + 1 new billing a11y pass, zero axe violations)
- Coverage: backend billing module 97% (154 stmts, 4 missed in `metering.py`'s SQS-path branch,
  not exercised since dev uses direct Aurora write per Law F); frontend `app/billing` 86% lines
- Lint/type/security: ruff clean, mypy clean (`src/ tests/`, 123 files), bandit clean (0 findings on
  the billing module + router), eslint clean on all touched frontend files, tsc clean

## ADRs Created

- `docs/specs/weave/engines/weave-platform/decisions/ADR-009.md` -- no configured budget cap means
  unmetered/fail-open (carried over from before this session's continuation, verified still correct
  and complete this session)

## Dependencies Unlocked

- PLAT-TASK-009 (audit) -- billing emits `billing.cap.changed`/`billing.cap.warning`/
  `billing.cap.reached` via `dispatch_notification` (same PLAT-NOTIFY-1 pattern PLAT-TASK-007
  established); the AC-6 re-fire-on-every-call-at-threshold nuance above is worth a look for the
  audit consumer, since it means an audit trail could show many `billing.cap.reached` events per
  period rather than one per crossing.

---

*Generated by Engineer. Read by Engineers starting dependent tasks and by QA.*
