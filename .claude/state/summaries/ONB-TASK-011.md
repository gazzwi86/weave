---
name: summary_ONB-TASK-011
description: Activation Detection (ONB-EPIC-005, partial) — engineer progress summary
metadata:
  type: summary
  timestamp: 2026-07-12
---

## Status: PARTIAL EPIC — not merged, no PR opened

Per explicit coordinator instruction this session, **no PR was opened** and the branch was **not
rebased** (3 behind `origin/main` — coordinator reconciles at epic close). Sibling task
**ONB-TASK-010** (self-mark activation) is **not** in this branch's commit set — it shares the
`record_milestone` entry point this task built but was not built in this session.

## What shipped (backend + scheduler + tests, this session)

- `packages/backend/src/weave_backend/onboarding/recorder.py` — `record_milestone(conn, *,
  tenant_id, user_id, milestone_id, source) -> bool`. `INSERT ... ON CONFLICT DO NOTHING RETURNING
  milestone_id` gates a same-transaction outbox enqueue (ADR-003 exactly-once).
- `packages/backend/src/weave_backend/onboarding/outbox_dispatcher.py` — `flush_pending(conn, *,
  notifier=_default_notifier) -> int`, `FOR UPDATE SKIP LOCKED` + conditional claim + per-row
  savepoint, mirrored from `operations/outbox.py`. Real bug fixed: asyncpg returns JSONB columns
  as raw strings, not dicts — `payload=json.loads(row["payload"])`, not `dict(row["payload"])`.
  Caught only by real-Postgres integration testing (the unit-test `FakeConn` had masked it by
  feeding pre-parsed dicts); the fake was corrected to store `payload` as a JSON string too, so the
  unit test now exercises the same shape as production.
- `packages/backend/src/weave_backend/onboarding/milestones.py` — `MILESTONE_ID_BY_PATH` config +
  `has_committed_entity(named_graph_iri, principal_iri)` SPARQL ASK against
  `prov:wasAssociatedWith`/`prov:generated`/`prov:Activity` in the workspace's `:prov` named graph.
- `packages/backend/src/weave_backend/onboarding/poller.py` — `select_pollable_users` (demo-active,
  unfired anti-join against `activation`), `poll_user` (locked-milestone skip, own-workspace
  resolution, cursor-advance gate, CE-outage skip, never advances cursor on skip). Reads/writes the
  cursor columns TASK-001 already reserved for this task — see Migration section below.
- **`packages/backend/src/weave_backend/onboarding/scheduler.py` (new this session)** — the real
  invocation entrypoint. `spawn_scheduler()` starts a fire-and-forget background task
  (`_run_forever`) that loops `_poll_all_tenants()` every `DEFAULT_POLL_INTERVAL_SECONDS`, using a
  module-level strong-ref `set[asyncio.Task]` + `add_done_callback` to prevent premature GC
  (mirrored from `billing/metering.py`'s `_spawn_background` pattern — not invented). Wired into
  `weave_backend/__init__.py`'s `@app.on_event("startup")` handler
  (`_start_onboarding_scheduler`), matching the existing `@app.on_event("shutdown")` pattern
  already in the codebase. Tenant listing uses `db/pool.py`'s `untenanted_connection` (a
  second legitimate caller, docstring updated to say so — the query is inherently cross-tenant,
  "list all tenants to poll").
- `packages/backend/tests/unit/test_onboarding_scheduler.py` — 5 unit tests covering
  poll-every-tenant, skip-empty-tenant, sleep-interval, cycle-survives-exception, and the
  spawn/discard task lifecycle.

## Grep-proven scheduler call site

`weave_backend/__init__.py`:

```python
@app.on_event("startup")
async def _start_onboarding_scheduler() -> None:
    # ONB-TASK-011 (AC-011-06): the activation poller's real call site --
    # without this, poller.py's functions are never invoked.
    spawn_scheduler()
```

placed after `assert_all_routes_guarded(app)`, before the existing shutdown handler. Confirmed via
`grep -n "spawn_scheduler" packages/backend/src/weave_backend/__init__.py` — one import, one call
site, both present.

## Migration: dropped, no schema change

The originally-committed `0084_onboarding_activation_cursor.sql` (adding a new
`activation_poll_cursor TEXT` column) was **deleted** (`git rm`, not renumbered) after discovering
`migrations/0082_onboarding_state.sql` (TASK-001, already merged) had already reserved
`poll_cursor_at TIMESTAMPTZ` and `poll_cursor_version_iri TEXT` explicitly for this task's use
("Activation poller bookkeeping (TASK-011 scope; this task only creates the columns)."). `poller.py`
was corrected to read/write those reserved columns instead of inventing a new one. **The branch
carries zero new migration files for ONB-TASK-011** — confirmed via `git status` and `git log
--stat` on the migrations directory for this branch's commits.

## Integration/E2E tests (brief's 4, all addressed)

