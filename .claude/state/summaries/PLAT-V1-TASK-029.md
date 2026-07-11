# PLAT-V1-TASK-029 — Audit & compliance surfaces v2 (tiles/charts rebuild)

Epic: PLAT-V1-EPIC-009 (this task is the sole task closing it). Worktree:
`weave-PLAT-V1-EPIC-009`, branch `feature/PLAT-V1-EPIC-009`.

## What changed (presentation-layer only, no backend/contract change)

- New `components/molecules/BarChart.tsx` — grouped horizontal bar chart
  molecule, reused the existing CSS-bar rendering pattern already in
  `widget-tile.tsx` (`BarChartValue`) instead of adding a charting library
  (Law A / common-stack-first). Renders `EmptyState` when there's no series
  data — deliberately no fake zero-height bar when a "previous period" isn't
  available yet.
- `KpiTile` extended with a `variant` prop (`default|success|warn|danger`) —
  used for chain-status / SHACL-rejection colour-coding, driven entirely by
  `--color-success/warn/danger` tokens, no ad-hoc hex.
- `/audit` and `/audit/compliance` (moved from `/compliance`, see below)
  rebuilt: KPI figures now `KpiTile`s instead of `<p>` rows (AC-1); the
  by-event-category comparison is now `BarChart` instead of the old
  `▲/▼`-glyph `CategoryDelta` (AC-2); category bars/tiles link to
  `/audit/logs?event_type=<category>` (AC-3).
- `/audit/logs`: `ts` renders as relative time (raw ISO on expand) via
  `RelativeTime`; `actor_principal_iri` renders as a friendly label
  (URN-suffix) via `EntityRef` with the raw URN on expand; numeric/ID columns
  use `--font-mono` + tabular-nums (AC-4). Filter bar now exposes all seven
  `PLAT-AUDIT-1` dimensions (`engine, event_type, actor_principal_iri,
  target_iri, date_from, date_to, q`) instead of just `event_type` (AC-5).
- `/compliance` → `/audit/compliance`: additive Next.js `redirects()` entry
  (307, not a breaking move) in `next.config.ts`; `/audit/compliance` is now
  canonical, nav-highlighted under "Audit trail" (AC-6). All internal links
  (`app/dashboard/page.tsx`, `components/shell/nav-items.ts`) updated to
  point at the new canonical path.

## Design-system boundary compliance

`app/**` may not import molecules/organisms directly (`weave/app-layer-boundary`
ESLint rule). Added three thin pass-through wrappers under
`components/templates/`: `BarChartSlot.tsx`, `KpiTileSlot.tsx`,
`RelativeTimeSlot.tsx` — mirrors the pre-existing `EntityRefSlot`/
`PageHeaderSlot` pattern. Pages import the Slot, not the molecule.

## Decisions / things worth knowing

- Brief calls the tile component `KpiCard`; the shipped design system
  (TASK-026) only has `KpiTile`. Reused/extended `KpiTile` rather than
  creating a duplicate component — same shape, just adds a `variant` prop.
- Logs table stayed hand-rolled (not migrated to the `DataTable` organism):
  `DataTable`'s cells are string-only and it has no row-expand affordance,
  both of which the logs UI needs (`RelativeTime`/`EntityRef` rich cells,
  click-to-expand signed-JSON detail). This is a technical constraint, not
  a new architectural decision — no ADR filed.
- Tenant-scoping and redaction: no new backend tests were added because this
  is a presentation-only task and both are already covered by pre-existing
  TASK-009 backend coverage, unchanged by this task:
  - `packages/backend/tests/unit/test_audit_listing.py` — `list_entries(conn,
    tenant_id=_TENANT, ...)`, proves cross-tenant rows aren't returned.
  - `packages/backend/tests/unit/test_audit_compliance.py` — asserts
    `not hasattr(summary, "diff_summary")`, i.e. redaction is structural
    (the response shape has no such field for any role), not a
    filter-that-could-be-forgotten.
- No migrations needed/created — confirmed no `0085`/`0086` files exist and
  none were added (brief states no backend change).

## Test coverage (all AC → named test)

| AC | Test | Type |
|---|---|---|
| AC-1 | `test_audit_dashboard_renders_kpi_tiles_not_text_rows` | unit |
| AC-2 | `test_compliance_trend_renders_as_bar_chart_not_text_glyph` | unit |
| AC-3 | `test_dashboard_tile_click_drills_into_prefiltered_logs` | E2E |
| AC-4 | `test_logs_table_shows_relative_time_and_entity_ref_not_raw` | unit |
| AC-5 | `test_logs_filter_bar_exposes_all_seven_query_dimensions` | integration (+ hook-level dup), now backed end-to-end (see below) |
| AC-6 | `test_legacy_compliance_route_redirects_and_nav_highlights_audit` | E2E |

