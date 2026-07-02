---
type: Task
title: "Task: TASK-004 — Ontology Modelling via Chat and Forms"
description: "Enable NL+form authoring of BPMO classes, property restrictions, and model imports."
tags: [constitution-engine, arch, task, milestone-M1]
timestamp: 2026-07-01T00:00:00Z
status: Backlog
priority: Must Have
entity: constitution-engine
epic: EPIC-001
milestone: M1
created: 2026-07-01
blocked_by: ["TASK-001", "TASK-002", "TASK-003"]
unlocks: ["TASK-005", "TASK-006"]
adr_refs: []
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

As an enterprise architect, I need to define and refine my company's ontology using plain
language or SHACL-driven forms — so that business colleagues (not ontologists) can
participate in modelling and the resulting graph is both machine-readable and explainable.

## Scope

Covers EPIC-001 stories E1-S1 (define class), E1-S2 (property restrictions and
disjointness), and E1-S3 (import and refine external model). E1-S4 (OWL DL reasoner
integration) is Phase 4 and is out of scope here.

## Acceptance Criteria

### E1-S1 — Define a Class

| ID | Criterion (EARS) |
|---|---|
| AC-004-01 | WHEN a modeller describes a new class in natural language (e.g., "Add a Process called Customer Onboarding"), THE SYSTEM SHALL parse the intent, create an `owl:Class` + `skos:Concept` (punned resource, decision B1) in the draft graph via CE-WRITE-1, and confirm the IRI and label to the user. |
| AC-004-02 | WHEN a modeller creates a class, THE SYSTEM SHALL enforce BPMO kind membership (Process, Activity, Event, DataAsset, Field, System, Service, BusinessCapability, BusinessDomain, Policy, Goal, Actor, Concept, Class); no kind outside the 13 BPMO kinds is accepted. |
| AC-004-03 | WHEN a class definition violates SHACL (e.g., missing required label), THE SYSTEM SHALL present the violation message to the modeller in plain language and not commit the change. |
| AC-004-04 | WHEN a class is successfully created, THE SYSTEM SHALL assign a deterministic, tenant-scoped IRI derived from the kind and normalised label. |
| AC-004-05 | WHEN a modeller creates a class via the guided form, THE SYSTEM SHALL pre-populate available BPMO kind options from `GET /api/ontology/types` (CE-READ-1). |

### E1-S2 — Property Restrictions and Disjointness

| ID | Criterion (EARS) |
|---|---|
| AC-004-06 | WHEN a modeller states "Process cannot have zero Activities", THE SYSTEM SHALL translate this to an `owl:minCardinality 1` restriction on the `weave:hasActivity` property for `weave:Process` and commit via CE-WRITE-1. |
| AC-004-07 | WHEN a modeller states "A Process and a DataAsset cannot be the same thing", THE SYSTEM SHALL assert `owl:disjointWith` between the two classes and commit via CE-WRITE-1. |
| AC-004-08 | WHEN a property restriction conflicts with an existing restriction (e.g., min > max), THE SYSTEM SHALL surface the conflict before attempting commit and ask the modeller to resolve. |
| AC-004-09 | WHEN a SHACL-driven form is used to add a restriction, THE SYSTEM SHALL generate the restriction form dynamically from the SHACL shape for the selected property type. |

### E1-S3 — Import and Refine External Model

| ID | Criterion (EARS) |
|---|---|
| AC-004-10 | WHEN a modeller uploads a Turtle (.ttl) or OWL/XML file, THE SYSTEM SHALL parse it, validate BPMO kind coverage (warn on unknown kinds), and stage it as a draft import batch via CE-WRITE-1. |
| AC-004-11 | WHEN an imported model contains class IRIs that collide with existing tenant classes, THE SYSTEM SHALL present the collision list and ask whether to skip, merge, or overwrite — never silently resolve collisions. |
| AC-004-12 | WHEN the import batch passes SHACL validation, THE SYSTEM SHALL commit the draft and report the count of added classes, properties, and relationships. |
| AC-004-13 | WHEN a modeller refines an imported class (adds label, description, or sub-class), THE SYSTEM SHALL use partial-update semantics (CE-WRITE-1 `update_node`) to preserve the original import triples. |

## API Contracts

Authoring uses **CE-WRITE-1** (`POST /api/operations/apply`) for all mutations.
Type catalogue fetched via **CE-READ-1** (`GET /api/ontology/types`).
See [contracts.md](../../../../contracts.md).

## Diagram

