---
type: Decision
title: "ADR-028: Tenant shape edit/retire retracts via a surgical SPARQL Update, not a whole-graph replace"
description: >-
  G2/G3 (remediation-2-api-gaps.md) need to replace-by-subject (edit) or fully remove (retire) a
  single sh:NodeShape's triple closure -- itself plus reachable blank nodes -- in the tenant shapes
  graph. append_graph alone stacks duplicate triples on re-commit (G2's bug); load_graph replaces
  the WHOLE graph, racing any concurrent edit to a DIFFERENT tenant shape. Adds one new primitive,
  oxigraph_client.run_update (SPARQL 1.1 Update), used only for a per-subject DELETE WHERE scoped
  to the incoming shape_iri -- extends ADR-024's "sole writer" invariant to "append + surgical
  retract", never load_graph.
tags: [decision, adr, constitution-engine, governance, shacl, m2, remediation-2]
status: Accepted
timestamp: 2026-07-18T00:00:00Z
resource: docs/specs/weave/engines/constitution-engine/decisions/ADR-028-shape-retract-uses-sparql-update.md
source: hand-authored
confirmed_by: none
confirmed_on: null
last_verified_sha: null
expires_on: 2027-01-18
owner: gazzwi86
coverage: constitution-engine
---

# ADR-028: tenant shape edit/retire retracts via a surgical SPARQL Update, not a whole-graph replace

## Status

**Accepted** — 2026-07-18.

## Context

`docs/design/remediation-2-api-gaps.md` flagged two gaps in the tenant governance-shapes writer
(`operations/governance_shapes.py`, ADR-024):

- **G2 (bug-class):** `commit_tenant_shape` used `append_graph` unconditionally. Re-committing the
  same `shape_iri` (an edit) appended a second, parallel set of `sh:property` blank nodes instead of
  replacing the first — the graph ends up with both the old and new constraint sets active at once.
- **G3 (gap):** there was no retract path at all — a tenant shape, once committed, could never be
  removed.

Both need the same primitive: delete every triple whose subject is `shape_iri` itself, or a blank
node reachable from it (a `sh:NodeShape`'s `sh:property` children, and any further blank-node
nesting a SHACL logical construct like `sh:or`/`sh:and` introduces).

Two mechanisms were considered:

- **Whole-graph fetch → in-memory retract → `load_graph` (PUT, replace-whole-graph).** Fetch the
  full tenant shapes graph via the existing `fetch_graph_ntriples`, compute the closure to drop in
  Python, then PUT the remainder + new triples back. Rejected: this rewrites the **entire** tenant
  shapes graph on every edit/retire. Two concurrent edits to two **different** shapes in the same
  tenant race — the second PUT silently drops whatever the first one added, with no error. For a
  compliance-rules graph, a rule silently vanishing because of an unrelated edit is the wrong
  failure mode, and it is exactly the whole-graph-replace hazard ADR-024 chose `append_graph` to
  avoid in the first place — this option would have widened that hazard, not preserved it.
- **A surgical, per-subject SPARQL 1.1 Update `DELETE WHERE`, scoped to the tenant shapes graph.**
  Deletes only the incoming `shape_iri`'s own closure; a concurrent write to a different shape in
  the same graph is untouched. No existing primitive for this — `oxigraph_client.py` had `run_query`
  (read), `load_graph`/`append_graph`/`clear_graph` (whole-graph or additive writes only), nothing
  matching a single subject's triples for deletion.

## Decision

Add `oxigraph_client.run_update(update: str)` — a thin POST to Oxigraph's `/update` endpoint
(`Content-Type: application/sparql-update`). Unlike `run_query`'s `default-graph-uri`/
`named-graph-uri` protocol params, `/update` has no dataset-scoping query param, so every update
this codebase issues names its target graph explicitly via `GRAPH <iri> { ... }`.

`governance_shapes.py` gets one shared helper, `_retract_shape_subject_closure(graph_iri,
shape_iri)`, used by both callers:

```sparql
DELETE { GRAPH <G> { ?s ?p ?o } }
WHERE {
  GRAPH <G> {
    <SHAPE> (!(<urn:weave:sparql:any-predicate>))* ?s .
    FILTER(?s = <SHAPE> || isBlank(?s))
    ?s ?p ?o .
  }
}
```

The `(!(<...>))*` property path is the standard SPARQL "any predicate, zero-or-more hops" idiom
(negate a property nobody uses, then repeat) — it walks from `SHAPE` through every predicate,
however deep, and the `FILTER` keeps only `SHAPE` itself and blank nodes reached along the way. A
named node reached in passing (e.g. `sh:targetClass`'s object) is excluded by the `isBlank` half of
the filter, so its own triples are never touched even if the walk passes through it.

- **G2** (`commit_tenant_shape`): retract-then-append — `_retract_shape_subject_closure` runs first,
  `append_graph` writes the new version second. A brand-new `shape_iri` has an empty closure, so the
  retract is a no-op and behaviour for a genuinely new shape is unchanged from before this ADR.
- **G3** (`retire_tenant_shape`, new): retract only, no re-append. Checks
  `shacl.framework_shape_iris()` first (403 — a framework shape is never in the tenant graph, so an
  existence-first check would misreport it as 404 instead of "not retirable"), then existence in the
  tenant graph via `fetch_graph_ntriples` + rdflib membership check (reusing the existing
  fetch-and-parse pattern from `shacl._tenant_shapes_graph`, not a second raw-SPARQL existence
  query), then retracts, audits (`governance.shape_retired`), and bumps the shapes version.

`shape_iri` is embedded directly into the hand-built SPARQL Update text. Since it reaches this
writer from a client-echoed shape body (commit) or a raw query parameter (retire), it is validated
against the SPARQL/Turtle `IRIREF`-forbidden byte set (`< > " { } | ^ \` and control characters)
before use — rejecting anything that could break out of the `<...>` wrapper, i.e. closing the
injection surface this design otherwise opens by building SPARQL text from a string field (Law 13).

ADR-024's invariant is generalised, not violated: `governance_shapes.py` remains the **sole**
writer to the tenant shapes graph, now via two primitives (`append_graph`, `run_update`) instead of
one — `load_graph` (whole-graph replace) is still never used against this graph.

## Alternatives considered

- **Whole-graph fetch/modify/PUT** — see Context; rejected for the lost-update race on concurrent
  edits to different shapes.
- **A per-tenant write lock around the whole-graph PUT**, to make the above race safe. Rejected as
  unnecessary complexity once the surgical-delete option is available with no locking needed at
  all — locking would only be the right tool if a per-subject delete were somehow unavailable.

## Consequences

- Closure-correctness (no duplicate `sh:property` nodes after a second commit, unrelated shapes
  untouched after a retire) can only be proven against a real Oxigraph instance — covered by
  `tests/integration/test_governance_shapes_tenant.py` (docker-marked, runs in CI). The unit suite
  (`tests/unit/test_governance_shapes.py`) asserts wiring only: `run_update` is called with a query
  naming the graph and shape IRI, called before `append_graph` on commit, and the audit/version-bump
  side effects fire.
- A future writer to this graph must go through `governance_shapes.py`; a second module calling
  `run_update` against `tenant_shapes_graph_iri(...)` directly would break the same grep-enforceable
  invariant ADR-024 established for `append_graph`.
