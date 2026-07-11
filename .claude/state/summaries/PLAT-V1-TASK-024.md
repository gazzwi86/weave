# PLAT-V1-TASK-024 — Recent-edits collaboration widget (E2-S9, M2 portion)

Status: **PARTIAL / feature-complete, not yet PR'd**. Backend registry + proxy +
refresh-dispatch wiring, frontend renderer, integration tests, and E2E spec are all built.
Docker-integration execution is deferred to CI (isolation not safely achievable in this
worktree this session — see below). This is a partial-epic delivery — EPIC-002 siblings
TASK-016 (merged, on main) and TASK-023 are separate PRs, not part of this branch's diff.

Worktree: `/Users/gareth/Sites/weave-PLAT-002b`, branch `feature/PLAT-V1-EPIC-002`
(off `origin/main`). HEAD after this session: `39f3f5c8b4a79c6886910a1b15623736858ae2e5`
(pushed to `origin/feature/PLAT-V1-EPIC-002`, no PR opened — coordinator handles
reconcile+PR+QA+merge). Commits this session, in order:

- `7d353f91` — backend registry/proxy/refresh-dispatch (prior session)
- `5e6c43e6` — `feat(dashboard): render activity_feed widgets`
- `31a9e2cf` — `test: add collaboration-activity integration tests (docker-marked)`
- `39f3f5c8` — `test(e2e): add recent-edits widget Playwright spec`

## What shipped this session

- **`dashboard/bindings.py`**: 11th `CATEGORIES` entry, `"collaboration-activity"`
  (`contracts=["CE-EVENT-1", "CE-READ-1"]`, `shapes=["events"]`, `fetch=_collaboration_activity`).
  `BindingContext` gained one additive `prior_result: Any = None` field — only this binding
  reads it (the widget's own prior `last_result`/cursor); every other binding's `FetchFn`
  signature is unaffected.
  - AC-1 (poll from cursor): `_collaboration_activity` reads `prior["last_seq"]`; on first
    render (`cursor is None`) takes a `limit=1` baseline call then a bounded tail
    (`latest_seq - tail`), never a full 30-day page-from-0.
  - AC-2 (render shape): each row gets an `href = /resource/{entity_iri}` deep-link (same
    convention as `coverage_gap.contraventions`); draft/published + top-contributors logic
    lives in the new pure `activity_feed.py` module.
  - AC-3 (410 re-baseline): on `page.gone`, re-seeds via
    `coverage_gap.recently_updated_entities` (new function, real `POST /api/sparql` surface)
    and returns the "history truncated — showing activity from now" notice in `meta`. **ADR-021**
    documents that this re-seed is label-ordered, not true-recency-ordered — the graph has no
    per-entity modified-timestamp predicate today; this is a scoped, honestly-labelled decision,
    not a silent gap.
  - AC-4 (degrade, never blank): `httpx.HTTPError` around the CE-READ-1 re-seed call returns
    `status="stale"` with the prior rows/meta untouched — never fabricated or blanked.
  - AC-7 (server-side, no literals): retain cap (`dashboard.collaboration.retain_rows`, default
    50) and baseline tail (`dashboard.collaboration.tail`, default 20) both resolve via
    `thresholds.threshold()` / `thresholds.DEFAULTS` — grep-verified, no literal in
    `bindings.py`/`activity_feed.py`.
  - `latest_seq` from the response is always what's persisted — never `max(rows)` (brief's
    explicit anti-pattern warning).

- **`dashboard/events_proxy.py`** (new): `proxy_events(conn, tenant_id, since_seq, limit)`.
  **Key architectural finding**: CE and the platform are *one* `weave_backend` FastAPI process
  sharing one Postgres — `routers/events.py`'s `GET /api/events` already does exactly the
  tenant-RLS'd read this task's brief calls "the proxy". So `events_proxy.py` calls
  `operations.events.read_events` **in-process** (no second HTTP hop, no `CE_API_BASE_URL`
  client) — both the new `GET /api/proxy/events` route (AC-6) and the binding's fetch path call
  this one function, so tenant scoping can't drift between the two call sites. Escalated this
  finding to the advisor before building; confirmed as the correct minimal path.

- **`routers/events_proxy.py`** (new) + registered in `weave_backend/__init__.py`: `GET
  /api/proxy/events`, `get_current_principal` (401 on no/bad JWT), tenant from `principal.tenant_id`
  only (never a query param — AC-6), `410` passed through unchanged on aged-out cursor.

