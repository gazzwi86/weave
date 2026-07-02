---
type: Task
title: "Task: TASK-006 — Authoring Surfaces — Chat Panel and Guided Forms"
description: "Persistent chat panel, SHACL-driven guided forms, and AI proposal explanations."
tags: [constitution-engine, arch, task, milestone-M1]
timestamp: 2026-07-01T00:00:00Z
status: Backlog
priority: Must Have
entity: constitution-engine
epic: EPIC-011
milestone: M1
created: 2026-07-01
blocked_by: ["TASK-003", "TASK-004", "TASK-005"]
unlocks: []
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

As a business modeller with no ontology expertise, I need a persistent conversational
interface and structured guided forms that let me author and refine the knowledge graph in
plain language or point-and-click — so that modelling is not gated on specialist knowledge.

## Scope

Covers EPIC-011 stories E11-S1 (persistent chat panel), E11-S2 (SHACL-driven guided
forms), and E11-S3 (AI explains AI proposals). E11-S4 (real-time multi-user collab) is
Phase 4 and is out of scope for M1.

## Acceptance Criteria

### E11-S1 — Persistent Chat Panel

| ID | Criterion (EARS) |
|---|---|
| AC-006-01 | WHEN a modeller opens the Constitution Engine workspace, THE SYSTEM SHALL display a persistent chat panel alongside the graph view with conversation history scoped to the session. |
| AC-006-02 | WHEN a modeller sends a message in the chat panel, THE SYSTEM SHALL interpret it as an ontology or instance authoring intent, generate a CE-WRITE-1 operation batch, and ask for confirmation before committing. |
| AC-006-03 | WHEN the modeller confirms a proposed change in chat, THE SYSTEM SHALL dispatch to CE-WRITE-1 and display the result (success with entity IRI, or SHACL violation message) inline in the chat thread. |
| AC-006-04 | WHEN the modeller says "undo" or "revert that", THE SYSTEM SHALL identify the most recent draft mutation in the session and propose an inverse operation batch for confirmation. |
| AC-006-05 | WHEN the chat panel is reopened after a page reload, THE SYSTEM SHALL restore conversation history from the session store (in-browser persistence; server-side history is Phase 2). |
| AC-006-06 | WHEN the AI's NL interpretation of a message is ambiguous, THE SYSTEM SHALL ask a clarifying question rather than guessing. |

### E11-S2 — SHACL-Driven Guided Forms

| ID | Criterion (EARS) |
|---|---|
| AC-006-07 | WHEN a modeller selects "Add entity" or "Edit entity", THE SYSTEM SHALL render a form whose fields are derived from the SHACL shape for the selected BPMO kind, fetched via CE-READ-1. |
| AC-006-08 | WHEN a required field (sh:minCount 1) is left empty on form submit, THE SYSTEM SHALL highlight the field and display the SHACL constraint label before dispatching. |
| AC-006-09 | WHEN a form is submitted successfully, THE SYSTEM SHALL display the committed entity IRI and offer a "View in graph" link. |
| AC-006-10 | WHEN a form submission returns a SHACL violation (422), THE SYSTEM SHALL map the violation focus_node and path back to the form field and display the message next to the field. |
| AC-006-11 | WHEN the SHACL shapes for a kind change (e.g., after an ontology update), THE SYSTEM SHALL re-fetch the shape and regenerate the form on the next form open (no stale cached forms). |

### E11-S3 — AI Explains AI Proposals

| ID | Criterion (EARS) |
|---|---|
| AC-006-12 | WHEN the AI proposes a CE-WRITE-1 operation batch in the chat panel, THE SYSTEM SHALL accompany the proposal with a plain-language explanation of each operation (what it will add/change/remove). |
| AC-006-13 | WHEN the modeller asks "Why?" after a proposal, THE SYSTEM SHALL explain the reasoning: what in the conversation prompted the proposal and which BPMO kind/relationship was selected. |
| AC-006-14 | WHEN the modeller asks "What are the consequences?", THE SYSTEM SHALL describe the downstream impact: which existing relationships would be affected and whether any SHACL constraints are near-limit. |
| AC-006-15 | WHEN the AI explanation references an entity IRI, THE SYSTEM SHALL render the IRI as a clickable link to `GET /api/ontology/resource/{iri}`. |

## API Contracts

All mutations dispatched via **CE-WRITE-1** (`POST /api/operations/apply`).
Form shape data fetched via **CE-READ-1** (`GET /api/ontology/types`,
`GET /api/ontology/resource/{iri}`).
See [contracts.md](../../../../contracts.md).

## Diagram

