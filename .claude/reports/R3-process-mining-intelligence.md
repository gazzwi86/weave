# R3 — Process Mining & Intelligence: The Mined-Observed Paradigm

**Status:** Draft — for product & architecture review
**Author:** Research session (Claude / Opus 4.8)
**Date:** 2026-06-26
**Frame:** Mined-observed paradigm (§3 of the research brief); stress-tests H1 (the union thesis)
and H5 (event/temporal modelling gap).

---

## 1. Why this report exists

Weave's value depends on its model of the business staying **alive** rather than decaying into a
stale, hand-drawn diagram. The descriptive-modeled paradigm (R2: ArchiMate/LeanIX/Ardoq) captures
how a business is *designed* to run and rots the moment reality diverges. The mined-observed
paradigm answers the complementary question — *how does the business **actually** run?* — by
reconstructing process and object graphs from the event exhaust that operational systems (ERP, CRM,
ITSM) already emit.

This report covers the three exemplars named in the brief — **Celonis**, **SAP Signavio**, and
**Software AG ARIS** — and the recent paradigm shift inside the field: **object-centric process
mining (OCPM)** built on the **OCEL** standard. OCPM is the single most important development here,
because it converts process mining from "discover one flowchart per case" into "reconstruct a
live multi-object graph of the enterprise" — which is structurally the same artefact Weave wants to
author. The report ends by stress-testing H1: is mined-observed genuinely absent from EA tools and
from Palantir, leaving the union open?

---

## 2. The mined-observed paradigm in one picture

Classic (case-centric) process mining takes an **event log** — rows of
`(case_id, activity, timestamp, [attributes])` — and reconstructs a process model (a directed graph
of activities) plus conformance and performance overlays. The input is the digital footprint left
by systems when work executes; nobody draws the model, it is *discovered*.

