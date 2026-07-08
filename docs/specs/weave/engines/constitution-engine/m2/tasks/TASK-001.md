---
type: Task
title: "Task: TASK-001 — SKOS Glossary Backend (Punned Term Model + SHACL)"
description: "Punned class+concept glossary terms (decision B1) written via CE-WRITE-1, with SHACL
  cardinality enforcement (one prefLabel per language, one definition) and reconciliation reads."
tags: [constitution-engine, arch, task, milestone-M2]
timestamp: 2026-07-08T00:00:00Z
status: Backlog
priority: Must Have
entity: constitution-engine
epic: EPIC-003
milestone: M2
created: 2026-07-08
blocked_by: []
unlocks: ["TASK-002", "TASK-005"]
adr_refs: []
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [constitution-engine.md](../../../constitution-engine.md) (EPIC-003, FR-022/FR-023)
Contracts: [contracts.md](../../../../contracts.md) · M2 delta: [m2-delta.md](../../tech-spec/m2-delta.md)

## Story

As a knowledge steward, I need every business term to have exactly one agreed meaning — a preferred
label, a definition, synonyms, and broader/narrower links — stored so the term and its structural
OWL class can never drift apart, so the whole organisation reasons from one vocabulary.

## Scope

EPIC-003 stories E3-S1 (define canonical term) and E3-S2 (term ≡ class as one punned resource).
E3-S3 (search/browse UI) is TASK-002. Backend only: model, SHACL shape, write path, read queries.

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-001-01 | WHEN a glossary term is created THE SYSTEM SHALL persist a **single IRI** typed both `owl:Class` and `skos:Concept` (punning, decision B1) in the tenant draft graph via CE-WRITE-1 — no separate linking property. |
| AC-001-02 | WHEN a term is created THE SYSTEM SHALL require exactly one `skos:prefLabel` per language and exactly one `skos:definition`, enforced by a SHACL shape validated with `inference='none'`. |
| AC-001-03 | WHEN a second `skos:prefLabel` in the same language is committed for a term THE SYSTEM SHALL return 422 with the violating language tag named — the commit does not land. |
| AC-001-04 | WHEN a term carries `skos:altLabel` (0..n) and `skos:broader`/`skos:narrower` links THE SYSTEM SHALL persist them; a broader/narrower target that is not itself a glossary term is a SHACL violation (422). |
| AC-001-05 | WHEN a reconciliation query asks "everything we know about {term}" THE SYSTEM SHALL return both the OWL axioms and the SKOS annotations from the one URI, via a CE-READ-1 SELECT. |
| AC-001-06 | WHEN any term mutation commits THE SYSTEM SHALL stamp PROV-O attribution exactly as any CE-WRITE-1 commit (no glossary-specific provenance path). |
| AC-001-07 | WHEN validation runs on glossary shapes THE SYSTEM SHALL use `inference='none'` so punning does not make OWL-DL completeness load-bearing (FR-022). |

## Pseudocode

```text
# No new write endpoint. Term ops are CE-WRITE-1 operation batches:
create_term(label, lang, definition, alt_labels, broader) ->
    ops = [ add_node(iri=mint_term_iri(label),
                     types=[owl:Class, skos:Concept],          # punned, one IRI
                     props={skos:prefLabel@lang, skos:definition, skos:altLabel*}),
            add_edge(iri, skos:broader, target)* ]
    POST /api/operations/apply  ->  SHACL gate (GlossaryTermShape) -> commit | 422

# Shape (framework graph, release-gated):
GlossaryTermShape: targetClass skos:Concept AND owl:Class (punned target)
    sh:property [ skos:prefLabel: uniqueLang=true, minCount 1 ]
    sh:property [ skos:definition: minCount 1, maxCount 1 ]
    sh:property [ skos:broader/narrower: class must be glossary term ]

reconcile(iri) -> SPARQL SELECT over draft graph:
    all (iri, ?p, ?o) UNION (?s, ?p, iri)  # OWL axioms + SKOS annotations, one URI
```

## API Contracts

- Writes: **CE-WRITE-1** `POST /api/operations/apply` — existing endpoint, existing op types. No
  glossary-specific write route (single-mutation-entry-point invariant, FR-003).
- Reads: **CE-READ-1** SPARQL SELECT (existing surface, existing ≤ 300 ms p95 budget).
- No new endpoints in this task.

