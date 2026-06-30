# Epic: EPIC-012 - Artefact & Document Ingest (Post-MVP, prioritized)

## Overview

**Phase:** Phase 3 — Cold-Start Ingest (Post-MVP, prioritized)
**PRD Reference:** [prd.md](../prd.md#epic-12-artefact--document-ingest-post-mvp-prioritized)
**Status:** Backlog
**Priority:** Should Have

## Description

The cold-start adoption lever for clients leaving Bizzdesign / LeanIX / MEGA: absorb the model they
already hold in documents, EA/BPMN tool exports, diagrams, and structured data so they populate the
graph from what they have instead of from a blank page. Every story writes through the **single**
validated mutation entry point (CE-WRITE-1) with PROV-O attribution and reuses the propose-mutations +
find-existing-node reconciliation flow — none introduces a second mutation path. This is user-supplied,
**materialised-copy** import, distinct from the platform's live managed connectors (PLAT-CONNECTOR-1).

## User Stories

| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK-001 | E12-S1 — Agent-driven conversational document ingest **[USER PRIORITY]** | Backlog | Must Have |
| TASK-002 | E12-S2 — Structured model import (ArchiMate Exchange Format + BPMN) | Backlog | Should Have |
| TASK-003 | E12-S3 — AI diagram / image-to-data | Backlog | Should Have |
| TASK-004 | E12-S4 — Structured-data import (R2RML + RML) | Backlog | Should Have |
| TASK-005 | E12-S5 — SKOS cross-notation reconciliation | Backlog | Should Have |

> All stories are **Post-MVP (prioritized)** — sequenced after the MVP authoring loop (Phases 1–2) but
> ahead of nice-to-haves. **E12-S1 is the `[USER PRIORITY]` Must-Have within this epic** (FR-038); the
> remaining stories (FR-039–FR-042) are Should Have and sequence behind it.

## Acceptance Criteria (Epic Level)

- [ ] **Every** ingest path (conversational, structured model, image, structured-data, reconciliation)
      writes **only** through CE-WRITE-1 — a CI test asserts no Epic-12 path bypasses prospective SHACL
      validation on a throwaway clone or introduces a second mutation entry point (PRD §10 risk).
- [ ] Every committed ingest carries a PROV-O activity attributing the **LLM/vision model as the
      extracting agent**, the **human as the approver**, and the **source artefact** as `prov:used`;
      no proposal is committed without per-proposal human accept/reject (human-in-the-loop is
      mandatory across all five stories).
- [ ] Re-mention of an entity that already exists reuses it via the find-existing-node reconciliation
      flow (same-label + same-kind) rather than duplicating — verified across the conversational,
      image, and cross-notation paths so the graph does not fragment into duplicates.
- [ ] Confidence/similarity gating holds end-to-end: extraction below the confidence threshold
      (default 0.6, tunable) is flagged for explicit review, never pre-selected for accept; a merge
      below the similarity threshold (default 0.85, tunable) is never auto-merged.
- [ ] Failure modes are non-destructive: AI/vision-provider-unavailable returns HTTP 503 with **no
      partial commit**; an `sh:Violation` returns 422 with the violation shown against the proposal and
      the graph unchanged; a malformed structured-model / mapping is rejected before any commit, leaving
      the store untouched; a partially-valid file commits only the valid elements and reports the skips.

## Dependencies

- **Blocked by:** **EPIC-006 / CE-WRITE-1** (the single clone-then-validate mutation entry point every
      ingest path must route through); **EPIC-009** (PROV-O attribution + the `prov:used` source link);
      **EPIC-011** (reuses the propose-mutations chat panel + find-existing-node reconciliation + guided
      forms); **EPIC-001/002/003** (a populated BPMO framework + glossary to link extracted entities
      against). Upstream: **PLAT-IDENTITY-1** (LLM/vision-model + human principal IRIs in PROV-O),
      **PLAT-AUDIT-1** (each ingest commit emits an audit event). MVP loop (Phases 1–2) must be complete.
- **Blocks:** nothing downstream gates on ingest — it is a cold-start adoption accelerator. It precedes
      the deferred should-haves / reasoning work only by roadmap sequencing, not by a hard dependency.

## Technical Notes

- **Materialised-copy, NOT query-time federation.** All imports (including E12-S4 R2RML/RML) write a
  materialised RDF copy through CE-WRITE-1; this is explicitly NOT a query-time SPARQL→SQL virtual
  graph (OQ-17, pending ADR) and is distinct from the platform's live connectors (Non-Goal #4 /
  PLAT-CONNECTOR-1).
- **Mapping basis as reference, not dependency:** the ArchiMate→RDF mapping (E12-S2) follows published
  prior art (**ArchiMEO** ontology / **archimate2rdf**) as a *reference*, not a tooling dependency;
  element-type→BPMO-kind mapping (BPMN task→Activity, BPMN event→Event, ArchiMate
  application-component→System/Service) is finalised in the CE data-model / ingest tech-spec note. The
  R2RML/RML mapping layer (authoring, storage, execution engine) is likewise detailed there.
- **Unmapped elements default to Concept (tunable)** and are listed for review, never silently dropped.
- **Event-log ingest** models observed-behaviour data (OCEL 2.0, OQ-14) as modellable data only — this
  epic builds **no** process-mining / discovery / conformance engine and no PQL (Non-Goal #10).
- **Cross-notation reconciliation (E12-S5)** collapses duplicates to **one punned `owl:Class` +
  `skos:Concept`** (decision B1 — no separate cross-notation linking property), reusing the same
  find-existing-node flow used everywhere else.
- Confidence/similarity defaults (0.6 / 0.85) are tunable per workspace via PLAT-SETTINGS-1 and pending
  confirmation against real client documents (OQ-18).
- Standards: CE-WRITE-1 (clone-then-validate), PROV-O (`prov:used` source attribution), SHACL
  (per-notation well-formedness + per-row), ArchiMate 3 / BPMN, W3C R2RML + RML, SKOS, OCEL 2.0.

---
*Generated by Weave Architect agent.*
