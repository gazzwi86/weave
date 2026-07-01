# R6 — Academic Foundations & Methods

**Status:** Draft — competitive & conceptual landscape study for Weave
**Owner:** research session (per `.claude/reports/00-research-brief.md`)
**Date:** 2026-06-26
**Scope:** Brief §4 Thrust B, question **B6** — what the enterprise-ontology and
KG-construction corpus establishes that Weave should **adopt** or **avoid**, mapped onto the
planned ~9-type universal ontology and the ArchiMate backbone. Tests hypothesis **H5**.

---

## 1. Why this report exists

Weave ships a **universal business ontology** that clients extend rather than author from scratch:
a ~9-type, ArchiMate-3-aligned core — Actor/Role/Org-Unit, Capability, Process/Activity,
System/Application, Data/Information asset, Rule/Policy, Event, Product/Service, KPI/Metric —
plus a Strategy/Motivation layer and a SKOS glossary
(`docs/specs/weave/engines/constitution-engine.md` § Brief). If those types and their
relationships rest on ad-hoc intuition, the model will drift, validate poorly, and fail to compose
with imported client artefacts. The enterprise-ontology research program has spent 30+ years
working out exactly these typing questions. This report extracts what is **load-bearing theory**
(adopt) versus **academic over-formalisation** (avoid, because it blocks non-expert authoring —
the Weave laws and brief make NL+forms authoring non-negotiable).

The seven bodies of work, in rough chronological / conceptual order:

| # | Corpus | Author(s) | What it contributes |
|---|---|---|---|
| 1 | Enterprise Ontology | Uschold & King 1998 | The canonical EA term set: activities, org, strategy, marketing |
| 2 | TOVE | Fox & Grüninger, U. Toronto, 1990s | Axiomatised activity/time/resource + competency-question method |
| 3 | DEMO / Enterprise Ontology | Dietz (PSI theory) | Transaction/communication-act kernel of how organisations operate |
| 4 | REA | McCarthy 1982; ISO 15944-4 | Resource–Event–Agent economic core with duality & commitments |
| 5 | OntoUML / UFO | Guizzardi et al. | Foundational identity/rigidity meta-theory for well-founded typing |
| 6 | ODM | OMG 2009/2014 | UML/ER ↔ OWL/RDF metamodel bridge for ingest |
| 7 | LLM KG construction | survey arXiv 2510.20345 (2025); Text2KGBench (2023) | The research basis for Weave's ingest/extraction method |

---

## 2. Placement on the three-paradigm frame

All seven foundations sit in the **descriptive-modeled** paradigm — "how the business is *designed*
to run", the human-authored model. None is mined-observed or data-bound-actionable on its own.
But two of them — **REA** and **DEMO** — carry an *event/transaction spine* that bridges toward the
other two paradigms, and this is precisely where Weave's union thesis (brief §3) needs theory:

- **REA's economic events + stock-flow** are the conceptual bridge to *data-bound-actionable*
  (live balances are derived from event flows, not stored — the Palantir-style "live state").
- **DEMO's transaction acts** and **TOVE's activity/causality/time axioms** are the bridge to
  *mined-observed* (an event log is a stream of exactly these acts; cf. OCEL in R3).

So the corpus gives Weave a **rigorous descriptive layer**; the observation and binding layers
(connectors, process-mining-style liveness) are additions Weave must build on top, not inherit
from this literature.

## 3. Placement on the four loop stages (model → generate → automate → govern)

| Corpus | model | generate | automate | govern |
|---|---|---|---|---|
| Enterprise Ontology (U&K) | Strong | — | — | Vocabulary baseline |
| TOVE | Strong | — | Weak (axiom inference) | Strong (competency Qs, axioms) |
| DEMO | Strong (essence) | — | Strong (act/role kernel) | Moderate |
| REA | Strong | Moderate (→ERP schema) | Moderate (commitments→workflow) | Moderate |
| OntoUML/UFO | Strong | Moderate (code-gen tooling) | — | Strong (anti-pattern validation) |
| ODM | Moderate (bridge) | Moderate (MDA transforms) | — | Weak |
| LLM KG construction | Strong (extraction) | — | — | Strong (conformance/hallucination metrics) |

