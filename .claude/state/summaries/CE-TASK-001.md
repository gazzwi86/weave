# CE-TASK-001 — SHACL Validation Pipeline (CE-WRITE-1)

**Status:** done (QA PASS after 1 retry) · **Epic:** CE-EPIC-006 · **Branch:** feature/CE-EPIC-006 (based on main post-platform-merge) · **Date:** 2026-07-05

## Decisions Made

- **Graph naming: reused the shipped workspace-granular scheme** `urn:weave:tenant:{tenant_id}:ws:{workspace_id}`
  (with versions `{named_graph_iri}:v{semver}`, prov at `{named_graph_iri}:prov`) instead of the brief's
  `urn:weave:g:tenant:{id}` — the sparql/search/workspaces routers already depend on it; one production
  scheme beats two. Recorded in `docs/specs/weave/engines/constitution-engine/decisions/ADR-001.md`,
  which cross-references the program-level `docs/specs/weave/decisions/ADR-001-tenant-isolation.md`
  and scopes the supersession to the IRI naming table ONLY (isolation boundary, CE-WRITE-1-only write
  path, 403+audit contract all unchanged). **ADR status: Proposed — awaiting human sign-off** (program
  ADR is human-confirmed and release-gating).
- **Single mutation entry point** `POST /api/operations/apply`: JWT→RBAC→idempotency→clone→apply-all→
  SHACL(`inference='none'`, Polikoff rule)→commit-or-discard. Violations → 422 `{violations}`;
  Warning/Info → advisory in 201. Modules: `operations/{shacl,graph_ops,idempotency,versioning,provenance,metrics,pipeline}.py`, `routers/operations.py`, `schemas/operations.py`.
- **PLAT-AUDIT-1 emission wired (retry fix):** `operations.applied` on success (in `_apply_uncached`),
  `security.rbac.denied` on RBAC 403, `security.cross_tenant.rejected` on forged-target 403 — all via
  `default_audit_emitter` on the same tenant connection. Denials use a **deferred-raise pattern**
  (HTTPException returned from inside the `tenant_connection` block, raised after it commits) so the
  audit insert survives the 403 — same pattern as billing's budget gate.
- **Forged cross-tenant target → 403 + audit** (retry fix; was 400/no-audit, contradicting program
  ADR-001). `ForeignTargetError` (well-formed version IRI outside caller's workspace, matched by
  `_VERSION_IRI_RE`) vs `InvalidTargetError` (malformed → 400, no audit — structurally cannot name a
  real foreign graph).
- **Idempotency**: optional `idempotency_key` in request body (contract silent on transport), Redis-backed,
  24h TTL, tenant-scoped keys (no cross-tenant cache leak), Redis lock ensures at-most-once apply under
  concurrency — which also structurally dedups the success audit entry (proven: 1 row after 2 posts).
- **Minimal PROV-O only**: `write_activity` mints `activity_iri` into `{graph}:prov` — full provenance
  model is TASK-002's job.
- **Framework shapes**: core subset ported from `prototypes/obpm/shapes/` to
  `packages/backend/src/weave_backend/ontology/shapes/framework.shacl.ttl` (Process=Violation,
  Actor/Goal=Warning/Info — all three severities exercised). Full 13-kind BPMO ships in TASK-004.
- **E2E scoped API-level** (httpx.ASGITransport against real docker stack, marker `[integration,docker,e2e]`)
  per `test_workspace_switch_e2e.py` precedent — no mutation UI exists until TASK-006, which must replace
  with a real browser spec (TODO in module docstring). No mocked network (PROJ-006 honoured).

## Assumptions Made

- `cloudwatch` added to LocalStack `SERVICES` in docker-compose.yml (metric calls were silently failing).
- No `openapi.yaml` artifact exists yet for constitution-engine; contract conformance verified via
  `app.openapi()` (201→ApplyResponse, 422→ViolationsResponse).

## Nuances / gotchas discovered

- FastAPI's `HTTPException` wraps details under `{"detail": ...}` — contract-shaped 422 requires
  returning `JSONResponse` directly.
- Oxigraph Turtle serialisation groups by subject (`;` lists, `a` for rdf:type) — parse with rdflib,
  never string-match serialisations in tests.
- `_resolve_ref` silently treats unresolved `subject_ref`/`object_ref` as an existing IRI (dangling-edge
  hazard) and `operations` has no `max_length` — both ledgered Warn, follow-up for TASK-002+/Architect.
- Audit-emission-per-route now has a structural-guard escalation: **PROJ-007** (3rd occurrence),
  Architect-owned, deadline before CE-TASK-003.
- Post-commit failure path (metrics/activity write AFTER commit succeeded) has no test — QA Warn for
  TASK-002's provenance work.

## Git Commits

Engineer: 8c489a5, 71fa2b2, 3482a66, fe644da, f5e4ab8, 3de9521, 314bb68.
QA edge cases: 6883727→0e98edd, 7bee6d0→d6491de (rebased). Retry: 74242ce, 62ba56d, 09fc043.

## Test Results

- Fast lane (default CI scope): 232 passed. Docker lane `test_operations_apply.py`: 9/9 (QA-verified twice).
- Coverage `operations/*`: pipeline 86%, graph_ops 97%, idempotency 100%, shacl 100%;
  provenance/versioning/metrics 47–61% unit-only (docker-lane-covered; `--cov`+docker lane forbidden —
  no combined per-file number possible, known constraint).
- ruff/mypy/bandit clean. Law E: max fn 44 lines, all files <300.
- QA FAIL round 1 (audit contract ×2 + ADR cross-ref), classified `logic`, retry 1 → all 3 re-validated PASS.

## PR #20 review-gate fixes (post-QA, commits 183e257/20ca5ba/90fd3bd)

7 findings fixed in-branch: (1) audit/PROV attribution now the JWT principal (`ApplyContext.principal_iri`),
client `actor` kept only as `claimed_actor_iri` in the audit payload; (2) 422 outcomes idempotency-cached
(`{kind, body}` tagging), concurrent-duplicate timeout → 409 `concurrent_apply_in_progress` (was unhandled
500), poll window derived from `LOCK_TTL_SECONDS`; (3) `engine="constitution"` on all 3 AuditEvent sites;
(4) routine RBAC 403 renamed `security.rbac.denied`→`access.rbac.denied` (no all-admin Slack fan-out;
`security.cross_tenant.rejected` unchanged); (5) shacl.py docstrings now truthful (lazy first-use cache,
framework-only, restart-to-refresh until shape authoring); (6) fake "Law 13" citation dropped (repo-wide
sweep of the pre-existing copies ledgered); (7) `_commit` reordered — version row + PROV + audit before the
working-graph promotion PUT, so promotion is the single last irreversible step (AC-001-10 holds on any
pre-promotion failure). Sub-threshold ledger rows: idempotency-poll pool-hold (Architect v1.0), Law-13 sweep.

## ADRs Created

- `docs/specs/weave/engines/constitution-engine/decisions/ADR-001.md` — workspace-granular graph scheme;
  **Proposed, pending human sign-off** (partially supersedes program ADR-001 naming).

## Dependencies Unlocked

- TASK-002 (provenance wraps commits; note the audit/prov seams above), TASK-003 (contract faces),
  TASK-004 (full BPMO shapes into the pipeline), TASK-005 (instance mutations), TASK-006 (authoring UI —
  owes the real browser E2E replacing the API-level slot).