The defining strength versus the descriptive paradigm: the model is **evidential, not aspirational**.
It cannot be wrong about what happened (only incomplete or noisy). The defining weakness: it is only
as good as the event log, and "most recent process mining approaches assume high-quality event logs,
without describing how such logs can be extracted from non-process-aware information systems"
([MDPI, *Event Log Preprocessing for Process Mining*, 2021](https://www.mdpi.com/2076-3417/11/22/10556);
[ACM JDIQ, *Process-Data Quality: The True Frontier of Process Mining*, 2023](https://dl.acm.org/doi/10.1145/3613247)).
Data-quality and log-extraction effort is the dominant cost — a fact Weave must price into any
"keep the model live" promise.

---

## 3. The key shift: object-centric process mining (OCPM / OCEL)

### 3.1 The problem with one case ID — flattening, convergence, divergence

Real ERP processes have no single "case." An order-to-cash flow involves *orders*, *order items*,
*deliveries*, *invoices*, and *payments*, each with its own lifecycle and many-to-many relations
(one invoice covers several orders; one order splits across several deliveries). Classic mining
forces a single case notion, which requires **flattening** the data to one chosen object. Van der
Aalst's foundational work identifies the two artefacts flattening introduces
([van der Aalst, *Object-Centric Process Mining: An Introduction*, RWTH/2023](https://www.vdaalst.rwth-aachen.de/publications/p1398.pdf)):

- **Convergence** — an event touching N objects is duplicated N times, inflating frequencies.
- **Divergence** — events for sibling objects (e.g. multiple items of one order) appear causally
  ordered when they are independent, fabricating loops and dependencies that do not exist.

The practical consequence is the "spaghetti" diagram and KPIs that quietly lie. OCPM removes the
need to pick a case at all.

### 3.2 OCEL 2.0 — the standard, dated

**OCEL (Object-Centric Event Log)** is the interchange standard for object-centric event data.
OCEL 1.0 shipped in 2020; **OCEL 2.0** was presented at ICPM 2023 (Rome, 23–27 Oct 2023) with the
specification paper dated 4 March 2024
([van der Aalst et al., *OCEL 2.0*, p1435](https://vdaalst.com/publications/p1435.pdf);
[arXiv 2403.01982, *OCEL 2.0 Resources*](https://arxiv.org/html/2403.01982);
[arXiv 2403.01975, *OCEL 2.0 Specification*](https://arxiv.org/abs/2403.01975)). The reference site
is [ocel-standard.org](https://www.ocel-standard.org).

The OCEL 2.0 metamodel adds three things over 1.0 that matter directly to Weave (verbatim from the
spec resources paper):

- **Object-to-object relationships** — "object-to-object relationships can be explicitly stored and
  supplemented with a qualifier."
- **Qualified event-to-object relationships** — "the nature of the relationship is explicitly
  annotated" (e.g. an event *places* vs *cancels* an order).
- **Dynamic attribute values** — "changes to object attribute values can now be tracked" over time.

OCEL 2.0 defines **three exchange formats: XML, JSON, and SQLite** (the SQLite variant "allows for
efficient SQL querying, eliminating the necessity to parse the entire event log")
([arXiv 2403.01982](https://arxiv.org/html/2403.01982)). *(Note: an early search snippet claimed
"CSV/Parquet"; the primary spec confirms XML/JSON/SQLite — corrected here.)*

### 3.3 Why this is structurally Weave's graph

Strip the labels and OCEL 2.0 is a **typed property graph with temporal provenance**: typed objects,
typed (qualified) relationships between objects, timestamped events that touch multiple objects, and
attribute-value histories. That is the same shape as RDF + PROV-O. The OCEL constructs map cleanly:

| OCEL 2.0 construct | Weave / W3C equivalent |
|---|---|
| Object (typed) | OWL individual of an ontology class |
| Object type | OWL class (ArchiMate-aligned business object / data object) |
| Object-to-object relationship + qualifier | RDF object property (the qualifier names the property) |
| Event (timestamped, multi-object) | PROV-O `Activity` linking multiple entities via `used`/`generated` |
| Qualified event-to-object relation | PROV qualified association / role |
| Dynamic attribute value change | PROV-O state + time, or RDF-star / reification with timestamps |

This is the concrete bridge to **H5** (Weave's event/temporal modelling gap). H5 flagged that the
ArchiMate-aligned 9-type core under-specifies events and time, and pointed at OCEL/DTDL. The finding
here is sharper than H5 assumed: OCEL 2.0 is not just an *inspiration* for an event type — it is a
**ready-made, peer-reviewed metamodel** for multi-object temporal events that Weave can adopt as the
shape of its event/temporal layer and the **target schema for ingesting observed behaviour**.

---

## 4. Celonis — the object-centric flagship (deepest treatment)

Celonis is the market-leading process-mining vendor and the most aggressive adopter of OCPM. It is
the most relevant competitor in this report because it is explicitly building toward a *live graph
of the whole business* — Weave's territory, approached from the mining side.

### 4.1 Object-Centric Data Model (OCDM) — "the core of the digital twin"

Celonis reframed its platform around the **Object-Centric Data Model (OCDM)**, GA'd at the 2023
World Tour ([Celonis blog, *Object-Centric Data Model: Single Source of Truth*](https://www.celonis.com/blog/celonis-object-centric-data-model-single-source-of-truth-for-process-intelligence)).
Key claims, quoted:

- It is "an extensible data representation of an entire business" serving as "the **core of an
  organization's digital twin**."
- It "reduces the work needed to transform data from source systems (e.g., ERP, CRM, SCM)" via
  "standardized business definitions and prebuilt transformations for core processes."
- Analysts can "dynamically adjust process analyses, switching perspectives from process to process
  without needing to go back to the source data" — i.e. one shared object graph, many process views.
- It "operates side-by-side with existing Celonis EMS Event Log Data Models" (non-disruptive
  migration from the case-centric world).

This is the headline strategic fact for Weave: **a process-mining vendor is now positioning its
object graph as a "digital twin of the business."** That is the same noun Weave and the EA vendors
(R2) use. Celonis arrives at it from the *observed* direction (extracted from logs); Weave arrives
from the *modelled* direction (authored, then bound). They converge on the same artefact.

### 4.2 Process Sphere — "MRI" object-centric mining

**Process Sphere** is Celonis's object-centric mining experience, announced at Celosphere 2022 and
marketed with an MRI-vs-X-ray metaphor: a 3-D, multi-object view versus a flat single-case one
([Celonis, *Next-generation MRI process mining with Process Sphere*](https://www.celonis.com/blog/celonis-announces-next-generation-mri-process-mining-technology-with-process-sphere)).
Claims: "visualize and analyze the complex relationships between objects and events across
interconnected processes," render an entire supply chain (sales orders, shipments, billing docs,
deliveries, invoices) "in a single view," and reduce the need to hand-write PQL queries.

**Recency / GA status (recency-drift caution):** Process Sphere launched in *beta* at Celosphere
2022 — Celonis stated it "will be available as a beta to select Celonis customers beginning in 2022"
([Celonis, *Next-generation MRI process mining with Process Sphere*](https://www.celonis.com/blog/celonis-announces-next-generation-mri-process-mining-technology-with-process-sphere)).
The **OCDM** reached GA in 2023, with Process Sphere enhancements still scheduled to roll out
afterward; there is **no single, clean dated "Process Sphere is GA" milestone**. At **Celosphere
2025**, Celonis announced further platform pieces — Data Core, the PI Graph, and the Orchestration
Engine
([Celonis, *Celosphere 2025*](https://www.celonis.com/blog/celosphere-2025-everything-you-need-to-know-from-process-intelligence-news-to-ai-innovation);
[SiliconANGLE, *Exploring Celonis' object-centric approach*, 5 Nov 2025](https://siliconangle.com/2025/11/05/exploring-object-centric-process-mining-celosphere/)).
Treat any flat "Process Sphere is GA" claim as **unsupported**: the public record shows a continuous
beta-to-GA rollout of OCPM *components* through 2023–2025 rather than one dated GA event. (Earlier
drafts named specific OCPM features — "Performance Spectrum," "Instance Explorer," an "Object-Centric
Performance app" — as 2025 releases; those are **not corroborated** by the cited Celosphere 2025
sources and have been dropped pending independent sourcing.)

### 4.3 Automation — Celonis closes part of the loop too

Celonis is not purely observational. Its **Orchestration Engine** (GA 2025) and Action Flows trigger
automations off mined signals, and the platform markets process-driven agents. So on the four loop
stages, Celonis covers **model (mined) → automate**, with weak **generate** (it does not generate
applications/pipelines from the graph) and strong **govern** for process KPIs.

---

## 5. SAP Signavio — model-and-mine suite, object-centric arriving

Signavio (acquired by SAP, 2021) is a **business-process-transformation suite**: it pairs BPMN
modelling (descriptive) with **Process Intelligence** (mined). Its differentiator is the round-trip
between *designed* (BPMN models, governed in the suite) and *observed* (mined from SAP ERP via SAP
Datasphere replication) ([SAP Signavio Process Intelligence](https://www.signavio.com/products/process-intelligence/);
[help.sap.com, Process Intelligence feature scope](https://help.sap.com/docs/signavio-process-intelligence/feature-scope-description/sap-signavio-process-intelligence)).

Object-centric is *arriving*, not native:

- **Object-Centric Clustering** (primary how-to dated 5 Sept 2025) "restructures those spaghetti
  views into focused, object-based clusters" — grouping events of the same business object (e.g. a
  "Supplier invoice" group with *Create invoice* / *Move invoice to free for payment*). It is a
  **layered visualization enhancement** in the Signavio Lab Space, gated behind an Enterprise licence
  plus a Test & Evaluation Agreement — i.e. a non-GA, bolt-on capability, not a re-architecting of the
  case-centric core
  ([SAP Community, *Turn spaghetti into structure*, 5 Sep 2025](https://community.sap.com/t5/technology-blog-posts-by-sap/turn-spaghetti-into-structure-a-hands-on-guide-to-object-centric-clustering/ba-p/14208828)).
- **Process Networks (beta)** in SAP Signavio Process Insights gives "an object-centric view of how
  your business actually runs … connecting business objects across end-to-end processes." It remains
  **beta**, and GA has slipped: per the **February 2026** release notes, SAP now places GA "later
  this year" — meaning **2026, not 2025** as earlier materials suggested
  ([SAP Signavio February 2026 release](https://community.sap.com/t5/technology-blog-posts-by-sap/sap-signavio-february-2026-release-sap-signavio-process-insights-and/ba-p/14325159)).
- **AI-Assisted Process Analyzer** adds NL "text to insights / text to widget" querying
  ([SAP Signavio April 2025 release](https://community.sap.com/t5/technology-blog-posts-by-sap/sap-signavio-april-2025-release-sap-signavio-process-insights-and-sap/ba-p/14077471)).

Read honestly: Signavio's *core* remains case-centric, with object-centric visualisation and
networks layered on in 2025. SAP's strategic asset is the **model+mine+ERP** triangle (Signavio
designs, mines, and feeds back into S/4HANA), not OCPM leadership.

---

## 6. Software AG ARIS — conformance against the designed model

ARIS is the EA/BPM incumbent (EPC and BPMN modelling) that added **ARIS Process Mining** as SaaS.
Its distinctive value is the **closed loop between designed and observed**: it compares live "as-is
data directly against governed to-be models," and offers "seamless integration between Process
Mining and the ARIS BPM repository," so a discovered deviation can "immediately update process
documentation and compliance standards in one place"
([Gartner Peer Reviews, *Software AG ARIS*, content through Oct 2025](https://www.gartner.com/reviews/market/process-mining-platforms/vendor/software-ag/product/aris)).
It adds an **AI-powered root-cause miner** and an **ARIS AI Companion** that derives process variants
from ERP data ([SiliconANGLE, *Software AG applies generative AI to process modeling*, 2024](https://siliconangle.com/2024/04/10/software-ag-applies-generative-ai-process-modeling-asset-management/)).

ARIS is **case-centric / conformance-oriented**, not object-centric. Reviewer-noted weaknesses:
"very limited flexibility to create analysis," "complex data integration requiring ongoing
maintenance," "limited visualization options." ARIS demonstrates the *conformance* pattern Weave
needs (designed-vs-observed delta) but is the legacy edge of the field, not the OCPM frontier.

---

## 7. H1 stress-test: is mined-observed genuinely missing from the others?

H1 claims the whitespace is the **union** of descriptive-modeled + mined-observed +
data-bound-actionable, plus generation/automation. This report's job is to check the *mined-observed*
leg of that claim against the two adjacent camps.

### 7.1 EA / descriptive tools — mined-observed is essentially absent (H1 holds here)

LeanIX and Ardoq are descriptive: they capture authored architecture, not observed behaviour.
LeanIX "is not based on any modeling notation such as ArchiMate" and uses table/inventory formats;
Ardoq supports ArchiMate authoring ([Hosiaisluoma, *EA modelling tools with ArchiMate support*](https://www.hosiaisluoma.fi/blog/enterprise-architecture-modelling-tools-with-archimate-support/);
[el-kaim.com, *2024 — Ardoq and LeanIX new functionalities*](https://el-kaim.com/2024-ardoq-and-leanix-new-functionalities-ae5601b6e412)).
Neither mines event logs natively; LeanIX reaches process mining only **via a connector to SAP
Signavio**. So in the EA camp, observed behaviour is bolted on through integration, not native — the
mined leg is genuinely open there. **H1 confirmed for EA tools.**

### 7.2 Palantir Foundry — has process mining (H1 needs qualifying, not refuting)

This is the consequential finding. Palantir Foundry ships **Machinery**, a process-mining capability
that the docs describe plainly: "Foundry enables mining an ongoing process from external event logs
to gain visibility into an existing process"
([Palantir docs, *Machinery / process mining*](https://www.palantir.com/docs/foundry/machinery/process-mining);
[Palantir, *Foundry Process Mining & Automation*](https://www.palantir.com/platforms/foundry/process-mining/)).
Crucially, Machinery is **ontology-native**: it maintains a **Log object type** that "tracks every
change made to an object, whether from external data sources or Foundry actions," mines **states and
transitions**, and overlays them on an existing process definition (amber = newly discovered,
grey = matches definition, dashed = defined-but-unobserved). Process objects "can be represented by
an object type in your ontology (such as Claim, Flight, or Employee)."

So Palantir does **not** leave the mined-observed leg empty. It binds mining *to the live ontology*
and to *write-back actions* — arguably the most integrated of all the tools here, because the
observed process and the actionable data model are the same objects. This **qualifies H1**: the
union is not "three camps each missing the other two." Rather:

- **Celonis** is encroaching from the mining side (OCDM as "digital twin," + automation).
- **Palantir** already spans data-bound **and** mined-observed, ontology-natively.
- **EA tools** remain descriptive-only.

**The honest H1 verdict:** the *union of all three paradigms* is **contested from multiple
directions, not vacant.** What remains genuinely unoccupied is the **specific** combination Weave
targets: (a) the union built on **open W3C standards** (OCEL/PROV-O/SHACL) rather than a proprietary
ontology (Palantir) or a proprietary OCDM (Celonis); (b) **generation** of apps/agents/pipelines
*from* that graph — neither Celonis nor ARIS nor Signavio generates software from the observed model;
and (c) **mid-market reach with NL+forms authoring**, versus Palantir/Celonis enterprise pricing and
implementation gravity. H1's *spirit* survives; its *literal* "no one has mined-observed" framing
does not. Weave should retire the "incumbents lack process mining" talking point and instead lead
with **open-standards union + generation + accessibility**.

---

## 8. Placement on the three-paradigm frame and four loop stages

These subjects are the **mined-observed** exemplars by definition, but each leaks into neighbours.

| Subject | Three-paradigm placement | model | generate | automate | govern |
|---|---|---|---|---|---|
| **Celonis (OCDM/Process Sphere)** | Mined-observed core; reaching toward data-bound ("digital twin") | Strong (mined, object-centric) | None (no app/code gen) | Medium (Orchestration Engine, Action Flows) | Strong (process KPIs, conformance) |
| **SAP Signavio** | Mined-observed + descriptive (BPMN suite); object-centric arriving 2025 | Strong (model **and** mine) | None | Medium (SAP workflow integration) | Strong (governed BPMN + compliance) |
| **Software AG ARIS** | Mined-observed + descriptive (EPC/BPMN), conformance-led | Medium (case-centric mining vs to-be) | None | Low | Strong (designed-vs-observed conformance) |
| **Palantir Foundry (Machinery)** | Data-bound-actionable **+** mined-observed (ontology-native) | Strong (ontology + log objects) | Strong (OSDK, Workshop apps) | Strong (Actions write-back) | Medium |
| **Weave (target)** | Union: descriptive **+** mined **+** data-bound, open-standards | Authored + bound + (planned) observed | **Core differentiator** | Core | Strong (SHACL/PROV-O) |

OCEL/OCPM itself sits at **model** (it is how the observed graph is *built*) and feeds **govern**
(conformance, performance).

---

## 9. Implications for Weave

### Emulate (copy the pattern)

- **Object-centric over case-centric, from day one.** The whole field is migrating to OCPM because
  flattening fabricates KPIs (convergence/divergence). Weave's universal ontology is already
  object/relationship-centric — lean into it and frame Weave as "object-centric by construction,"
  borrowing Celonis's own narrative against single-case flattening.
- **Celonis's "OCDM as digital twin" framing** — one shared object graph, many process perspectives
  derived without re-touching source data. This is exactly Weave's "live model, many views" pitch;
  Celonis has validated the market language.
- **ARIS's designed-vs-observed conformance loop.** Comparing authored model to mined reality (amber
  = new, grey = conforms, dashed = defined-but-unobserved, à la Palantir Machinery) is the single
  most valuable "keep the model alive" UX. Weave can implement it natively as a **SHACL + diff**
  overlay: the authored graph is the to-be; ingested OCEL events are the as-is.
- **Signavio's NL process querying** ("text to insights / text to widget") — aligns with Weave's
  NL+forms authoring; mined views should be NL-queryable too.

### Adopt (use the tech/standard directly)

- **OCEL 2.0 as the event-ingestion and event/temporal schema.** This directly closes the **H5 gap**.
  Adopt OCEL 2.0's metamodel (typed objects, qualified object-to-object and event-to-object
  relations, dynamic attribute histories) as (i) the *shape* of Weave's event/temporal layer and
  (ii) the *import format* for observed behaviour. Its constructs map onto RDF + PROV-O with no
  semantic loss (table in §3.3). Use the **SQLite exchange format** for efficient ingest.
- **PROV-O for the temporal/provenance layer** to represent OCEL events as `prov:Activity` touching
  multiple `prov:Entity` objects — already in the confirmed W3C stack.
- **The data-quality discipline** the literature insists on: log extraction from non-process-aware
  systems is the dominant cost. Adopt explicit event-log quality checks (completeness, timestamp
  integrity) as a first-class ingest step, not an afterthought.

### Avoid (commodity / anti-pattern)

- **Do not build a process-mining engine from scratch.** Discovery algorithms, conformance, and PQL
  are mature commodity capability owned by Celonis/Signavio/ARIS/Foundry. Weave should *ingest* OCEL
  and *integrate* (or partner) for heavy mining, not reimplement Inductive/Heuristic miners.
- **Avoid case-centric event logs entirely.** Building on flat single-case logs would bake in the
  convergence/divergence defects the field is actively fleeing.
- **Avoid promising "always live, zero effort."** The data-quality literature shows log extraction is
  costly; over-claiming liveness is the vendor-marketing trap flagged in the brief (§10).
- **Avoid competing on process-KPI dashboards** — a saturated commodity.

### Differentiate (where Weave deliberately diverges, and why)

- **Open W3C standards vs proprietary object models.** Celonis OCDM and Palantir Ontology are
  proprietary; Weave's mined graph is RDF/OWL/SHACL/PROV-O — portable, queryable in SPARQL, no
  lock-in. This is the durable wedge now that "process mining" itself is not differentiating.
- **Generation is the unmatched leg.** None of Celonis, Signavio, or ARIS generates apps, agents, or
  pipelines from the observed graph (only Palantir generates apps, and only from its proprietary
  ontology). Weave's **model → generate** is the genuinely open whitespace; the mined graph becomes
  *generation input*, not just a dashboard.
- **Union on one substrate, not via connectors.** EA tools reach mining only through integrations
  (LeanIX→Signavio). Weave's differentiator is **authored + bound + observed in one RDF graph**, so
  conformance is a graph diff, not an ETL hop.
- **Mid-market accessibility.** Celonis/ARIS/Palantir carry enterprise pricing and implementation
  gravity. NL+forms authoring plus a shipped universal ontology lets a mid-market client reach a
  live, partly-observed model without a six-figure mining programme.

### Recommendation flagged against the briefs

- **Retire the "incumbents lack process mining" claim from positioning.** Palantir Machinery and
  Celonis OCDM materially occupy the mined-observed space; leading with that claim is falsifiable and
  weakens credibility. Re-anchor H1's positioning on **open standards + generation + accessibility**
  (this refines, not contradicts, the brief — surfaced per §2/§8 guidance).
- **Promote OCEL 2.0 from "look to" (H5) to a confirmed adoption candidate** for the event/temporal
  layer in the Constitution Engine tech spec.

---

## 10. Sources

Primary sources (standards bodies, vendor docs, peer-reviewed/author papers):

- [OCEL 2.0 specification paper (van der Aalst et al., p1435, 2024)](https://vdaalst.com/publications/p1435.pdf)
- [OCEL 2.0 Resources — arXiv 2403.01982 (HTML)](https://arxiv.org/html/2403.01982)
- [OCEL 2.0 Specification — arXiv 2403.01975](https://arxiv.org/abs/2403.01975)
- [van der Aalst, *Object-Centric Process Mining: An Introduction* (p1398, RWTH 2023)](https://www.vdaalst.rwth-aachen.de/publications/p1398.pdf)
- [OCEL standard reference site](https://www.ocel-standard.org)
- [Celonis — Object-Centric Data Model: Single Source of Truth](https://www.celonis.com/blog/celonis-object-centric-data-model-single-source-of-truth-for-process-intelligence)
- [Celonis — Next-generation MRI process mining with Process Sphere](https://www.celonis.com/blog/celonis-announces-next-generation-mri-process-mining-technology-with-process-sphere)
- [Celonis — What is object-centric process mining (OCPM)?](https://www.celonis.com/blog/what-is-object-centric-process-mining-ocpm)
- [Celonis docs — Objects and Events (object-centric process mining)](https://docs.celonis.com/en/object-centric-process-mining.html)
- [Celonis — Celosphere 2025 announcements](https://www.celonis.com/blog/celosphere-2025-everything-you-need-to-know-from-process-intelligence-news-to-ai-innovation)
- [SAP Signavio Process Intelligence — product page](https://www.signavio.com/products/process-intelligence/)
- [SAP Help — Signavio Process Intelligence feature scope](https://help.sap.com/docs/signavio-process-intelligence/feature-scope-description/sap-signavio-process-intelligence)
- [SAP Community — Object-Centric Clustering guide (5 Sep 2025)](https://community.sap.com/t5/technology-blog-posts-by-sap/turn-spaghetti-into-structure-a-hands-on-guide-to-object-centric-clustering/ba-p/14208828)
- [SAP Signavio February 2026 release (Process Networks beta; GA "later this year")](https://community.sap.com/t5/technology-blog-posts-by-sap/sap-signavio-february-2026-release-sap-signavio-process-insights-and/ba-p/14325159)
- [SAP Signavio April 2025 release (AI-Assisted Process Analyzer)](https://community.sap.com/t5/technology-blog-posts-by-sap/sap-signavio-april-2025-release-sap-signavio-process-insights-and-sap/ba-p/14077471)
- [Palantir docs — Machinery / process mining](https://www.palantir.com/docs/foundry/machinery/process-mining)
- [Palantir — Foundry Process Mining & Automation](https://www.palantir.com/platforms/foundry/process-mining/)
- [Software AG — ARIS Process Mining](https://www.softwareag.com/en_corporate/platform/aris/process-mining.html)

Secondary / analyst / orientation (used for cross-checking and recency, not as the cited basis for
capability claims):

- [SiliconANGLE — Exploring Celonis' object-centric approach (5 Nov 2025)](https://siliconangle.com/2025/11/05/exploring-object-centric-process-mining-celosphere/)
- [Gartner Peer Reviews — Software AG ARIS (through Oct 2025)](https://www.gartner.com/reviews/market/process-mining-platforms/vendor/software-ag/product/aris)
- [SiliconANGLE — Software AG generative AI for process modeling (2024)](https://siliconangle.com/2024/04/10/software-ag-applies-generative-ai-process-modeling-asset-management/)
- [MDPI — Event Log Preprocessing for Process Mining: A Review (2021)](https://www.mdpi.com/2076-3417/11/22/10556)
- [ACM JDIQ — Process-Data Quality: The True Frontier of Process Mining (2023)](https://dl.acm.org/doi/10.1145/3613247)
- [Hosiaisluoma — EA modelling tools with ArchiMate support](https://www.hosiaisluoma.fi/blog/enterprise-architecture-modelling-tools-with-archimate-support/)
- [el-kaim.com — 2024 Ardoq and LeanIX new functionalities](https://el-kaim.com/2024-ardoq-and-leanix-new-functionalities-ae5601b6e412)
