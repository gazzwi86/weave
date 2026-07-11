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
| AC-5 | `test_logs_filter_bar_exposes_all_seven_query_dimensions` | integration (+ hook-level dup) |
| AC-6 | `test_legacy_compliance_route_redirects_and_nav_highlights_audit` | E2E |

Plus new `BarChart` molecule unit tests (3) and a `KpiTile` variant assertion.

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