`packages/backend/tests/integration/test_onboarding_activation_integration.py` — 3 real
Postgres+Oxigraph integration tests (`pytest.mark.integration, pytest.mark.docker`), run and
confirmed **green** against a worktree-local isolated docker-compose stack
(`COMPOSE_PROJECT_NAME=weaveonb011`, custom ports `WEAVE_PG_PORT=25439`
`WEAVE_REDIS_PORT=26389` `WEAVE_LOCALSTACK_PORT=24589` `WEAVE_OXIGRAPH_PORT=27899` — PLAT-017-lane
pattern, never the shared default stack):

- `test_activation_exactly_once_under_concurrent_writers` — real concurrent writers via
  `asyncio.gather`, proves the `ON CONFLICT DO NOTHING RETURNING` gate only fires once.
- `test_own_workspace_commit_fires_sandbox_commit_does_not` — real `/api/operations/apply` commits,
  `publish_version` called explicitly (draft-only commits never resolve via `version="latest"`,
  a real gap this test caught — `_resolve_own_workspace` raised `VersionNotFound` on a draft).
- `test_notify_outage_retries_then_dispatches_once_on_recovery` — proves the outbox backoff/retry
  path dispatches exactly once after a simulated notify-outage recovers.

Toast E2E (`packages/frontend/tests/e2e/onboarding-activation-toast.spec.ts`, new this session) —
**honest-skip**: grepped `app/` + `hooks/` for `activation`/`onboarding-activation`, zero hits — no
frontend toast-to-activation wiring exists yet (the design-token-compliant `Toast` component exists
from prior work, but nothing connects it to onboarding activation events). Rather than
`test.skip()` (forbidden by `sonarjs/no-skipped-tests`), the test is gated behind a
`toastWiringExists = false` constant so it's **unregistered**, not skipped — same convention as
`visual-baselines.spec.ts`'s `shouldRun` gate. A `ponytail:` comment documents the ceiling (no
frontend consumer built) and the upgrade path (build the toast consumer as a follow-on, flip the
flag). ESLint (`sonarjs`) clean.

## AC coverage

| AC | Status | Test(s) |
|---|---|---|
| AC-011-01 (poll on version advance only) | Pass | `test_onboarding_poller.py` cursor-unchanged-skip test |
| AC-011-05 (locked milestones never evaluated) | Pass | `MILESTONE_ID_BY_PATH.get` None-return unit test |
| AC-011-06 (demo-active, unfired anti-join, tunable interval, real scheduler) | Pass | `select_pollable_users` unit test + `test_onboarding_scheduler.py` (5 tests) + `spawn_scheduler()` wired at FastAPI startup |
| AC-011-07 (own workspace only, never sandbox; CE-outage/no-active-workspace/unpublished all skip without advancing cursor) | Pass | 4 unit tests + `test_own_workspace_commit_fires_sandbox_commit_does_not` integration test |
| Exactly-once recorder (ADR-003) | Pass | `test_onboarding_recorder.py` (4 unit) + `test_activation_exactly_once_under_concurrent_writers` (real-Postgres race) |
| Outbox dispatch + backoff | Pass | `test_onboarding_outbox_dispatcher.py` (5 unit) + `test_notify_outage_retries_then_dispatches_once_on_recovery` (real-Postgres) |
| Toast on activation | Honest-skip | `onboarding-activation-toast.spec.ts` — unregistered, ceiling documented, no frontend wiring built this task |

## Gates run (final pass, this worktree only)

Cross-worktree noise from concurrent lanes explicitly identified and disregarded throughout.

- Backend poison-endpoint pytest (`LOCALSTACK_ENDPOINT_URL=http://127.0.0.1:1
  OXIGRAPH_URL=http://127.0.0.1:1 uv run pytest -m "not docker and not e2e"`): **green**, 21 dot-lines
  to 100%, no `F`.
- `uv run ruff check packages/backend`: **green**, "All checks passed!" (whole-repo `ruff check .`
  surfaces 2 pre-existing unrelated errors in `.claude/scripts/modules/{lifecycle,memory}.py` —
  not touched by this task, not this task's debt).
- `uv run mypy --no-incremental src/ tests/`: **green**, "Success: no issues found in 668 source
  files".
- Frontend ESLint on the new spec file: **green**, zero problems (fixed one
  `sonarjs/no-trivial-assertions` hit by writing a real locator assertion in the gated-off test
  body instead of `expect(true).toBe(true)`).

## Docker-integration: run locally, isolated stack

Unlike the earlier session (which deferred entirely), this session **did** stand up a
worktree-local isolated stack and ran the 3 backend integration tests against it — see the
Integration/E2E section above for the project name/ports. Torn down after the run
(`docker compose -p weaveonb011 down -v`). The frontend toast E2E has no docker dependency (it's
unregistered).

## No new ADR

The in-process (non-HTTP) CE access pattern for a background poller (no request-scoped JWT to
forward) is a documented-inline decision (poller.py module docstring), following the existing
`requests/ce_read.py` precedent directly — judged not to need a fresh ADR file given the strong
existing precedent (same judgment call as ONB-TASK-006's approach; flagging for architect review if
disagreed). The scheduler's fire-and-forget task-lifetime pattern is likewise a direct mirror of
`billing/metering.py`'s existing (undocumented) precedent, not a new decision.
