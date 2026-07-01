---
type: Coding Standard
title: "Semantic Web — OWL 2 DL Ontology (rdf)"
description: "A small BPMO-aligned OWL 2 DL fragment in Turtle: class, subClassOf, object + datatype properties."
tags: [standards, patterns, semantic-web, rdf]
timestamp: 2026-07-01
resource: docs/standards/patterns/semantic-web/owl-turtle-ontology.md
topic: semantic-web
stack: rdf
verification: "rdflib Turtle parse OK (syntax only; OWL 2 DL profile is enforced separately by HermiT in CI, not by this parse)"
---

# Semantic Web — OWL 2 DL Ontology (rdf)

A minimal OWL 2 DL fragment in Turtle (the canonical serialisation): a class, an
`rdfs:subClassOf`, an `owl:ObjectProperty` with `rdfs:domain`/`rdfs:range`, and an
`owl:DatatypeProperty`. Classes are `weave:PascalCase`, properties `weave:camelCase`. This is
BPMO-aligned framework, not populated taxonomy — `weave:Process` is one example kind; the
authoritative kind set is served by `GET /api/ontology/types` (CE-READ-1), never hard-coded.

```turtle
@prefix rdf:   <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .
@prefix skos:  <http://www.w3.org/2004/02/skos/core#> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .
@prefix weave: <https://weave.io/ontology/> .

weave:BusinessBehaviourElement
    a owl:Class ;
    rdfs:label "Business Behaviour Element"@en ;
    rdfs:comment "Anything the business does over time."@en ;
    rdfs:subClassOf weave:BusinessElement .

# weave:Process is one BPMO kind. Its URI is simultaneously an owl:Class and a
# skos:Concept (blessed class/concept punning, decision B1) — structural model and
# business-glossary term share identity and can never drift apart.
weave:Process
    a owl:Class, skos:Concept ;
    rdfs:label "Process"@en ;
    rdfs:comment "A repeatable sequence of activities that produces business value."@en ;
    rdfs:subClassOf weave:BusinessBehaviourElement ;
    skos:prefLabel "Process"@en ;
    skos:definition "A repeatable sequence of activities that produces business value."@en ;
    skos:inScheme weave:BusinessGlossaryScheme ;
    skos:exactMatch <http://www.opengroup.org/xsd/archimate3/archimate#BusinessProcess> .

weave:Actor
    a owl:Class ;
    rdfs:label "Actor"@en ;
    rdfs:subClassOf weave:BusinessElement .

weave:performedBy
    a owl:ObjectProperty ;
    rdfs:label "performed by"@en ;
    rdfs:comment "Links a process to the actor that carries it out."@en ;
    rdfs:domain weave:Process ;
    rdfs:range weave:Actor ;
    owl:inverseOf weave:performs .

weave:processCode
    a owl:DatatypeProperty, owl:FunctionalProperty ;
    rdfs:label "process code"@en ;
    rdfs:comment "Stable business identifier, e.g. PRC-0042."@en ;
    rdfs:domain weave:Process ;
    rdfs:range xsd:string .
```

**Why.** OWL 2 DL is the profile that supports complete, decidable reasoning. Concrete
`rdfs:domain`/`rdfs:range` (never `owl:Thing`) keep inference sharp. Object properties relate
individuals; datatype properties relate an individual to a literal — keeping them distinct is a
DL requirement. The class/concept punning (decision B1) gives the structural class and its
glossary term one identity, so an OWL axiom and its SKOS definition are always about the same
resource; the SHACL gate runs `inference='none'` precisely so this punning never forces the
reasoner toward OWL Full during validation. SKOS `skos:exactMatch` records ArchiMate 3
alignment without an `owl:equivalentClass` across notations.

**Security.** An ontology is trusted framework, not user input — it is authored and reviewed,
not accepted from a request. Client extensions and instances are added through the OntologyStore
write path (with PROV-O and SHACL validation), never by editing the shipped upper ontology.
Generated code that bakes domain-specific classes into the shipped ontology is a violation of
the framework-not-taxonomy rule.

**Anti-patterns.**

- Mixing `rdfs:Class` and `owl:Class` for the same resource, or using `owl:Thing`/`owl:Nothing`
  as domain/range — tips the ontology into OWL Full and weakens reasoning.
- Class/individual punning (one IRI as both `owl:Class` and `owl:NamedIndividual`) — distinct
  from, and not blessed like, the class/concept identity above.
- Checking in N-Triples or RDF/XML as the primary source — Turtle is canonical.
- Hard-coding "8" / "13" / "14" kinds anywhere — resolve the kind set from
  `GET /api/ontology/types` (CE-READ-1).
- Trusting a bare `rdflib` parse as an OWL 2 DL check: it verifies **syntax only**. Profile
  conformance and consistency are checked by HermiT / `owl-api-tools` in CI.
