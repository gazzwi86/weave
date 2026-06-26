# R2 — Enterprise Architecture & Digital-Twin-of-Organization Tools

**Status:** Final (verified)
**Date:** 2026-06-26
**Author:** Research session (Weave landscape study)
**Scope:** LeanIX (SAP), Ardoq, Bizzdesign, MEGA HOPEX, Software AG Alfabet, Catio (AI-native entrant),
and the Microsoft hyperscaler twin thread (Azure Digital Twins + DTDL, Fabric Digital Twin Builder).
These are the **descriptive-modeled** exemplars of the three-paradigm frame.

---

## 1. Executive summary

This category is where Weave's "model the business" surface lives today — and where almost every
incumbent **stops at model**. EA tools give you a governed repository of fact sheets / ArchiMate
objects, capability maps, dependency graphs, and impact analysis. They are excellent at description
and increasingly good at AI-assisted reasoning over the model, but with one partial exception (Ardoq
post-GraphLake) they do **not** bind to live source data, and **none** generates running applications,
agents, or pipelines from the model. That gap — generate + automate — is precisely Weave's whitespace.

Three structural findings drive the rest of this report:

1. **The metamodels are bespoke, not standards-native.** LeanIX, Ardoq, and Alfabet ship their own
   pragmatic fact-sheet/object metamodels; ArchiMate is *supported* (import/diagram) but is not the
   storage substrate. Only Bizzdesign and MEGA HOPEX are genuinely ArchiMate/TOGAF-native. Almost
   none uses W3C RDF/OWL/SHACL as the persistence layer — Ardoq's June-2026 GraphLake acquisition is
   the first material move toward it.
2. **"Digital twin of the organization" (DTO) is the convergence label.** Gartner's DTO framing
   (a continuously-synchronised model integrating structural, informational, behavioural and
   performance perspectives) is now the banner that EA vendors (Ardoq, MEGA/QualiWare, BusinessOptix)
   and hyperscalers (Microsoft Fabric) are all marching under — confirming Weave's thesis (H6) and
   warning that the window is closing.
3. **The loop almost never closes.** Model is universal; govern is mature; automate is emerging only
   as "automate the EA practice itself" (Ardoq's ~40% routine-work claim); **generate is essentially
   absent**. The Microsoft twin stack reaches "data-bound + dashboards/alerts" but not app generation.

---

## 2. The category and the DTO framing (Gartner — H6)

Gartner defines a **Digital Twin of an Organization (DTO)** as "a dynamic software model of any
organization that integrates operational and contextual data to understand how an organization
operationalizes its business model, connects with its current state, responds to changes, deploys
resources and delivers customer value" — introduced by Gartner in 2017 and positioned as a
"continuously synchronized enterprise model integrating structural, informational, behavioral, and
performance perspectives." [Gartner, *Quick Answer: What Is a Digital Twin of an Organization?*;
Gartner DTO platform-selection webinar, 2025] This is the same loop Weave targets — and the word
"synchronized" is the operative gap: most EA tools are manually maintained snapshots, not live twins.

The DTO label is now a marketing battleground: QualiWare, BusinessOptix, Interfacing and Ardoq all
brand around it, and Ardoq frames DTO explicitly as "the evolution of EA." [ardoq.com/blog/
digital-twin-of-an-organization] The hyperscaler entry (Microsoft Fabric Digital Twin Builder) is
DTO-adjacent but currently scoped to **physical/industrial** operations (assets, processes), not the
full org — an opening Weave should note.

---

## 3. Subject profiles

For each: **headline capability · data model underneath · authoring experience for non-technical
users · placement (paradigm + loop stages)**.

### 3.1 SAP LeanIX

- **Headline capability (2025–26):** Market-leading SaaS EA repository centred on the *application*
  portfolio; strongest at application rationalisation, technology-risk/obsolescence, business-
  capability mapping, and SAP transformation (RISE/S4HANA). Acquired by SAP Nov 2023; now "SAP LeanIX."
- **Data model:** A configurable **fact-sheet metamodel** — *not* a graph store exposed to users and
  *not* ArchiMate-native. Meta Model v4 ships **12 fact-sheet types** by default (Application is the
  centre; Business Capability, Organization, Data Object, IT Component, Tech Category, Project, etc.),
  fully configurable but with strong best-practice defaults. [help.sap.com/docs/leanix/ea/meta-model;
  learning.sap.com SAP LeanIX Meta Model] Fact sheets are connected by typed **relations**; capability
  maps are first-class. ArchiMate is **supported by customisation, not natively**: "SAP LeanIX comes
  with its own meta-model … By adding custom categories and types to application and component fact
  sheets … you can build an ArchiMate architecture model within our platform."
  [leanix.net/en/blog/archimate-sap-leanix]
