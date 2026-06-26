# R4 — Semantic/KG Platforms & Data Catalog/Governance

**Status:** Draft for review
**Author:** Research session (Opus 4.8)
**Date:** 2026-06-26
**Brief:** `.claude/reports/00-research-brief.md` (§3 frame, §4 questions, §7 standards)
**Scope:** Two adjacent categories that bracket Weave's Constitution Engine —
(a) semantic / knowledge-graph platforms and (b) data catalog & governance — assessed for what is
commodity substrate (buy/adopt) versus genuine differentiator (build).

---

## 1. Why these two categories matter to Weave

These vendors are the strongest evidence for and against two of the brief's hypotheses:

- **H4 — the moat is authoring + liveness + closure, not storage.** If RDF/OWL/SHACL/SPARQL are sold
  as commodities by a dozen vendors, then Weave's triple store choice (Oxigraph → Neptune/Fuseki) is
  a substrate decision, not a competitive edge. This report tests that directly.
- **The "govern" loop stage.** Catalog/governance vendors own *govern* — glossary, lineage, stewardship,
  policy — more deeply than Weave plans to in the MVP. The question is whether Weave should build that
  or treat it as a buy/integrate surface.

The headline finding (developed below): **every subject here clusters on `model` + `govern`. None
closes to `generate` or `automate` in the Weave sense** (emit running apps, agents, or pipelines from
the model). Their "AI" is NL-to-query, GraphRAG retrieval, and model-editing assistance — real, worth
emulating, but not application generation. That gap *is* Weave's whitespace, restated from the supply
side.

**Scope of the "none generates" claim (verification note).** This is **directly verified against
primary docs for four subjects** — Stardog [S2], Microsoft Purview [S16], data.world [S14], and
Atlan [S13] — each of which is NL-to-query, GraphRAG retrieval, model-editing assistance, or a
governance/context layer, with no application/agent/pipeline code generation. For the remaining four
(GraphDB/Graphwise, TopBraid EDG, Altair/Anzo, Collibra) the claim is **supported by the same pattern
but not independently confirmed against each vendor's primary docs this session** — treat the
universal "none of the eight" as a strong inference, not an exhaustively audited fact. One trap worth
naming: **Graphwise markets "GenAI app development" for GraphDB 11, but that is GraphRAG retrieval
tooling, not application code generation** [S5] — exactly the kind of marketing phrasing that must be
read carefully against the §1 thesis.

---

## 2. Category (a): Semantic / knowledge-graph platforms

All four are built on the same W3C stack Weave has already committed to. That uniformity is the point.

### 2.1 Stardog

**Data model & reasoning.** Stardog is an RDF graph platform that "inferences (performs reasoning) at
QUERY time, meaning you're using the most up-to-date data" — an OWL/rules inference engine applied at
query time rather than materialised, marketed as an "Inference Engine for explainable AI" that
"harmonize[s] conflicting data definitions" by applying business rules at query time (stardog.com,
© 2026). [S1][S2]

**SHACL.** Stardog "supports the open standard SHACL, a declarative language for specifying constraints
over RDF graphs," layered on its older Integrity Constraint Validation (ICV) feature, and crucially
"offers explanations for violations of the constraints, telling you not just that there is invalid data,
but precisely what that invalid data is, and why it's invalid." [S1][S2]

**Virtual graphs / federation.** This is Stardog's strongest differentiator versus a plain triple store.
It "rewrites (parts of) SPARQL queries against Stardog into native query syntaxes like SQL, issues the
native queries to remote datasources, and then translates the native results into SPARQL results,"
across RDBMSs (JDBC), CSVs, and NoSQL (MongoDB, Elasticsearch, Cassandra, JSON). Both **virtual**
(query in situ) and **materialised** (`virtual import`) modes are supported. Documented limitations are
honest and worth noting: "SPARQL MINUS operator lacks SQL translation support," duplicate solutions may
be returned, "datatype comparison semantics don't consistently follow XML Schema standards," and "R2RML
named graphs remain unsupported." [S3]