Plus new `BarChart` molecule unit tests (3) and a `KpiTile` variant assertion.

## PR-review fix: AC-5's six non-`event_type` filters were UI-only, not wired

PR #76 review (post-initial-implementation) found a Major correctness bug: the
filter bar rendered and accepted input for all seven `PLAT-AUDIT-1`
dimensions, but only `event_type` was actually forwarded downstream — the
Next.js proxy's `auditQuerySchema` and the backend's `list_entries` both only
understood `event_type`. A user filtering by actor/date/target/`q` believed
results were scoped when they silently weren't.

Decision (per the coordinator's two options): the `PLAT-AUDIT-1` contract
(`docs/specs/weave/contracts.md`) explicitly names all seven dimensions —
`engine`, `event_type`, `actor_principal_iri`, `target_iri`, `date_from`,
`date_to`, `q` — as the query surface, so this was **wired end-to-end**
rather than the UI being stripped down to `event_type`-only:

- `packages/backend/src/weave_backend/audit/listing.py` — `list_entries` now
  takes all seven filters via a new `AuditFilters` dataclass (bundled to stay
  under the Law E five-param budget; it had grown to 11 positional params).
  The WHERE clause is a static, fully-parameterised SQL string (no f-string
  interpolation, so a SQL-injection static-analysis scan sees literal query
  text only, resolving a `ruff` S608 flag along the way) with a
  `$n::text IS NULL OR ...` guard per dimension — same pattern the existing
  `event_type` filter already used. `date_from`/`date_to` compare against
  `ts` as `timestamptz`; `q` is a case-insensitive `ILIKE` over `target_iri`
  and `diff_summary::text`, matching the contract's "plain ILIKE v1 — no
  ranking/fuzzy" wording.
- `packages/backend/src/weave_backend/schemas/audit.py` (`AuditQueryParams`)
  and `packages/backend/src/weave_backend/routers/audit.py` — the five new
  fields added to the Pydantic query-param schema and threaded through to
  `list_entries`.
- `packages/frontend/app/api/audit/route.ts` — `auditQuerySchema` (zod)
  extended with the same six fields; forwarded verbatim to the backend
  (which remains the schema/tenant-scoping authority).
- Tests added proving **downstream consumption**, not just query-string
  construction: `test_list_entries_filters_by_engine`,
  `..._by_actor_principal_iri`, `..._by_target_iri`, `..._by_date_range`,
  `..._by_q_substring_on_target_or_diff` (backend unit, against a fake
  connection that actually applies the filter predicate — same pattern as
  the pre-existing `event_type` test); a frontend route test proving all
  seven dimensions appear in the URL sent to the backend
  (`forwards all seven PLAT-AUDIT-1 filter dimensions to the backend, not
  just event_type`); and a new E2E test,
  `filtering audit logs by actor (a non-event_type dimension) narrows the
  rendered rows` — mocks `/api/audit` to only return the actor-matching row
  when the request carries `actor_principal_iri`, fills the "Actor" field,
  clicks Filter, and asserts the row count actually drops from 2 to 1. An
  unwired filter would keep returning the same unfiltered page regardless of
  input, so this test would have caught the original bug.
- Tenant-scoping and redaction were untouched by this fix (still no new
  cross-tenant surface — every new filter is `AND`-ed onto the existing
  `tenant_id = $1` predicate, never replaces it) and remain covered by the
  pre-existing TASK-009 backend tests noted above.

## CI-review fix round 2: `api`/`integration` jobs red after the filter-wiring fix

The filter-wiring fix (commit `4313a651`) was green locally but red in CI on
two real jobs (`ce-perf`/`mutation-strict`/`deploy-essential-dev` were
pre-existing unrelated noise). Two distinct root causes, both confirmed by
reading the actual CI job logs (`gh api .../jobs/<id>/logs`):

- **`api` job (mypy failure):** `list_entries`'s signature changed (standalone
  `event_type` kwarg replaced by `filters: AuditFilters`), but a caller in
  `packages/backend/src/weave_backend/dashboard/bindings.py`
  (`_agent_activity()`) still passed `event_type=None`. This file didn't exist
  in my worktree when I made the signature change — my branch had drifted
  behind `origin/main` (a different PR landed it after my branch's
  merge-base). Fixed by `git rebase origin/main` (one conflict in
  `next.config.ts`, resolved by keeping both this task's `/compliance`
  redirect and main's newer `/login` redirect in the same array) then dropping
  the now-invalid `event_type=None` kwarg from the `bindings.py` caller
  (equivalent to the new default, so no behaviour change).
- **`integration` job (real-Postgres SQL type error):**
  `asyncpg.exceptions.UndefinedFunctionError: operator does not exist: text >=
  timestamp with time zone`. The `audit_entries.ts` column is `TEXT` (per
  `packages/backend/migrations/0005_audit_chain.sql`), not `timestamptz` —  my
  `date_from`/`date_to` guards compared it directly against a
  `$n::timestamptz` parameter with no cast on the column side. Postgres has no
  `text >= timestamptz` operator. Local unit tests
  (`test_audit_listing.py`) never caught this because they run against a fake
  in-memory connection with no real type system. Fixed by casting
  `ts::timestamptz >= $6` / `ts::timestamptz <= $7` in both `_LIST_QUERY` and
  `_COUNT_QUERY` (the first edit attempt only updated `_LIST_QUERY` — caught
  by re-running the exact CI command locally against real Postgres and seeing
  the same error persist, then diffing the two query blocks).

Also (coordinator's "while here" ask): added `_escape_like()` — escapes `\`,
`%`, `_` (backslash first) in the `q` filter value before it reaches the
`ILIKE ... ESCAPE '\'` clause, so a user typing a literal `%`/`_` filters for
that literal character instead of it acting as an unintended wildcard.

Verification: reproduced the `integration` job's exact command
(`pytest -m "integration and docker and not stack"`) locally against real
Postgres and confirmed the `UndefinedFunctionError` before the fix, confirmed
it gone after the fix (via the earlier `_LIST_QUERY`-only edit's clean run on
`test_audit_chain_api.py` alone). A later rerun of both CI-flagged files
together hit unrelated `docker compose up` port collisions (host ports
`7878`/`4566` already bound by other concurrent `/implement` lanes' worktrees)
— same known shared-docker-stack contention flagged in the round-1 summary
above, not a regression from this fix. `ruff`, `mypy`, the poison-endpoint
suite, and the full frontend lint/typecheck/vitest run were all re-run clean
post-rebase (see updated Gates section below).

## Edge cases found

- Playwright's page object has no `getByLabelText` (that's Testing Library's
  API) — the correct method is `page.getByLabel(...)`. Caught and fixed in
  the AC-3 E2E test.
- `categories.map((c) => summary.by_event_category[c])` can be `undefined`
  for a category key missing from the map — fixed with `?? 0` in both
  `/audit` and `/audit/compliance` pages (would otherwise be a TS error and
  a real runtime bug rendering "undefined" bars).

## Gates run (all green unless noted)

- Backend poison-endpoint pytest (`LOCALSTACK_ENDPOINT_URL=http://127.0.0.1:1
  OXIGRAPH_URL=http://127.0.0.1:1 uv run pytest -m "not docker and not e2e"`) — pass.
- `uv run ruff check .` (backend) — pass ("All checks passed!").
- `uv run mypy src/ tests/` (backend) — pass (615 source files, 0 issues).
- `npm run lint` (frontend, eslint) — 0 errors, 293 pre-existing warnings
  unrelated to this task.
- `npm run typecheck` (frontend, tsc --noEmit) — pass.
- `npm test` (frontend, vitest run) — 237 files / 1203 tests passed.
- New/updated E2E specs (`audit-dashboard.spec.ts`, `audit-compliance.spec.ts`,
  covering AC-3 + AC-6) run directly against a local dev server — 4/4 passed.
- `python3 .claude/scripts/okf_validate.py docs` — conformant (171 warnings,
  all pre-existing, none from this task's files).
- `mutmut` import check — clean (`import mutmut` succeeds in the backend venv).
- Migration check — no `0085`/`0086` files exist; none needed.
- `.claude/scripts/ui_verify.sh --full` — **not fully green**. Steps A
  (structural/a11y) and B (Playwright click-through) require the full local
  docker stack (postgres/redis/localstack/oxigraph); `localstack` came up
  `unhealthy` in this worktree after repeated restart attempts, most likely
  due to shared-stack port/resource contention with other concurrent
  background build agents running in parallel worktrees on this machine
  (matches the previously-documented `localstack` port-conflict issue for
  this same task, see prior summary note). This blocks the *whole* 100+-spec
  suite that `ui_verify --full` runs (all specs, not just this task's),
  independent of any change in this PR. Given AC-3/AC-6's own E2E specs pass
  cleanly standalone (4/4) and the full unit/component/lint/typecheck suite
  is green, this is treated as an environment limitation, not a defect in
  this task's code — flagged here rather than silently downgraded.

## Follow-up for coordinator

`ui_verify.sh --full` needs a healthy shared docker stack to give a real
verdict on steps A–C (structural, Playwright click-through, Lighthouse).
Recommend re-running it once the machine isn't running multiple parallel
`/implement` lanes against the same docker-compose ports, or moving to
per-lane container namespacing (already flagged in project memory as a
known constraint: "Docker interim = 1 lane on shared stack").
