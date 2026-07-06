# CE-TASK-003 — CE-READ-1 & CE-WRITE-1 Stable Interface Layer

**Epic:** CE-EPIC-010 · **Branch:** `feature/CE-EPIC-010` (stacked on `harness/mutation-60` → PR #36 base)
**Status:** implemented, awaiting QA · **Commit:** `cec3600`

## Nature of the task — gap-fill, not greenfield

The CE-READ-1/CE-WRITE-1 endpoint surface was already built in CE-TASK-001/002. This task
verified each acceptance criterion against the existing code and closed the genuine gaps only.
Verified already-present (no change needed):

- **AC-003-14** `X-CE-Version` + `X-Tenant-ID` on all responses — `observability/middleware.py::CeContractHeadersMiddleware` (one shared mechanism).
- **AC-003-10** `Link rel=next` pagination (>1000 rows) — `routers/sparql.py`.
- **AC-003-12** service-account write scope — `settings/resolver.py`, `tenancy/sessions.py`.
- **AC-003-13** published-version write rejection — `routers/operations.py`.
- **AC-003-15** `since_version` polling — `routers/sparql.py`.

## Delta implemented this task

`routers/sparql.py` — both `/api/sparql` handlers (POST + GET) now route validation through a
shared `_validate_or_400`, surfacing **precise error shapes** instead of the generic
`disallowed_query` catch-all (AC-003-05/-06):

- `ProhibitedClauseError` → `400 {"error":"prohibited_clause","clause":...}`
- `ServiceBlockedError` → `400 {"error":"service_blocked"}`
- subclasses caught ahead of their `DisallowedQueryError` parent, matching
  `routers/query.py::_validated_or_translation_failed` ordering.

## Non-negotiable held: isolation is protocol-layer

`validate_query` **only validates structure** (rdflib AST) — no query-text/regex rewriting. Dataset
scoping is enforced one layer down via `oxigraph_client.run_query`'s `default-graph-uri` /
`named-graph-uri` (SPARQL 1.1 Protocol). The task brief's "query-rewriting step" hint (Implementation
Hints ~L170-172) is **stale** — superseded by the PR #11 security finding; not followed. Do not
reintroduce text rewriting.

## Tests

- `tests/unit/test_sparql_router.py` (+15 passing) — each error branch (prohibited-clause,
  service-blocked, unscoped, version-not-found) for POST and GET.
- `tests/integration/test_ce_contract_read_endpoints.py` (new, `pytest.mark.docker`) — real-HTTP proof
  over the actual `app` stack: AC-003-07 (401 no-bearer), AC-003-14 (`X-CE-Version` on real response),
  AC-003-01 (`GET /api/ontology/types` BPMO catalogue). Runs in CI docker lane; skipped locally without docker.

## Coordinator notes (not the engineer's — no engineer report was produced)

The engineer subagent ended without a structured per-AC report and left all work **uncommitted**,
blocked by pre-commit mypy: 4 `comparison-overlap` errors on `HTTPException.detail == {dict}`
assertions (the file's established idiom is `# type: ignore[comparison-overlap]`, see lines 82/98 —
the 4 new lines missed it). Coordinator added the ignore comments, cleared a stale mypy incremental
cache (unrelated `attr-defined` phantoms), and committed. Left uncommitted and untouched (not this
task's): `.claude/state/summaries/latest.md`, `docs/wiki/backend.md` (both modified before this
session — another session's work), and `e2e/ui-verify/__screenshots__/`.

## Next task context (CE-TASK-006/007 depend on this)

CE-TASK-003 is the interface contract CE-TASK-006 (authoring surfaces) and CE-TASK-007 (NL→SELECT)
build against. The SPARQL error shapes are now stable and precise — downstream can branch on
`error` codes (`prohibited_clause`, `service_blocked`, `unscoped_query_rejected`, `disallowed_query`).
