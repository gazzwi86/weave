---
type: Task
title: "Task: TASK-003 — CE-READ-1 and CE-WRITE-1 Stable Interface Layer"
description: "Expose the validated graph and query surface as stable, versioned public contracts."
tags: [constitution-engine, arch, task, milestone-M1]
timestamp: 2026-07-01T00:00:00Z
status: Backlog
priority: Must Have
entity: constitution-engine
epic: EPIC-010
milestone: M1
created: 2026-07-01
blocked_by: ["TASK-001", "TASK-002"]
unlocks: ["TASK-004", "TASK-005", "TASK-006", "TASK-007"]
adr_refs: [ADR-001]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: e6499f88873d7157bed76c3632ce25e2f5fb6d4b
expires_on: 2026-12-28
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [constitution-engine.md](../../../constitution-engine.md)
Contracts: [contracts.md](../../../../contracts.md)

## Story

As an internal engine (Build, Events, Graph Explorer) or an authorised external consumer,
I need stable, versioned read and write interfaces to the Constitution Engine, so that my
integration does not break when the CE's internal implementation changes.

## Scope Note

This task adds the **public contract face** for CE-READ-1 and CE-WRITE-1. It does not
re-implement the SHACL validation pipeline (TASK-001) or provenance/versioning (TASK-002).
It wires those implementations behind the stable contracts, adds the SELECT-only SPARQL
sanitiser, the shared query middleware, and the cross-tenant isolation guard that all
read endpoints share.

## Acceptance Criteria

### E10-S1 — CE-READ-1 Read Interface

| ID | Criterion (EARS) |
|---|---|
| AC-003-01 | WHEN `GET /api/ontology/types` is called with a valid JWT, THE SYSTEM SHALL return the full BPMO kind catalogue for the tenant, including label, IRI, and property shape summary. |
| AC-003-02 | WHEN `GET /api/ontology/resource/{iri}` is called with a valid IRI, THE SYSTEM SHALL return the resource's triples, kind, label, version IRI, and outgoing/incoming edges. |
| AC-003-03 | WHEN `GET /api/ontology/versions` is called, THE SYSTEM SHALL return a paginated list of published versions (newest-first) for the tenant; draft versions are excluded unless the caller has `author` level or higher (SSOT: rbac-multi-tenancy.md). |
| AC-003-04 | WHEN `GET /api/sparql?query={sparql}&version={iri|latest}&page={n}` is called with a SELECT-only query, THE SYSTEM SHALL return paginated results at most 1000 rows per page. |
| AC-003-05 | WHEN a SPARQL request contains UPDATE, INSERT, DELETE, or SERVICE clauses, THE SYSTEM SHALL reject it with `400 {error:"prohibited_clause", clause:"<name>"}`. |
| AC-003-06 | WHEN a SPARQL request contains a `SERVICE` keyword (SSRF vector), THE SYSTEM SHALL reject it with `400 {error:"service_blocked"}`. |
| AC-003-07 | WHEN any read endpoint is called without a valid JWT, THE SYSTEM SHALL return `401`. |
| AC-003-08 | WHEN any read endpoint is called with a JWT from tenant A, THE SYSTEM SHALL query only tenant A's named graphs; cross-tenant data is never returned. |
| AC-003-09 | WHEN a read request specifies `?version={iri}` that does not exist in the tenant's version history, THE SYSTEM SHALL return `404`. |
| AC-003-10 | WHEN a SPARQL result set exceeds 1000 rows, THE SYSTEM SHALL return the first page and include `Link: <next_page_url>; rel="next"` in the response header. |

### E10-S2 — CE-WRITE-1 Write Interface

| ID | Criterion (EARS) |
|---|---|
| AC-003-11 | WHEN `POST /api/operations/apply` is called with a valid payload, THE SYSTEM SHALL route the request to the validated mutation pipeline (TASK-001) and return its response unchanged. |
| AC-003-12 | WHEN a WRITE request arrives from another Weave engine using a service-account JWT, THE SYSTEM SHALL accept it if the service account has write scope for the tenant. |
| AC-003-13 | WHEN the `target` field in a write request is `"draft"`, THE SYSTEM SHALL apply operations to the current draft; when `target` is a version IRI, THE SYSTEM SHALL reject if that version is published. |

### Cross-cutting

| ID | Criterion (EARS) |
|---|---|
| AC-003-14 | WHEN any contract endpoint returns a response, THE SYSTEM SHALL include `X-CE-Version: {ce_api_version}` and `X-Tenant-ID: {tenant_id}` headers. |
| AC-003-15 | WHEN CE-EVENT-1 polling fallback is used (transport TBD), THE SYSTEM SHALL support `GET /api/sparql?since_version={iri}` to return changes since a pinned version. |

## API Contracts

Implements **CE-READ-1** and **CE-WRITE-1**. References **CE-EVENT-1** (polling fallback).
See [contracts.md](../../../../contracts.md) — do not restate shapes.

## Diagram