- **Authoring (non-technical):** Forms-first fact-sheet editing, **Surveys** to crowdsource updates
  from business owners, Excel/XLSX round-trip import/export, REST + GraphQL APIs, and (2025) **AI
  diagram-to-data**: upload an architecture image and AI extracts components/relations into fact
  sheets. [leanix.net/en/blog/diagram-to-data; help.sap.com/docs/leanix/ea/importing-and-exporting-data]
- **Placement:** Descriptive-modeled. Loop: **model ✓ · generate ✗ · automate ✗ (govern-grade
  workflows only) · govern ✓**. No app/pipeline/agent generation.

### 3.2 Ardoq

- **Headline capability (2025–26):** Graph-native, "AI-first" EA. Ardoq positions itself as the
  platform where "AI reasons on a live architecture graph, outputs are traceable to source, and
  governance is built in by design," and claims it shipped 100+ features in 2025.
  [ardoq.com/news/ai-first-enterprise-architecture-platform]
- **Data model:** Built from inception on a **graph** (nodes = applications, capabilities, people,
  data; edges = relationships). In **June 2026** Ardoq acquired **GraphLake**, "a unified RDF and
  labeled-property-graph database," to build an "EA-grade context graph for enterprise AI." This adds
  four DB-native features: **temporal/point-in-time queries, zero-cost scenario branching, per-fact
  decision provenance with trust scoring, and open standards (RDF, OWL, SHACL)**. CEO: "The graph
  wasn't a feature; it was the architecture." [ardoq.com/news/ardoq-graphlake-context-graph-
  enterprise-ai] This is the closest any EA incumbent gets to Weave's W3C substrate.
- **Authoring (non-technical):** Spreadsheet-style component editing, "broadcasts"/surveys to harvest
  data from non-architects, and (2025–26) an **Omnipresent AI Assistant** (conversational queries over
  the whole model), an **AI Import Builder** (reads docs and auto-configures source connections), and
  **Custom Agents** scoped to a customer's metamodel. [ardoq.com/news/ai-first-enterprise-
  architecture-platform]
- **Placement:** Descriptive-modeled, edging toward **mined/data-bound** via import automation and the
  context graph. Loop: **model ✓ · generate ✗ · automate ~ (automates the EA *practice* — claimed
  ~40% of routine EA work, Tenneco 292% ROI) · govern ✓ (provenance, lineage, change control)**.
  Still no generation of running software from the model.

### 3.3 Bizzdesign (Horizzon / Enterprise Studio)