## Diagram References

| Diagram | Source | What it covers |
|---|---|---|
| CE-WRITE-1 write path | [architecture.md](../../tech-spec/architecture.md) (Level 3, write path) | The clone → SHACL → commit pipeline term mutations flow through |
| Named-graph scheme + M2 delta | [m2-delta.md](../../tech-spec/m2-delta.md) §2 | Punned terms live in the tenant draft graph |
| SKOS entity mapping | [data-model.md](../../tech-spec/data-model.md) (standards mapping table) | `skos:Concept` + `BusinessGlossaryScheme` conventions |

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Punning: one IRI is both `owl:Class` and `skos:Concept` | Vocabulary and structure cannot drift if they are the same resource | engine spec decision B1, obpm `mi-glossary.ttl` |
| Validation with `inference='none'` | Punning breaks OWL-DL completeness assumptions; SHACL must not depend on inference | FR-022, EPIC-003 technical notes |
| GlossaryTermShape ships in `urn:weave:g:framework` | It is a framework-level grammar rule, not tenant governance; release-gated like other framework shapes | m2-delta.md §2, data-model.md |
| No glossary-specific write endpoint | CE-WRITE-1 is the single mutation entry point; a second path is a standing FR-003 violation | engine spec FR-003 |

## Test Requirements

Minimum: 4 unit, 4 integration, 0 E2E (UI E2E lands in TASK-002).

| Layer | Scenario (`should X when Y`) | AC |
|---|---|---|
| Unit | should mint one IRI carrying both rdf:type owl:Class and skos:Concept | AC-001-01 |
| Unit | should build prefLabel with language tag from request | AC-001-02 |
| Unit | should reject broader link whose target lacks glossary-term typing (shape fixture) | AC-001-04 |
| Unit | should keep validation inference mode 'none' for GlossaryTermShape | AC-001-07 |
| Integration | should create term then read back OWL + SKOS facets from the one URI | AC-001-01, AC-001-05 |
| Integration | should 422 with language tag named on duplicate prefLabel@en | AC-001-03 |
| Integration | should 422 on second skos:definition | AC-001-02 |
| Integration | should stamp PROV-O activity on term commit (same as any commit) | AC-001-06 |

## Dependencies

- **blocked_by**: none within M2 (consumes the M1 spine: CE-WRITE-1, SHACL gate, CE-READ-1 — all done)
- **unlocks**: TASK-002 (glossary UI), TASK-005 (EPIC-005 depends on EPIC-003 per engine spec)

## Cost Estimate

**S–M** — est. **250k tokens** (engineer loop incl. QA retries; scale: S ≈ 200k, M ≈ 400k,
L ≈ 700k). One shape, one op-batch builder, reconciliation SELECT; no new endpoints or UI.

## DoR Checklist

- [x] M1 spine (CE-WRITE-1/CE-READ-1/SHACL gate) merged and green
- [x] Punning decision (B1) approved in engine spec; `inference='none'` pinned (FR-022)
- [x] Framework-graph shape placement pinned (m2-delta.md §2)
- [ ] M1 program gate green (build precondition — spec-ready now, build blocked until gate)

## DoD Checklist

- [ ] All ACs pass (unit + integration)
- [ ] Punning verified: one URI answers both OWL-axiom and SKOS-annotation queries
- [ ] Duplicate prefLabel/lang and duplicate definition both 422 with named field
- [ ] GlossaryTermShape committed to the framework graph with a release note
- [ ] No second write path added (CI no-second-mutation-path assertion still passes)
- [ ] Coverage ≥ 80%, mutation ≥ 60% on new modules

## Implementation Hints

- Follow the M1 op-batch builder pattern (TASK-004/005 backend modules) — term creation is an
  `add_node` with two `rdf:type` values plus property assertions; do not invent a new op type.
- `sh:uniqueLang true` on the prefLabel property shape is the whole duplicate-language rule —
  do not hand-roll language-tag counting.
- Reconciliation query: single SELECT with UNION over subject/object positions, LIMIT/paginated
  through the existing B3 sanitizer; reuse the TASK-005 (M1) browse pattern.
- Pitfall: minting the term IRI from the label — slugify + collision-check against the draft
  graph (same-label same-kind duplicate rule from M1 E2-S1 applies to terms too).
