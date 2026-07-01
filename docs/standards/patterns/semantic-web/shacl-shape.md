---
type: Coding Standard
title: "Semantic Web — SHACL Shape (rdf)"
description: "A SHACL NodeShape + PropertyShapes for a BPMO kind, driving validation and form generation."
tags: [standards, patterns, semantic-web, rdf]
timestamp: 2026-07-01
resource: docs/standards/patterns/semantic-web/shacl-shape.md
topic: semantic-web
stack: rdf
verification: "rdflib Turtle parse OK; pyshacl conforming graph Conforms:True (exit 0); pyshacl bad graph Conforms:False (exit 1) citing DatatypeConstraintComponent + PatternConstraintComponent + ClassConstraintComponent"
---

# Semantic Web — SHACL Shape (rdf)

One `sh:NodeShape` per BPMO kind, expressing cardinality and data constraints as SHACL
(not OWL axioms). The same shape both **validates** a graph edit before commit and **drives
the authoring form** — every `sh:property` becomes a form field, so the shape is the single
source of truth for "what a valid Process looks like".

`weave:Process` is used here only as an example kind. The authoritative BPMO kind set is
served by `GET /api/ontology/types` (contract CE-READ-1) — never hard-code the kind list into
generated code or shapes.

```turtle
@prefix rdf:   <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix sh:    <http://www.w3.org/ns/shacl#> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .
@prefix weave: <https://weave.io/ontology/> .

weave:ProcessShape
    a sh:NodeShape ;
    sh:targetClass weave:Process ;
    rdfs:label "Process shape"@en ;
    sh:property [
        sh:path weave:label ;
        sh:name "Label" ;
        sh:description "Human-readable name of the process."@en ;
        sh:datatype xsd:string ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:maxLength 255 ;
        sh:severity sh:Violation ;
        sh:message "Every Process must have exactly one string label."@en ;
    ] ;
    sh:property [
        sh:path weave:processCode ;
        sh:name "Process code" ;
        sh:datatype xsd:string ;
        sh:maxCount 1 ;
        sh:pattern "^PRC-[0-9]{4}$" ;
        sh:severity sh:Violation ;
        sh:message "Process code must match PRC-NNNN (four digits)."@en ;
    ] ;
    sh:property [
        sh:path weave:performedBy ;
        sh:name "Performed by" ;
        sh:class weave:Actor ;
        sh:minCount 1 ;
        sh:severity sh:Violation ;
        sh:message "A Process must be performed by at least one Actor."@en ;
    ] .
```

A tiny **conforming** instance graph (passes) — note the value of `weave:performedBy` carries
its own explicit `rdf:type`, which is what `sh:class` checks when inference is disabled:

```turtle
@prefix weave: <https://weave.io/ontology/> .
@prefix ex:    <https://weave.io/instances/> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .

ex:actor-billing-team a weave:Actor .

ex:process-invoicing
    a weave:Process ;
    weave:label "Customer Invoicing"^^xsd:string ;
    weave:processCode "PRC-0042"^^xsd:string ;
    weave:performedBy ex:actor-billing-team .
```

A tiny **non-conforming** instance graph (fails) — a wrong-typed label (integer), a bad
`processCode` pattern, and a `performedBy` pointing at a `weave:System` rather than a
`weave:Actor` trip the datatype, pattern, and class constraints respectively:

```turtle
@prefix weave: <https://weave.io/ontology/> .
@prefix ex:    <https://weave.io/instances/> .

ex:some-system a weave:System .

ex:process-broken
    a weave:Process ;
    weave:label 12345 ;
    weave:processCode "INVOICING" ;
    weave:performedBy ex:some-system .
```

**Why.** SHACL carries cardinalities and data constraints; OWL axioms (subclassing,
domain/range) stay in the ontology, never duplicated across both. One shape per class keeps
constraints discoverable and makes shape-to-form generation deterministic — each `sh:property`
maps to one field, and `sh:name` / `sh:description` / `sh:message` supply the field label, help
text, and inline error. Severity tiers the UX: `sh:Violation` blocks save, `sh:Warning` is
saveable-but-flagged, `sh:Info` is a nudge.

**Security / grounding guarantee.** The SHACL gate runs with **`inference='none'`** (decision
B1) — that is the pyshacl default; do not pass `-i rdfs`/`-i owl` on the validation gate.
Target selection and `sh:class` then read only **direct** `rdf:type` triples in the data graph,
so validation is a decidable, reasoner-free check on exactly the triples the user submitted —
no OWL Full blow-up, no inferred triples silently satisfying a constraint. Validate before
commit and return HTTP 422 on violation without mutating the store (never mutate on 422).

**Anti-patterns.**

- Validating with inference on (`inference='rdfs'`/`'owl'`) — breaks the B1 grounding guarantee
  and can let inferred types mask a real violation.
- A "non-conforming" fixture whose focus node lacks a direct `a weave:Process` triple: under
  `inference='none'` the `sh:targetClass` selects nothing and the shape passes **vacuously** —
  proving nothing. Always give focus and value nodes explicit types.
- Scattering one class's constraints across several shapes, or duplicating OWL domain/range as
  SHACL — pick one home per fact.
- Hard-coding the BPMO kind set instead of reading `GET /api/ontology/types` (CE-READ-1).
