# Progress: BE-TASK-001 — M1 Project Bootstrap Stub

Branch: `feature/BE-EPIC-002` (branched from `origin/main` @ `61dfc15`). Not yet merged/PR'd —
coordinator instructed push-only, PR deferred until the epic has more tasks.

## Outcome

PASS

## Decisions Made

- **Auth reused, not rebuilt.** Used the already-shipped `get_current_principal`/`Principal`
  dependency (`weave_backend/auth/dependencies.py`) instead of the brief's `python-jose` hint.
  Its 401 shapes (`{"error": "token_ttl_exceeded"}` etc., no `Www-Authenticate` header, no
  `{"error": "unauthorised"}` string) differ from AC-3's illustrative wording — this is a
  disclosed, coordinator-directed supersession (the brief predates the shared dependency), not
  a silent gap. Tests here assert `status_code == 401` only, matching `test_whoami.py`'s
  existing precedent for this shared boundary.
- **Slug**: hand-rolled `slugify()` (stdlib `re`, lowercase + hyphenate + strip) instead of
  `python-slugify` — no such dependency exists anywhere in this codebase (Law A / ponytail
  ladder: stdlib beats a new dependency for ~4 lines of logic).
- **project_iri scheme**: `urn:weave:project:{tenant_id}:{slug}`, `UNIQUE(tenant_id, slug)`
  enforced at the DB level (migration + `ProjectExists` on `asyncpg.UniqueViolationError`).
- **CE-VERSION-1 retry**: hand-rolled 3-attempt loop (initial + 2 retries), not literal
  `tenacity` — no `tenacity` dependency exists in this codebase; precedent is
  `notifications/dispatch.py`'s `deliver_slack_with_retry`.
- **Migration number**: `0009_projects.sql`, applies cleanly on a DB with only 0001..0006
  applied (verified via the isolated lane below) — zero coupling to other in-flight lanes'
  0007/0008.
- **`NewProject` grouping model** introduced in `projects/model.py` solely to keep
  `create_project`'s signature under Law E's 5-parameter budget (ruff `PLR0913` caught the
  original 8-parameter signature).

## Assumptions Made

- None beyond the coordinator's own explicit overrides (which supersede the brief's
  implementation hints by direct instruction, not inference) — auth reuse, DB/RLS reuse,
  migration number, CE-VERSION-1 client-only integration (real endpoint doesn't exist on
  `main` yet), Docker lane isolation, and the AC-3 body-shape note above.

## Nuances

- **pytest-cov + asyncpg C-extension segfault.** Running the docker-marked integration lane
  under `pytest-cov` (both the default C tracer and `COVERAGE_CORE=sysmon`) segfaults inside
  `platform_stack`'s fixture setup on this environment — reproducible, not test-code-specific.
  Worked around by measuring coverage from the unit lane only (100% achieved there via
  `_FakeConnection`-based tests, see `test_members.py` for the established stand-in pattern)
  and running the docker lane's correctness proof without `--cov`. Logged as a cross-task
  finding rather than touching any harness/CI config.
- **`check-anatomy-fresh` false positive** (pre-existing on `origin/main`, not introduced by
  this task): `docs/wiki/README.md`'s own explanatory text contains a literal
  `<!-- stale: <path> --> ` example that the freshness-checker regex matches as a real stale
  entry. Not currently blocking (no git pre-push hook is actually installed in this worktree —
  only `.sample`), but logged to `.claude/state/qa-cross-task-findings.md` per
  harness-governance rule 3 (found, not fixed inline).
- **Source-control config is captured but never echoed back.** `POST /api/projects` persists
  `source_control_provider`/`source_control_token_secret_ref` on the row (M1 producer for
  TASK-010) but neither the `POST` nor `GET` response schema exposes them — proven only via a
  raw DB query in the integration test. TASK-010 must query the DB (or a future endpoint) for
  these columns directly; they are not in `ProjectResponse`/`CreateProjectResponse`.

## Git Commits

- `921cc2f` — `test: add failing tests for BE-TASK-001 project bootstrap stub`
- `625eb74` — `feat: BE-TASK-001 project bootstrap stub (build-engine EPIC-002)`
- `5e87a51` — `test: close BE-TASK-001 coverage gap to 100% on new project modules`

## Test Results

- Unit: 24 passing (`test_project_model.py` 10, `test_ce_version_client.py` 5,
  `test_projects_router.py` 9) — 0 failing.
- Integration (docker-marked, isolated `weave-lane-be` lane): 5 passing — 0 failing.
  (`test_create_project_persists_and_returned_via_get`,
  `test_create_project_rejects_unauthenticated_post`,
  `test_project_rls_tenant_b_cannot_read_tenant_a`,
  `test_create_project_pins_latest_ce_version_by_flag_not_list_position`,
  `test_create_project_persists_source_control_config`)
- E2E: n/a — backend-only task, no UI (per brief and coordinator instruction).
- Coverage: 100% on `weave_backend.projects` + `weave_backend.routers.projects` +
  `weave_backend.schemas.projects` (143/143 statements), measured from the unit lane alone
  (see Nuances re: docker-lane + coverage segfault). Full fast (non-docker) suite: all green,
  no regressions.
- Lint: `ruff check .` clean. `mypy src/ tests/` — "Success: no issues found in 152 source
  files". `bandit` on the 4 new implementation files + 3 modified test files: 0 High
  severity/confidence findings.

## ADRs Created

- None — all deviations from the brief's implementation hints were explicit, written
  coordinator overrides (auth/DB/slug/retry/docker-lane), not undocumented design decisions
  requiring a new ADR.

## Dependencies Unlocked

- **TASK-004 / TASK-006**: `POST /api/projects` / `GET /api/projects/{project_iri}` are live,
  auth-gated (`get_current_principal`), tenant-RLS-enforced, returning
  `{project_iri, pinned_graph_version_iri, created_at}` / `{project_iri, name,
  pinned_graph_version_iri, created_at}`.
- **TASK-010**: `projects.source_control_provider` / `projects.source_control_token_secret_ref`
  columns are persisted (accept `{provider: "github"|"gitlab", token_secret_ref}` on create) —
  query them directly from the `projects` table; they are not in any response schema yet.
- **All three**: the CE-VERSION-1 client (`weave_backend/projects/ce_version_client.py`) is
  stubbed via `httpx.MockTransport` at both unit and integration levels (`CE_API_BASE_URL` env
  var, default `http://localhost:8000`, same process as Build for M1). Real cross-engine wiring
  is unproven until the CE lane's `GET /api/ontology/versions` endpoint merges to `main` — treat
  the 503 `ce_version_unavailable` path as contract-shape-correct but not yet integration-proven
  against a real CE deployment.

---
*Generated by Engineer. Read by Engineers starting TASK-004/TASK-006/TASK-010.*
