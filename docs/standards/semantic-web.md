---
type: Coding Standard
title: Semantic Web — Coding Standard
description: "OWL/SHACL/SPARQL/PROV conventions for the ontology and graph layer."
tags: [standards, semantic-web, rdf]
timestamp: 2026-06-30T00:00:00Z
resource: docs/standards/semantic-web.md
---

# Semantic Web Standards

Weave's ontology layer is built on the full W3C semantic web stack: RDF/OWL 2 DL,
SHACL, SPARQL 1.1, SKOS, and PROV-O. These conventions ensure the graph stays
parseable, valid, and portable across tools.

Weave ships a thin, ArchiMate-3-aligned **upper-ontology framework** — not a populated
business taxonomy. Clients build their own domain vocabulary and instances on top of it
("Weave provides the grammar; the company writes the sentences", constitution-engine PRD,
decision A1). The shipped framework is:

- **~8 structural node-kinds:** `weave:BusinessDomain`, `weave:BusinessCapability`,
  `weave:System`, `weave:Service`, `weave:DataAsset`, `weave:Field`, `weave:Concept`,
  `weave:Class`.
- **9 relationship types** between those kinds, drawn from the ArchiMate-3 relationship grammar
  (e.g. relations such as assignment, realisation, composition, serving). The canonical set is
  registered by the engine and served via `GET /api/ontology/types` (CE-READ-1) — treat that
  endpoint, not this list, as authoritative for the exact 9.
- **W3C scaffolding:** SHACL shapes, PROV-O provenance, and SKOS concept-scheme structure.

Do **not** ship or assume populated client taxonomy terms in the upper ontology. The standard
the engine enforces is the framework, the constraints, and the AI-assisted authoring layer — not
a vocabulary the client must fight. Generated code that hard-codes domain-specific classes into
the shipped ontology violates this standard.

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
| Named graph (draft) | `weave:graph/draft` | `weave:graph/draft` |
| Named graph (published version) | `weave:graph/<semver>` | `weave:graph/v1.2.0` |
| Named graph (inferred, per version) | `weave:graph/<semver>/inferred` | `weave:graph/v1.2.0/inferred` |
| Named graph (provenance) | `weave:graph/prov` | `weave:graph/prov` |
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
| Class/individual punning (one IRI as both `owl:Class` and `owl:NamedIndividual`) | Not used in Weave; distinct from the blessed class/concept identity below |
| Role-chain axioms combined with universal restrictions on the same property | Can breach DL decidability |

Run `owl-api-tools` or `HermiT` reasoning in CI to verify the ontology stays within DL.

### Class + concept identity (blessed punning pattern)

A single URI is **simultaneously** an `owl:Class` and a `skos:Concept` — the structural
class and its business-glossary term are one resource, never two linked URIs (decision B1,
constitution-engine PRD E3-S2). This is a deliberate, documented form of OWL 2 punning: the
business vocabulary and the structural model can never drift out of sync because they share
identity.

```turtle
weave:ContractualObligation
    a owl:Class, skos:Concept ;
    rdfs:label "Contractual Obligation"@en ;
    rdfs:subClassOf weave:BusinessElement ;
    skos:prefLabel "Contractual Obligation"@en ;
    skos:definition "A duty a party owes under a contract."@en ;
    skos:inScheme weave:BusinessGlossaryScheme .
```

**Rules:**

- Do **not** introduce a separate linking property (no `weave:denotes`, no `owl:equivalentClass`
  between two URIs). The two types live on one subject.
- Because the same URI carries both `owl:Class` semantics and `skos:Concept` annotations,
  DL-completeness is **not** load-bearing here. **SHACL validation runs with `inference='none'`**
  (decision B1) so the class/concept punning never forces the reasoner into OWL Full during
  validation. Reasoning (consistency, inference materialisation) is a separate publish-time step
  (see *Versioned named graphs*), not part of the SHACL gate.
- Testable: a reconciliation query for a term (e.g. "show everything about `ContractualObligation`")
  must return both its OWL axioms and its SKOS annotations from the one URI; a query that assumes
  two distinct URIs must return empty (PRD E3-S2 failure AC).
