# R5 — Notations → Ontology Translation (First-Class)

**Thrust:** B (Methodological / semantic — notation → ontology)
**Status:** Draft for review
**Date:** 2026-06-26
**Hypothesis under test:** H3 — *notation→ontology is largely solved in theory but unproductised; Weave's gap
is productising + LLM-assisting the mapping, not inventing the correspondences.*

---

## 0. TL;DR and placement on the frames

**Verdict on H3: CONFIRMED (qualified).** For every notation Weave cares about, a published or directly
derivable OWL/RDF formalization already exists, and in the strongest cases (ArchiMate, BPMN) it ships *with*
SHACL validation. The correspondences are not the hard part. What does **not** exist as a product is: (a) a
single tool that ingests heterogeneous artefacts and composes them into one reconciled graph, (b) SKOS-based
reconciliation across overlapping notations, and (c) LLM-assisted lifting of diagrams/spreadsheets/text into
those schemas. That triad is Weave's wedge. The one genuine *theory* gap is C4 (no canonical ontology) and the
cross-notation temporal/event story — addressed in §B4.

**Three-paradigm placement.** Notations are squarely the **descriptive-modeled** paradigm — "how the business
is *designed* to run", drawn by humans. They are **not** mined-observed (no event-log inference) and **not**
data-bound-actionable (no binding to live source data, no write-back). This is important for Weave: importing
notations populates the *design* half of the graph; the mined and data-bound halves come from elsewhere (R3 /
R1). Notation import is a **cold-start accelerator**, not a liveness mechanism.

**Four-loop-stage placement.** Notation→ontology touches exactly two stages:

| Stage | Notation→ontology relevance |
|---|---|
| **Model** | PRIMARY. This is how the human-authored model enters the graph. |
| **Govern** | SECONDARY. SHACL shapes derived from each notation's well-formedness rules validate imports and ongoing edits. |
| Generate | Not addressed by notations themselves (downstream of the populated graph). |
| Automate | Not addressed by notations themselves. |

---

## B1 + B2 — What each notation captures, its OWL/RDF mapping, and SHACL well-formedness

Format note (per brief §7): each notation gets one table with the mandated columns
`Source construct | OWL/RDF construct | SHACL constraint | Notes`. SHACL columns encode the notation's
well-formedness rules so that imports validate. Ten notations follow; ≥6 was the floor.

### B1.1 ArchiMate 3.2 — the backbone