- **Headline capability (2025–26):** The **ArchiMate-native** EA suite; Leader in the 2025 Gartner
  Magic Quadrant for EA Tools and top-scoring in the 2025 Critical Capabilities report. Strong on
  formal modelling rigour, business architecture (BIZBOK↔ArchiMate mapping), and portfolio/roadmap
  analysis. [bizzdesign.com; gartner.com/reviews/product/bizzdesign-horizzon] (Note: Bizzdesign
  acquired MEGA's HOPEX line — Gartner now lists "Bizzdesign Hopex" — consolidating two of this
  report's six EA subjects under one owner.)
- **Data model:** **ArchiMate 3 as the underlying metamodel** for all architecture and strategy views,
  plus support for C4, BPMN, ERD and UML; standardised model-exchange (Open Group ArchiMate Exchange
  Format) for import/export. [help.bizzdesign.com — *Modeling with the ArchiMate modeling language*;
  *Importing ArchiMate model data*] Repository-backed, relational/object store (not RDF-native).
- **Authoring (non-technical):** Primarily a **modeller's tool** — formal diagram authoring in
  Enterprise Studio with Horizzon as the web collaboration/viewing/dashboard layer for stakeholders.
  Higher modelling-skill floor than LeanIX/Ardoq; less "business user fills a form."
- **Placement:** Descriptive-modeled (the purest exemplar). Loop: **model ✓ · generate ✗ · automate ✗
  · govern ✓**.

### 3.4 MEGA HOPEX

- **Headline capability:** Heavyweight EA + **GRC** (governance, risk, compliance) repository, favoured
  in banking/insurance/regulated sectors where EA also owns regulatory mapping and operational risk.
  Mature TOGAF, ArchiMate and **BIAN** support; deep audit/traceability and scenario simulation.
  [community.mega.com — HOPEX ArchiMate; Catio EA-tools overview, 2026] Now under Bizzdesign ownership.
- **Data model:** Centralised repository over a **bespoke metamodel** with explicit **ArchiMate↔HOPEX
  object mapping** (e.g. ArchiMate Application Component → HOPEX Application) so models interchange.
  [community.mega.com forum — "How does ArchiMate work with MEGA?"]
- **Authoring (non-technical):** Repository + web-form contribution and impact-analysis dashboards;
  heaviest/most consultant-driven of the set. Strong on governance workflows, weaker on self-serve.
- **Placement:** Descriptive-modeled + GRC. Loop: **model ✓ · generate ✗ · automate ✗ · govern ✓✓
  (risk/compliance is the differentiator)**.

### 3.5 Software AG Alfabet

- **Headline capability:** Long-established EA management + IT-portfolio/APM tool; strengths in
  application portfolio analysis, dependency visualisation, impact analysis, scenario planning and
  compliance tracking; deep integration with the wider Software AG/ARIS estate. **Alfabet FastLane**
  is a pre-configured cloud edition for faster onboarding. [softwareag.com — Alfabet EAM;
  gartner.com EA-tools reviews] (Note: Software AG's process/EA assets have been changing hands —
  ARIS/Alfabet moved under Bizzdesign/other owners through 2024–25; treat vendor identity as in flux.)
- **Data model:** Configurable **meta-model** persisted in a relational database; the meta-model
  configuration is itself an artifact — exportable/importable as an **AMM file** and updatable via API.
  [softwarereviews.com / peerspot Alfabet 2025] Not graph- or RDF-native.
- **Authoring (non-technical):** Form/wizard-driven data capture, governance workflows, portfolio
  dashboards; enterprise-IT-centric rather than business-user-centric.
- **Placement:** Descriptive-modeled. Loop: **model ✓ · generate ✗ · automate ✗ · govern ✓**.

### 3.6 Catio (AI-native entrant)

- **Headline capability (2025–26):** "Architecture IDE / control plane for modern software systems" —
  a **live, queryable digital twin of an organisation's *tech stack*** that "replaces stale diagrams
  with synchronized ground truth." Driven by **31 specialised AI agents** modelled on roles (chief
  architect, data architect, etc.) that simulate design reviews; an *Archie* conversational multi-agent
  assistant lets users "talk to their architecture." Won VentureBeat Transform 2025 "Coolest Tech";
  ~$7M raised since 2023. [catio.tech; venturebeat.com 2025; catio.tech/blog/digital-twin-architecture]
- **Data model:** Continuously **discovered** from code, cloud and service integrations — i.e. the twin
  is *mined* from real systems, not hand-drawn — mapped into a live architecture model. (Public docs
  don't expose a formal RDF/OWL substrate; the differentiator is auto-discovery + multi-agent reasoning,
  not standards.)
- **Authoring (non-technical):** Conversational ("how do I improve my security posture?") + auto-sync
  rather than manual modelling — the most "no-author" experience in the set, but **scoped to software
  architecture, not the whole business** (no people/process/value-stream layer).
- **Placement:** **Mined-observed** (rare for this category) for the tech-stack slice; data-bound to
  code/cloud. Loop: **model ✓ (auto) · generate ~ (recommendations/decisions, not apps) · automate ~
  (advisory) · govern ~**. Narrow domain, but the clearest demonstration that auto-discovery beats
  manual EA upkeep.

### 3.7 Microsoft thread — the hyperscaler twin/EA play

Two distinct, easily-confused products; both are explicitly *not the same thing*. [learn.microsoft.com
notes the distinction in both doc sets.]

**(a) Azure Digital Twins + DTDL**

- **Capability:** A PaaS for building **graph-based digital twins** of physical environments (buildings,
  factories, grids, IoT). Twins + relationships form a live twin graph updated from telemetry.
  [learn.microsoft.com/azure/digital-twins/concepts-ontologies, updated Dec 2025]