```mermaid
flowchart LR
    NL[Natural Language Input] --> LLM[claude-sonnet-5<br/>NL→operations parser]
    Form[SHACL-Driven Form] --> ops[Operation batch<br/>add_node / update_node / add_edge]
    File[Turtle / OWL file upload] --> parser[Turtle parser + BPMO validator]
    LLM --> ops
    parser --> ops
    ops --> write1[CE-WRITE-1<br/>POST /api/operations/apply<br/>→ TASK-001 SHACL pipeline]
    write1 -->|201| draft[(Draft Graph)]
    write1 -->|422| violations[Violations surfaced to user]
    draft --> publish[POST /api/ontology/versions/{iri}/publish<br/>→ Published version]
```

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Punned resources (owl:Class + skos:Concept at same IRI) | Single URI for both class semantics and concept labelling; SHACL runs `inference='none'` so no OWL/SHACL conflict. | engine spec decision B1 |
| BPMO 13-kind constraint enforced at ingestion, not only SHACL | Kind membership is a platform-level constraint; earlier rejection = better UX than SHACL 422. | engine spec §BPMO framework |
| NL parsing uses claude-sonnet-5 to produce operation batches | Sonnet produces structured operation JSON from intent; model is swappable. | CLAUDE.md stack |
| Deterministic IRIs from kind + normalised label | Prevents duplicate IRIs for same concept; makes import idempotent. | engine spec E1-S1 ACs |
| Import collision → HITL resolution, never silent | Silent resolution hides data quality problems; the modeller must own the decision. | engine spec E1-S3 ACs |
| OWL restrictions authored as OWL 2 DL (not SHACL constraints) | Property restrictions are class-level semantics → OWL; data quality rules → SHACL. Polikoff rule. | engine spec decision B3 |

## Test Requirements

| Layer | Scenario | AC |
|---|---|---|
| Unit | BPMO kind constraint: class outside 13 kinds rejected before CE-WRITE-1 call | AC-004-02 |
| Unit | Deterministic IRI generation for kind+label pair (idempotent) | AC-004-04 |
| Unit | OWL minCardinality restriction correctly translated from NL intent | AC-004-06 |
| Unit | Collision detection on import: duplicate IRI flagged with details | AC-004-11 |
| Integration | NL → `add_node` operation → committed draft class (happy path) | AC-004-01 |
| Integration | SHACL violation on missing label → 422 surfaced to user, no commit | AC-004-03 |
| Integration | `owl:disjointWith` asserted and queryable via SPARQL | AC-004-07 |
| Integration | Turtle import → validated → draft batch committed | AC-004-10, AC-004-12 |
| Integration | Partial-update on imported class preserves original import triples | AC-004-13 |
| E2E | Modeller types "Add a Process called Customer Onboarding" → class appears in graph | AC-004-01 |
| E2E | Modeller uploads hammerbarn.ttl seed file → classes imported, count reported | AC-004-12 |

## Dependencies

- **blocked_by**: TASK-001 (SHACL validation pipeline), TASK-002 (provenance/versioning),
  TASK-003 (CE-READ-1 types catalogue + CE-WRITE-1 public interface)
- **unlocks**: TASK-005 (instances require classes to exist), TASK-006 (authoring surfaces
  implement the NL+form UX that calls this task's backend)

## Cost Estimate

**L** — three distinct authoring paths (NL parsing, SHACL forms, file import) each with
their own error handling; NL parsing introduces LLM latency requirements.

## DoR Checklist

- [ ] TASK-001, TASK-002, TASK-003 complete
- [ ] BPMO 13-kind list and SHACL shapes committed to repo
- [ ] claude-sonnet-5 integration pattern agreed (prompt template, structured output schema)
- [ ] Turtle parser library selected (rdflib or equivalent)
- [ ] Hammerbarn seed dataset available for E2E test

## DoD Checklist

- [ ] All ACs pass (unit + integration + E2E)
- [ ] Hammerbarn seed dataset fully importable via Turtle upload
- [ ] BPMO kind guard tested with 13 valid kinds and at least 5 invalid kind names
- [ ] NL parser output validated against CE-WRITE-1 operation schema before dispatch
- [ ] OWL restrictions queryable via SPARQL from published graph
- [ ] Import collision flow tested (HITL path, skip path, overwrite path)
- [ ] All NL→operation prompts reviewed for PII risk (user input must not be logged)

## Implementation Hints

**NL parsing strategy**: claude-sonnet-5 should produce a structured `{operations: [Op]}`
JSON object matching the CE-WRITE-1 request schema. Prompt must include the BPMO kind list
and the existing class IRIs (from CE-READ-1 types) so the model can resolve references
("add Activity to the Customer Onboarding process" requires knowing that process IRI).

**Import pipeline**: parse Turtle to an in-memory RDF graph, then translate each class to
an `add_node` operation and each property to an `add_edge` operation. Do not call
`POST /api/operations/apply` per triple — batch all operations into one request per BPMO
kind group to stay within idempotency-key scope.

**IRI determinism**: normalise the label (lowercase, strip punctuation, replace spaces with
hyphens), prefix with `{tenant_iri}/{kind}/`, and encode. Verify uniqueness against CE-READ-1
before dispatch; if colliding, surface to user rather than appending a counter.
