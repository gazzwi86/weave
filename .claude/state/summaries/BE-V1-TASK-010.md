# Progress: BE-V1-TASK-010 — v1 Data Layer: Four PM Tables + generation_runs Columns + Repo Methods

`build-engine` EPIC-002.

## Outcome

DONE — all 6 acceptance criteria (AC-1..AC-6) implemented and tested; DoD checklist satisfied
(see below).

## Decisions Made

- **`tenant_id TEXT` / `project_iri TEXT`, not the spec's literal `tenant_id UUID` /
  `project_id UUID`** — `ADR-011`. The pinned DDL in `v1-delta.md` §4 is internally inconsistent
  (its own `cost_events` table already uses `project_iri TEXT`) and cannot be satisfied together
  with the brief's other instruction to copy `0013_gate_results.sql`'s RLS idiom verbatim
  (`current_setting(...)` returns text; a UUID column would force a different policy shape).
  Strong in-repo precedent backs TEXT: `0010_task_briefs.sql`'s header documents this exact
  convention, and `0014_fix_layout_tenant_text.sql` already fixed this same UUID mistake once
  before (on `0008`). There is also no `projects.project_id` surrogate anywhere in this schema —
  `projects`' real PK is `project_iri TEXT` (`0009_projects.sql`). Treated as Law 10 (ADR)
  territory, not a Law 11 blocking ambiguity — the evidence is one-sided.
- **`projects.description` / `projects.archived_at` ALTERs skipped** — same spec DDL block
  includes them, but they're out of scope: `description` already exists (`0009` line 17, the
  ALTER would fail without `IF NOT EXISTS`), and the brief names only "four tables + two
  `generation_runs` columns".
