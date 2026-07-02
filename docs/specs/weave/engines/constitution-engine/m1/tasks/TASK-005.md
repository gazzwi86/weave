---
type: Task
title: "Task: TASK-005 — Instance Data Population"
description: "Add, edit, delete, and browse entity instances against the committed ontology."
tags: [constitution-engine, arch, task, milestone-M1]
timestamp: 2026-07-01T00:00:00Z
status: Backlog
priority: Must Have
entity: constitution-engine
epic: EPIC-002
milestone: M1
created: 2026-07-01
blocked_by: ["TASK-003", "TASK-004"]
unlocks: ["TASK-006"]
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

As a business analyst, I need to add, edit, and delete instances of the company's business
concepts (processes, systems, people, data assets) in the knowledge graph — using forms or
plain language — so that the graph reflects the real operational state of the business.

## Scope

Covers EPIC-002 stories E2-S1 (add entity), E2-S2 (edit/delete with partial-update),
and E2-S4 (browse and search instances). E2-S3 (bulk-populate) is Phase 4 and is out
of scope for M1.

## Acceptance Criteria

### E2-S1 — Add an Entity

| ID | Criterion (EARS) |
|---|---|
| AC-005-01 | WHEN a user provides entity details (kind, label, description, and properties), THE SYSTEM SHALL create an `add_node` operation and submit it via CE-WRITE-1, returning the new entity IRI on success. |
| AC-005-02 | WHEN the entity kind is not in the BPMO 13-kind list, THE SYSTEM SHALL reject with a clear error before dispatching to CE-WRITE-1. |
| AC-005-03 | WHEN the submitted entity violates SHACL shapes (e.g., missing required property), THE SYSTEM SHALL surface the violation message in plain language with the field name highlighted. |
| AC-005-04 | WHEN an entity with the same case-insensitive label and kind already exists in the tenant graph, THE SYSTEM SHALL surface the existing entity IRI and ask whether to edit it instead. |
| AC-005-05 | WHEN adding an entity via the guided form, THE SYSTEM SHALL derive the property fields dynamically from the SHACL shape for the selected kind (via CE-READ-1). |

### E2-S2 — Edit and Delete

| ID | Criterion (EARS) |
|---|---|
| AC-005-06 | WHEN a user edits named properties of an existing entity, THE SYSTEM SHALL submit an `update_node` operation via CE-WRITE-1 using partial-update semantics; unnamed properties are preserved. |
| AC-005-07 | WHEN a user deletes an entity, THE SYSTEM SHALL submit a `delete_node` operation via CE-WRITE-1 and confirm deletion of dependent edges (outgoing and incoming). |
| AC-005-08 | WHEN a `delete_node` operation would leave a required relationship dangling (an entity that `sh:minCount 1` requires a related entity), THE SYSTEM SHALL return a 422 with the SHACL violation and not commit. |
| AC-005-09 | WHEN a user edits an entity, THE SYSTEM SHALL show current property values pre-populated from `GET /api/ontology/resource/{iri}` (CE-READ-1). |
| AC-005-10 | WHEN a user deletes an entity that is referenced by a published version, THE SYSTEM SHALL warn that deletion will be visible in the diff of the next publish and require explicit confirmation. |

### E2-S4 — Browse and Search

| ID | Criterion (EARS) |
|---|---|
| AC-005-11 | WHEN a user browses entities by kind, THE SYSTEM SHALL return a paginated list of matching entities from the draft graph, ordered by label. |
| AC-005-12 | WHEN a user searches by keyword, THE SYSTEM SHALL return entities where label, description, or any string property contains the keyword (case-insensitive), with kind and IRI. |
| AC-005-13 | WHEN a search returns more than 50 results, THE SYSTEM SHALL paginate and return the first page with a `next_page` cursor. |
| AC-005-14 | WHEN the user filters by kind AND keyword, THE SYSTEM SHALL AND both predicates in the query. |

## API Contracts

