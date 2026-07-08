---
type: TechSpec
title: "Constitution Engine — Spec Invariants"
description: "Flat checklist of architectural invariants the engineer MUST honour and QA MUST
  verify. Each entry carries a verify-by selector (file path + grep pattern). M1 invariants
  derived from the M1 tech spec; M2 invariants from m2-delta.md §11."
tags: [constitution-engine, arch, tech-spec, invariants]
status: Draft
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/constitution-engine/tech-spec/invariants.md
source: hand-authored
confirmed_by: none
expires_on: 2027-01-08
---

# Constitution Engine — Spec Invariants

Engineer MUST honour; QA MUST verify. One line each; `verify-by:` = where to look + what to grep.

## M1 (standing)

- Single mutation entry point: every graph write routes through CE-WRITE-1's apply pipeline
  (FR-003) — verify-by: CI no-second-mutation-path assertion; grep routers for store-write calls
  outside the operations module.
- Cross-tenant isolation is fail-closed (ADR-001): unscoped queries rejected, zero rows
  cross-tenant — verify-by: two-tenant isolation test suite; grep query layer for the
  scoping-guard call.
- Both query surfaces are SELECT-only, `SERVICE`-blocked, paginated (B3) — one shared sanitizer,
  no fork — verify-by: grep for a single sanitizer module imported by both editor and NL paths.
- SHACL validation runs `inference='none'` — verify-by: grep validator config for the inference
  parameter.
- Published version graphs are immutable — verify-by: grep write path for any write targeting a
  `:v{semver}` graph IRI (must be publish pipeline only).

## M2 delta (from m2-delta.md §11)

- Registry/brand JSON projections are derived, never hand-edited — verify-by: no POST/PUT route
  under `/api/functions*` or `/api/brand/*`; grep routers for write verbs on those prefixes.
- CE-EVENT-1 event row is written in the same DB transaction as the commit — verify-by: grep the
  CE-WRITE-1 commit function for the event insert inside the transaction scope.
- Event `version_iri` never carries a draft graph IRI — draft events carry `version_iri: null` +
  `last_published_version` — verify-by: change-feed test asserting null `version_iri` on a
  draft-commit event.
- `graph_change_events` is append-only at the DB level (no UPDATE/DELETE grants) — verify-by:
  grep the migration for grant statements; migration test attempts UPDATE and fails.
- No per-function version lineage exists — `version_iri` is the CE-VERSION-1 IRI — verify-by:
  grep registry schemas/models for any function-local semver field (must be absent).
- Published function signatures are immutable in-place; unclassified signature changes default to
  `breaking: true` (fail-closed) — verify-by: TASK-009 unit test "unknown change class ⟹
  breaking"; grep the classifier for its default branch.
- Tenant validation loads shapes only from `urn:weave:g:framework` ∪
  `urn:weave:g:tenant:{id}:shapes` — never another tenant's — verify-by: grep the shape loader
  for the two graph IRI templates; cross-tenant shape-leak test green.
- Shapes-graph commits bump the per-tenant version hash; validation cache keys on
  `(tenant, shapes_version_hash)` — verify-by: grep cache key construction; two-process
  invalidation test green.
- Unstated agent authority resolves to deny / route-to-human; authority responses use the
  CE-READ-1 `{ rows, decision: "permit"|"deny"|"coverage-gap" }` convention and `"permit"` is
  unreachable in M2 (ADR-013); gap rows are `{entity_iri, missing_link}`; rows carry `source`
  detail — verify-by: TASK-010 deny-default + permit-unreachable tests; grep the response model
  for `decision` and rows for `source`.
- Authority/escalation patterns route through the shared B3 sanitizer (no second sanitizer) —
  verify-by: grep pattern-execution path for the sanitizer import.
- Brand-token payload = closed core (`color`/`typography`/`spacing`/`radius`) + `extensions`
  untyped map; core changes require a contracts.md amendment — verify-by: token response schema
  test pinned to the four core keys + extensions.