- **`upsert`/`put` take a grouped `New*` dataclass**, not five-plus keyword args — Law E's
  5-parameter cap (mirrors `briefs/store.py`'s `NewBrief` pattern). Caught by the pre-commit lint
  hook on first commit attempt (`PLR0913`), fixed before the `feat:` commit landed.
- **`cost_events.rollup` splits total vs by-task rows via `GROUPING(task_id)`, not
  `task_id IS NULL`** — a genuine non-task-work bucket (drafting, replans) also has `task_id IS
  NULL`, so only the `GROUPING SETS` collapse flag reliably distinguishes it from the totals row.
  One SQL aggregate (`GROUP BY GROUPING SETS ((task_id), ())`), no in-Python summing, per the
  brief's pseudocode hint.
- **`cost_estimate_usd` typed `Decimal`, not `float`** — column is `NUMERIC(12,6)`; asyncpg
  returns `Decimal`, and this is a money path.
- **AC-4/AC-5 (invalid role, duplicate binding) proven only in the docker integration lane, not
  faked as unit tests** — a fake `asyncpg.Connection` programmed to raise an exception proves
  nothing about a real DB constraint; these ACs explicitly say "reject at the DB constraint" /
  "via the unique constraint". Unit-lane ≥80% coverage is a separate, already-satisfied concern
  (100% on `pm/`, via fake-connection happy-path + rollup-split-logic tests, same pattern as
  `test_generation_store.py`).
- **No pure-Python role pre-validator added** — would only exist to manufacture a redundant unit
  test; the DB CHECK is the single source of truth for valid roles (design decision in the brief).

## Assumptions Made

- **AC-3 (generation_runs backfill) verified via `DEFAULT 'request'` on a freshly-inserted row,
  not a literal "pre-seeded row migrated forward"** — the `platform_stack` fixture runs every
  migration up front in one session boot, so there is no point in test time where a pre-0018 row
  can exist to migrate. Inserting a row that omits `trigger` and asserting it lands as `'request'`
  with `log_location_ref IS NULL` is the faithful proxy: the `DEFAULT` clause is the exact
  mechanism that would backfill a real pre-existing row. Documented here so QA doesn't read the
  brief's literal wording as a gap.
- **"Extend the M1 release-gate test's two-tenant isolation fixture"** (a Fact given at task
  start) does not correspond to any real shared fixture — every isolation test in this codebase
  (`test_gate_results_rls_tenant_isolation`, `test_brief_store_rls_tenant_isolation`, etc.)
  hand-rolls its own tenant pair per file. Followed that actual convention instead: a new
  `tests/integration/test_v1_pm_tables.py` with an inline `_V1_PM_TABLES` list, not a new shared
  fixture. Documentation-drift finding, not a Law-11 blocker (the AC itself — zero cross-tenant
  rows — was still fully specified).
- **No existing "static/grep, no raw SQL outside repo layer" test to extend** (the other Fact
  given) — none exists anywhere in the codebase yet. Wrote
  `tests/unit/test_pm_static_no_raw_sql.py` from scratch (grep the four new table names across
  `src/weave_backend`, excluding `pm/`).

## Nuances

- Pre-commit's lint hook runs the **whole-repo** `ruff check .` / `mypy src/ tests/`, not just
  staged files — a `PLR0913` (too-many-args) violation on the first commit attempt was caught
  there before the `feat:` commit, not by a targeted pre-check. Worth knowing for future tasks:
  running `uv run ruff check .` locally before committing saves a failed-commit round-trip.
  Frontend lint/typecheck also runs as part of the same pre-commit hook (unrelated pre-existing
  warnings, 0 errors, not touched by this task).
  `PROJ-013` (`asyncpg` + `pytest-cov` segfault on the docker lane) referenced in the task Facts
  was not re-triggered here since I never combined `--cov` with `-m docker`; confirming the
  documented workaround (coverage from the unit lane only) as the correct approach.

## Git Commits

- `d1a36eb` — `feat: TASK-010 v1 PM tables + generation_runs columns` (migration
  `0018_v1_pm_tables.sql`, `pm/` repo layer, all unit + integration + static tests)
- Preceding this in the working tree (same session): a `test:` RED-phase commit for the same
  test files, confirmed failing (`ModuleNotFoundError: No module named 'weave_backend.pm'`)
  before implementation existed.
- `d7ba483` — `docs: ADR-011 -- v1 PM tables use TEXT tenant_id/project_iri, not spec's literal UUID`

## Test Results

- Unit (`-m "not docker"`, `tests/unit/test_pm_*.py`): 14 passing, 0 failing.
- Integration (`-m docker`, `tests/integration/test_v1_pm_tables.py`): 6 passing, 0 failing —
  RLS enabled+forced on all four tables, two-tenant zero-rows across all four tables,
  `generation_runs` column defaults, AC-4 CHECK-constraint rejection, AC-5 UNIQUE-constraint
  rejection, rollup totals+by-task from seeded events.
- Static (`test_pm_static_no_raw_sql.py`): 1 passing — no other module names the four new tables.
- Coverage (unit lane, `weave_backend.pm`): **100%** (120/120 statements).
- `ruff check .`: clean. `mypy src/ tests/`: clean (360 files). `bandit -r src/weave_backend/pm`:
  clean (no findings).

## ADRs Created

- `ADR-011` — `tenant_id TEXT` / `project_iri TEXT` deviation from the spec's literal UUID types.

## Dependencies Unlocked

- Any future TASK reading/writing `project_contributors`, `external_bindings`, `cost_events`, or
  `project_prompts` must go through `weave_backend.pm.{contributors,bindings,cost_events,prompts}`
  — the static test in this task will fail CI if a raw query to these tables appears anywhere
  else.
- Routes for `GET/PUT/DELETE /api/projects/{id}/contributors[/{principal}]`,
  `GET/PUT /api/projects/{id}/bindings`, `POST /api/projects/{id}/prompts`, and any cost-rollup
  read endpoint are NOT part of this task (data layer only) — a future task wires these repo
  functions to HTTP routes + authz.

---
*Written by the Engineer at task completion, per Law 9.*