```mermaid
graph TD
    subgraph CE Public Interface Layer
        R1[CE-READ-1<br/>GET /api/ontology/types<br/>GET /api/ontology/resource/{iri}<br/>GET /api/ontology/versions<br/>GET /api/sparql]
        W1[CE-WRITE-1<br/>POST /api/operations/apply]
        sanitiser[SELECT-only SPARQL sanitiser<br/>+ SERVICE block]
        auth[JWT auth + RBAC middleware<br/>cross-tenant isolation]
    end

    R1 --> auth --> sanitiser
    W1 --> auth

    sanitiser --> graph[(Tenant Named Graph)]
    auth --> pipeline[SHACL Validation Pipeline<br/>TASK-001]
    pipeline --> graph
    pipeline --> prov[PROV-O + Version Store<br/>TASK-002]
    graph --> CE-EVENT-1[CE-EVENT-1<br/>polling fallback]

    BuildEngine --> R1
    BuildEngine --> W1
    EventsEngine --> R1
    GraphExplorer --> R1
```

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| CE-READ-1 and CE-WRITE-1 are the sole public faces | No other endpoint may expose graph data to external callers; internal paths (e.g., PROV-O queries) are not published as contracts. | engine spec E10, contracts.md |
| SELECT-only SPARQL with SERVICE block | Eliminates UPDATE/INSERT/DELETE mutations via SPARQL surface; SERVICE block prevents SSRF. | engine spec FR-023, contracts.md CE-READ-1 |
| No silent row cap on SPARQL | A silent cap would produce silently incomplete results; pagination with Link headers is explicit. | contracts.md CE-READ-1 |
| Interface layer delegates to TASK-001/002; does not re-implement | One implementation, two public faces; avoids drift between the contract shape and the actual behaviour. | engine spec E10 rationale |
| `X-CE-Version` header on all responses | Enables consumers to detect API version skew without parsing the response body. | engine spec NFR |
| CE-EVENT-1 transport deferred; polling via `since_version` ships M1 | Avoids over-engineering event transport before consumers exist; polling is sufficient for M1 demos. | engine spec E10-S1, contracts.md CE-EVENT-1 |

## Test Requirements

| Layer | Scenario | AC |
|---|---|---|
| Unit | SPARQL sanitiser blocks UPDATE, INSERT, DELETE, SERVICE | AC-003-05, AC-003-06 |
| Unit | Pagination: result set > 1000 rows emits `Link: rel=next` | AC-003-10 |
| Unit | `?version=latest` resolves to newest published version | AC-003-09 (negative: non-existent version) |
| Integration | `GET /api/ontology/types` returns BPMO kind catalogue for tenant | AC-003-01 |
| Integration | `GET /api/ontology/resource/{iri}` returns triples + edges | AC-003-02 |
| Integration | `GET /api/sparql` returns correct results for valid SELECT | AC-003-04 |
| Integration | `401` on unauthenticated requests to all read endpoints | AC-003-07 |
| Integration | Cross-tenant isolation: tenant A JWT returns only tenant A data | AC-003-08 |
| Integration | `404` on non-existent version IRI | AC-003-09 |
| Integration | Service-account JWT with write scope accepted on CE-WRITE-1 | AC-003-12 |
| Integration | Write to published version IRI rejected | AC-003-13 |
| E2E | Build Engine calls `GET /api/ontology/types` and receives BPMO catalogue | AC-003-01 |
| E2E | Graph Explorer calls `GET /api/sparql` with SELECT query and receives results | AC-003-04 |

## Dependencies

- **blocked_by**: TASK-001 (mutation pipeline must exist before CE-WRITE-1 can delegate to it),
  TASK-002 (version lifecycle must be in place before version-aware reads can work)
- **unlocks**: TASK-004, TASK-005, TASK-006 (all authoring surfaces call CE-READ-1/CE-WRITE-1),
  TASK-007 (NL query endpoint lives under CE-READ-1)

## Cost Estimate

**M** — primarily wiring and middleware; the hard logic lives in TASK-001 and TASK-002.
The SPARQL sanitiser and cross-tenant middleware need careful testing but are bounded in scope.

## DoR Checklist

- [ ] TASK-001 and TASK-002 complete (mutation pipeline + versioning functional)
- [ ] CE-READ-1 and CE-WRITE-1 contract shapes frozen in contracts.md
- [ ] SPARQL sanitiser approach agreed (AST-level parse vs. regex; prefer AST)
- [ ] OpenAPI 3.1 spec stub created for all CE-READ-1 endpoints
- [ ] Service-account JWT format confirmed with PLAT-IDENTITY-1

## DoD Checklist

- [ ] All ACs pass (unit + integration + E2E)
- [ ] SPARQL sanitiser tested against all prohibited clause types
- [ ] No raw SPARQL error messages leaked to external callers (map to API error shapes)
- [ ] OpenAPI schema validates against contracts.md shapes
- [ ] `X-CE-Version` header present on all responses (verified in integration tests)
- [ ] Cross-tenant isolation confirmed by integration test across two provisioned tenants
- [ ] No sensitive data (JWT payload, internal graph IRIs) logged at INFO level or above

## Implementation Hints

**SPARQL sanitiser**: parse the SPARQL string to an AST (e.g., with SPARQLWrapper or rdflib
query parser) before execution. Reject at AST-level, not regex — regex on SPARQL is unsafe.
Check query type (must be `SelectQuery`); walk the AST for `SERVICE` nodes.

**Cross-tenant isolation**: the middleware should inject the tenant's named-graph IRI as a
query-rewriting step before any SPARQL reaches Oxigraph. This is preferable to checking
post-execution — it prevents the query from even touching the wrong graph.

**`GET /api/ontology/resource/{iri}`**: IRI must be URL-encoded in the path; decode and
validate against the tenant's graph before querying. Return `404` for IRIs from other tenants,
not `403` — do not confirm existence of other tenants' resources.