- **Data model:** Models authored in **DTDL (Digital Twins Definition Language)** — a JSON-LD-based
  language, **not** native RDF/OWL. Microsoft ships open-source DTDL **ontologies** (RealEstateCore for
  smart buildings, energy grid, etc.) under four strategies: **Adopt / Extend / Convert / Author**.
  Critically, **existing RDF/OWL models must be *converted* to DTDL** to be used — confirming Microsoft
  chose a parallel JSON-LD lineage over the W3C OWL stack. [concepts-ontologies; opendigitaltwins-dtdl
  v3 spec on GitHub] Twin graph is queryable; visualised in Azure Digital Twins Explorer.
- **Placement:** **Data-bound-actionable** for physical assets. Loop: model ✓ · generate ✗ ·
  automate ~ (event routing to Azure Functions/Logic Apps) · govern ~. Not an org-level EA tool.

**(b) Fabric Digital Twin Builder (Preview, announced Build 2025)**

- **Capability:** A **low-code/no-code** item in the Fabric Real-Time Intelligence workload to model
  business concepts (assets, processes) through an **ontology**, map source data to it, and define
  semantic relationships — aimed at operational decision-makers, scoped to **physical/industrial
  operations**, not whole-org EA. [learn.microsoft.com/fabric/.../digital-twin-builder/overview,
  updated May 2026]
- **Data model:** Ontology metamodel = **namespace · entity type · entity instance · property ·
  relationship type · relationship instance**. Stored as **Delta tables in a Fabric lakehouse**
  (base layer = definitions + instances; domain layer = normalised SQL views) — i.e. **lakehouse/SQL,
  not a triple store; not DTDL; not RDF/OWL/SHACL**. [digital-twin-builder/concept-modeling, updated
  May 2026] This is a relational/analytical realisation of an "ontology," which is significant: the
  word "ontology" here means *enterprise vocabulary over a data lake*, not W3C semantics.
- **Authoring:** No-code ontology modelling + data mapping wizards; **explorer** (card/time-series
  views, keyword + advanced query). **Extensions** are where it gets interesting vs. the EA tools:
  connect the ontology to **Power BI / Real-Time Dashboards**, build **Q&A with a Fabric Data Agent
  (generative AI over the twin)**, train **ML models**, and trigger **Activator** alerts/actions.
  [digital-twin-builder/overview]
- **Placement:** **Data-bound-actionable** (live, lakehouse-bound). Loop: **model ✓ · generate ~
  (dashboards/Q&A agents/ML, *not* apps/pipelines as artifacts) · automate ~ (Activator
  alerts/actions) · govern ~ (Fabric security/CI-CD)**. The strongest "twin" loop-closure in the set,
  but industrial-scoped and non-W3C.

---

## 4. Cross-cutting comparison

### 4.1 Paradigm + loop-stage matrix

| Subject | Paradigm | Metamodel substrate | model | generate | automate | govern |
|---|---|---|---|---|---|---|
| SAP LeanIX | Descriptive-modeled | Bespoke fact sheets (relational) | ✓ | ✗ | △ (workflow) | ✓ |
| Ardoq | Descriptive → context graph | Graph; +RDF/OWL/SHACL via GraphLake (2026) | ✓ | ✗ | △ (EA practice) | ✓ |
| Bizzdesign | Descriptive-modeled | ArchiMate-native (relational/object) | ✓ | ✗ | ✗ | ✓ |
| MEGA HOPEX | Descriptive + GRC | Bespoke; ArchiMate-mapped | ✓ | ✗ | ✗ | ✓✓ |
| Software AG Alfabet | Descriptive-modeled | Configurable meta-model (relational) | ✓ | ✗ | ✗ | ✓ |
| Catio | **Mined-observed** (tech stack) | Auto-discovered model + agents | ✓ | △ (advice) | △ (advice) | △ |
| Azure Digital Twins | **Data-bound** (physical) | DTDL (JSON-LD), twin graph | ✓ | ✗ | △ (events) | △ |
| Fabric Digital Twin Builder | **Data-bound** (industrial) | Lakehouse/SQL "ontology" | ✓ | △ (BI/agents/ML) | △ (Activator) | △ |

Legend: ✓ strong · △ partial/emerging · ✗ absent.

### 4.2 Patterns a skeptic should note

- **"Ontology" is overloaded.** Fabric DTB and Azure DT both say "ontology" but neither uses
  RDF/OWL/SHACL; Fabric's is a lakehouse vocabulary, Azure's is JSON-LD/DTDL. Only Ardoq (post-2026)
  genuinely adopts the W3C stack. Weave's claim to *real* semantic-web infrastructure is defensible —
  but must be stated precisely, because the incumbents are colonising the *word*.
