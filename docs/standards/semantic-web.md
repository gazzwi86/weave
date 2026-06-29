---
type: Coding Standard
title: Semantic Web — Coding Standard
description: "OWL/SHACL/SPARQL/PROV conventions for the ontology and graph layer."
tags: [standards, semantic-web, rdf]
timestamp: 2026-06-29T00:00:00Z
resource: docs/standards/semantic-web.md
---

# Semantic Web Standards

Weave's ontology layer is built on the full W3C semantic web stack: RDF/OWL 2 DL,
SHACL, SPARQL 1.1, SKOS, and PROV-O. These conventions ensure the graph stays
parseable, valid, and portable across tools.

## Turtle serialisation

Turtle is the canonical serialisation. Never check in N-Triples or RDF/XML
as primary source files.

**IRI/prefix declarations at the top:**

```turtle
@prefix rdf:   <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .
@prefix sh:    <http://www.w3.org/ns/shacl#> .
@prefix skos:  <http://www.w3.org/2004/02/skos/core#> .
@prefix prov:  <http://www.w3.org/ns/prov#> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .
@prefix weave: <https://weave.io/ontology/> .
@prefix ex:    <https://weave.io/instances/> .
```

**Formatting rules:**

- 2-space indent inside predicate-object lists.
- One predicate per line when a subject has multiple predicates.
- Align the first object after the predicate; continuation objects indent 2 beyond the predicate.
- Blank line between top-level subject blocks.

```turtle
weave:BusinessActor
    a owl:Class ;
    rdfs:label "Business Actor"@en ;
    rdfs:comment "A person, role, or organisation that performs business behaviour."@en ;
    rdfs:subClassOf weave:ActiveStructureElement ;
    skos:exactMatch <http://www.opengroup.org/xsd/archimate3/archimate#BusinessActor> .
```

## IRI naming

| Kind | Pattern | Example |
|------|---------|---------|
| Ontology class | `weave:PascalCase` | `weave:BusinessActor` |
| Object property | `weave:camelCase` | `weave:assignedTo` |
| Datatype property | `weave:camelCase` | `weave:label` |
| Named graph | `weave:graph/slug` | `weave:graph/tenant-a` |
| Curated vocabulary term | `weave:vocab/slug` | `weave:vocab/billing-process` |
| Runtime instance | UUID IRI | `ex:e4b1a2f0-...` |

Never abbreviate IRIs with `[]` blank nodes for entities that need to be
referenced more than once. Use blank nodes only for structurally anonymous
shapes (e.g. SHACL constraints that are never reused).

## OWL 2 DL

Weave targets **OWL 2 DL** — the profile that supports complete reasoning with
guaranteed decidability. Avoid constructs that tip into OWL Full:

**Allowed:**

```turtle
weave:assignedTo
    a owl:ObjectProperty ;
    rdfs:domain weave:BusinessRole ;
    rdfs:range weave:BusinessActor ;
    owl:inverseOf weave:performs .
```

**Avoid:**

| Pattern | Why |
|---------|-----|
| Using `rdfs:Class` and `owl:Class` interchangeably | Mixing metaclasses tips to OWL Full |
| `owl:Thing` / `owl:Nothing` as domain/range | Weakens reasoning; be specific |
| Punning (same IRI as class and individual) | Only permitted if deliberate and documented |
| Role-chain axioms combined with universal restrictions on the same property | Can breach DL decidability |

Run `owl-api-tools` or `HermiT` reasoning in CI to verify the ontology stays within DL.

## SHACL shapes

SHACL is the primary mechanism for:
- Validating user-provided graph edits
- Driving the UI form structure (shape-to-form generation)
- Gating the Build Engine (shapes define what is "complete" enough to generate from)

**Structure:**

```turtle
weave:BusinessActorShape
    a sh:NodeShape ;
    sh:targetClass weave:BusinessActor ;
    sh:property [
        sh:path weave:label ;
        sh:datatype xsd:string ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:maxLength 255 ;
        sh:severity sh:Violation ;
        sh:message "Every BusinessActor must have exactly one label."@en ;
    ] ;
    sh:property [
        sh:path weave:description ;
        sh:datatype xsd:string ;
        sh:maxCount 1 ;
        sh:severity sh:Warning ;
    ] .
```

