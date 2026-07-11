---
type: ADR
title: "ADR-022: Brand token RDF encoding + BPMO catalogue leak fix"
status: Accepted
task: TASK-003
timestamp: 2026-07-11T00:00:00Z
---

## Context

TASK-003's pseudocode pins `weave:BrandStandard`'s properties
(`contentType`, `contentBody`|`sourceUri`, `effectiveDate`, `owner`) and the
**output** token JSON shape (closed core `color`/`typography`/`spacing`/
`radius` + open `extensions`), but not how one or more `BrandStandard`
individuals encode as that output. This is an undocumented design decision
(Law 10) made while implementing the `flatten_to_token_json` projection.

A second, unrelated gap surfaced while tracing the SHACL shape file:
`ontology/catalogue.py::list_kinds` (backs `GET /api/ontology/types`,
CE-READ-1) enumerates **every** `sh:NodeShape`/`sh:targetClass` pair in
`framework.shacl.ttl` with no BPMO-membership filter. Adding
`BrandStandardShape`/`VoiceRuleShape` to that same file — needed so
CE-WRITE-1's existing `validate_graph` picks them up — would leak both as
bogus BPMO kinds from the catalogue endpoint, violating
`.claude/rules/ontology-standards.md` ("do not hard-code domain-specific
classes into the shipped ontology" / never a *populated* kind list beyond
the 14 BPMO kinds).

## Decision

**1. `contentType` is the token JSON key.** Each `BrandStandard` individual
carries one JSON section. If `contentType` is one of the four closed-core
keys (`color`, `typography`, `spacing`, `radius`), its `contentBody` (a JSON
string literal) is parsed and merged into that key. Any other `contentType`
value is used verbatim as a key inside `extensions` (matches the
pseudocode's `"<namespaced.key>": <any JSON>` convention, e.g.
`acme.logoRadius`).

**2. `sourceUri`-only individuals are asset references, not token data.**
A `BrandStandard` with `sourceUri` and no `contentBody` (e.g. a logo file or
a style-guide PDF) is still committed/versioned/PROV-stamped via CE-WRITE-1
like any other individual, but is excluded from `flatten_to_token_json`'s
output — there is no field for it in the pinned token JSON shape.

**3. Duplicate `contentType` merge policy: shallow-merge, subject-IRI
order, last wins.** SHACL cannot enforce "at most one individual per
`contentType`" (it targets individual shapes, not cross-individual
cardinality), so the projection tolerates duplicates deterministically: the
`SELECT` is ordered by subject IRI, and individuals are merged into the
output dict in that order, so a later IRI's keys win on collision.
`ponytail: last-write-wins by IRI order, not by effectiveDate; a
same-`contentType` authoring conflict is undetected. Revisit with an
explicit single-canonical-per-contentType SHACL/app check if this proves
confusing in practice.`

**4. `VoiceRule` maps directly.** `ruleId` -> `id`, `severity`, `assertion`
map 1:1 into the pinned `{id, severity, assertion}` shape. `humanLabel` is
governance/display metadata only (task brief's Story section) and is
dropped from the CE-BRAND-1 projection — Build's gate only needs the
mechanically-evaluable fields.

**5. Catalogue leak fix: filter `list_kinds` to `BPMO_KINDS`.** BPMO_KINDS
(`authoring/bpmo.py`) is already the canonical, non-hand-copied 14-kind
membership set that both the write-side guard and (per its own docstring)
`GET /api/ontology/types` are meant to trace back to. `list_kinds` now
filters shapes to those whose target-class local name is in `BPMO_KINDS`
before returning them, so framework-level classes appended to the same
shapes file (`BrandStandardShape`, `VoiceRuleShape`, and later
`weave:Function`) validate at commit but never surface as a fake BPMO kind.
This is a one-line filter, not a second shapes file — `operations/shacl.py`
keeps loading exactly one file, unchanged.

## Alternatives considered

- **One `BrandStandard` individual = one whole token-JSON blob in
  `contentBody`.** Rejected: doesn't explain why the pseudocode's SELECT
  binds `individuals` (plural) into a single `flatten_to_token_json` call,
  and forces every governed edit (e.g. just the primary color) to rewrite
  and re-review the entire document.
- **Second shapes file, loaded only by `validate_graph`, not by
  `catalogue.shapes_graph()`.** Rejected: `shacl.py`'s
  `_load_shapes_graph`/`shapes_graph()` is a single lazily-cached file by
  design (ADR-001) shared by both call sites; forking it adds a second
  cache and a second load path for two shapes, more surface than a
  one-line filter.

## Consequences

- `brand/projection.py`'s flattener is a pure function over SPARQL SELECT
  bindings (`contentType`, `contentBody`, `sourceUri` per row), ordered by
  subject IRI — no store access, matches the task brief's unit-testability
  hint.
- `catalogue.list_kinds`'s existing tests must still see the original 14
  BPMO kinds and nothing else once `BrandStandardShape`/`VoiceRuleShape`
  land in `framework.shacl.ttl` — covered by a new unit test asserting the
  catalogue omits both.