- **Generation is the universal blank.** Across all eight, no tool generates running applications,
  agents, or data pipelines from the model. The nearest motions are Fabric (dashboards/Q&A agents/ML
  off the twin) and Catio (architecture *recommendations*). This validates H1's "generation +
  automation" leg as genuine whitespace.
- **The frontier moved in 2025–26.** AI-assisted *authoring* (LeanIX diagram-to-data, Ardoq AI Import
  Builder, Catio auto-discovery) is rapidly eroding the "manual modelling" pain that justified EA tools.
  Liveness/auto-population is becoming table stakes — Weave cannot ship a manual-only modeller.
- **Consolidation is real.** Bizzdesign now owns HOPEX; Software AG's EA/process assets have changed
  hands. Six "independent" EA vendors are really ~four owners. The category is maturing/contracting,
  consistent with H6's "window is closing."

---

## 5. Implications for Weave

### Emulate (copy the pattern)

- **Ship a strong default metamodel, keep it configurable.** LeanIX's 12 fact-sheet types with
  Application at the centre is the proven "opinionated but extensible" pattern — exactly Weave's
  ~9-type universal ontology strategy. Lead with best-practice defaults, allow client extension.
- **Survey/broadcast-style crowdsourced authoring.** LeanIX Surveys and Ardoq broadcasts let
  *non-architects* maintain the model. Weave's NL+forms authoring should include this "push a form to
  the data owner" pattern, not just an editor.
- **AI-assisted ingest of existing artifacts.** LeanIX diagram-to-data and Ardoq's AI Import Builder
  are the bar for "ingest what the client already has" (brief §B5). Weave should match: upload an
  ArchiMate/BPMN/diagram/spreadsheet → LLM extracts → SHACL-validated fact sheets.
- **AI reasons over the live graph with traceability.** Ardoq's "every recommendation traces back to
  source, human can override" is the right governance posture for Weave's AI-native layer — pair every
  AI assertion with PROV-O provenance.

### Adopt (use the tech/standard directly)

- **RDF/OWL/SHACL as substrate — now vindicated.** Ardoq's GraphLake bet (unified RDF + LPG, temporal,
  provenance, SHACL) independently confirms Weave's confirmed stack choice. Adopt the same: temporal/
  point-in-time queries, scenario branching, and per-fact provenance should be first-class.
- **Open Group ArchiMate Exchange Format** for import/export interoperability with Bizzdesign/MEGA
  estates; **DTDL conversion** path if Weave ever needs to interoperate with Azure Digital Twins.
- **The DTO vocabulary.** Adopt Gartner's "digital twin of the organization" framing in positioning —
  it is the analyst-sanctioned demand signal, and it maps directly onto Weave's pitch.

### Avoid (commodity / anti-pattern)

- **Don't build another manual ArchiMate modeller.** Bizzdesign/MEGA own formal-modelling rigour and a
  consultant-led delivery model; competing there is a commodity race with a high skill floor and a
  shrinking, consolidating market.
- **Don't overload "ontology" loosely.** Avoid the Microsoft/Fabric pattern of calling a lakehouse
  vocabulary an "ontology" — it dilutes the term. Weave's edge is *actually* W3C-semantic; say so
  precisely and back it with SHACL validation and reasoning.
- **Don't stop at govern.** The entire incumbent category's failure mode is "beautiful repository,
  zero generation." A Weave that ships only model+govern is just another EA tool.
- **Don't scope the twin to physical/industrial assets** (the Azure DT / Fabric DTB trap) — Weave's
  twin is the *whole operating model* (people, process, systems, data, rules), not IoT equipment.

### Differentiate (where Weave deliberately diverges, and why)

- **Close the loop: model → generate → automate.** This is the structural gap across all eight
  subjects. Weave's defensible position is generating apps/agents/pipelines *from* the governed graph —
  no EA tool, no hyperscaler twin does this today.
- **Union of all three paradigms.** EA tools are descriptive only; Catio is mined-only (and narrow);
  Azure/Fabric are data-bound-only (and industrial). Weave's thesis is the *union* — a modeled **and**
  observed **and** data-bound graph. Hold this line: it is the one position none of them occupy.