**Generative AI.** "Stardog Voicebox, a knowledge engineer powered by Large Language Models (LLM),
simplifies knowledge graph model building and maintenance as well as query writing with plain language
instructions" (© 2026). This is **NL→model-edit and NL→query**, *not* application generation. [S2]

### 2.2 Ontotext / Graphwise (GraphDB + PoolParty)

**Corporate event (date-sensitive).** Ontotext and Semantic Web Company merged on **23 October 2024**
into **Graphwise**, combining GraphDB (RDF database) with PoolParty (taxonomy management, automated
tagging, semantic search, recommenders). The merger rationale was that "GraphDB and PoolParty were often
used by customers simultaneously." [S4]

**GraphDB 11 (2025).** The first major post-merger release; per trade coverage it adds "broader support
for LLMs, enhanced GraphRAG, and the addition of MCP for agentic AI." *(Sourced from BigDATAwire/HPCwire
trade press, 8 Jul 2025 — secondary; the primary product release notes could not be fetched this session,
so treat the MCP/GraphRAG specifics as un-cross-checked.)* [S5]

**Standards.** Graphwise positions GraphDB's value as resting on "OWL ontologies, SKOS taxonomies, and
SHACL," and notes that "with inference, SHACL can also employ the class hierarchy to apply constraints
for a root class on its subclasses." PoolParty supplies the SKOS taxonomy/glossary + tagging layer. [S5]

### 2.3 TopBraid EDG (TopQuadrant)

**SHACL-native ontology modelling.** EDG is the purest expression of "the W3C stack as a product." It
"uses the W3C's SHACL standard … to define schemas and validate data against ontological rules";
"classes and properties are described using SHACL." It ships "over 20 pre-built ontologies" containing
"hundreds of classes." [S6][S7]

**SKOS taxonomies + business glossary.** "A taxonomy in EDG is an asset collection based on SKOS"; the
Vocabulary Management package handles "Taxonomies, Ontologies, and Crosswalks," and these "integrate
seamlessly with business glossaries, reference data, and data catalogs." "Glossary Term" is a
first-class entity class. [S7][S8]

**Critically — it governs, it does not generate.** The TopQuadrant docs "emphasise modeling governance
rather than application generation … the platform functions as a governance tool for managing these
models." [S6]

### 2.4 Cambridge Semantics / Altair Graph Studio (Anzo)

**Ownership (date-sensitive, three names in 18 months).** Cambridge Semantics' Anzo platform → acquired
by **Altair (April 2024)** → rebranded **Altair Graph Studio** → **Siemens announced acquisition of
Altair on 26 March 2025**. Search results also show a "Rapidminer Graph Studio" label in flux. Any
ownership claim must be dated; the product identity is unstable. [S9]

**Capability.** "AnzoGraph DB is a massively parallel processing (MPP) native graph database built for …
analytics at scale (trillions of triples …)," positioned as an "MPP native graph OLAP database." Graph
Studio is "an enterprise-scale knowledge graph platform built on open, W3C standards-based ontology …
into a unified, queryable semantic layer, without moving or duplicating data." Its differentiator is
**OLAP-scale analytics**, not authoring or generation. [S9]

### 2.5 What category (a) proves — H4 confirmed on the storage axis

| Capability | Stardog | GraphDB/Graphwise | TopBraid EDG | Altair/Anzo |
|---|---|---|---|---|
| RDF/OWL/SPARQL store | Yes | Yes | Yes | Yes (MPP) |
| OWL/rules reasoning | Query-time | Inference | SHACL-rule | Yes |
| SHACL validation | Yes (+explain) | Yes | Yes (schema *is* SHACL) | Yes |
| SKOS taxonomy/glossary | Add-on | PoolParty | First-class | Add-on |
| Virtual/federated graph | **Strong** | Yes | Limited | "no-move" semantic layer |
| NL assistant | Voicebox | GraphRAG/MCP | Limited | Limited |
| **Generate apps/agents/pipelines** | **No** | **No** | **No** | **No** |

