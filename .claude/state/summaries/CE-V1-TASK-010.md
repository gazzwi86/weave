---
type: Summary
title: "TASK-010 summary — Agent-Grounding Authority & Escalation Patterns"
task: CE-V1-TASK-010
epic: CE-V1-EPIC-007
tags: [constitution-engine, summary, task]
timestamp: 2026-07-12T00:00:00Z
---

# TASK-010 — Agent-Grounding Authority & Escalation Patterns (E7-S4, ADR-013 M2 descope)

## What shipped

New module `packages/backend/src/weave_backend/rdf/agent_grounding.py` (M1's `rdf/patterns.py`
left untouched, Law 3):

- `authority_query(actor_iri, action, target_iri)` — one-row-always SPARQL builder. `action` must
  be one of the three base BPMO link predicates (`performedBy`/`governedBy`/`accesses`); the query
  itself unions a "modelled" branch (`<target> weave:<action> <actor>` holds) with a
  "coverage_gap" branch (`FILTER NOT EXISTS`), so it never returns zero rows and never needs a
  SPARQL-side "no rows = deny" shortcut (that's the exact FR-036 failure mode the brief calls out).
- `escalation_query(process_iri)` — same one-row-always shape, resolves the process's `performedBy`
  actor(s) as the escalation target. Base BPMO has no dedicated "escalate to" predicate; documented
  the "reuse performedBy" degrade as **ADR-027** (new decision, not covered by the brief).
- `coverage_gap_query(kind, required_links)` — generalises M1's step-level
  `coverage_gap_process` (`rdf/patterns.py`) to entity-level: one row per missing required link,
  `{entity_iri, missing_link}`, default invocation `(Process, [performedBy, governedBy])`
  (AC-010-04). Deliberately a NEW query, not a rewrite of `coverage_gap_process` — different column
  shape, different semantics ("every required link" vs "any of performedBy/supportedBy").
- `COMPETENCY_QUESTIONS_FRAMEWORK` — FR-037's framework competency-question set as one UNION query
  over `consumes`/`produces`/`runsOn`/`performedBy`/`governedBy`.
- `synthesize_decision(rows)` — pure function, decision computed in Python from row content, never
  from SPARQL row count. Can only return `"deny"` or `"coverage-gap"` — no code path can produce
  `"permit"` (ADR-013 invariant, security-floor test written first).
- `resolve_deny_default(conn, tenant_id, workspace_id)` — AC-010-02/-03's PLAT-SETTINGS-1 tunable
  (`agent_authority.deny_default` setting key, cascade via `settings/resolver.py::resolve_setting`,
  mirrors `ingest/confidence.py`'s fallback shape). A configured `"permit"` value (misconfigured or
  malicious) is never honoured — falls back to `"deny"`. Tested explicitly.

`routers/sparql.py` changes: `pattern=authority|escalation|coverage_gap` now branch to a new
`_agent_grounding_response` (params via `PatternGroundingParams`, split across two small
`Depends()` to stay under Law E's 5-param cap). Existing `pattern=coverage_gap_process` and
`query=` paths are untouched. Response shape for the three new patterns is
`{rows, column_names, decision}` (no `message` key — that's the M1 static-pattern convention only).

Validation: `actor`/`target`/`process` IRIs go through the same "reject SPARQL injection chars"
regex convention as `operations/pipeline.py::_SAFE_IRI_RE`; `action` is checked against the
3-value base-link allowlist (mirrors `GET /api/ontology/types`, hardcoded per ADR-013's fixed M2
scope); `kind`/`required_links` go through a bare-identifier regex. All surface as `400` with a
named `error` code, not a 500/KeyError.

## Test coverage (all new, TDD RED→GREEN)

- `tests/unit/test_agent_grounding_queries.py` — pure SPARQL-logic proofs against in-memory
  rdflib `Dataset`s (no Oxigraph/docker), same style as M1's `test_rdf_patterns.py`: modelled-link,
  absent-link, default-invocation multi-gap-row, present-link-not-flagged, and competency-question
  cases, plus validation-error cases for bad action/IRI/kind.
- `tests/unit/test_agent_grounding_decision.py` — `synthesize_decision` security-floor invariants
  (empty rows never reads as permitted; return value is never `"permit"` for any input) and
  `resolve_deny_default`'s cascade/fallback/reject-permit behaviour (mocked `resolve_setting`).
- `tests/unit/test_sparql_agent_grounding_route.py` — route-level wiring for all three patterns
  (missing-param 400s, invalid-action 400, decision propagation, default coverage_gap invocation
  query-text assertion), mocked Postgres/Oxigraph, mirrors `test_sparql_pattern_route.py`.

Not covered in this pass (out of scope for the poison-endpoint/unit gate, consistent with
`docker`/`e2e` exclusion): the brief's Locust perf AC (AC-010-08, p95 ≤ 500 ms @ 100k) and a
live-Oxigraph "seeded Hammerbarn graph" integration run — both need a running Oxigraph/Postgres
stack this sandbox doesn't have. The in-memory rdflib proofs exercise the identical query text that
ships to Oxigraph (same convention M1 established), so the query logic itself is proven; only the
live-store performance and end-to-end wiring remain unverified until a docker/e2e run.

## Design decisions

- **ADR-027** (new, `docs/specs/weave/engines/constitution-engine/decisions/ADR-027-escalation-performed-by-target.md`):
  `escalation(process)` resolves via `performedBy` because base BPMO has no dedicated escalate-to
  predicate and `performedBy` is the only base link connecting `Process` to `Actor`. Not covered by
  the task brief or ADR-013 explicitly — brief only said "escalation/exception links" without
  naming the concrete predicate.
- **PLAT-SETTINGS-1 tunable resolved as a 2-value enum, not a 3rd decision literal**: AC-010-02's
  "route-to-human, tenant/domain PLAT-SETTINGS-1" was read as "the `deny` branch's default string
  is tunable between `deny` and `coverage-gap`", not a 4th enum value outside CE-READ-1's
  documented `{permit, deny, coverage-gap}` set. `"permit"` is excluded from the allowed
  configured values by construction.
- **Authority direction fixed from `data-model.md`'s predicate table**: `<target> weave:<action>
  <actor>` (e.g. `<Process> weave:performedBy <Actor>`), not the reverse — confirmed from the
  ArchiMate relationship table (`tech-spec/data-model.md`), not assumed.

## Gates (all green in this worktree)

- `LOCALSTACK_ENDPOINT_URL=http://127.0.0.1:1 OXIGRAPH_URL=http://127.0.0.1:1 uv run pytest -m "not docker and not e2e" -p no:warnings -q` — green, except two **pre-existing, unrelated** failures
  (`test_sdkgen_emit_typescript.py::test_emitted_typescript_passes_tsc_noemit`,
  `test_sdkgen_pipeline_unit.py::test_generate_sdk_calls_all_five_ce_fetches_before_returning_staging_dir`)
  caused by `packages/frontend/node_modules/.bin/tsc` not being installed in this worktree — not
  touched by this task, not caused by this change.
- `uv run ruff check .` (whole `packages/backend`) — clean.
- `uv run mypy src/ tests/` — clean, 586 source files.
- `python3 .claude/scripts/okf_validate.py docs` — conformant (171 warnings, all pre-existing/tolerated
  cross-link patterns; the new ADR-027 file itself only adds one tolerated "recommended field
  `description` absent" warning, matching the existing ADR convention in this directory).
- mutmut double-in-process-run check (per `reference_mutmut-double-inprocess-run.md`): ran the three
  new test files through two in-process `pytest.main()` calls back to back — both green. No
  module-level once-per-process state (no caches/dedup sets/`lru_cache`) in any new code, so this
  is a non-issue for the mutation gate.
- No new migrations needed — the deny-default tunable is a key/value read against the existing
  `settings` table via `resolve_setting`; no schema change. Lane's reserved 0073/0074 unused.
- Frontend not touched — lint/typecheck/test skipped per the brief (no-new-contract, backend-only
  read-side task). Not UI-bearing — `ui_verify` skipped.

## Files

- `packages/backend/src/weave_backend/rdf/agent_grounding.py` (new)
- `packages/backend/src/weave_backend/routers/sparql.py` (extended: `pattern=authority|escalation|coverage_gap`)
- `packages/backend/tests/unit/test_agent_grounding_queries.py` (new)
- `packages/backend/tests/unit/test_agent_grounding_decision.py` (new)
- `packages/backend/tests/unit/test_sparql_agent_grounding_route.py` (new)
- `docs/specs/weave/engines/constitution-engine/decisions/ADR-027-escalation-performed-by-target.md` (new)