- Testable: the SHACL validator must be invoked with inference disabled — grep the validation
  call site for `inference='none'` (or the engine's equivalent flag); `inference='rdfs'`/`'owl'`
  on the SHACL gate is a violation of this standard.

> Note: the `obpm` reference prototype runs `validate_shacl.py` with `inference="rdfs"`
> (`prototypes/obpm/scripts/validate_shacl.py:57`). That predates decision B1 and is **not** the
> standard — generated Weave code must use `inference='none'` on the SHACL gate.

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

## Versioned named graphs

The graph is partitioned into named graphs by lifecycle state. Editing happens in a draft;
publishing snapshots the draft into an immutable, version-named graph. This is the backbone of
the CE-READ-1 / CE-VERSION-1 contracts and the draft → published lifecycle
(constitution-engine PRD E9-S2, FR-008/009).

**Graph naming:**

| Graph | IRI pattern | Mutable? | Holds |
|-------|-------------|----------|-------|
| Draft | `weave:graph/draft` | Yes | The single working graph; all edits land here first |
| Published version | `weave:graph/<semver>` | **No** | A point-in-time snapshot, e.g. `weave:graph/v1.2.0` |
| Inferred (per version) | `weave:graph/<semver>/inferred` | **No** | Materialised inferences for that one version |
| Provenance | `weave:graph/prov` | Append-only | PROV-O activity/entity records |

**Rules — each is testable and gates generated code:**

- **Published graphs are immutable.** Publishing snapshots the draft into a new
  `weave:graph/<semver>` and never alters an existing published graph. Testable (FR-008):
  after publishing a later version, every prior `weave:graph/<semver>` is **byte-identical**
  to its pre-publish state. A code path that writes triples into an existing published version
  graph is a violation.
- **Draft isolation.** Edits target `weave:graph/draft` only (or `target: "draft"` in the
  CE-WRITE-1 `POST /api/operations/apply` payload). No write ever lands directly in a published
  or inferred graph. A draft is never readable through a pinned `?version=<semver>` query.
- **Inference materialises at publish, per version (when materialisation is enabled).** When
  OWL inference is materialised, it runs **at publish time** (not per-commit) and writes into
  that version's `weave:graph/<semver>/inferred` graph, with inferred triples labelled as
  inferred, not asserted (PRD E8-S1, E1-S4). Testable (version isolation): a pinned read of
  `v1.2.0` never returns an inferred triple produced for `v1.3.0`. Note: E8-S1 is **Should Have**
  in v1 — a conformant v1 **may** run a consistency check without full materialisation, in which
  case the inferred graph can remain empty; do not assert "the inferred graph is always populated
  after publish" as a hard rule.
- **Reasoner-timeout blocks publish.** If inference exceeds the reasoner budget (default 30 s,
  tunable per workspace), publish **fails** with a reasoner-timeout error and commits **no
  partial inferred graph** (PRD E1-S4 / E8-S1 failure ACs). Consistent with FR-007's rule that a
  publish never ships unchecked: a reasoner-unavailable or timed-out publish is rejected, leaving
  prior published versions and the draft intact. Testable: after a forced reasoner timeout, no new
  `weave:graph/<semver>` and no `weave:graph/<semver>/inferred` exist.
- **`?version=` resolves to a named graph.** `GET /api/sparql?version=<iri|semver|latest>`
  binds the query's default graph to the matching `weave:graph/<semver>` (decision B2,
  FR-009/010/011). `version=latest` resolves to the **newest published version** — testable:
  after publishing `v1.3.0`, `latest` resolves to `weave:graph/v1.3.0`, and downstream
  consumers auto-track `latest` unless they pin a specific version IRI.
- **Unknown version → 404.** A `?version=` naming a graph that does not exist returns `404`,
  never a silent fall-through to draft or latest (PRD E9-S3, E10-S1 failure ACs).

## Data classification & sensitive-data handling

**ODRL is deferred from v1** (constitution-engine PRD, non-goal line 86 and E7 line 285). v1 does
**not** ship ODRL policy enforcement. Instead, PII and sensitive-data handling is expressed with
**SHACL constraints plus data-classification properties** on data assets.

- Classify data assets with a `weave:dataClassification` property whose object is one of a
  closed `skos:Concept` set (e.g. `Public`, `Internal`, `Restricted`, `SensitivePersonalData` —
  cf. `prototypes/obpm/ontologies/mi-agent-model.ttl:106-118`, which models the same axis as a
  `mi:DataClassification` enumeration).
- Enforce coverage with SHACL: a `DataAsset` classified sensitive with no governance coverage
  must raise an `sh:Violation` (PRD E7 line 281). Testable: a sensitive-classified data asset
  missing required governance triples fails the SHACL gate.
- Do **not** author `odrl:` triples or assume an ODRL runtime in v1. Generated code that depends
  on ODRL policy evaluation violates this standard.

## ArchiMate alignment

Weave's upper-ontology framework (see the intro) is grounded in ArchiMate 3. This is a layer
mapping — orthogonal to the ~8 structural node-kinds, which classify *what* an entity is; the
ArchiMate layer classifies *which architectural plane* it sits on. The mapping is:

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