Instance mutations use **CE-WRITE-1** (`POST /api/operations/apply`).
Property pre-population and browse queries use **CE-READ-1** (`GET /api/ontology/resource/{iri}`,
`GET /api/sparql`). See [contracts.md](../../../../contracts.md).

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Instance mutations use same CE-WRITE-1 pipeline as ontology mutations | Single validated entry point; instances and classes share the same SHACL validation. | engine spec E2, CE-WRITE-1 |
| Partial-update semantics on edit | Prevents overwriting metadata fields (position, colour, annotations) the editor did not touch. | engine spec decision B2 |
| Browse queries via `GET /api/sparql` (SELECT-only) | Reuses the CE-READ-1 SPARQL surface; no separate browse endpoint needed. | engine spec CE-READ-1 |
| SHACL-driven form fields for instances | SHACL shapes define which properties are required, optional, and their types; the form is generated from the shape, not hard-coded. | engine spec E2-S1, E11-S2 |
| Delete warns on published-version reference | Immutable published versions remain queryable; the warning informs the user their deletion will be diff-visible. | engine spec decision versioning |
| Duplicate detection → HITL (edit-instead offer), not auto-merge | Auto-merge can silently corrupt instance data; the user must decide. | engine spec E2-S1 ACs |

## Test Requirements

| Layer | Scenario | AC |
|---|---|---|
| Unit | BPMO kind guard rejects instance kind outside 13 kinds | AC-005-02 |
| Unit | Partial-update preserves unmutated properties | AC-005-06 |
| Unit | Delete cascade: outgoing+incoming edges listed in confirm payload | AC-005-07 |
| Unit | Browse pagination: cursor-based, ordered by label | AC-005-11, AC-005-13 |
| Integration | Add entity → committed to draft graph → IRI returned | AC-005-01 |
| Integration | SHACL violation on add (missing required property) → 422 with field name | AC-005-03 |
| Integration | Duplicate label+kind → surfaces existing IRI | AC-005-04 |
| Integration | Pre-populate edit form from `GET /api/ontology/resource/{iri}` | AC-005-09 |
| Integration | Delete entity with SHACL-required edge → 422 | AC-005-08 |
| Integration | Keyword search: case-insensitive match on label + description | AC-005-12 |
| Integration | Kind + keyword filter: both predicates applied | AC-005-14 |
| E2E | Business analyst adds "Customer Onboarding" process instance → appears in browse | AC-005-01, AC-005-11 |
| E2E | Business analyst edits description of existing instance → change committed | AC-005-06 |
| E2E | Business analyst deletes instance with a SHACL-required relation → blocked with message | AC-005-08 |

## Dependencies

- **blocked_by**: TASK-003 (CE-READ-1/CE-WRITE-1 interfaces), TASK-004 (classes must exist
  before instances of those classes can be added)
- **unlocks**: TASK-006 (authoring surfaces expose the add/edit/browse flows defined here)

## Cost Estimate

**M** — three stories but each is narrowly scoped; the hardest path is delete cascade
validation and SHACL-driven form generation.

## DoR Checklist

- [ ] TASK-003 and TASK-004 complete
- [ ] SHACL shapes for all 13 BPMO kinds committed and tested
- [ ] Hammerbarn seed dataset available for browse/search E2E tests
- [ ] Browse/search page size agreed (50 per page, cursor-based)
- [ ] Delete cascade behaviour agreed (edges auto-deleted or HITL)

## DoD Checklist

- [ ] All ACs pass (unit + integration + E2E)
- [ ] Hammerbarn instances fully addable and browsable via API
- [ ] Partial-update verified: edit of one field does not alter unrelated fields
- [ ] Browse and search tested with >50-result datasets (pagination verified)
- [ ] SHACL violation messages mapped to human-readable field names (not raw IRI paths)
- [ ] Delete confirm payload lists all dependent edges before user confirms
- [ ] No PII in log output (entity labels may contain personal names)

## Implementation Hints

**Browse query pattern**: use SPARQL SELECT with `?kind`, `?label`, `?iri` against the
draft graph. Filter by `rdf:type` for kind, `CONTAINS(lcase(?label), lcase(?keyword))` for
keyword. Paginate with `LIMIT 50 OFFSET n` and derive the cursor from the offset.

**Delete cascade**: before dispatching `delete_node`, issue a CE-READ-1 query for all
triples where the target IRI appears as subject or object. Present the list to the user.
Then, in the `delete_node` operation batch, include `delete_edge` operations for each
dependent edge — do not rely on the store's implicit cascade.

**SHACL form generation**: call `GET /api/ontology/types` to get the kind, then derive the
property fields from the SHACL shapes graph (the shapes are already loaded for validation).
Map `sh:datatype` to form field type, `sh:minCount` to required, `sh:maxLength` to input
constraint. Cache the shape-to-form mapping per kind to avoid re-querying on every form open.