```mermaid
flowchart TD
    Chat[Chat Panel<br/>E11-S1] --> NLparse[claude-sonnet-5<br/>NL→operation batch]
    Chat --> explain[AI Explanation<br/>E11-S3]
    Form[Guided Form<br/>E11-S2] --> validate[Client-side SHACL field validation]
    NLparse --> confirm{Modeller confirmation}
    validate --> confirm
    confirm -->|Confirmed| write1[CE-WRITE-1<br/>POST /api/operations/apply]
    confirm -->|Rejected| Chat
    write1 -->|201| ChatResult[IRI + confirmation in chat]
    write1 -->|422| violations[Violations mapped to form fields / chat message]
    explain --> read1[CE-READ-1<br/>GET /api/ontology/resource/{iri}]
```

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Confirm before commit in chat | The modeller must see the operation before it hits the graph; this prevents unwanted mutations from ambiguous NL. | engine spec E11-S1 ACs |
| SHACL-driven forms (not hard-coded per kind) | The form is a live projection of the SHACL shape; when shapes evolve, forms evolve automatically. | engine spec E11-S2, FR-003 |
| AI explanation accompanies every proposal | Business users cannot read operation JSON; the explanation is the human interface to the mutation batch. | engine spec E11-S3 |
| Undo = inverse operation batch (not git-style rollback) | The graph may have subsequent mutations; reverting to a snapshot would overwrite them. An inverse operation is minimal and targeted. | engine spec E11-S1 |
| In-browser chat history for M1 | Server-side history requires additional storage and auth scope; deferred to Phase 2 to stay lean. | engine spec E11-S1 scope |
| Ambiguity → clarifying question, never guess | Guessing on ambiguous intent risks incorrect graph mutations; the safety default is to ask. | engine spec E11-S1 ACs |

## Test Requirements

| Layer | Scenario | AC |
|---|---|---|
| Unit | NL parser produces correct `add_node` for "Add a Process called X" | AC-006-02 |
| Unit | Inverse operation batch correctly negates a prior `add_node` (undo) | AC-006-04 |
| Unit | Form fields derived from SHACL shape match expected field list | AC-006-07 |
| Unit | Required field validation blocks submit | AC-006-08 |
| Unit | 422 violation mapped back to form field by focus_node+path | AC-006-10 |
| Integration | Chat → confirm → CE-WRITE-1 → 201 → IRI displayed in chat | AC-006-03 |
| Integration | Chat → CE-WRITE-1 → 422 → violation message in chat thread | AC-006-03 |
| Integration | Form re-fetches shape after ontology update (cache invalidation) | AC-006-11 |
| Integration | AI explanation references entity IRI as clickable link | AC-006-15 |
| E2E | Modeller types "add a Process called Customer Onboarding" → confirm → entity in graph | AC-006-02, AC-006-03 |
| E2E | Modeller says "undo" → inverse batch proposed → confirmed → entity removed | AC-006-04 |
| E2E | Modeller opens guided form for Process → fields match Process SHACL shape | AC-006-07 |
| E2E | Modeller submits form with empty required field → field highlighted, no commit | AC-006-08 |

## Dependencies

- **blocked_by**: TASK-003 (CE-READ-1 for shape data and entity lookups; CE-WRITE-1 for
  mutations), TASK-004 (ontology classes must exist for NL to resolve kind references),
  TASK-005 (instance browse/edit flows are wired through these surfaces)
- **unlocks**: nothing — this is the terminal M1 frontend task

## Cost Estimate

**XL** — three distinct surface modes (chat, forms, explanations) each with their own
state, LLM integration, and error-path UI. The largest frontend task in M1.

## DoR Checklist

- [ ] TASK-003, TASK-004, TASK-005 complete (API surface stable)
- [ ] Design mockups for chat panel, guided form, and explanation panel reviewed
- [ ] claude-sonnet-5 prompt template for NL→operation-batch agreed and tested offline
- [ ] Undo semantics confirmed (inverse operation batch, not snapshot revert)
- [ ] In-browser session history format agreed (localStorage schema)

## DoD Checklist

- [ ] All ACs pass (unit + integration + E2E)
- [ ] Chat panel handles CE-WRITE-1 201 and 422 without unhandled exceptions
- [ ] SHACL-driven form tested with all 13 BPMO kinds
- [ ] AI explanation shown for every proposal (not only complex ones)
- [ ] Undo tested: inverse batch correctly reverts the most recent session mutation
- [ ] Ambiguity detection tested: at least 3 intentionally vague prompts trigger clarifying question
- [ ] Chat history survives page reload (localStorage verified in E2E)
- [ ] No PII or user message content sent to external services beyond the Anthropic API call
- [ ] SHACL form cache invalidation tested: form field list updates after ontology change

## Implementation Hints

**Chat state machine**: track a per-session state of `{pending_operations: [Op] | null,
conversation_history: [Message]}`. The confirm/reject UI toggles `pending_operations`
between proposed and null. Do not dispatch to CE-WRITE-1 until the user confirms.

**SHACL form generation**: query the SHACL shapes graph via `GET /api/sparql` for the
selected kind's `sh:NodeShape`. Map each `sh:property` to a form field. Cache by kind IRI
with a session-level cache key derived from the latest version IRI — stale when version
changes.

**Explanation generation**: the explanation LLM call receives the operation batch as
structured JSON + the current graph context (classes and relationships around the
affected IRI). It must NOT receive the full graph — compress to the 3-hop neighbourhood
of the affected IRI using CE-READ-1 before injecting into the prompt.

**Undo semantics**: the inverse of `add_node` is `delete_node`; the inverse of `update_node`
is a second `update_node` with the pre-edit values (retrieved from CE-READ-1 before the
original edit). The inverse of `delete_node` is `add_node` + restore all edges. Store the
pre-edit snapshot in the session state alongside each operation for exact inversion.