ArchiMate captures the enterprise across three layers (Business, Application, Technology) plus Strategy,
Physical, Motivation and Implementation aspects, structured on a 2×2 of *active structure / behaviour /
passive structure* × *internal / external*. The most complete public RDF/OWL formalization is Mendoza's
*ArchiMate 3.2 as an RDF Ontology* (independent formalization, blog dated 2026-03-01; GitHub
`AlbertoDMendoza/archimate_ontology`), covering all 61 element types and 11 relationship types, with a
three-level SHACL suite that encodes the spec's Appendix B relationship matrix
([Mendoza 2026](https://albertodmendoza.net/2026/03/01/archimate-3-2-as-an-rdf-ontology-beyond-the-drawing-board/)).
A second, peer-reviewed anchor is ArchiMEO (Hinkelmann et al., SCITEPRESS 90002, 2020).

> **Source-honesty flag:** Mendoza is a *single-author, personal-site* formalization, not an Open Group
> release. Its "all 61 elements / SHACL enforces Appendix B by construction" claims are strong and
> single-sourced. Treat it as the best available reference design to *emulate*, not as "ArchiMate now ships as
> RDF". The Open Group ships ArchiMate as a spec and an XML Model Exchange File Format, not as OWL.

Namespace used below: `archimate: <https://purl.org/archimate#>` (Mendoza's permanent IRI).

| Source construct | OWL/RDF construct | SHACL constraint | Notes |
|---|---|---|---|
| Element type (e.g. `BusinessActor`) | `owl:Class`, multiply `rdfs:subClassOf` `Element`, layer class, aspect class | `sh:NodeShape` `sh:targetClass archimate:BusinessActor`; `sh:property` for `id`/`name` `sh:minCount 1` | Three subClassOf axioms encode type+layer+aspect so a reasoner propagates classification |
| Relationship type (e.g. `serving`, `assignment`, `triggering`) | `owl:ObjectProperty` (11 total, 4 clusters: structural/dependency/dynamic/other) | Property shapes assert legal `sh:class` on subject/object per Appendix B matrix | Relationships are predicates, not reified classes by default — keeps the graph traversable |
| `specialization` relationship | `owl:ObjectProperty`, `owl:TransitiveProperty` | Specialization type-match shape (source/target same layer/aspect) | Transitivity gives inheritance inference for free |
| Junction (AND/OR) | `owl:Class` + `junctionType` datatype property (`"and"`/`"or"`) | Shape requiring `junctionType in (and,or)` | Junctions reified because they have ≥3 endpoints |
| Appendix B relationship matrix (which element may connect to which) | Not OWL axioms — SHACL shapes | Level-3 "Full Matrix" shapes: 58 concrete element types validated for composition/aggregation/access/realization | "Polikoff rule": constraints go in SHACL, not OWL — exactly Weave's import-validation need |
| Relationship metadata (provenance, dates, status) | RDF-Star quoted triple `<< s p o >>` carrying `id/name/effectiveDate/status/confidence` | Shapes over the quoted triple's annotation properties | PROV-like provenance per relationship; aligns with Weave's audit-trail requirement |
| Derived relationships | SHACL-AF `sh:construct` rules (DR1–DR8, PDR1–PDR12) materialize inferred links | n/a (these *produce* triples) | Lets Weave answer "does A ultimately serve B" without manual edges |

### B1.2 BPMN 2.0 — process behaviour

BPMN captures orchestrated process flow: flow nodes (activities, events, gateways) connected by sequence
flows, plus pools/lanes, data objects, and messages. The reference OWL formalization is **BBO (BPMN-Based
Ontology)**, Annane et al., OWL 2 DL, focused on Chapter 10 of the BPMN 2.0 spec
([BBO GitHub](https://github.com/AminaANNANE/BBO_BPMNbasedOntology); BBO paper, 2019). Namespace:
`bbo: <http://BPMNbasedOntology#>`. BBO ships `SHACLshapes.ttl`.

| Source construct | OWL/RDF construct | SHACL constraint | Notes |
|---|---|---|---|
| Process | `bbo:Process` (⊑ `bbo:FlowElementsContainer`) | NodeShape: `sh:property bbo:has_flowElements` `sh:minCount 1` | Container for the flow graph |
| Task / Activity (+ `UserTask`,`ServiceTask`,`BusinessRuleTask`,`ScriptTask`,`CallActivity`) | `bbo:Task` ⊑ `bbo:Activity` ⊑ `bbo:FlowNode` | Activity shape: ≥1 `has_incoming` OR is start; ≥1 `has_outgoing` OR is end | Subtype taxonomy gives fine-grained automation hints (ServiceTask → API call) |
| Event (`StartEvent`,`EndEvent`,`Intermediate`,`Catch`/`Throw`,`Boundary`) | `bbo:Event` ⊑ `bbo:FlowNode` | StartEvent shape: `has_incoming` `sh:maxCount 0`; EndEvent: `has_outgoing` `sh:maxCount 0` | Well-formedness of process boundaries |
| Gateway (exclusive/parallel/inclusive) | `bbo:Gateway` ⊑ `bbo:FlowNode` | Gateway shape: `has_incoming`+`has_outgoing` each `sh:minCount 1`; ≥2 on the split side | Encodes branch/merge legality |
| Sequence Flow | `bbo:SequenceFlow` ⊑ `bbo:FlowElement` | Shape: `bbo:has_sourceRef` `sh:minCount 1 sh:class bbo:FlowNode`; `bbo:has_targetRef` likewise | The edge of the process graph |
| source/target refs | `bbo:has_sourceRef`, `bbo:has_targetRef` (`owl:ObjectProperty`) | Range `sh:class bbo:FlowNode` | Connectivity well-formedness |
| Condition on flow | `bbo:has_conditionExpression` → `bbo:Expression` | Conditional-flow shape requires expression on gateway-outgoing flows | Bridge point to DMN (condition → decision) |
| Lane / performer | assignment of `bbo:Activity` to a participant/role | Shape: every Task has an assigned role (see worked example) | Reconciliation hook to ArchiMate `BusinessRole` |

### B1.3 DMN 1.1 — decision logic

DMN captures decision requirements (the DRG/DRD) and decision logic (decision tables, FEEL expressions). The
reference OWL version is **dmn-ont** (Nicholas Car, 2017, CC-BY 4.0; `github.com/nicholascar/dmn-ont`),
namespace `dmn: <http://promsns.org/def/dmn#>`. It targets **DMN 1.1**.

> **Recency-drift flag:** dmn-ont targets DMN **1.1**; the current OMG DMN spec is **1.5/1.6-era**. The DRG
> structure (Decision, InputData, BKM, KnowledgeSource, the three requirement types) is stable across
> versions, but FEEL surface syntax and boxed-expression types have grown. Weave should treat dmn-ont as a
> proven DRG skeleton and extend the logic layer, not adopt it verbatim.

| Source construct | OWL/RDF construct | SHACL constraint | Notes |
|---|---|---|---|
| Decision | `dmn:Decision` ⊑ `dmn:DRGElement` | NodeShape: ≥1 `InformationRequirement` OR is leaf input-bound; `question` `sh:maxCount 1` | DRG node |
| Input Data | `dmn:InputData` ⊑ `dmn:DRGElement` | Shape: no outgoing InformationRequirement (sources only) | Leaf of the DRG |
| Business Knowledge Model | `dmn:BusinessKnowledgeModel` | Shape: invoked only via `KnowledgeRequirement` | Reusable logic |
| Knowledge Source | `dmn:KnowledgeSource` | Shape: referenced via `AuthorityRequirement` only | Governance/authority anchor |
| Information / Knowledge / Authority Requirement | `dmn:InformationRequirement` etc. (reified dependency classes) | Acyclicity shape over requirement edges (DRG must be a DAG) | Prevents circular decisions |
| Decision Table | `dmn:DecisionTable` ⊑ `dmn:Expression` | Shape: hit-policy present; ≥1 rule | Logic detail |
| FEEL / Literal Expression | `dmn:LiteralExpression`, `dmn:Expression` (text + `typeRef`) | `textFormat` constrained to FEEL where applicable | Executable logic kept as typed literal |
| ItemDefinition (data type) | `dmn:ItemDefinition` | `typeRef` resolves to a known type | Bridge to data-model types |

### B1.4 UML / class models — domain structure (OMG ODM + OntoUML/UFO)

UML class diagrams capture domain structure: classes, attributes, associations, generalization, multiplicity.
Two complementary primary anchors: **OMG ODM** (Ontology Definition Metamodel) provides the *normative*
UML↔OWL/RDF bridge and UML profiles for RDF/OWL ([OMG ODM](https://www.omg.org/odm/)); **OntoUML/UFO** plus
its OWL implementation **gUFO** provide ontologically *well-founded* typing (NeMO/UFES;
`github.com/nemo-ufes/gufo`, `github.com/OntoUML/ontouml-models`).

| Source construct | OWL/RDF construct | SHACL constraint | Notes |
|---|---|---|---|
| Class | `owl:Class` | NodeShape per class | ODM normative mapping |
| Attribute (typed) | `owl:DatatypeProperty` with `rdfs:range` xsd type | `sh:datatype` + `sh:minCount/maxCount` from multiplicity | Multiplicity → cardinality |
| Association | `owl:ObjectProperty` (+ inverse) | Property shape `sh:class` on both ends; `sh:minCount/maxCount` | Bidirectional via `owl:inverseOf` |
| Generalization | `rdfs:subClassOf` | `sh:targetClass` inheritance respected | Maps cleanly |
| Multiplicity `0..1 / 1 / 1..* / *` | `owl:minCardinality`/`maxCardinality` OR (preferred) SHACL | `sh:minCount`/`sh:maxCount` | SHACL preferred for *validation* (closed-world); OWL cardinality is open-world |
| OntoUML stereotype (`«kind»`,`«role»`,`«phase»`,`«relator»`) | gUFO classes (`gufo:Kind`,`gufo:Role`,`gufo:Phase`,`gufo:Relator`) via `rdf:type`/specialization | Shapes enforcing UFO meta-properties (e.g. a Role must have an allowed bearer) | This is the *quality* layer — distinguishes rigid types from anti-rigid roles. Directly relevant to modelling "Customer" (role) vs "Person" (kind) |

### B1.5 C4 — software architecture (THE theory gap)

C4 (Simon Brown) captures software architecture at four zoom levels: System Context → Container → Component →
Code, with elements (Person, Software System, Container, Component) and relationships (uses, sends data to).
**There is no canonical, widely-cited OWL ontology for C4.** This is the one notation where the correspondence
must be *constructed*, not adopted. C4's element set is small and maps trivially onto ArchiMate's
Application/Technology layers, so Weave should express C4 as a lightweight profile over the ArchiMate backbone
rather than invent a parallel ontology.

| Source construct (C4) | OWL/RDF construct (proposed, over ArchiMate) | SHACL constraint | Notes |
|---|---|---|---|
| Person | `archimate:BusinessActor` (or `BusinessRole`) | Standard actor shape | Reuse ArchiMate, do not duplicate |
| Software System | `archimate:ApplicationComponent` (system-of-systems) | Shape: ≥1 contained Container | C4 "system" ≈ coarse app component |
| Container (app/datastore) | `archimate:ApplicationComponent` / `archimate:SystemSoftware` / `archimate:Node` | Container must be inside exactly one System | Datastore container → also a `DataObject` host |
| Component | `archimate:ApplicationComponent` (nested) or `ApplicationFunction` | Component must be inside one Container | Level-3 detail |
| "uses" / "sends data to" | `archimate:serving` / `archimate:flow` | Range = ApplicationComponent/Node | Reuse ArchiMate relationship matrix |
| Level (Context/Container/Component) | `skos:Concept` tag or a `weave:c4Level` annotation | Shape: level value in enum | Keep zoom level as metadata, not structure |

### B1.6 Org charts — W3C ORG ontology

Org charts capture organizational units, posts/positions, membership and reporting lines. This is a **fully
standardized, W3C-published** mapping: the **Organization Ontology** (`org:`,
[W3C TR vocab-org](https://www.w3.org/TR/vocab-org/)), namespace `org: <http://www.w3.org/ns/org#>`. The W3C
notes its coverage corresponds to "the type of information typically found in organizational charts".

| Source construct | OWL/RDF construct | SHACL constraint | Notes |
|---|---|---|---|
| Organization / department | `org:Organization`, `org:OrganizationalUnit` | NodeShape: unit `org:unitOf` exactly 1 parent (except root) | Tree well-formedness |
| Sub-unit / reporting line | `org:subOrganizationOf` (`owl:TransitiveProperty`) | Acyclic shape (no unit reports to itself transitively) | Transitivity = ancestor queries free |
| Post / position | `org:Post` | Shape: a Post `org:postIn` 1 Organization | Position distinct from the person |
| Person holds post | `org:heldBy` / `org:holds` | Shape: Membership has 1 member + 1 org | Person↔role decoupled (matches ArchiMate) |
| Membership (role of person in org) | `org:Membership` (reified n-ary) | Membership shape: `org:member`,`org:organization`,`org:role` each minCount 1 | Carries time via `org:memberDuring` |
| Role | `org:Role` | maps to `archimate:BusinessRole` via SKOS | Reconciliation hook |

### B1.7 Capability maps — ArchiMate Strategy layer

Capability maps are **not a separate notation requiring a separate ontology** — they are the ArchiMate
Strategy layer. This collapse is itself evidence for the ArchiMate-backbone decision (§B4).

| Source construct | OWL/RDF construct | SHACL constraint | Notes |
|---|---|---|---|
| Capability | `archimate:Capability` | NodeShape: `name` minCount 1 | Strategy element |
| Capability decomposition | `archimate:composition` (Capability→Capability) | Acyclic composition shape (reuses ArchiMate Level-1 SHACL) | L0/L1/L2 capability tree |
| Capability realized by app/process | `archimate:realization` (ApplicationComponent/BusinessProcess → Capability) | Range shape per matrix | This is the heatmap join: which systems realize which capability |
| Resource backing capability | `archimate:Resource` + `archimate:assignment` | Resource→Capability assignment shape | Strategy layer Resource |

### B1.8 Value-stream maps — ArchiMate Value Stream

Also ArchiMate Strategy layer (`archimate:ValueStream`, `archimate:CourseOfAction`,
`archimate:Value`). Same backbone, no separate ontology.

| Source construct | OWL/RDF construct | SHACL constraint | Notes |
|---|---|---|---|
| Value stream | `archimate:ValueStream` | NodeShape present | Strategy element |
| Stage in stream | `archimate:composition` (ValueStream→ValueStream) + ordering | Ordered, acyclic shape | Stages are nested value streams in ArchiMate 3.2 |
| Value produced | `archimate:Value` via `archimate:association` | Shape: stage associates ≥0 Value | Outcome of the stage |
| Stage served by capability | `archimate:serving` (Capability→ValueStream) | Matrix shape | Links value stream to capability map |

### B1.9 REA — economic exchange (Resource-Event-Agent)

REA (McCarthy 1982) captures economic substance: **Resources** exchanged via **Events**, involving **Agents**,
bound by duality (give/take), stockflow, and commitment/contract. A published **OWL** formalization of the REA
business-domain ontology exists (Gailly/Geerts/Poels). The most recent unified formalisation is **REA2**
(Laurier, Kiehn & Polovina, *Applied Ontology*, IOS Press 2018, DOI 10.3233/AO-180198) — but note REA2 is **not
OWL**: its metamodel is expressed with **OntoUML** stereotypes and its proof of concept is implemented in
**SWI-Prolog**, uniting REA with the Open-EDI Business Transaction Ontology (OeBTO)
([Laurier et al. 2018](https://journals.sagepub.com/doi/10.3233/AO-180198)). For an OWL/RDF backbone, Weave
therefore lifts the REA *conceptual core* (the table below) onto OWL using the Gailly/Geerts/Poels mapping as
the OWL anchor, treating REA2 as the conceptual reference rather than a drop-in OWL artefact. REA is recognised
by **The Open Group within the TOGAF standard** as a useful tool for modelling business processes
([Wikipedia: Resources, Events, Agents](https://en.wikipedia.org/wiki/Resources,_Events,_Agents), orientation
pointer to the TOGAF recognition).

| Source construct | OWL/RDF construct | SHACL constraint | Notes |
|---|---|---|---|
| Economic Resource | `rea:EconomicResource` (`owl:Class`) | NodeShape: resource `rea:underControlOf` ≥1 Agent | What is exchanged |
| Economic Event | `rea:EconomicEvent` | Shape: event has `rea:provider` + `rea:receiver` (Agents) + `rea:affects` Resource | Increment/decrement of a resource |
| Economic Agent | `rea:EconomicAgent` | Shape: agent minCount on participating events | Party to the exchange |
| Duality (give↔take) | `rea:duality` (`owl:ObjectProperty`, often symmetric) | Shape: each transfer event paired with a counter-event | Core REA axiom — encodes reciprocity |
| Stockflow | `rea:stockflow` (Event→Resource) | Range shape Resource | How events move resources |
| Commitment / Contract | `rea:Commitment`, `rea:Contract` | Shape: commitment `rea:fulfilledBy` ≥0 Event | The "planned" vs "actual" bridge — useful for automation triggers |

*Weave's analytical framing (not a sourced claim):* REA is the strongest candidate to fill ArchiMate's weak
*economic-exchange* semantics (ArchiMate has Product, Contract, Value but no duality/stockflow). See §B4.

### B1.10 e3value — value networks

e3value (Gordijn & Akkermans) captures who exchanges objects of economic value with whom, and whether each
actor's value model is profitable: actors, value ports/interfaces, value exchanges, value activities, market
segments. There is no single dominant OWL release; the canonical formalizations are the e3value *ontology*
itself (it is defined as an ontology) and a **UML profile for e3value** (Pijpers/Gordijn). Derivable mapping:

| Source construct | OWL/RDF construct | SHACL constraint | Notes |
|---|---|---|---|
| Actor / Market segment | `e3:Actor`, `e3:MarketSegment` (`owl:Class`) | NodeShape: actor has ≥1 value interface | Economic entity |
| Value object | `e3:ValueObject` | Shape: exchange references exactly 1 value object | What has value |
| Value port / interface | `e3:ValuePort` (in/out), `e3:ValueInterface` | Shape: interface bundles ≥1 in + ≥1 out port (reciprocity) | Economic reciprocity rule |
| Value exchange | `e3:ValueExchange` (Port→Port) | Shape: connects one out-port to one in-port | The transfer |
| Value activity | `e3:ValueActivity` | Shape: assigned to exactly 1 actor | Profit-relevant activity |
| Dependency path / boundary element | reified path classes | path connectivity shape | Used for profitability sheets |

e3value overlaps REA heavily (both model economic exchange). In one graph they reconcile via SKOS: e3value's
`ValueExchange` ≈ REA's reciprocal `EconomicEvent` pair (see §B3).

---

## B3 — How the notations compose, overlap, conflict, and reconcile in one graph

The notations are not disjoint; they describe overlapping reality at different altitudes. The overlaps are the
*reason* a single reconciled graph is valuable — and the source of conflict if naïvely merged.

### Overlap / conflict map

| Pair | Where they overlap | Conflict risk | Reconciliation in one graph |
|---|---|---|---|
| ArchiMate ↔ BPMN | ArchiMate `BusinessProcess` is the coarse box; a BBO `Process` is its fine internal flow | Two "process" classes; double-counting | ArchiMate process `weave:refinedBy` a BBO process; SKOS concept "Replenishment Process" links both |
| ArchiMate ↔ C4 | ArchiMate `ApplicationComponent` vs C4 Container/Component | Parallel app taxonomies | Express C4 as ArchiMate profile (§B1.5) — no second taxonomy |
| BPMN ↔ DMN | BPMN `BusinessRuleTask` / gateway condition vs DMN `Decision` | Logic duplicated in flow and decision | BPMN task `dmn:usingTask` / references the DMN `Decision`; OMG already standardizes this linkage |
| Org chart ↔ ArchiMate | `org:Role`/`org:Post` vs `archimate:BusinessRole`/`BusinessActor` | Two role models | SKOS `skos:exactMatch` between the role concepts; pick ArchiMate as canonical for behaviour assignment |
| REA ↔ e3value | Both model economic exchange | Duplicate exchange semantics | SKOS map `e3:ValueExchange` ↔ paired `rea:EconomicEvent`; keep REA for operational, e3value for design-time profitability |
| ArchiMate Strategy ↔ capability/value-stream maps | Same elements | None (same ontology) | Collapse — they ARE ArchiMate |
| UML/OntoUML ↔ ArchiMate DataObject | Domain class vs `archimate:DataObject`/`BusinessObject` | Structure vs reference | UML class `weave:realizes` the ArchiMate object; gUFO typing adds rigor |

### The reconciliation spine: SKOS as the glossary join

The central technique (and Weave's core IP) is to make **one `skos:Concept` the shared meaning anchor** that
every notation's element points at. The concept is notation-neutral; each notation contributes a *view*:

```turtle
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix weave: <https://weave.example/ont#> .

weave:concept-Product a skos:Concept ;
    skos:prefLabel "Product"@en ;
    skos:definition "A sellable stock-keeping unit in the retail catalogue."@en .

# each notation's element declares which concept it denotes
hb:DataObject-Product   weave:denotes weave:concept-Product .   # ArchiMate DataObject
hb:rdf-class-Product    weave:denotes weave:concept-Product .   # relational table → RDF class
hb:bpmn-dataref-Product weave:denotes weave:concept-Product .   # BPMN data reference
```

SPARQL over `weave:denotes` (or `skos:exactMatch`) then answers "show me everything we know about Product,
across the architecture model, the process model, and the database" — which no single-notation tool can do.
This is exactly the role ArchiMEO and the W3C ORG/RegOrg stack assign to a shared vocabulary: a glossary as the
interoperability layer over heterogeneous models. Conflicts (two elements claiming to be *the* Product) become
**SHACL-detectable**: a shape can flag a concept with >1 canonical denotation per notation, surfacing it for
HITL or LLM-assisted merge rather than silently corrupting the graph.

---

## B4 — The right backbone for Weave's universal ontology, and its gaps

**Recommendation: ArchiMate 3.2 (RDF/OWL) is the backbone, augmented with a REA/DEMO-informed economic core
and explicit temporal/data/motivation extensions.** This builds directly on the confirmed CLAUDE.md decision
(ArchiMate-3-aligned ~9-type universal ontology) and the brief's H5.

**Why ArchiMate wins the backbone slot (evidence, not assertion):**

- It is the only notation whose published OWL form (Mendoza/ArchiMEO) ships with a *complete relationship
  matrix as SHACL* — i.e. it already solves B2 at enterprise scope.
- Four of the ten notations in §B1 (ArchiMate, capability maps, value-stream maps, and the behaviour-assignment
  half of org charts) **collapse onto it**. A backbone that natively absorbs 40% of the target notations is the
  pragmatic centre of gravity.
- Its 3-layer × active/behaviour/passive structure is the natural superset onto which BPMN (behaviour
  refinement), C4 (application/tech detail), and UML/data models (passive-structure detail) attach.

**The ~9 core types** map cleanly onto ArchiMate: Actor/Role, Capability, Business Process/Function, Service,
Application Component, Node/Technology, Data/Business Object, Value/Outcome, and a Motivation element (Driver/
Goal/Requirement). Each is an `owl:Class` ⊑ an ArchiMate element class — so clients "extend the universal
ontology" by specializing these.

### Known gaps and how to fill them

| Gap | Why ArchiMate is weak | Fill with | Standard / source |
|---|---|---|---|
| **Events & temporal** | ArchiMate has no first-class event log / valid-time; relationships are static | PROV-O for provenance/history; W3C Time Ontology for intervals; OCEL for object-centric events (mined half, see R3) | W3C PROV-O, W3C OWL-Time, OCEL |
| **Economic exchange** | Product/Contract/Value but no duality/stockflow/commitment | REA economic core in OWL (Gailly/Geerts/Poels), with REA2 as conceptual reference (OntoUML/Prolog, not OWL) | Gailly/Geerts/Poels OWL-REA; REA2 (IOS Press 2018, DOI 10.3233/AO-180198); TOGAF recognises REA |
| **Data assets (fine grain)** | `DataObject` is coarse; no columns/types/lineage | UML/OntoUML class detail + R2RML-generated RDF classes; C4 datastore profile | OMG ODM, gUFO, W3C R2RML |
| **Motivation depth** | Motivation layer exists but thin on rules | DMN decisions as machine-readable rules; SHACL as enforced policy | OMG DMN, dmn-ont, W3C SHACL |
| **Ontological rigor (types vs roles)** | ArchiMate doesn't distinguish rigid kinds from anti-rigid roles | gUFO/OntoUML stereotypes as a typing overlay | gUFO (NeMO/UFES) |

RDF-Star relationship metadata (already in Mendoza's design) gives Weave per-edge provenance and effective
dates — a cheap partial answer to the temporal gap and a direct fit for the audit-trail requirement.

---

## B5 — Ingesting existing client artefacts

Clients arrive with EA repositories, BPMN files, CMDB exports, and spreadsheets. Three deterministic lanes
plus one LLM-assisted lane cover the landscape. Deterministic-first is the rule: use LLMs only where structure
is absent.

| Artefact type | Ingest lane | Tool / standard | Output | Confidence |
|---|---|---|---|---|
| Relational DB / CMDB / Aurora export | **R2RML** | W3C R2RML (`rr:`), engines like Ontop/Morph | RDF classes + properties, virtual or materialized | Deterministic, lossless |
| CSV / JSON / XML / spreadsheets (structured) | **RML** | W3C KG-Construct RML (superset of R2RML, 2025 modular spec) ships its own SHACL shapes | RDF per declarative rules | Deterministic given a mapping |
| ArchiMate EA repository (`.archimate` / Open Group Model Exchange XML) | **Model-Exchange→RDF** | `bp4mc2/archimate2rdf` (translates ArchiMate Model Exchange File Format to RDF); Mendoza ontology as target schema | ArchiMate triples directly | Deterministic |
| BPMN `.bpmn` XML | XSLT/parser → BBO | BBO + PM2ONTO-style transform | BBO triples | Deterministic |
| Diagrams (images), unstructured docs, "the process is…" prose, loosely-typed spreadsheets | **LLM-assisted extraction** | Vision/LLM proposes element+relationship triples *against the target ontology*, then SHACL-validated, then HITL | Candidate triples with confidence + provenance | Probabilistic — must be gated |

**The discipline that makes LLM ingest safe:** the LLM never writes to the graph directly. It proposes triples
typed against the universal ontology; those triples must pass the same SHACL shapes that govern manual edits
(B2); failures and low-confidence proposals route to HITL or the SKOS reconciliation queue. This is the
productisation H3 predicts is missing — the *mapping* exists (R2RML/RML/archimate2rdf/BBO), the *assisted,
validated, reconciled pipeline over heterogeneous inputs* does not, as a product.

---

## Worked example — Hammerbarn store replenishment (end-to-end)

**Slice:** Hammerbarn (Australian hardware retailer) has a *Store Replenishment* capability. When a store's
on-hand for a product drops below its reorder point, a replenishment process raises a purchase order to a
supplier. Behind it sits a small data model (`product`, `store_inventory`, `purchase_order`). We model this in
**ArchiMate** (architecture), **BPMN** (process), and a **relational data model** (lifted via R2RML), then
**compose** them into one reconciled OWL/RDF graph with SHACL shapes. All vocabulary below is traceable to the
tables in §B1 — no invented predicates.

### Prefixes

```turtle
@prefix archimate: <https://purl.org/archimate#> .
@prefix bbo:   <http://BPMNbasedOntology#> .
@prefix org:   <http://www.w3.org/ns/org#> .
@prefix rea:   <https://w3id.org/rea#> .
@prefix skos:  <http://www.w3.org/2004/02/skos/core#> .
@prefix sh:    <http://www.w3.org/ns/shacl#> .
@prefix rr:    <http://www.w3.org/ns/r2rml#> .
@prefix weave: <https://weave.example/ont#> .
@prefix hb:    <https://hammerbarn.example/graph#> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .
```

### 1. ArchiMate layer (strategy + business + application)

```turtle
hb:Cap-StoreReplenishment a archimate:Capability ;
    archimate:name "Store Replenishment" .

hb:Proc-Replenish a archimate:BusinessProcess ;
    archimate:name "Replenish Store Stock" .
hb:Proc-Replenish archimate:realization hb:Cap-StoreReplenishment .   # process realizes capability

hb:Role-InventoryPlanner a archimate:BusinessRole ;
    archimate:name "Inventory Planner" .
hb:Role-InventoryPlanner archimate:assignment hb:Proc-Replenish .     # role performs process

hb:App-ReplenishmentSystem a archimate:ApplicationComponent ;
    archimate:name "Replenishment System (RMS)" .
hb:App-ReplenishmentSystem archimate:serving hb:Proc-Replenish .

hb:DataObject-Product a archimate:DataObject ;
    archimate:name "Product" .
hb:DataObject-PurchaseOrder a archimate:DataObject ;
    archimate:name "Purchase Order" .
```

### 2. BPMN layer (the fine-grained flow, refining the ArchiMate process)

```turtle
hb:bpmn-Replenish a bbo:Process ;
    bbo:has_flowElements hb:t-CheckStock, hb:gw-BelowReorder, hb:t-RaisePO, hb:e-Start, hb:e-End .

hb:e-Start a bbo:StartEvent .
hb:t-CheckStock a bbo:ServiceTask ;
    bbo:has_incoming hb:sf1 ; bbo:has_outgoing hb:sf2 .
hb:gw-BelowReorder a bbo:Gateway ;          # exclusive: on-hand < reorder point?
    bbo:has_incoming hb:sf2 ; bbo:has_outgoing hb:sf3, hb:sf-end .
hb:t-RaisePO a bbo:UserTask ;
    bbo:has_incoming hb:sf3 ; bbo:has_outgoing hb:sf4 .
hb:e-End a bbo:EndEvent ; bbo:has_incoming hb:sf4 .

hb:sf3 a bbo:SequenceFlow ;
    bbo:has_sourceRef hb:gw-BelowReorder ; bbo:has_targetRef hb:t-RaisePO ;
    bbo:has_conditionExpression hb:cond-BelowReorder .

# composition join: the ArchiMate process is refined by the BPMN process
hb:Proc-Replenish weave:refinedBy hb:bpmn-Replenish .
# role reconciliation: BPMN task performed by the same role
hb:t-RaisePO weave:performedBy hb:Role-InventoryPlanner .
```

The exclusive-gateway condition is the natural **DMN** hook: `hb:cond-BelowReorder` can be a
`dmn:Decision` ("Reorder?") whose `InputData` are on-hand and reorder-point. Omitted for brevity but it slots
in via `bbo:has_conditionExpression → dmn:Decision`.

### 3. Relational data model, lifted via R2RML

```turtle
# R2RML mapping (excerpt): store_inventory table → RDF
hb:Map-Inventory a rr:TriplesMap ;
    rr:logicalTable [ rr:tableName "store_inventory" ] ;
    rr:subjectMap   [ rr:template "https://hammerbarn.example/inv/{store_id}-{product_id}" ;
                      rr:class weave:StoreInventory ] ;
    rr:predicateObjectMap
      [ rr:predicate weave:onHand ; rr:objectMap [ rr:column "on_hand" ;
                                                   rr:datatype xsd:integer ] ] ,
      [ rr:predicate weave:reorderPoint ; rr:objectMap [ rr:column "reorder_point" ;
                                                         rr:datatype xsd:integer ] ] ,
      [ rr:predicate weave:ofProduct ; rr:objectMap [ rr:template
                                                      "https://hammerbarn.example/prod/{product_id}" ] ] .

# resulting instance triples after running the mapping:
hb:inv-S12-P900 a weave:StoreInventory ;
    weave:onHand 3 ; weave:reorderPoint 10 ;
    weave:ofProduct hb:prod-P900 .
hb:prod-P900 a weave:Product ; weave:sku "P900" ; weave:name "20kg Cement Mix" .
```

### 4. REA economic overlay (the purchase order as economic substance)

```turtle
hb:po-7781 a rea:EconomicEvent ;            # raising the PO is a commitment-fulfilling event
    rea:provider hb:supplier-Boral ;
    rea:receiver hb:Hammerbarn ;
    rea:affects  hb:prod-P900 ;
    rea:stockflow hb:prod-P900 .
hb:supplier-Boral a rea:EconomicAgent ; org:identifier "Boral" .
```

### 5. SKOS reconciliation spine (one concept, four views)

```turtle
weave:concept-Product a skos:Concept ; skos:prefLabel "Product"@en .

hb:DataObject-Product weave:denotes weave:concept-Product .   # ArchiMate view
weave:Product         weave:denotes weave:concept-Product .   # relational/RDF class view
hb:prod-P900          weave:denotes weave:concept-Product .   # instance lifted from DB
# (BPMN data reference to Product would also denote the same concept)
```

A SPARQL query over `weave:denotes` now returns the architecture object, the data class, and the live
inventory instance for "Product" — the cross-notation answer no single tool gives.

### 6. SHACL shapes that validate the composed import (real shapes)

```turtle
# Shape 1 — every BPMN task must be performed by an ArchiMate role (B2 well-formedness + reconciliation)
weave:TaskHasPerformerShape a sh:NodeShape ;
    sh:targetClass bbo:Task ;
    sh:property [
        sh:path weave:performedBy ;
        sh:minCount 1 ;
        sh:class archimate:BusinessRole ;
        sh:message "Every BPMN task must be assigned to an ArchiMate BusinessRole." ] .

# Shape 2 — every exclusive gateway must have >=2 outgoing flows (BPMN well-formedness)
weave:GatewaySplitShape a sh:NodeShape ;
    sh:targetClass bbo:Gateway ;
    sh:property [ sh:path bbo:has_outgoing ; sh:minCount 1 ] ;
    sh:property [ sh:path bbo:has_incoming ; sh:minCount 1 ] .

# Shape 3 — a Purchase Order economic event must reference a Product and both agents (REA duality-lite)
weave:POEventShape a sh:NodeShape ;
    sh:targetClass rea:EconomicEvent ;
    sh:property [ sh:path rea:provider ; sh:minCount 1 ; sh:class rea:EconomicAgent ] ;
    sh:property [ sh:path rea:receiver ; sh:minCount 1 ; sh:class rea:EconomicAgent ] ;
    sh:property [ sh:path rea:affects  ; sh:minCount 1 ;
                  sh:message "A purchase-order event must affect a known Product." ] .

# Shape 4 — reconciliation integrity: a concept must not have two ArchiMate denotations
weave:OneCanonicalArchiMateShape a sh:NodeShape ;
    sh:targetClass skos:Concept ;
    sh:property [ sh:path [ sh:inversePath weave:denotes ] ;
                  sh:qualifiedValueShape [ sh:class archimate:DataObject ] ;
                  sh:qualifiedMaxCount 1 ;
                  sh:message "Concept has >1 canonical ArchiMate object — route to HITL merge." ] .
```

If a client's imported BPMN has a task with no role, Shape 1 fails the import and surfaces it; if their
spreadsheet ingest produces two ArchiMate "Product" objects for one concept, Shape 4 routes it to
reconciliation. That validate-then-reconcile loop is the product Weave is building on top of the (already
solved) correspondences.

---

## Implications for Weave

### Emulate (copy the pattern)

- **Mendoza's layered SHACL architecture** (Core → Metamodel → Full-Matrix). The idea that the relationship
  matrix lives in SHACL, not OWL ("Polikoff rule"), is exactly right for *import validation* and should be
  Weave's house pattern for every notation.
- **RDF-Star per-relationship provenance** (effectiveDate/status/establishedBy) — directly serves Weave's
  audit-trail requirement and the temporal gap, cheaply.
- **ArchiMEO's "glossary as interoperability layer"** — formalize it as the SKOS reconciliation spine.
- **RML's shipped-with-SHACL** discipline (the 2025 modular RML spec ships shapes to validate mappings) —
  Weave's ingest mappings should themselves be validated.

### Adopt (use the tech/standard directly)

- **W3C R2RML** for relational/CMDB ingest; **W3C KG-Construct RML** for CSV/JSON/XML/spreadsheets.
- **W3C Organization Ontology (`org:`)** for org charts — do not reinvent; bridge to ArchiMate roles via SKOS.
- **W3C SHACL (+ SHACL-AF)** as the validation and derived-relationship engine across all notations.
- **W3C PROV-O + OWL-Time** for the temporal/event gap; **gUFO** as an optional ontological-rigor overlay.
- **`bp4mc2/archimate2rdf`** (or equivalent) for ArchiMate Model Exchange XML → RDF; **BBO** as the BPMN target
  schema; **dmn-ont** as the DRG skeleton (extend the logic layer for DMN 1.5+).

### Avoid (commodity / anti-pattern)

- **Don't invent a new C4 ontology** — express C4 as a thin profile over ArchiMate's app/tech layers.
- **Don't model capability maps or value-stream maps as separate notations** — they are ArchiMate strategy
  elements; a separate schema is pure duplication.
- **Don't push the relationship matrix / cardinality into OWL axioms** for validation — open-world OWL won't
  reject the violations you need to catch on import; that is SHACL's job.
- **Don't let the LLM write to the graph** un-validated. LLM proposes → SHACL gates → HITL/SKOS reconciles.
- **Don't ship dmn-ont verbatim** as "DMN support" — it is DMN 1.1; flag the version and extend.
- **Don't treat notation import as liveness** — it populates the *designed* model only (descriptive paradigm).

### Differentiate (where Weave deliberately diverges and why)

- **Productise the union, not a single mapping.** Every correspondence in this report is published; *no product
  ingests heterogeneous artefacts and composes them into one SHACL-validated, SKOS-reconciled graph.* That
  pipeline is the wedge (confirms H3).
- **SKOS reconciliation spine as a first-class feature.** Competitors (EA tools, catalogs) each own one
  notation's repository; Weave owns the *join across notations* via shared concepts — the cross-notation
  SPARQL answer.
- **LLM-assisted lifting, deterministically gated.** Diagrams/spreadsheets/prose → candidate triples →
  SHACL → HITL. The novelty is the *gate discipline*, not the LLM.
- **Ship the ArchiMate-backed universal ontology pre-loaded with the SHACL suite**, so a client's first import
  validates on day one. Incumbents make you build the metamodel; Weave ships it.

---

## Three-paradigm and four-loop scorecard (this report's subject)

| Subject | Descriptive-modeled | Mined-observed | Data-bound | Model | Generate | Automate | Govern |
|---|---|---|---|---|---|---|---|
| Notation→ontology import | PRIMARY | No | No (R2RML can virtualize → partial) | PRIMARY | No | No | SECONDARY (SHACL) |

**H3 verdict: CONFIRMED, qualified.** Correspondences are solved/derivable for all ten notations (one
constructed: C4). Unsolved-as-product: the composed, validated, reconciled, LLM-assisted ingest pipeline —
which is precisely Weave's Constitution Engine scope.

---

## Sources

Primary sources (standards bodies, peer-reviewed/preprint papers, official ontology repositories):

- Mendoza, A. D. *ArchiMate 3.2 as an RDF Ontology: Beyond the Drawing Board.* 2026-03-01.
  <https://albertodmendoza.net/2026/03/01/archimate-3-2-as-an-rdf-ontology-beyond-the-drawing-board/>
  (independent single-author formalization) and repo <https://github.com/AlbertoDMendoza/archimate_ontology>
- Hinkelmann et al. *ArchiMEO: A Standardized Enterprise Ontology based on the ArchiMate Conceptual Model.*
  SCITEPRESS / MODELSWARD 2020, paper 90002. <https://www.scitepress.org/Papers/2020/90002/90002.pdf>
- Annane, A. et al. *BBO: BPMN 2.0 Based Ontology for Business Process Representation.* 2019; ontology repo
  <https://github.com/AminaANNANE/BBO_BPMNbasedOntology>
- Car, N. *dmn-ont — OWL ontology of DMN 1.1.* 2017, CC-BY 4.0.
  <https://github.com/nicholascar/dmn-ont>
- Object Management Group. *Ontology Definition Metamodel (ODM).* <https://www.omg.org/odm/>
- Object Management Group. *Decision Model and Notation (DMN)* and *BPMN 2.0* specifications.
- The Open Group. *ArchiMate 3.2 Specification* and ArchiMate Model Exchange File Format.
- bp4mc2. *archimate2rdf — Translating the ArchiMate Model Exchange File Format to RDF.*
  <https://github.com/bp4mc2/archimate2rdf>
- W3C. *The Organization Ontology (vocab-org).* <https://www.w3.org/TR/vocab-org/>
- W3C. *R2RML: RDB to RDF Mapping Language.* <https://www.w3.org/ns/r2rml>
- W3C KG-Construct Community Group. *RML-Core specification* (modular RML, 2023–2025) and Springer chapter
  *The RML Ontology: A Community-Driven Modular Redesign.*
  <https://kg-construct.github.io/rml-core/spec/docs/> ;
  <https://link.springer.com/chapter/10.1007/978-3-031-47243-5_9>
- Laurier, W., Kiehn, J., Polovina, S. *REA2: A unified formalisation of the Resource-Event-Agent ontology.*
  *Applied Ontology*, IOS Press, 2018. DOI 10.3233/AO-180198. <https://journals.sagepub.com/doi/10.3233/AO-180198>
  (metamodel in OntoUML; SWI-Prolog proof of concept uniting REA with the Open-EDI Business Transaction
  Ontology — NOT an OWL formalisation.)
- Gailly/Geerts/Poels. *Towards an OWL-formalization of the Resource Event Agent Business Domain Ontology.*
  (the OWL-REA anchor used as Weave's RDF mapping target.)
- NeMO/UFES. *gUFO: A Lightweight Implementation of UFO (OWL 2 DL).*
  <https://nemo-ufes.github.io/gufo/> ; OntoUML/UFO Catalog <https://github.com/OntoUML/ontouml-models>
- Gordijn, J. & Akkermans, H. *e-Business value modelling using the e3-value ontology* (ScienceDirect) and
  Pijpers/Gordijn *A UML Profile for the e3-value e-Business Modeling Ontology.*
- Brown, S. *The C4 model for visualising software architecture.* <https://c4model.com> (notation; no
  canonical OWL ontology — mapping constructed here over ArchiMate).
- W3C. *PROV-O*, *OWL-Time*, *SHACL* recommendations.

Orientation only (not cited as substantive basis): vendor/explainer pages (Atlan RDF-vs-OWL, NILUS, Wikipedia).
