---
type: Coding Standard
title: "Semantic Web — PROV-O Provenance (rdf)"
description: "PROV-O in Turtle modelling a single graph-edit for the append-only audit trail."
tags: [standards, patterns, semantic-web, rdf]
timestamp: 2026-07-01
resource: docs/standards/patterns/semantic-web/prov-o-provenance.md
topic: semantic-web
stack: rdf
verification: "rdflib Turtle parse OK (syntax + xsd:dateTime literals well-formed; PROV-O semantics not machine-checked here)"
---

# Semantic Web — PROV-O Provenance (rdf)

Every write to the graph produces a PROV-O record: a `prov:Activity` (the edit),
`prov:wasAssociatedWith` the acting `prov:Agent`, `prov:used` on the inputs, and
`prov:wasGeneratedBy` linking the resulting `prov:Entity` back to the activity. The OntologyStore
emits exactly one activity per applied operation, into the dedicated `weave:graph/prov` named
graph — never mixed into the data graph — and this feeds the append-only, hash-chained
`PLAT-AUDIT-1` trail.

```turtle
@prefix rdf:   <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix prov:  <http://www.w3.org/ns/prov#> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .
@prefix weave: <https://weave.io/ontology/> .
@prefix ex:    <https://weave.io/instances/> .

ex:agent-user-42
    a prov:Agent, prov:Person ;
    rdfs:label "Ada Okafor"@en ;
    weave:principalIri <https://weave.io/principals/user-42> .

ex:activity-op-9f3c
    a prov:Activity ;
    rdfs:label "Update label of ex:process-invoicing in draft"@en ;
    prov:startedAtTime "2026-07-01T10:00:00Z"^^xsd:dateTime ;
    prov:endedAtTime   "2026-07-01T10:00:01Z"^^xsd:dateTime ;
    prov:wasAssociatedWith ex:agent-user-42 ;
    prov:used ex:process-invoicing-rev-1 .

# The post-edit state is a generated entity, attributed to the agent and
# derived from its prior revision.
ex:process-invoicing-rev-2
    a prov:Entity ;
    rdfs:label "process-invoicing (revision 2)"@en ;
    prov:wasGeneratedBy ex:activity-op-9f3c ;
    prov:wasAttributedTo ex:agent-user-42 ;
    prov:wasDerivedFrom ex:process-invoicing-rev-1 .
```

**Why.** The three PROV-O core classes — Entity, Activity, Agent — plus the relations
`wasGeneratedBy` (entity ← activity), `wasAssociatedWith` (activity → agent), `used` (activity →
input entity), `wasAttributedTo` and `wasDerivedFrom` capture *who* changed *what*, *when*, and
*from which prior state*. Modelling each edit as an activity that generates a new entity revision
gives an immutable lineage: the graph's history is reconstructible by walking `wasDerivedFrom`.
The canonical acting `principalIri` on the agent is the same identity recorded in every
`PLAT-AUDIT-1` entry, so the RDF provenance and the relational audit chain reconcile.

**Security.** Provenance is append-only: records are written once by the OntologyStore and never
updated or deleted — a code path that mutates or removes a PROV triple is a violation. Keep PROV
in `weave:graph/prov`, isolated from the data graph, so a read of the model never silently
includes audit metadata and an audit read cannot be spoofed by data-graph triples. Reference the
agent by its principal IRI; never embed secrets, tokens, or PII in labels or comments. Machine
agents are attributed by their IAM/STS principal IRI, not by any stored credential.

**Anti-patterns.**

- Writing PROV triples into the data graph instead of `weave:graph/prov`.
- Updating or deleting an existing provenance record (breaks append-only + the hash chain).
- Writing graph edits directly to the store, bypassing the OntologyStore, so no activity is
  recorded — every write must produce a provenance record.
- A slash in a prefixed-name local part (e.g. `ex:activity/op-9f3c`) — invalid Turtle; use a
  hyphenated local name or a full `<...>` IRI.
- Putting a person's name, email, or a token in `rdfs:label` / `rdfs:comment`.