The W3C stack (RDF/OWL/SHACL/SPARQL/SKOS) is unambiguously **commodity** — four mature vendors plus
Oxigraph/Jena/Neptune all implement it. SHACL itself has been a **W3C Recommendation since 20 July
2017** and is explicitly designed for "user interface building, code generation and data integration,"
not just validation. [S10] **Storage and standards conformance are not a moat.** The only
storage-adjacent capability that is genuinely differentiating is **virtual-graph federation** (Stardog),
because it touches *liveness* — binding the model to source data without ETL.

---

## 3. Category (b): Data catalog & governance

These own the `govern` stage. Their data models are metadata catalogs (some graph-backed), not business
ontologies, and none generates running software.

### 3.1 Collibra

Enterprise governance suite: business glossary, data catalog, lineage (column-level), data quality,
workflow engine, plus newer AI-model governance. Collibra defines a business glossary as "a complete set
of data-related terms explained in simple language" using "a standardized set of terms and definitions
used consistently across an organization," and lineage as "the data's lifecycle path … where data
originates (source), how it moves, and what transformations it undergoes" at "individual column or field
level." [S11] Its public glossary mentions a knowledge graph only generically ("a sophisticated type of
database … used to store and manage the semantic layer"); it does **not** expose an RDF/OWL/SPARQL model
to users, and the docs reviewed give "no indication Collibra generates applications, agents, or data
pipelines." [S11][S12]

### 3.2 Atlan

Repositions (2025–26) as the **"Context Layer for AI"** with an **"Enterprise Data Graph"** — "Connect
all your business systems and pull context across your data estate into one living graph" — plus active
metadata (automated classification, tagging, policy propagation), real-time column-level lineage, and
"AI teammates that document tacit knowledge and make your data AI-ready." Atlan self-reports being a
Leader in the **2026 Gartner Magic Quadrant for D&A Governance Platforms** and the **Forrester Wave for
Data Governance, Q3 2025** *(self-reported on atlan.com — treat as marketing until corroborated against
the paywalled analyst reports)*. Atlan "governs metadata rather than generates applications." [S13]

### 3.3 data.world

