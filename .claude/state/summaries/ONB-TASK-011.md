---
name: summary_ONB-TASK-011
description: Activation Detection (ONB-EPIC-005, partial) — engineer progress summary
metadata:
  type: summary
  timestamp: 2026-07-12
---

## Status: PARTIAL EPIC — not merged, no PR opened

Per explicit coordinator instruction this session, **no PR was opened**. HEAD of
`feature/ONB-EPIC-005` is `c088fb89`, pushed to `origin/feature/ONB-EPIC-005`. Sibling task
**ONB-TASK-010** (self-mark activation) is **not** in this branch's commit set — it shares the
`record_milestone` entry point this task built but was not built in this session.

## What shipped (4 commits, this session)

- `58714dd8` test: failing tests for exactly-once milestone recorder
- `7c76c6a1` feat: `packages/backend/src/weave_backend/onboarding/recorder.py` —
  `record_milestone(conn, *, tenant_id, user_id, milestone_id, source) -> bool`. `INSERT ...
  ON CONFLICT DO NOTHING RETURNING milestone_id` gates a same-transaction outbox enqueue (ADR-003
  exactly-once).
- `d0950750` test: failing tests for outbox dispatcher backoff
- `2cf42730` feat: `packages/backend/src/weave_backend/onboarding/outbox_dispatcher.py` —
  `flush_pending(conn, *, notifier=_default_notifier) -> int`, `FOR UPDATE SKIP LOCKED` +
  conditional claim + per-row savepoint, mirrored from `operations/outbox.py`.
- `c088fb89` feat: poller + milestone config (committed this session, previously staged):
  - `packages/backend/src/weave_backend/onboarding/milestones.py` — `MILESTONE_ID_BY_PATH` config
    + `has_committed_entity(named_graph_iri, principal_iri)` SPARQL ASK against
    `prov:wasAssociatedWith`/`prov:generated`/`prov:Activity` in the workspace's `:prov` named graph.
  - `packages/backend/src/weave_backend/onboarding/poller.py` — `select_pollable_users` (demo-active,
    unfired anti-join against `activation`), `poll_user` (locked-milestone skip, own-workspace
    resolution, cursor-advance gate, CE-outage skip, never advances cursor on skip).
  - `packages/backend/migrations/0084_onboarding_activation_cursor.sql` — adds
    `onboarding_state.activation_poll_cursor TEXT` (per-user poll cursor, ADR-004).
  - `packages/backend/tests/unit/test_onboarding_poller.py` — 8 unit tests.

## Migration numbering

Final number: **0084** (not 0083). `0083` collided with an uncommitted migration
(`0083_audit_outbox_clock_timestamp.sql`) in sibling worktree `weave-hotfix-int`
(branch `hotfix/integration-suite`) — checked via a loop over all local `weave-*` worktrees plus
`git branch -r` / remote `git ls-tree`, per explicit coordinator instruction to check higher than
the last-known BE-024 (`0068`). Renumbered via `git mv`, clean rename, no other collision found in
the 0083-0099 range across any worktree or remote branch.

## Mount/wiring (grep-proven)

- `poller.py` imports and calls `record_milestone` from `recorder.py` directly (`poll_user`,
  line 137) — not a stub.
- `poller.py` imports `has_committed_entity`/`MILESTONE_ID_BY_PATH` from `milestones.py` — used,
  not orphaned.
- `outbox_dispatcher.py` reads the same `outbox` table `recorder.py` enqueues to (both against
  `packages/backend/migrations/0082_onboarding_state.sql`'s `outbox` table) — same schema, verified
  by column names matching in both files' SQL.
- **Gap, not yet built**: no scheduler/cron entrypoint calls `select_pollable_users` +
  `poll_user` on an interval yet — `poller.py` exposes the functions but nothing invokes them in
  a running process. Flagging honestly rather than silently deferring; needs either a follow-up
  task or explicit scope note from the architect for the M1 activation loop to actually run.

## AC coverage

| AC | Status | Test(s) |
|---|---|---|
| AC-011-01 (poll on version advance only) | Pass | `test_onboarding_poller.py` cursor-unchanged-skip test |
| AC-011-05 (locked milestones never evaluated) | Pass | `MILESTONE_ID_BY_PATH.get` None-return unit test |
| AC-011-06 (demo-active, unfired anti-join, tunable interval) | Pass | `select_pollable_users` SQL-shape unit test (`DEFAULT_POLL_INTERVAL_SECONDS` constant, not wired to a scheduler — see gap above) |
| AC-011-07 (own workspace only, never sandbox; CE-outage/no-active-workspace/unpublished all skip without advancing cursor) | Pass | 4 unit tests in `_resolve_own_workspace` covering each skip path |
| Exactly-once recorder (ADR-003) | Pass | `test_onboarding_recorder.py`, 4 unit tests |
| Outbox dispatch + backoff | Pass | `test_onboarding_outbox_dispatcher.py`, 5 unit tests |

**Not yet written** (from the brief's Test Requirements table): the release-gate integration test
`test_activation_exactly_once` (concurrent-insert race), the seeded own-workspace-fires/
sandbox-does-not integration test, the notify-stub-outage retry integration test, and the E2E toast
test. No frontend toast wiring built this session either (design-token-compliant `Toast` component
already exists from prior work; no hook connects it to activation events yet).

## Gates run (this worktree only, weave-ONB-005 — cross-worktree noise from concurrent lanes
(weave-hotfix-int, weave-PLAT-001b, weave-PLAT-010) explicitly identified and disregarded)

- Backend poison-endpoint pytest (`LOCALSTACK_ENDPOINT_URL=http://127.0.0.1:1
  OXIGRAPH_URL=http://127.0.0.1:1 uv run pytest -m "not docker and not e2e"`): **green**, confirmed
  via direct file read of a uniquely-named log file (21 chunks, all dots, 100%, no `F`).
- `uv run ruff check .` (whole backend repo): **green**, "All checks passed!".
- `uv run mypy --no-incremental src/ tests/` (whole backend repo, cache cleared to rule out a stale
  incremental-cache false pass): **green**, "Success: no issues found in 665 source files".
- Pre-commit hook (`make lint` = backend ruff+mypy, frontend eslint+tsc) ran on the actual commit:
  **green**. One real mypy break was caught and fixed inline (`str | None` narrowing in
  `test_onboarding_poller.py`'s query-shape assertions — added an `assert query is not None` before
  the `in` checks).
- Pre-push hook (OKF conformance, semgrep on the 4 changed files): **green**.

## Docker-integration: deferred to CI

This worktree has **no** worktree-local isolated docker-compose stack (no unique
`COMPOSE_PROJECT_NAME`, no worktree-scoped `.env` override) — only the shared default-port
`docker-compose.yml`. Per the hard rule against touching the shared stack, docker-gated tests were
**not run locally this session** and are deferred to CI, which runs them in isolation.

## No new ADR

The in-process (non-HTTP) CE access pattern for a background poller (no request-scoped JWT to
forward) is a documented-inline decision (poller.py module docstring), following the existing
`requests/ce_read.py` precedent directly — judged not to need a fresh ADR file given the strong
existing precedent (same judgment call as ONB-TASK-006's approach; flagging for architect review if
disagreed).