- **Whole-business scope at mid-market reach.** Incumbents are either enterprise-EA (LeanIX/Ardoq/
  Bizzdesign/MEGA/Alfabet, IT-portfolio-centric, consultant-heavy) or hyperscaler-industrial (MS).
  Weave's NL+forms authoring targeting business users across the *whole* operating model, mid-market
  priced, is open territory.
- **W3C-native, not JSON-LD/lakehouse-native.** Where Microsoft chose DTDL and a lakehouse, and most
  EA tools chose bespoke relational metamodels, Weave's RDF/OWL/SHACL/PROV/SPARQL substrate gives
  reasoning, validation, and portability the others must bolt on (as Ardoq just had to *acquire*).

> **Flag (challenges no fixed decision, but sharpens one):** Ardoq's 2026 move to RDF+LPG +
> temporal + provenance is the single biggest competitive signal in this report. It validates Weave's
> substrate but means the open-standards wedge is **time-limited** — Weave's durable moat must be the
> *generation/automation closure and whole-business authoring UX*, not the triple store itself (per H4).

---

## 6. Sources

Primary (vendor docs, standards bodies, vendor press, analyst definitions):

- SAP LeanIX Meta Model — https://help.sap.com/docs/leanix/ea/meta-model ;
  https://help.sap.com/docs/leanix/ea/meta-model-v3 ; learning.sap.com SAP LeanIX Meta Model
- SAP LeanIX, *ArchiMate & SAP LeanIX* — https://www.leanix.net/en/blog/archimate-sap-leanix
- SAP LeanIX, *Diagram to Data* — https://www.leanix.net/en/blog/diagram-to-data
- SAP LeanIX, Importing and Exporting Data — https://help.sap.com/docs/leanix/ea/importing-and-exporting-data
- Ardoq, *AI-First Enterprise Architecture Platform* (May 2026) —
  https://www.ardoq.com/news/ai-first-enterprise-architecture-platform
- Ardoq, *Ardoq Acquires GraphLake* (Jun 2026) —
  https://www.ardoq.com/news/ardoq-graphlake-context-graph-enterprise-ai
- Ardoq, *Evolution of EA: Digital Twin of an Organization* —
  https://www.ardoq.com/blog/digital-twin-of-an-organization
- Ardoq, Platform Overview / Graph Databases & EA knowledge hub — https://www.ardoq.com/platform-overview
- Bizzdesign — *Modeling with ArchiMate* and *Importing ArchiMate model data*,
  https://help.bizzdesign.com/articles/ ; https://bizzdesign.com/transformation-suite/horizzon ;
  BIZBOK↔ArchiMate mapping blog
- MEGA HOPEX — community.mega.com (HOPEX ArchiMate; "How does ArchiMate work with MEGA?")
- Software AG Alfabet — https://www.softwareag.com (Alfabet EAM); Alfabet FastLane / AMM file
  (softwarereviews.com, peerspot.com 2025 reviews — secondary, used for meta-model detail)
- Catio — https://www.catio.tech ; https://www.catio.tech/blog/digital-twin-architecture
- Microsoft Learn — *What is an ontology? (Azure Digital Twins)*, updated Dec 2025 —
  https://learn.microsoft.com/en-us/azure/digital-twins/concepts-ontologies
- Microsoft, DTDL v3 spec — https://github.com/Azure/opendigitaltwins-dtdl/blob/master/DTDL/v3/DTDL.v3.md
- Microsoft Learn — *What Is Digital Twin Builder (Preview)?* (updated May 2026) —
  https://learn.microsoft.com/en-us/fabric/real-time-intelligence/digital-twin-builder/overview
- Microsoft Learn — *Modeling Data in Digital Twin Builder (Preview)* (updated May 2026) —
  https://learn.microsoft.com/en-us/fabric/real-time-intelligence/digital-twin-builder/concept-modeling
- Gartner — *Quick Answer: What Is a Digital Twin of an Organization?*
  (https://www.gartner.com/en/documents/4004172); Gartner DTO platform-selection webinar (2025)

Secondary / orientation only (not the cited basis for capability claims):

- VentureBeat (Catio, VB Transform 2025); InfoWorld / blog.fabric.microsoft.com (Fabric DTB);
  Info-Tech SoftwareReviews (Ardoq DTO vision); PeerSpot / SoftwareReviews (Alfabet, HOPEX);
  Gartner Peer Insights / Magic Quadrant 2025–26 (positioning context).