The catalog that most explicitly markets itself as **knowledge-graph-native**. The fetched product page
describes "a knowledge graph architecture [that] represents disparate entities and their relationships in
the form of nodes and edges," powering catalog, lineage, and a "semantic glossary," and states it
"powers … AI-powered applications" through semantic context but "enables rather than auto-generates them"
— focus is "discovery and governance first." [S14] *Caveat:* the RDF/OWL/SPARQL phrasing for data.world
appears in orientation search snippets and data.world marketing, but the **fetched product page did not
explicitly name the W3C stack** ("doesn't explicitly mention RDF, OWL, or SPARQL technical
specifications") — so treat "genuinely RDF-native" as marketed-but-not-confirmed-on-this-page rather than
verified. Either way, data.world is the closest analogue to Weave's *substrate* among the catalog
vendors — but it stops at catalog/govern. [S14][S15]

### 3.4 Microsoft Purview (the governance thread)

**Unified Catalog** (GA rolling out 2025–26; doc updated 16 Mar 2026) is a federated-governance SaaS
built on a **proprietary metamodel, not RDF/W3C**. Its primitives: **governance domains** ("a mini
catalog inside Unified Catalog," organised by business concept like Marketing/Finance); **data products**
(grouped assets); **glossary terms** taken "from static objects to active objects … Policies within these
terms allow data stewards to scale governance," where "terms applied to data products trickle down to the
data assets and automatically secure those resources with their attached policies"; **critical data
elements**; **OKRs**; **lineage** ("the lifecycle that spans the data's origin, and where it moves over
time"); and an **AI-powered copilot** for search. [S16][S17] Notably, Microsoft Learn's own publishing
pipeline runs on **PoolParty** ontologies (visible in the page's `cmProducts`/`spProducts` metadata
URLs) — incidental confirmation that even Microsoft's docs estate is semantically modelled. [S16]

**Purview's "active glossary terms" is the standout pattern**: a term is not a dictionary entry but a
*policy carrier* that propagates governance downward. This is the single most Weave-relevant idea in the
governance category, because it makes the glossary *behavioural*, edging toward `automate`.

### 3.5 What category (b) proves

| Vendor | Underlying model | Glossary | Lineage | SKOS/W3C | Generate/Automate |
|---|---|---|---|---|---|
| Collibra | Proprietary metamodel | Yes | Column-level | No (generic KG only) | No |
| Atlan | "Enterprise Data Graph" (proprietary) | Yes | Real-time column | No (not exposed) | No (AI = metadata) |
| data.world | Graph-native (W3C marketed, unconfirmed) | Semantic glossary | Graph-powered | Marketed | No (enables, not gen) |
| Purview | Proprietary, policy-carrying terms | **Active terms** | Yes | No (PoolParty internally) | Partial (policy propagation) |

Governance is a **mature, crowded, well-defended category**. Glossary + lineage + stewardship is table
stakes here and would be a multi-year build for Weave to match — and would *not* differentiate it.

---

## 4. Placement on the three-paradigm frame

All R4 subjects are overwhelmingly **descriptive-modeled** (humans author the schema/glossary), with a
thin reach into **data-bound** via federation/lineage. **None is mined-observed** (no process mining)
and none is **data-bound-actionable** in Palantir's write-back sense.

| Subject | Descriptive-modeled | Mined-observed | Data-bound-actionable |
|---|---|---|---|
| Stardog | Core (ontology authoring) | — | Partial — virtual graphs bind to live sources (read), no write-back |
| GraphDB/Graphwise | Core | — | Partial — federation/GraphRAG (read) |
| TopBraid EDG | **Core** (SHACL model + glossary) | — | — (governance repository) |
| Altair/Anzo | Core | — | Partial — "no-move" semantic layer (read/analytics) |
| Collibra | Core (glossary/policy) | — | Lineage observes flow (metadata, not events) |
| Atlan | Core | — | Active metadata over live estate (read) |
| data.world | Core (RDF catalog) | — | Lineage (metadata) |
| Purview | Core (governance domains) | — | Policy propagation to live assets (govern-time write) |

**Implication:** R4 confirms the brief's frame — this entire field lives in the descriptive-modeled
column with read-only tendrils into data-bound. The **mined-observed** column belongs to R3 (Celonis);
the **actionable write-back** column belongs to R1 (Foundry). Weave's union thesis (H1) is *not*
contradicted by any R4 subject; they reinforce it by absence.

---

## 5. Placement on the four loop stages (model → generate → automate → govern)

| Subject | model | generate | automate | govern |
|---|---|---|---|---|
| Stardog | ●● (Voicebox NL authoring) | ○ | ○ | ◐ (SHACL DQ) |
| GraphDB/Graphwise | ●● | ○ | ◐ (MCP/agentic, unverified) | ◐ |
| TopBraid EDG | ●● (SHACL-native) | ○ | ○ | ●● (EDG = governance) |
| Altair/Anzo | ●● (OLAP analytics) | ○ | ○ | ◐ |
| Collibra | ◐ (glossary) | ○ | ◐ (workflow engine) | ●● |
| Atlan | ◐ | ○ | ◐ (policy propagation) | ●● |
| data.world | ● (RDF catalog) | ○ | ○ | ●● |
| Purview | ◐ | ○ | ◐ (active terms propagate policy) | ●● |

Legend: ●● strong · ● present · ◐ partial · ○ absent.

**Reading:** category (a) is strong on `model`, weak on `govern`; category (b) is strong on `govern`,
weak on `model`. **The `generate` column is empty across all eight** — directly verified for Stardog,
Purview, data.world, and Atlan [S2][S13][S14][S16]; a strong inference (not an exhaustive audit) for
the other four, and notably *not* contradicted by Graphwise's "GenAI app development" pitch, which is
GraphRAG retrieval rather than code generation [S5]. `automate` appears only as workflow engines
(Collibra) and policy propagation (Purview/Atlan) — governance automation, not the
model→app/agent/pipeline automation Weave targets. This empty `generate` column is the R4 payload for H1.

---

## 6. Build-vs-buy verdict per capability (the task's core question)

| Capability | Verdict for Weave | Rationale |
|---|---|---|
| RDF/OWL/SPARQL store | **Buy/Adopt** (already: Oxigraph→Neptune/Fuseki) | Commodity; four vendors + open source. No moat. [S10] |
| SHACL validation | **Adopt the standard, build the UX** | SHACL is a 2017 W3C Rec [S10]; the differentiator is *non-expert authoring of shapes*, not the engine. |
| Reasoning (OWL/rules) | **Adopt** | Query-time inference is a solved, commodity feature (Stardog, GraphDB). |
| Virtual/federated graph | **Emulate** (high priority) | Stardog's SPARQL→SQL federation is the one storage-adjacent feature that delivers *liveness*. Directly serves Weave's "data lives in Snowflake/Databricks/Azure" requirement. |
| SKOS taxonomy / glossary | **Emulate-lite** | Use SKOS for the reconciliation spine (per brief B3); not a standalone product surface. |
| Business glossary + lineage + stewardship | **Avoid building deep; integrate later** | Collibra/Atlan/Purview own this. Multi-year build, zero differentiation. |
| NL→model / NL→query assistant | **Emulate** | Stardog Voicebox + GraphDB GenAI prove demand; aligns with Weave's NL+forms authoring. |
| **Generate apps/agents/pipelines** | **BUILD — this is the moat** | No R4 subject does it (verified for Stardog/Purview/data.world/Atlan [S2][S13][S14][S16]; strong inference for the rest). This is Weave's whitespace. |

**Single most important call:** the triple store, reasoner, and SHACL engine are **substrate (buy/adopt)**;
**virtual-graph federation and NL authoring are patterns to emulate**; **generation + automation closure
is the differentiator to build.** This is H4, confirmed from the supply side.

---

## 7. Implications for Weave

### 7.1 Emulate (copy the pattern)

- **Stardog virtual graphs / SPARQL→SQL federation.** The canonical way to keep the model *live* against
  Snowflake/Databricks/Azure/S3 without ETL. Emulate the architecture (rewrite + push-down + in-situ
  query) and the honesty about limitations. This is the `liveness` leg of H4. [S3]
- **Purview "active glossary terms."** Make glossary/ontology terms *policy carriers* that propagate
  governance to bound data, not inert dictionary entries. This nudges Weave's `govern` stage toward
  `automate` cheaply. [S16]
- **Stardog Voicebox / GraphDB GenAI NL authoring.** NL→model-edit and NL→query, with explanation of
  SHACL violations ("why it's invalid"). Matches Weave's NL+forms mandate and is provably in demand. [S2][S3]
- **TopBraid's "SHACL *is* the schema" stance + shipped ontologies.** EDG ships 20+ pre-built ontologies
  as SHACL; Weave already plans a shipped universal ontology — validate that decision and emulate the
  "schema-as-SHACL, governed in-product" model. [S6][S7]

### 7.2 Adopt (use the tech/standard directly)

- **The full W3C stack** (RDF/OWL 2 DL / SHACL / SPARQL / SKOS / PROV-O) — already fixed in CLAUDE.md and
  vindicated: it is the lingua franca of every serious vendor here. [S10]
- **SHACL (W3C Rec, 2017)** for validation *and* its lesser-known sanctioned uses — "UI building, code
  generation and data integration" — which directly support Weave's forms-authoring and generation. [S10]
- **SKOS** as the cross-notation reconciliation spine (brief B3), exactly as PoolParty and TopBraid use it.

### 7.3 Avoid (commodity / anti-pattern)

- **Don't build a deep data-catalog / lineage / stewardship product.** Collibra, Atlan, data.world, and
  Purview own it; it is table-stakes governance, not differentiation, and a multi-year sink. Integrate or
  defer. [S11][S13][S14][S16]
- **Don't treat triple-store choice as strategic.** It is substrate. Spending architecture cycles
  selecting Stardog/GraphDB over Oxigraph/Neptune for *competitive* reasons is misallocated; choose on
  ops/cost/federation, not differentiation. [S10]
- **Don't over-index on OLAP graph analytics** (Altair/Anzo's niche) — not Weave's MVP problem.
- **Don't ship superlative marketing claims** ("most comprehensive platform," self-reported MQ/Wave
  leadership) as fact — they are the vendor-bias trap §10 warns of.

### 7.4 Differentiate (deliberate divergence, and why)

- **Generation + automation closure.** The empty `generate` column across all eight subjects *is* the
  differentiation — directly verified for Stardog, Purview, data.world, and Atlan
  [S2][S13][S14][S16], and a strong inference for the rest. Every vendor here stops at model+govern;
  Weave continues to model→**generate**→**automate**. This is the H1 whitespace, observed from the
  KG/governance flank.
- **Open W3C semantics vs proprietary metamodels.** Collibra, Atlan, and Purview use proprietary
  metamodels; data.world is the only catalog vendor that *markets* an RDF/graph-native core (W3C-stack
  specifics unconfirmed on its product page). Weave's openness is a portability/lock-in wedge against the
  governance incumbents (mirrors H2's wedge against Palantir). [S11][S13][S16]
- **Union of paradigms.** R4 subjects are descriptive-modeled only. Weave's descriptive + observed
  (R3-style) + data-bound model is something none of them attempt.
- **Shipped universal ontology + NL/forms for business users.** TopBraid ships ontologies but for
  *ontologists*; the governance tools serve *data stewards*. Weave's reach to non-technical business
  authors (NL+forms over a shipped ArchiMate-aligned ontology) is unoccupied territory here.

### 7.5 Flag to the architecture (not a contradiction — a recommendation)

CLAUDE.md fixes the store path as **Oxigraph (dev) → Neptune or Jena Fuseki (prod, deferred to the
Constitution Engine tech spec)**. R4 surfaces one capability that path does **not** natively give you:
**mature SPARQL→SQL virtual-graph federation** (Stardog's strength). Neptune and Fuseki are stores, not
federation engines. **Recommendation, for the Constitution Engine tech spec to weigh:** decide
explicitly whether data-source binding is built in-house (R2RML/RML + a push-down query layer) or
whether a federation-capable engine (Stardog, or Ontop as an open-source virtual-KG layer) is adopted for
the `liveness` leg. This does not relitigate the store decision; it flags a gap the store decision does
not close. Do not read this as "buy Stardog as the platform" — only its federation pattern is in scope.

---

## 8. Confidence & caveats

- **Vendor-marketing bias:** stardog.com/platform, atlan.com, and graphwise marketing pages oversell.
  Self-reported analyst placements (Atlan MQ/Wave) are flagged high-bias and attributed "per Atlan."
- **Recency / un-cross-checked:** GraphDB 11's MCP/GraphRAG specifics rest on trade press (HPCwire, Jul
  2025); the primary release notes 403'd this session. Altair/Anzo's product identity is mid-flux
  (Cambridge Semantics → Altair Apr 2024 → Siemens announced Mar 2025).
- **Scope of the "none generates apps/agents/pipelines" claim:** directly verified against primary docs
  for **four** of the eight subjects — Stardog [S2], Microsoft Purview [S16], data.world [S14], and
  Atlan [S13]. For the other four (GraphDB/Graphwise, TopBraid EDG, Altair/Anzo, Collibra) it is a
  strong inference from the same pattern, not an exhaustive per-vendor audit. Graphwise's "GenAI app
  development" marketing for GraphDB 11 is GraphRAG retrieval tooling, not application code generation
  [S5] — it does not contradict the claim, but it is the phrasing most likely to mislead.
- **Primary-source ratio:** 14 of 17 distinct cited sources are primary-type (vendor first-party docs,
  vendor product pages, Microsoft Learn, or W3C standards) = **0.82**; 3 are trade press / third-party
  orientation (S5, S9, S12). Of the 14 primaries, **10 were directly fetched and quoted** this session
  (S2, S3, S4, S6, S7, S10, S11, S13, S14, S16); the remaining four (S1, S8, S15, S17) are
  primary-type URLs corroborated via search snippets but not separately fetched — discount accordingly.

---

## Sources

Primary (vendor docs / first-party / standards):

- [S1] Stardog Docs — Data Quality Constraints / SHACL. <https://docs.stardog.com/data-quality-constraints>
- [S2] Stardog — Platform (incl. Voicebox, inference engine), © 2026. <https://www.stardog.com/platform/>
- [S3] Stardog Docs — Virtual Graphs. <https://docs.stardog.com/virtual-graphs/>
- [S4] Graphwise — "Graphwise Merger: SWC + Ontotext" (merger 23 Oct 2024).
  <https://graphwise.ai/blog/graphwise-merger-swc-ontotext/>
- [S6] TopQuadrant — Overview of TopBraid EDG Ontologies.
  <https://www.topquadrant.com/resources/overview-of-topbraid-edg-ontologies/>
- [S7] TopQuadrant — Taxonomy & Ontology Management product page.
  <https://www.topquadrant.com/product/taxonomy-and-ontology-management/>
- [S8] TopQuadrant — EDG 8.4 Vocabulary Management docs.
  <https://www.topquadrant.com/doc/8.4/quick_start_guides/edg_vocabulary_management/index.html>
- [S10] W3C — Shapes Constraint Language (SHACL), Recommendation 20 Jul 2017. <https://www.w3.org/TR/shacl/>
- [S11] Collibra — Data and AI Governance Glossary. <https://www.collibra.com/data-and-ai-governance-glossary>
- [S13] Atlan — Data Governance Tools (self-description, Enterprise Data Graph, analyst placements).
  <https://atlan.com/data-governance-tools/>
- [S14] data.world — Knowledge Graph product page. <https://data.world/product/knowledge-graph/>
- [S15] data.world — "What does it mean for a data catalog to be powered by a knowledge graph?"
  <https://data.world/blog/data-catalog-knowledge-graph/>
- [S16] Microsoft Learn — Learn about Microsoft Purview Unified Catalog (updated 16 Mar 2026).
  <https://learn.microsoft.com/en-us/purview/unified-catalog>
- [S17] Microsoft Learn — Glossary Terms in Unified Catalog.
  <https://learn.microsoft.com/en-us/purview/unified-catalog-glossary-terms>

Secondary / orientation (trade press, third-party — not load-bearing for capability claims):

- [S5] HPCwire/BigDATAwire — "Graphwise Bolsters GenAI App Development with GraphDB Update," 8 Jul 2025.
  <https://www.bigdatawire.com/2025/07/08/graphwise-bolsters-genai-app-development-with-graphdb-update/>
- [S9] Altair — Graph Studio product page; Wikipedia "Cambridge Semantics" (ownership timeline).
  <https://altair.com/altair-graph-studio> · <https://en.wikipedia.org/wiki/Cambridge_Semantics>
- [S12] er-Studio/Atlan third-party Collibra overviews (orientation only).
  <https://erstudio.com/blog/collibra-data-governance/>
</content>
</invoke>
