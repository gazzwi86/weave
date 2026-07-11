---
type: Decision
title: "ADR-023: Tenant governance shapes graph is tenant-wide, not per-workspace"
description: >-
  CE-TASK-005's tenant shapes graph (urn:weave:g:tenant:{id}:shapes) deliberately omits the
  :ws:{workspace_id} segment that ADR-001's data-graph naming uses. A compliance rule ("every
  Process must name an owner") is an organisation-wide obligation, not a per-workspace one, so the
  shapes graph is keyed one level coarser than the data graphs it validates.
tags: [decision, adr, constitution-engine, rdf, multi-tenancy, governance, task-005, m2]
status: Accepted
timestamp: 2026-07-11T00:00:00Z
resource: docs/specs/weave/engines/constitution-engine/decisions/ADR-023-tenant-shapes-graph-naming.md
source: hand-authored
confirmed_by: none
confirmed_on: null
last_verified_sha: null
expires_on: 2027-01-11
owner: gazzwi86
coverage: constitution-engine
---

# ADR-023: tenant governance shapes graph is tenant-wide, not per-workspace

## Status

**Accepted** — 2026-07-11.

## Context

ADR-001 settled CE's data-graph naming as domain/workspace-granular:
`urn:weave:tenant:{tenant_id}:domain:{domain_id}` (one graph per workspace's working data). TASK-005
(tenant-scoped governance shapes, EPIC-005) adds a second kind of tenant-owned graph — the
compliance officer's authored SHACL shapes — and m2-delta.md §2 pins its IRI as
`urn:weave:g:tenant:{id}:shapes`, with **no workspace segment**.

This is a deliberate divergence from ADR-001's per-workspace pattern, not an oversight: a
governance rule ("every Process must name an owner") is scoped to the whole tenant (the whole
company), the same way a legal or regulatory obligation applies across every team and workspace a
tenant runs, not to one workspace's data in isolation. A tenant with three workspaces (three
`:domain:{id}` data graphs) has exactly one shapes graph, enforced against all three at validation
time (`operations/shacl.py`'s `validate_graph_for_tenant`, which loads framework shapes ∪ this one
tenant-wide shapes graph — never another tenant's, per ADR-001's fail-closed scoping extended to
shapes).

## Decision

The tenant governance shapes graph IRI is `urn:weave:g:tenant:{id}:shapes` — tenant-granular,
sibling to (not nested under) the workspace-granular data graphs ADR-001 defines. Isolation is
still fail-closed at the tenant boundary: tenant A's shapes graph is never read while validating
tenant B's data (`operations/shacl.py:_tenant_shapes_graph`, `tenant_shapes_graph_iri`), exercised
by the cross-tenant shape-leak test (`test_operations_shacl_tenant.py::test_cross_tenant_shape_leak_is_impossible`).

## Alternatives considered

- **Per-workspace shapes graph** (`urn:weave:g:tenant:{id}:ws:{ws}:shapes`), mirroring ADR-001's
  data-graph pattern exactly. Rejected: would require a compliance officer to author the same rule
  once per workspace, and a shape committed in workspace A would silently not apply to workspace
  B's data — directly contradicting FR-025's "applies on the very next commit" for the whole
  tenant, and inviting exactly the kind of policy drift governance rules exist to prevent.

## Consequences

- `ApplyContext` (CE-WRITE-1's workspace-scoped mutation context) does not carry enough
  information to address the shapes graph directly — it is keyed to one workspace's data graph.
  How the shapes graph is actually written is a separate decision (see ADR-024).
