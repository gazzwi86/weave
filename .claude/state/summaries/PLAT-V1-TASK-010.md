# Progress: PLAT-V1-TASK-010 — Widget-state foundation + fixed CE-sourced default dashboard (EPIC-001, first task)

`weave-platform` EPIC-001. **PARALLEL LANE** worktree `../weave-PLAT-V1-EPIC-001`, branch
`feature/PLAT-V1-EPIC-001` (off origin/main). Full-stack task (I mis-scoped it frontend-only at spawn;
engineer flagged, corrected to full-stack). Coordinator-authored from the engineer's receipt, pre-QA.

## Outcome

Engineer reports DONE — all 9 ACs, backend + frontend, TDD, all green. QA pending: must independently
re-verify (esp. the docker-integration set + the two flagged decisions below).

## What shipped (7 commits, feature/PLAT-V1-EPIC-001)

- `2562fae` test: failing unit tests (widget-state status/default-tiles)
- `40ffbbf` feat: backend GREEN — migrations, RLS, dashboard module, routes
- `28ba601` fix: inject CE-METRICS-1 client via FastAPI `Depends()` (was manual `async for` loop —
  would've blocked test-time `app.dependency_overrides`). Self-caught DI bug.
- `56d057d` test: integration tests widget-state API (AC-1,2,4,6,7,8,9)
- `8860843` test: failing WidgetTile/WidgetGrid render tests (AC-3,4,5,7)
- `b8c3009` feat: frontend GREEN — fixed CE-sourced default dashboard (AC-3)
- `af388d8` test(e2e): fixed default dashboard renders CE-sourced tiles (AC-2,3,5)

## Migrations / RLS

- `0045_widget_state.sql` + `0046_widget_state_backfill.sql` (from pre-assigned 0045-0049 block; 47-49
  unused, not padded). Tables `widget_instances`, `widget_library_items`, `widget_refinements` — all
  `FORCE ROW LEVEL SECURITY` + `tenant_id = current_setting('app.tenant_id', true)`, proven by DB-level
  no-WHERE backstop tests (zero cross-tenant rows) + full-HTTP cross-tenant test.

## Per-AC

AC-1 RLS ✓ · AC-2 seed 6-tile default on tenant-create + idempotent backfill ✓ · AC-3 tiles+render
(kpi_card/bar_chart, 12-col bento, tokens-only) ✓ · AC-4 CE-fetch-fail→unavailable no-500 ✓ ·
AC-5 pending-subfield never renders 0 (explicit assertion both layers) ✓ · AC-6 pure SWR read ✓ ·
AC-7 stale retains prior payload, 2× refresh-interval bound ✓ · AC-8 role-starters+clearable+owner-only
delete incl IDOR — see flag · AC-9 cross-tenant isolation ✓.

## Tests / gates (engineer-reported — QA to re-verify)

Backend unit 8/8 (100% cov status.py+default_tiles.py); integration 9/9 docker
(`integration and docker and not stack`); frontend dashboard 12/12, full 577/577; ruff clean; mypy clean
(435 files); ESLint 0 errors (142 pre-existing warnings unrelated). Files 23-194 lines. Two dataclass
bundles (`WidgetFetchState`, `RefreshOutcome`) to stay under 5-param cap — no waivers.

## FLAGS FOR QA (scrutinize)

1. **AC-8 role-appropriateness proven at STORE level, not real-bearer HTTP.** `mock_oidc/tokens.py::
   issue_token_pair` has no `roles`-claim param → HTTP tests always get `principal.roles == []`. Engineer
   covered role-ranking via unit tests + `store.ensure_user_starters` called with explicit role, deemed
   extending the shared fixture out-of-scope. The delete/IDOR half IS proven over real HTTP. **Coordinator
   accepts for this task; the mock-OIDC-roles-claim fixture gap is logged as a recurring follow-up** (every
   role-gated feature hits it — TASK-027/030 etc.). QA: confirm store-level + IDOR coverage is genuinely solid.
2. **Self-caught IDOR (real security fix):** delete route originally checked only `scope != "user"`, not
   ownership → any tenant member could delete another user's private widget by id-guess. Fixed to also check
   `owner_principal_iri`; covered by `test_delete_other_users_starter_is_not_found`. QA: verify the fix + test.

## Risky-tier → PR HELD

Migrations + RLS = risky tier. PR held for human morning review, not opened. EPIC-001 has more tasks
(011-017) before it closes.

## Dependencies unlocked (within EPIC-001)

TASK-011 (next, blocked_by 010), TASK-014 (blocked_by 010,011), TASK-016 (blocked_by 010,012).

## QA pass (2026-07-11): FAIL — 2 defects found, sent back to Engineer

Re-verified engineer's claims (9/9 docker integration + 8/8 unit + lint/mypy/eslint) — all hold.
Flag #1 (AC-8 role-appropriateness) accepted as-is: store-level coverage genuinely hits all 3 roles
+ fallback. Flag #2 (delete-route IDOR fix) confirmed correct — then found an unguarded sibling.

**New defects (both proven with committed red tests, no implementation touched — QA does not fix
implementation code):**

1. **IDOR sibling on refresh route.** `refresh_widget_route` checks `scope` but not
   `owner_principal_iri`, unlike the already-fixed `delete_widget_route`. Any tenant member can
   refresh — and thereby mutate/observe `status`/`fetched_at` for — another user's private starter
   widget by id-guessing. Proof: `test_refresh_other_users_starter_is_not_found` (asserts 404, got
   200). Fix: mirror the delete-route owner guard.
2. **AC-7 clause 2 not honoured on the GET read path.** "Stale even without a failed refresh" is
   only implemented inside the refresh flow (`derive_status()`); `list_widgets_route` returns the
   stored `status` column verbatim, so a widget that's never refreshed again stays `fresh` forever
   regardless of `fetched_at` age. Frontend `widget-tile.tsx` also trusts `widget.status` directly.
   Proof: `test_stale_bound_renders_on_read_without_failed_refresh` (asserts stale, got fresh). Fix:
   wire `derive_status` into `list_widgets_route` (and the frontend render path).

**Also delivered:** extended the RLS backstop test from `widget_instances` only to all 3 new
tables (`widget_library_items`, `widget_refinements` were unproven) — green, same migration, same
tenant-sensitivity.

**Non-blocking:** `max-w-[1440px]` wrapper on the dashboard page — `layout-grid.md` genuinely
ambiguous between "Full-bleed | bento dashboard grid" and "Wide ~1440px | multi-column dashboards"
for this mixed-content page; flagged for design confirmation, not an engineer error. AC-6 perf
target (p95 ≤200ms) has no k6/latency assertion yet — flagged as an honest gap, not silently
passed. Lighthouse/axe/mutation deferred to re-QA (this FAIL is backend-only, UI unchanged).

**Commit:** `631d9ed` on `feature/PLAT-V1-EPIC-001` — 3 tests added (1 green RLS-extend, 2 red
proofs). **Cross-task finding logged:** `XT-PLAT010-1` in `.claude/state/qa-cross-task-findings.md`
— affects TASK-011/014/016 (blocked_by 010), which should confirm the refresh-route fix landed
before building on top of it.

**Status: task remains open, back with Engineer for the two fixes above, then re-QA.**