The corpus is heaviest on **model** and **govern** — which is exactly the Constitution Engine's
remit (it ships first). It is thin on **generate** and **automate**, confirming those are Weave's
own whitespace, not borrowed art.

---

## 4. Each foundation, mapped to Weave's 9-type core

### 4.1 Enterprise Ontology — Uschold & King (1998)

The foundational EA ontology, built in the Edinburgh "Enterprise Project". It defines a small
**meta-ontology** — entities, classes, instances, relationships, roles, states of affairs, plus
relation-dependent entities — and then exactly **four subject areas**: Activities & Processes,
Organisation, Strategy, and Marketing (AIAI Edinburgh ontology page,
<https://www.aiai.ed.ac.uk/project/enterprise/enterprise/ontology.html>; Cambridge KER 1998):

- **Activities & Processes:** `Activity`, `Doer`, `Resource`, `Effect`, `Activity-Spec`,
  `Process-Specification`, `Hold-Authority`.
- **Organisation:** `Legal-Entity`, `Organisational-Unit`, `Ownership`, `Management-Link`.
- **Strategy:** `Purpose`, `Strategy` (= "a Plan to Achieve a high-level Purpose"), `Decision`,
  `Assumption`, `Risk`, `Factor`.
- **Marketing:** `Sale`, `Market`, `Product`, `Brand-Image`, `Promotion`, `Segmentation-Variable`.

**Mapping to Weave (approximate, not 1:1):**

| Weave type | Enterprise Ontology term (approximate) |
|---|---|
| Actor/Role/Org-Unit | Role, Legal-Entity, Organisational-Unit |
| Process/Activity | Activity, Process-Specification, Doer |
| Data/Information asset | Resource (information resources) |
| Rule/Policy | Hold-Authority, Factor |
| Product/Service | Product, Sale, Market |
| KPI/Metric | (gap — EO has no metric type) |
| Strategy/Motivation | Purpose, Strategy, Decision, Assumption, Risk (loose overlap only) |

The correspondence is **approximate, not 1:1**: EO's four subject areas broadly overlap Weave's
type families and so offer **supporting prior art** for Weave's typing, but the alignment is loose,
not term-for-term. Two qualifications matter (AIAI primary page). First, **EO has no distinct
Motivation layer** — that layered notion is ArchiMate's, not EO's; EO's *Strategy* subject area
(Purpose, Strategy, Decision, Assumption, Risk) only loosely overlaps Weave's motivation concepts.
Second, EO predates the IT-and-analytics era, so Weave's `System/Application`, `Event`, and
`KPI/Metric` types have no EO counterpart — a defensible extension, not a defect. Read U&K as
**independent corroboration** that Weave's core families (activities, organisation, products,
strategy) are conventional, **not** as a strict validation of the exact 9-type list.

### 4.2 TOVE — Fox & Grüninger (U. Toronto, 1990s)

TOVE ("TOronto Virtual Enterprise") differs from U&K in *method*: it is **axiomatised in
first-order logic** and validated by **competency questions** — the set of queries the ontology
must be able to answer is fixed *first*, and the ontology is judged complete only when its axioms
entail the answers (Grüninger & Fox; EIL U. Toronto; *CMOT* 2000). TOVE spans activity, state,
causality, time, resources, inventory, order, cost, quality, and organisation structure (EIL
"TOVE Ontologies").

**What to adopt:** (a) the **competency-question discipline** as the acceptance test for Weave's
shipped ontology and for each client extension — "what questions must this graph answer?" is a far
better scoping tool than feature lists, and it operationalises Weave Law 4 (define success
criteria, loop until verified); (b) TOVE's **activity / time / causality** micro-ontology as a
source for Weave's weakest area, the Event/temporal layer (H5's first named gap).