**Severity levels:**

| Level | When to use |
|-------|------------|
| `sh:Violation` | Hard constraint — the entity is invalid without it. Blocks save. |
| `sh:Warning` | Best practice — the entity is incomplete but saveable. Surfaced in UI. |
| `sh:Info` | Hint / suggestion — surfaced as a nudge, never blocks. |

**Principles:**

- One `sh:NodeShape` per class. Do not scatter constraints across multiple shapes.
- Reuse `sh:PropertyShape` nodes (give them IRIs) when the same constraint appears on multiple classes.
- Keep OWL axioms (subclassing, domain/range) in the ontology; keep cardinalities and data constraints in SHACL. Do not duplicate in both.

## SPARQL

**Named query files.** Complex queries live in `queries/*.sparql` — not as Python
f-strings. Load them at startup:

```python
FIND_BY_TYPE = (Path(__file__).parent / "queries" / "find_by_type.sparql").read_text()
```

**Parameterise with VALUES, not string concatenation:**

```sparql
# Good — type_uri is injected as a VALUES binding
SELECT ?subject ?label WHERE {
  VALUES ?type { <TYPE_PLACEHOLDER> }
  ?subject a ?type ;
           weave:label ?label .
}
```

Replace `<TYPE_PLACEHOLDER>` via string substitution only for IRIs validated
against a whitelist. Never interpolate user-supplied strings directly into SPARQL.

**Naming convention for query files:**

```
queries/
├── find_entities_by_type.sparql
├── find_relationships.sparql
└── validate_shape.sparql
```

**SPARQL Update:** Only via the service layer (OntologyStore methods), never
directly from route handlers. Each update must produce a corresponding PROV-O
activity record.

## SKOS (vocabulary / concept management)

SKOS is used for the human-readable vocabulary layer above the OWL ontology.

```turtle
weave:BillingProcess
    a skos:Concept ;
    skos:prefLabel "Billing Process"@en ;
    skos:altLabel "Invoicing Process"@en ;
    skos:definition "The set of activities that create, send, and track customer invoices."@en ;
    skos:broader weave:FinanceProcess ;
    skos:inScheme weave:BusinessProcessScheme ;
    skos:exactMatch <http://purl.org/vocab/aiiso/schema#Process> .
```

**Rules:**

- One `skos:prefLabel` per language per concept.
- `skos:altLabel` for synonyms and abbreviations — do not create duplicate concepts.
- `skos:broader` / `skos:narrower` are vocabulary hierarchy, not ontological subclassing. If something is both, link with `skos:exactMatch` to the OWL class separately.
- Use `skos:exactMatch` for confirmed cross-vocabulary equivalence; `skos:closeMatch` when approximate.

## PROV-O (provenance)

Every write to the graph must produce a provenance record. This is enforced by
the OntologyStore — do not write triples directly to Oxigraph outside of it.

```turtle
ex:activity/a1b2c3
    a prov:Activity ;
    prov:startedAtTime "2026-06-26T10:00:00Z"^^xsd:dateTime ;
    prov:endedAtTime   "2026-06-26T10:00:01Z"^^xsd:dateTime ;
    prov:wasAssociatedWith ex:agent/user-42 ;
    rdfs:label "Create entity weave:BillingProcess"@en .

ex:entity/billing-process
    a prov:Entity ;
    prov:wasGeneratedBy ex:activity/a1b2c3 .
```

Provenance triples live in a dedicated named graph (`weave:graph/prov`) — never
mixed into the primary data graph.

## ArchiMate alignment

Weave ships a universal ontology grounded in ArchiMate 3. The mapping is:

| ArchiMate Layer | Weave OWL namespace |
|-----------------|---------------------|
| Strategy | `weave:StrategyElement` |
| Business | `weave:BusinessElement` |
| Application | `weave:ApplicationElement` |
| Technology | `weave:TechnologyElement` |
| Physical | `weave:PhysicalElement` |
| Motivation | `weave:MotivationElement` |

Cross-notation alignment uses `skos:exactMatch` (confirmed equivalent) or
`skos:closeMatch` (approximate). Do not add `owl:equivalentClass` across
notation namespaces without a documented reasoning justification.