- **`routers/dashboard.py`**: `refresh_widget_route` now branches on
  `row.spec.bindings.get("category")` — category widgets go through the new
  `_refresh_category_widget` helper (`bindings.resolve_category` + the *same*
  `store.apply_refresh_result` SWR write path as the CE-METRICS-1 path, ADR-013/014), so cursor
  + retained rows persist server-side, cross-device, RLS-scoped — never localStorage (AC-7).
  **This is front-running TASK-012/017's generic resolver wiring**, which doesn't exist on
  `main` yet — noted inline as a comment, not hidden. `_CATEGORY_STATUS_MAP` maps the registry's
  `bindings.NOT_YET_AVAILABLE` sentinel onto `WidgetStatus`'s `"source_not_ga"` literal (AC-5's
  gating rides the *existing* TASK-016 availability-registry mechanism unchanged — no new code
  needed for AC-5 itself, since `resolve_category` already gates any non-GA-sourced binding;
  confirmed with the advisor before skipping a dedicated AC-5 implementation path).

- **`dashboard/coverage_gap.py`**: added `recently_updated_entities()` (CE-READ-1 SPARQL
  re-seed for AC-3) and an `href` field on `contraventions()`'s sibling pattern — reused, not
  duplicated.

- **`dashboard/activity_feed.py`** (new, pure/no I/O): `is_draft`, `top_contributors`,
  `merge_newest_first` — kept out of `bindings.py` specifically so AC-2's shaping logic is
  unit-testable without a DB/CE stack.

- **`docs/specs/weave/engines/weave-platform/decisions/ADR-021.md`** (new): the label-ordered
  vs true-recency re-seed decision above, `type: Decision` with full `description` frontmatter
  (OKF-conformant, verified against the pre-push gate).

## Gates run this session (all from `packages/backend` unless noted)

- Poisoned-endpoint pytest (`LOCALSTACK_ENDPOINT_URL=http://127.0.0.1:1
  OXIGRAPH_URL=http://127.0.0.1:1 uv run pytest -m "not docker and not e2e" -p no:warnings -q`):
  **green** (exit 0), all non-docker/non-e2e tests pass including the new
  `test_dashboard_activity_feed.py` unit suite.
  - `test_dashboard_bindings.py::test_ten_categories_present` updated 10→11 (real, expected
    break from adding the 11th binding — not a weakened gate).
  - Added `test_binding_cites_ce_event_and_ce_read` (contracts/shape assertion).
- `uv run ruff check .` (whole `packages/backend`): clean (`All checks passed!`).
- `uv run mypy src/ tests/`: clean, 663 source files (up from 662 — the new integration test
  file).
- Frontend: `npx vitest run components/dashboard/__tests__/widget-tile.test.tsx` — 10/10 pass
  (6 pre-existing + 4 new `activity_feed` cases). `npx tsc --noEmit` and `npx eslint` on the
  touched files: clean.
- `git commit`/`git push` pre-commit + pre-push hooks (lint, typecheck, semgrep, OKF-validate):
  all passed for real on every commit this session.
- **Playwright E2E** (`tests/e2e/recent-edits-widget.spec.ts`): written and lint/typecheck-clean,
  following `dashboard-widgets.spec.ts`'s fully route-mocked precedent (no live backend needed
  at the E2E tier). **Not executed against a running dev server this session** — same
  execution model as the existing suite (CI/`ui_verify` runs it), consistent with how
  `dashboard-widgets.spec.ts` itself is exercised.

## Not done — explicit deferral, not silent

- **Docker-integration test execution**: the 7 integration tests are written
  (`tests/integration/test_dashboard_collaboration_activity.py`, docker-marked, following
  `test_dashboard_bindings_api.py`/`test_events_change_feed.py` precedent) but **not run against
  a live stack this session**. Isolation was evaluated and explicitly not attempted: this
  worktree has no `.env` file, `docker-compose.yml`'s default host ports (6379 Redis, 7878
  Oxigraph, plus Postgres/LocalStack) are fixed unless overridden, and `docker compose ls`
  showed 8 other worktree stacks already running concurrently (`weave-CE-V1-EPIC-003/004/005/
  009/010`, `weave-PLAT-V1-EPIC-001/009`, `slm-testbed`) — constructing a safe unique-port
  `.env` here without a reliable way to verify no collision against those live sessions was
  judged unsafe under this session's budget. Deferred to CI, which runs each worktree/branch in
  its own container network. This is the same fixture (`platform_stack`) exercised by every
  sibling `pytest.mark.docker` file in this suite, so CI coverage is not a novel gap.
- No new DB migration — confirmed unnecessary: cursor/rows persist inside the existing
  `widget_instances.last_result` JSONB column (ADR-013 SWR row), same mechanism every other
  category binding already uses. Not a gap, a verified non-requirement.

## Next-step for whoever resumes

1. Run `tests/integration/test_dashboard_collaboration_activity.py` and
   `tests/e2e/recent-edits-widget.spec.ts` against a real/CI stack; fix any real failures (they
   are new, unexecuted code paths — treat first failures as signal, not flakiness).
2. Run `ui_verify` (axe/Lighthouse) once the E2E spec has executed at least once, per DoD.
3. Reconcile + open the PR (base `main`, title `feat: PLAT-V1-EPIC-002 (partial) — Recent-edits
   collaboration (TASK-024)`), noting EPIC-002 siblings TASK-016 (merged) and TASK-023
   (deferred) are out of scope for this PR.