**What to avoid:** TOVE's **full FOL axiomatisation**. Weave's stack is OWL 2 DL + SHACL (CLAUDE.md);
DL is deliberately decidable and less expressive than FOL, and the brief mandates non-expert
authoring. Re-implementing TOVE's causal axioms would push validation outside OWL/SHACL and put
authoring out of business users' reach. Borrow the *concepts and the method*, not the logic depth.

### 4.3 DEMO / Enterprise Ontology — Dietz (PSI theory)

DEMO (Design & Engineering Methodology for Organizations) models an organisation as a web of
**transactions** between **actor roles**. Each transaction follows a universal pattern of
**coordination acts** (request, promise, declare/state, accept) around a **production act**, with
one actor as *initiator* and one as *executor* (Dietz; PSI = "Performable Sign Interactions" /
Performance in Social Interaction; CEUR Vol-2825 "Evolution of DEMO"). Its strength is reducing an
organisation to its **essence** — the commitments people make — independent of how they are
implemented.

**Mapping to Weave:** DEMO's `actor role` ↔ Weave Actor/Role; `transaction` ↔ Event +
Process/Activity; the request→promise→accept cycle is the **commitment semantics** Weave's
Event type needs to be more than a timestamp. DEMO and REA agree here: both centre on commitments
preceding events (see 4.4), and recent work re-grounds the DEMO transaction pattern in UFO
(ResearchGate, "Revisiting the DEMO Transaction Pattern with UFO").

**What to adopt:** the **actor-role + transaction-commitment kernel** as the conceptual model for
how Weave's Event and Process types relate to Actors — this is also the natural seam to the
automate stage (a coordination act is an automatable trigger).

**What to avoid:** imposing **DEMO's full method** (its four aspect models — Construction, Process,
Action, Fact — and its insistence on modelling only the "ontological" essence) on Weave users.
DEMO has a famously steep learning curve and demands trained analysts; that directly contradicts
NL+forms authoring. Use DEMO as *internal design theory*, surface only the simple
actor→commitment→event story to users.

### 4.4 REA — McCarthy (1982); ISO 15944-4

REA models economic activity as **Resources** exchanged in **Events** between **Agents**, with the
defining axiom of **duality**: every increment event (you receive a resource) is paired with a
decrement event (you give one) — e.g. a sale pairs with a cash receipt (McCarthy 1982; valueflo.ws
REA/ISO-15944-4; Wikipedia REA). The extended model adds **commitments** (promises of future
events), **contracts** (bundles of reciprocal commitments), and **policies** (rules over them).
Balances like accounts-receivable are **derived from event flows (stock-flow)**, not stored. REA is
standardised in **ISO 15944-4 (Open-edi)** and underpins modern ERP designs (e.g. Workday).

**Mapping to Weave:**

| REA concept | Weave type |
|---|---|
| Economic Resource | Product/Service, Data/Information asset |
| Economic Event | Event (the missing economic spine) |
| Economic Agent | Actor/Role/Org-Unit |
| Commitment / Contract | Rule/Policy + Event |
| Duality (give/take) | a relationship pattern over Event |

**This is the heart of H5.** REA is the single best answer to Weave's named Event/temporal gap. It
is event-centric (where ArchiMate is structure-centric), it is an ISO standard (not just a paper),
it has an OWL form (OntoREA — ResearchGate 2017), and its stock-flow derivation is the very
"live-state-from-events" pattern that bridges to the data-bound paradigm. **Adopt REA as the
economic/event core** layered onto the ArchiMate backbone.

**What to avoid:** forcing *every* business event into REA's strict economic duality. Many enterprise
events (a system alert, a policy change, a JIRA transition) are not resource exchanges. Use REA for
the value-exchange subset; keep a lighter, generic Event supertype for the rest.

### 4.5 OntoUML / UFO — Guizzardi et al.

The Unified Foundational Ontology (UFO) and its modelling language OntoUML provide the **meta-level
discipline** the EA notations lack: a theory of **identity and rigidity** (Guizzardi 2005; SAGE
*Applied Ontology* 2015 & 2022; OntoUML spec / readthedocs). Core distinctions:

