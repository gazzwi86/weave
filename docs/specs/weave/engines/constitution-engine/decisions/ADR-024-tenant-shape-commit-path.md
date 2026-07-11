---
type: Decision
title: "ADR-024: Tenant shape commits use a dedicated writer, not CE-WRITE-1's Op vocabulary"
description: >-
  TASK-005's pseudocode frames shape commits as "a CE-WRITE-1 op batch targeting the shapes
  graph", but CE-WRITE-1's Op vocabulary (AddNodeOp: BPMO-kind-validated, flat properties dict,
  workspace-versioned) structurally cannot represent a sh:NodeShape's blank-node sh:property
  list, and the shapes graph is tenant-wide/directly-mutable (ADR-023), not workspace-versioned.
  Shape commits get their own writer in operations/governance_shapes.py, built from the same
  primitives CE-WRITE-1's own PROV-O writer already uses for non-instance-data graphs
  (append_graph, never load_graph) -- not a second entry point for tenant data.
tags: [decision, adr, constitution-engine, governance, shacl, task-005, m2]
status: Accepted
timestamp: 2026-07-11T00:00:00Z
resource: docs/specs/weave/engines/constitution-engine/decisions/ADR-024-tenant-shape-commit-path.md
source: hand-authored
confirmed_by: none
confirmed_on: null
last_verified_sha: null
expires_on: 2027-01-11
owner: gazzwi86
coverage: constitution-engine
---

# ADR-024: tenant shape commits use a dedicated writer, not CE-WRITE-1's Op vocabulary

## Status

**Accepted** — 2026-07-11.

## Context

TASK-005's pseudocode says a shape commit is "a CE-WRITE-1 op batch targeting the shapes graph",
and the design-decisions table states "shapes graph write goes through CE-WRITE-1 — single
mutation entry point (FR-003) covers shapes too". Taken literally this means routing shape commits
through `operations/pipeline.py`'s `_apply_uncached`/`apply_operations_request`, the same function
that handles `POST /api/operations/apply`'s `AddNodeOp`/`UpdateNodeOp`/... batch.

That function's `Op` vocabulary (`schemas/operations.py`) is shaped for BPMO instance data: an
`AddNodeOp` is `{kind: <one of 13 BPMO kinds, BPMO_KINDS-validated>, label, properties: dict[str,
Any]}` — a flat property bag on a single named subject. A `sh:NodeShape` is not that: it is a
subject with an `sh:property` list of **blank nodes**, each carrying its own `sh:path` /
`sh:minCount` / `sh:datatype` / `sh:severity` / `sh:message`. There is no way to express nested
blank-node structure inside `properties: dict[str, Any]` without smuggling a second serialisation
format (e.g. a JSON-encoded SHACL fragment as a string value) through a field designed for scalar
BPMO attribute values — which `validate_kind`'s BPMO-kind gate would reject outright before that
smuggled value was ever reached (a shape's `target_class` is not itself a BPMO kind to create an
instance of).

Separately, `ApplyContext`/`mint_version` version the **workspace** data graph
(`urn:weave:tenant:{tenant_id}:domain:{domain_id}`) on every commit. The shapes graph
(`urn:weave:g:tenant:{id}:shapes`, ADR-023) is tenant-wide and directly mutable — not versioned per
commit, not scoped to a workspace. Forcing it through `ApplyContext` would mean either minting a
meaningless per-shape "version" of a graph that isn't versioned, or bypassing half of
`_apply_uncached`'s workspace-specific machinery — at which point it is not meaningfully "the same
entry point" any more, just a fork of it wearing the same name.

`routers/operations.py`'s own docstring scopes the invariant precisely: *"No other route may write
to **a working graph**; that's the point."* The shapes graph is not a working graph — it is
structurally a sibling of the existing PROV activity graph
(`{named_graph_iri}:prov`, `operations/provenance.py`), which is **already** written outside the
Op vocabulary, via `oxigraph_client.append_graph` (POST/merge), called directly from
`pipeline.py::_commit`. That is the established precedent this decision follows.

## Decision

Shape commits go through one dedicated function,
`operations/governance_shapes.py::commit_tenant_shape`, which is the **sole** caller of
`append_graph` against a `tenant_shapes_graph_iri(...)` target anywhere in the codebase (grep-
enforceable, mirroring the existing `no second mutation path` invariant's spirit for the shapes
graph specifically). It reuses the same primitives `pipeline.py::_commit` already relies on for
non-instance-data graph writes:

- `oxigraph_client.append_graph` (not `load_graph` — additive, never replaces the whole shapes
  graph, matching provenance's append-only pattern)
- a shape-specific PROV-O writer (`operations/provenance.py::write_shape_activity`), extending the
  existing `write_activity` pattern with a second, optional agent role (`prov:hadRole
  weave:generator`) so an AI-generated shape can be PROV-attributed to both the generating LLM and
  the approving human — `write_activity` itself only models one actor, insufficient for AC-005-01's
  "PROV-O attributing the LLM as generator and the human as approver"
- `operations/outbox.py::enqueue` (same audit-outbox discipline as every other mutation)
- `operations/shacl.py::bump_shapes_version` (cross-worker cache invalidation, AC-005-02)

The router (`routers/governance.py`) never calls `oxigraph_client.append_graph`/`load_graph`
directly — every write is behind `commit_tenant_shape`, same discipline as CE-WRITE-1's "single
entry point, no bypass" for the working graph, applied to the shapes graph's own boundary.

## Alternatives considered

- **Extend `Op` with a `add_shape` variant carrying raw Turtle.** Rejected: reintroduces exactly
  the "second serialisation format smuggled through a generic field" problem, and still needs
  `ApplyContext`'s workspace/version semantics bent to fit a tenant-wide, non-versioned graph —
  more surface area than a five-function dedicated module, not less.
- **Route shape commits through `_apply_uncached` with `ctx.named_graph_iri` swapped to the shapes
  IRI.** Rejected: `_apply_uncached` SHACL-validates the *result* of applying ops against
  framework+tenant shapes (meaningless for a graph whose content *is* shapes, not instance data)
  and calls `mint_version`, which requires a `workspace_id` the shapes graph does not have.

## Consequences

- A future reviewer grepping for "who writes to `urn:weave:g:tenant:{id}:shapes`" finds exactly one
  answer: `commit_tenant_shape`. A unit test asserts this directly (see
  `test_governance_shapes.py`).
- If a second kind of tenant-wide, non-workspace-versioned graph is ever needed (post-v1), this
  module is the pattern to copy, not `pipeline.py`.