- **Kind** — rigid sortal supplying a principle of identity (e.g. *Person*, *Organisation*).
- **Subkind** — rigid specialisation under one identity.
- **Role** — anti-rigid, relationally dependent (e.g. *Customer* — a Person only while in a
  relationship). **A role must not be modelled as a subtype of a kind.**
- **Phase** — anti-rigid via intrinsic change (e.g. *Active*/*Suspended* account).
- **Relator** — a truth-maker of a relationship (e.g. *Employment*, *Contract*) — reified, with its
  own identity.
- **Category / Mode / Quality** — non-sortal and intrinsic-property types.

**Why Weave needs this:** Weave's very first type is "**Actor/Role/Org-Unit**" — a bundle that UFO
would *split*: Actor and Org-Unit are **kinds**, Role is an **anti-rigid role**, and the
Actor-plays-Role link is a **relator**. ArchiMate itself has no formal identity semantics and is
routinely critiqued for conflating these (Guizzardi's group has published OntoUML analyses of
ArchiMate). Applying UFO's rigidity rules to the shipped ontology prevents the classic taxonomy
bugs (modelling *Customer* as a subclass of *Person*; treating *Contract* as an attribute instead
of a relator). UFO also has an OWL realisation (**gUFO**), so this is implementable on Weave's stack.

**What to adopt:** UFO's **kind / role / phase / relator** distinctions as an **internal design and
validation discipline** for the shipped ontology and for SHACL-checkable extension rules
(e.g. "a subclass of an anti-rigid Role type may not be declared rigid").

**What to avoid (firmly):** exposing **OntoUML stereotypes to business authors**. The «kind»/«role»/
«relator» vocabulary is exactly the formal apparatus that makes ontology engineering inaccessible —
the opposite of NL+forms. Use UFO behind the curtain (as Weave's modelling guideline and validator),
never as the user-facing language.

### 4.6 ODM — OMG Ontology Definition Metamodel

ODM is OMG's bridge between **MDA / UML / ER** and **OWL / RDF / Common Logic / Topic Maps**,
providing UML profiles for RDF and OWL and mappings among the metamodels (OMG ODM spec; Wikipedia
ODM). It is directly relevant to Weave's **ingest** capability (B5): a client's UML/ER models can in
principle be transformed to OWL via ODM mappings.

**Status caveat (date it):** ODM is **dormant**. The last formal release is **1.1 (Sept 2014)**;
1.0 was 2009 (OMG `omg.org/spec/ODM/`). It has no active revision and limited modern tooling. The
ArchiMate→OWL mappings tracked in R5 (Mendoza's *ArchiMate 3.2 as RDF*, ArchiMEO) are more current
and more relevant to Weave's actual import sources.

**What to adopt:** ODM's **mapping correspondences** (UML class→owl:Class, association→
owl:ObjectProperty, generalisation→rdfs:subClassOf) as a *reference* for the UML/ER ingest path.

**What to avoid:** **depending on ODM tooling or treating it as living standard.** Build the ingest
transforms on current RML/R2RML (relational) and the ArchiMate RDF mappings (EA models), citing ODM
only as the conceptual precedent.

### 4.7 Ontology learning & LLM-empowered KG construction (the ingest method)

This is the research basis for "ingest what the client already has" plus NL authoring. The 2025
survey **"LLM-empowered knowledge graph construction"** (arXiv 2510.20345, submitted Oct 2025)
frames the field as the classical **three-layer pipeline — ontology engineering → knowledge
extraction → knowledge fusion** — now driven by LLMs, and splits approaches into **schema-based**
(structure, normalisation, consistency) vs **schema-free** (flexibility, open discovery). It flags
limitations at each stage and future directions (KG-based reasoning, dynamic memory for agents,
multimodal KG).

**Text2KGBench** (arXiv 2308.02357, ISWC 2023) is the concrete evaluation: given an ontology and
sentences, extract facts that **conform to the ontology** (concepts, relations, domain/range) and
are **faithful** to the text, scored with seven metrics including **ontology conformance** and
**hallucination** rates over Wikidata-TekGen (10 ontologies, 13,474 sentences) and DBpedia-WebNLG
(19 ontologies, 4,860 sentences).

**What to adopt:**

- The **schema-based paradigm** — Weave *ships* an ontology, so extraction should be **ontology-
  guided** (constrained generation against the 9 types + SHACL), not open IE. This is the single
  most important method choice and it aligns the ingest pipeline with the shipped-ontology strategy.
- **Text2KGBench-style evaluation** — adopt **ontology-conformance and hallucination metrics** as
  the acceptance gate for the LLM ingest/authoring pipeline, with **SHACL as the hard validation
  bridge** (an extracted triple that violates a shape is rejected). This makes "AI-native
  throughout" auditable rather than aspirational.
- **Human-in-the-loop fusion** — the survey's fusion stage (entity/schema alignment) is where the
  brief's HITL gates belong; LLM proposes, human/ SHACL disposes.

**What to avoid:** the **schema-free paradigm** for the governed core. Open, schema-less extraction
maximises drift and hallucination — acceptable for exploratory discovery, unacceptable for a graph
that downstream engines generate code from. Keep schema-free strictly to a "suggest new types"
side-channel that a human promotes into the schema.

---

## 5. Testing H5 — "ArchiMate + a REA/DEMO-informed core is the right backbone"

> **H5 (brief §8):** ArchiMate + a REA/DEMO-informed core is the right backbone, with known gaps in
> event/temporal, data-asset, and motivation layers; the 9-type core should map cleanly onto
> ArchiMate layers.

**Verdict: CONFIRMED, with three qualifications.**

**Confirmed:** The 9 types map cleanly onto ArchiMate's layers (Business: Actor/Role/Org-Unit,
Process/Activity, Product/Service; Application: System/Application; Technology/data: Data asset;
Strategy: Capability; Motivation: Strategy layer + KPI). ArchiMate is the right *structural*
backbone — it is the lingua franca of EA, it is what clients already have (ingest leverage), and its
layered separation matches Weave's type families. The academic corpus *augments* rather than
replaces it.

**Qualification 1 — the gaps are real and the fixes are named.** ArchiMate is structure-centric and
genuinely thin on:

- **Event/temporal** → fill with **REA economic events + duality** (primary) and **TOVE
  time/causality** axioms (secondary); for the *observed* event stream, OCEL/DTDL (R3/R2).
- **Data-asset** → ArchiMate's Data Object is anaemic; enrich with **REA Resource** semantics plus
  data-model conventions (DCAT-style asset metadata, R5).
- **Motivation/value** → ArchiMate has a Motivation layer (adopt it for mission/vision/goals/
  drivers, as the brief already plans), but **value exchange** needs **REA / e3value**, which
  ArchiMate lacks.

**Qualification 2 — ArchiMate has no formal identity/rigidity semantics; UFO must supply it.** H5
names REA and DEMO but omits **UFO**, which is the corpus's most important contribution to *getting
the types right*. Recommend explicitly: **add UFO/OntoUML as the internal meta-discipline** that
governs how the ArchiMate-aligned types are defined (kind vs role vs relator), validated via gUFO +
SHACL. This is a *strengthening* of H5, not a contradiction.

**Qualification 3 — DEMO's contribution is the commitment kernel, not its method.** H5 pairs REA and
DEMO; in practice REA carries more weight (standardised, OWL-realised, ERP-proven). DEMO's value is
narrow but real: the **actor-role / coordination-act** model of *how* commitments arise — useful for
the Event type and the seam to automation — provided its heavyweight methodology stays internal.

---

## 6. Implications for Weave

### Emulate (copy the pattern)

- **TOVE's competency-question method** — gate the shipped ontology and every client extension on
  "what questions must this graph answer?", not on type count. Operationalises Law 4.
- **REA's stock-flow derivation** — model live balances/KPIs as *derived from events*, not stored.
  This is also the conceptual hook into the data-bound paradigm and keeps KPI/Metric honest.
- **Text2KGBench's evaluation harness** — score the LLM ingest pipeline on ontology-conformance and
  hallucination, continuously, as a CI gate.

### Adopt (use the theory/standard directly)

- **Uschold & King term set** as approximate cross-validation that Weave's core type families
  (activities, organisation, products, strategy) are conventionally named — supporting prior art, not
  a 1:1 match. Note EO has no distinct Motivation layer and no metric/system/event types, so it
  corroborates the backbone, not the full 9-type list.
- **REA (ISO 15944-4)** as the **economic/event core** layered on ArchiMate — the primary fix for
  the Event/temporal and value-exchange gaps. Use its OWL realisation (OntoREA) as a starting point.
- **UFO / OntoUML rigidity rules** (kind/subkind/role/phase/relator) as the **internal design and
  SHACL-validation discipline**; implement on **gUFO** (OWL), consistent with the W3C stack.
- **TOVE activity/time/causality** micro-ontology as source material for the temporal layer.
- **Schema-based, ontology-guided LLM extraction** (survey 2510.20345) with **SHACL as the hard
  validation bridge** — the method that matches Weave's ship-an-ontology strategy.
- **ODM mapping correspondences** as a *reference* for the UML/ER ingest transforms.

### Avoid (commodity / anti-pattern — esp. anything that blocks non-expert authoring)

- **Full FOL axiomatisation (TOVE-style)** — incompatible with OWL 2 DL decidability and with
  forms-based authoring. Borrow concepts, not the logic.
- **Exposing OntoUML stereotypes or DEMO aspect models to users** — the formal apparatus is exactly
  what makes ontology engineering inaccessible. Keep UFO/DEMO behind the curtain.
- **Schema-free / open IE for the governed core** — maximises drift and hallucination; confine it to
  a human-gated "suggest new type" side-channel.
- **Depending on ODM as a living standard** — dormant since 2014; cite it, don't build on its
  tooling. Prefer current RML/R2RML and ArchiMate-RDF mappings.
- **Forcing every Event into REA duality** — keep a generic Event supertype for non-economic events.

### Differentiate (where Weave deliberately diverges, and why)

- **A shipped, opinionated ~9-type ontology that fuses ArchiMate + REA + UFO discipline** — the
  literature offers each foundation separately; *no one ships the synthesis as a populated,
  client-extensible product*. The academic work proves each piece sound; the integration is Weave's.
- **Foundational rigor under a non-expert surface** — Weave runs UFO-grade typing discipline and
  TOVE-grade competency checks *internally*, while exposing only NL+forms. The corpus assumes a
  trained ontologist; Weave's wedge is delivering that rigor without one.
- **Extending the descriptive corpus to the union of three paradigms** — REA's event spine and
  DEMO's act kernel are repurposed as the bridge to mined-observed and data-bound state +
  generation + automation, which the source theories never attempted.

---

## 7. Honest assessment & residual risk

- **Recency:** the corpus is foundational (1982–2022) by nature; the *current* layer (LLM KG
  construction 2023–2025, gUFO, OntoREA, ArchiMate-RDF) is what dates the application claims. Where a
  claim rests on a 1990s source, it is the *theory* that is cited, not a capability.
- **Vendor-marketing bias:** low here — these are academic/standards sources, not vendor docs. The
  main bias risk is *researcher advocacy* (each school argues its ontology is THE one); this report
  triangulates rather than adopting any single camp wholesale.
- **Biggest open question for the data-model tech spec:** how much UFO to encode as *enforced* SHACL
  vs. *advisory* guidance. Too much enforcement re-imports the over-formalisation Weave is trying to
  avoid; too little forfeits the rigor. This is a deliberate tuning decision, flagged for the
  Constitution Engine tech spec.

---

## Sources

Primary (standards bodies, peer-reviewed, arXiv, academic project pages):

- Uschold, King, Moralee, Zorgios, *The Enterprise Ontology*, Knowledge Engineering Review, 1998 —
  <https://www.cambridge.org/core/journals/knowledge-engineering-review/article/abs/enterprise-ontology/17080176D5F06DEAEA8DBB2BAA9F8398>
- *The Enterprise Ontology* (full text PDF), AIAI, University of Edinburgh —
  <https://www.aiai.ed.ac.uk/project/enterprise/enterprise/ontology.html>
- TOVE Project, Enterprise Integration Laboratory, University of Toronto —
  <https://eil.mie.utoronto.ca/projects/tove-project/> and
  <https://eil.mie.utoronto.ca/theory/enterprise-modelling/tove/>
- Grüninger & Fox, *Ontologies to Support Process Integration in Enterprise Engineering*,
  Computational & Mathematical Organization Theory, 2000 —
  <https://link.springer.com/article/10.1023/A:1009610430261>
- Dietz et al., *The Evolution of DEMO*, CEUR-WS Vol-2825 —
  <https://ceur-ws.org/Vol-2825/paper6.pdf>
- *A framework to semantify BPMN models using DEMO business transaction pattern*, arXiv 2012.09557 —
  <https://arxiv.org/pdf/2012.09557>
- *Revisiting the DEMO Transaction Pattern with the Unified Foundational Ontology (UFO)* —
  <https://www.researchgate.net/publication/316430933>
- McCarthy, *The REA Accounting Model as an Accounting and Economic Ontology* / ISO 15944-4 —
  <https://www.valueflo.ws/linked-docs/REA-Ontology_ISO-15944-4--BillMcCarthy_20131107.pdf>
- *The OntoREA Accounting Model: Ontology-based Modeling of the Accounting Domain*, 2017 —
  <https://www.researchgate.net/publication/318824704>
- Guizzardi et al., *UFO: Unified Foundational Ontology*, Applied Ontology, 2022 —
  <https://journals.sagepub.com/doi/abs/10.3233/AO-210256>
- Guizzardi, Wagner, Almeida, Guizzardi, *Towards Ontological Foundations for Conceptual Modeling:
  The UFO Story*, Applied Ontology, 2015 — <https://journals.sagepub.com/doi/10.3233/AO-150157>
- *Endurant Types in Ontology-Driven Conceptual Modeling: Towards OntoUML 2.0*, NEMO/UFES —
  <https://nemo.inf.ufes.br/wp-content/papercite-data/pdf/endurant_types_in_ontology_driven_conceptual_modeling__towards_ontouml_2_0_2018.pdf>
- OntoUML specification (rigidity, stereotypes) — <https://ontouml.readthedocs.io/en/latest/theory/rigidity.html>
  and <https://ontology.com.br/ontouml/spec/>
- OMG, *Ontology Definition Metamodel (ODM)* v1.1 — <https://www.omg.org/spec/ODM/> and
  <https://www.omg.org/spec/ODM/1.1/PDF>
- Bian et al., *LLM-empowered knowledge graph construction: a survey*, arXiv 2510.20345, 2025 —
  <https://arxiv.org/abs/2510.20345>
- Mihindukulasooriya, Tiwari, Enguix, Lata, *Text2KGBench: A Benchmark for Ontology-Driven Knowledge
  Graph Generation from Text*, ISWC 2023 / arXiv 2308.02357 — <https://arxiv.org/abs/2308.02357>

Secondary (orientation only — not the cited basis for capability claims):

- Wikipedia: *TOVE Project*, *Resources, Events, Agents*, *Ontology Definition MetaModel*.

Internal grounding:

- `.claude/reports/00-research-brief.md` (frame §3, questions §4, hypotheses §8).
- `docs/specs/weave/engines/constitution-engine.md` § Brief (ontology kinds).
- `CLAUDE.md` (confirmed W3C stack, OWL 2 DL + SHACL, ArchiMate-3 alignment, NL+forms authoring).
