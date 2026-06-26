# R1 — Palantir Foundry / AIP Deep-Dive

**Status:** Draft for internal product & architecture review
**Date:** 2026-06-26
**Author:** Research agent (commissioned from `.claude/reports/00-research-brief.md`)
**Frame role:** Exemplar of the **data-bound-actionable** paradigm (brief §3); the reference
architecture for Weave's `model → generate → automate → govern` loop (hypothesis H2).

---

## 0. Scope, method, and an opacity caveat

This is the deepest single-subject treatment in the study. It maps Foundry's building blocks onto
Weave's four planned engines (Constitution / Build / Events & Actions / Graph Explorer), places
Foundry on the three-paradigm frame and four loop stages, and extracts defensible differentiation.

**Evidence basis.** Claims here are drawn from Palantir's own product docs (`palantir.com/docs/foundry/*`,
accessed June 2026), cross-checked against one independent technical teardown and practitioner review
sites. Per the brief's flagged risk (§10, "Palantir opacity"), the deepest internals — storage engine,
indexing, the OMS/OSS/Funnel service split — are **not** authoritatively documented in public vendor
material; where a claim rests on a secondary teardown rather than vendor docs, it is marked
*[secondary]* and should be treated as indicative, not load-bearing. Vendor docs themselves carry
marketing bias (brief §10) — capability language like "no-code" and "digital twin" is the vendor's
framing and is flagged where it materially oversells.

---

## 1. The Ontology — Foundry's semantic backbone

Foundry's organising abstraction is **the Ontology**: per Palantir, *"an operational layer for the
organization"* that *"sits on top of the digital assets integrated into the Palantir platform"* and
*"connects them to their real-world counterparts, ranging from physical assets like plants, equipment,
and products to concepts like customer orders or financial transactions"*
([Ontology overview](https://www.palantir.com/docs/foundry/ontology/overview)). Palantir explicitly
frames the result as *"a digital twin of the organization"* — the same analyst framing (Gartner's
"digital twin of the organization") that validates Weave's timing (brief H6).

The Ontology is split into two layers, and this split is the single most important structural idea to
internalise:

| Layer | Building blocks | Question it answers | Weave analogue |
|---|---|---|---|
| **Semantic** | object types, properties, link types, interfaces | "What exists and how is it related?" | Constitution Engine (the live model) |
| **Kinetic** | action types, functions | "What can I *do*, and what happens then?" | Build + Events & Actions engines |

This semantic/kinetic distinction is exactly Weave's thesis stated in Palantir's vocabulary: a model
that is not merely *described* but *bound to data and actionable*. Weave's differentiator is that the
semantic layer is open W3C (RDF/OWL/SHACL) rather than proprietary.

### 1.1 Semantic layer building blocks (verbatim definitions)

- **Object type** — *"the schema definition of a real-world entity or event"*; instances are *objects*
  (e.g. JFK and LHR are objects of an `Airport` object type), collections are *object sets*
  ([core concepts](https://www.palantir.com/docs/foundry/ontology/core-concepts)).
- **Property** — *"the schema definition of a characteristic of a real-world entity or event"* (e.g.
  `name`, `country` on `Airport`). **Shared properties** allow consistent reuse across object types.
- **Link type** — *"the schema definition of a relationship between two object types"*; a *link* is a
  single instance of that relationship
  ([link types](https://www.palantir.com/docs/foundry/object-link-types/link-types-overview)).
- **Interface** — *"an Ontology type that describes the shape of an object type and its capabilities"*,
  providing *"object type polymorphism"* — consistent modelling of object types that share a common
  shape ([overview](https://www.palantir.com/docs/foundry/ontology/overview)). This is the closest
  Foundry construct to OWL class abstraction / `rdfs:subClassOf`-style reuse.
- **Roles** — the central permissioning model granting access to ontological resources.

### 1.2 Kinetic layer building blocks (verbatim definitions)

- **Action type** — *"the schema definition of a set of changes or edits to objects, property values,
  and links that a user can take at once"*
  ([action types](https://www.palantir.com/docs/foundry/action-types/overview)). Actions are the
  **write-back** mechanism: edits *"immediately commit to the Ontology and propagate across all
  applications"*, persisted in **writeback datasets**. Actions carry **rules** (who may act, submission
  criteria, validations) and **side effects** (notifications, webhooks to external systems,
  rule-based link/property creation). This is where Foundry stops being a read model and becomes an
  operational system of record.
- **Function** — *"a piece of code-based logic that takes in input parameters and returns an output"*
  with *"first-class support for authoring logic based on the Ontology"*: reading properties,
  traversing links, performing Ontology edits
  ([functions overview](https://www.palantir.com/docs/foundry/functions/overview)). Authored in
  **TypeScript** (v1/v2) or **Python**. Functions back Actions (function-backed actions), Workshop
  widgets (function-backed columns/charts), Pipeline Builder (Python sidecars), and external-system
  enrichment. Functions are the general-purpose business-logic escape hatch.

> **Vendor-marketing flag.** Palantir's "Ontology = digital twin of the organization" is aspirational.
> The Ontology models whatever has been *engineered into it*; the independent teardown is blunt:
> *"The Ontology is not magic... If data pipelines are poorly maintained or ontological mappings
> misrepresent reality, AIP will confidently execute flawless logic over fundamentally flawed data"*
> ([Towards AI teardown, 2025](https://towardsai.com/p/machine-learning/inside-palantir-aip-how-the-worlds-most-controversial-ai-platform-actually-works)) *[secondary]*. Coverage and correctness are a
> function of engineering investment, not an emergent property.

---

## 2. The application & integration tools

### 2.1 Pipeline Builder — data integration (model: ingest → bind)

*"Foundry's primary application for data integration"*: builds pipelines that *"transform raw data
sources into clean outputs"*, supporting both **batch** and **streaming**, with outputs landing as
**datasets** or directly as **Ontology objects**
([Pipeline Builder overview](https://www.palantir.com/docs/foundry/pipeline-builder/overview)).
Positioned as *"no-code"* but explicitly designed so *"users who code and users who do not code can
collaborate jointly on a pipeline workflow"* — i.e. visual graph with a code escape hatch. This is the
binding step that makes the Ontology *live* rather than drawn.

### 2.2 Workshop — application builder (generate: apps)

*"No-code/low-code"* builder for *"interactive and high-quality applications for operational users"*
([Workshop overview](https://www.palantir.com/docs/foundry/workshop/overview)). Built around the
**object layer as the primary building block** (not raw tables), weaving **objects, links, and
actions** into **widgets** (tables, lists, object views, charts, maps, Gantt, filters, and AI widgets
such as AIP Analyst / Chatbot). State is managed through **variables** (transformations, struct types,
object-set filters). Common patterns: inbox/alert task managers, Common Operational Pictures.

### 2.3 Quiver — analysis (model/explore)

Tool for *"analyzing, transforming, and visualizing data stored in Objects"*; used alongside Workshop
for analytical/charting workflows (e.g. time-series). Public docs are comparatively thin — depth bound
to vendor description here.

### 2.4 Object Explorer / Object Views — graph exploration (govern/inspect)

**Object Views** are the consolidation surfaces — *"central hubs consolidating object information and
workflows"* — while **Object Explorer** is the search/discovery surface for navigating the instance
graph ([core concepts](https://www.palantir.com/docs/foundry/ontology/core-concepts)). These are the nearest
analogue to Weave's Graph Explorer, though Foundry's exploration is object/record-centric (instance
data) rather than a force-directed *schema/model* visualisation.

### 2.5 OSDK (Ontology SDK) — code generation from the model (generate: code)

The most important construct for Weave's "generate" thesis. The OSDK *"generates functions and types
tailored to your Ontology subset"*: *"types and functions are generated from your Ontology, allowing
you to query and explore your Ontology directly in your editor"*
([OSDK overview](https://www.palantir.com/docs/foundry/ontology-sdk/overview)). It produces
**type-safe**, language-specific bindings (types and functions) generated from a user's Ontology
subset, with first-class support for **TypeScript** (NPM), **Python** (pip/Conda), **Java** (Maven),
and **any other language** via an **OpenAPI** spec
([OSDK overview](https://www.palantir.com/docs/foundry/ontology-sdk/overview)). The July 2025
release stream is adjacent but distinct: it announces **TypeScript Functions v2** (a function
runtime) and **Python OSDK 2.x** (syntax/return-type improvements), not a TypeScript-OSDK
codegen-for-large-ontologies change
([July 2025 announcements](https://www.palantir.com/docs/foundry/announcements/2025-07)).
This is the canonical "ontology-as-API-contract → generated SDK" pattern Weave's Build engine should
emulate — and is directly achievable over an OWL/SHACL model (SHACL shapes → typed classes).

---

## 3. AIP — the agentic layer (automate)

- **AIP Logic** — *"a no-code development environment for building, testing, and releasing functions
  powered by LLMs"* ([AIP Logic overview](https://www.palantir.com/docs/foundry/logic/overview)).
  Functions take Ontology objects as input and can *"make edits to Ontology records"*, which can be
  *"automatically applied or staged for human review"*. Supports prompt engineering, eval, monitoring,
  automation. Crucially, the LLM is given *"access only to what is necessary to complete a task"* —
  the Ontology + Roles act as the permission and grounding boundary. The output is a **Function**, so
  LLM logic composes with Actions/Workshop/OSDK identically to hand-written logic.
- **AIP Agent Studio → renamed AIP Chatbot Studio** (agents → "Chatbots") — builds *"interactive
  assistants equipped with enterprise-specific information and tools"*
  ([core concepts](https://www.palantir.com/docs/foundry/agent-studio/core-concepts)). Core concepts:
  **Tools** (actions/retrieval the LLM can invoke), **Retrieval/RAG** with **vector embeddings**,
  **Application State** (prompt variables), and **Chatbots-as-Functions** (publishable for reuse in
  Evals/Automate/repos). Deployable internally and externally via OSDK and platform APIs.
- **Recent agentic roadmap (cross-checked, dates noted):** AIP Analyst (GA ~April 2026) —
  conversational querying of Ontology data with *"transparent derivation chains"*; AIP Autopilot
  (Beta ~March 2026) — trace/debug agent workflows. *[dates from search snippets; treat as indicative
  until confirmed against vendor release notes.]*

> **Vendor-marketing flag.** The "no-code"/"autonomous" framing is overstated. The teardown notes
> production AIP deployments *"demand rigorous prompt engineering and months of testing"*, and that
> *"human validation requirements for all critical actions"* mean the autonomous-agent narrative
> *"overstates actual autonomy in risk-sensitive domains"*
> ([Towards AI, 2025](https://towardsai.com/p/machine-learning/inside-palantir-aip-how-the-worlds-most-controversial-ai-platform-actually-works)) *[secondary]*.

---

## A1. Building blocks → Weave engine mapping

| Foundry building block | Primary role | Weave engine | Notes on the mapping |
|---|---|---|---|
| Object / link types, interfaces, properties | Semantic schema | **Constitution Engine** | Weave = OWL classes/`owl:ObjectProperty`/SHACL node shapes; interfaces ≈ OWL class hierarchy. |
| Action types (write-back, rules, side effects) | Kinetic / operational change | **Events & Actions Engine** + Build | Weave needs SHACL-validated write-back + PROV-O provenance on every edit. |
| Functions (TS/Python, ontology-aware) | Business logic | **Build Engine** | Weave: generated/handwritten logic bound to the graph; SPARQL/SHACL as the query/validation substrate. |
| Pipeline Builder | Data integration / binding | **Constitution Engine (connectors)** | Weave's managed connectors (Snowflake/Databricks/S3/Azure) + R2RML/RML virtualisation. |
| Workshop | App builder | **Build Engine** | Weave: generate Next.js/shadcn apps from the model rather than a hosted widget canvas. |
| Quiver / Object Views | Analysis / inspection | **Graph Explorer** | Weave's force-directed schema view is *more* model-centric than Foundry's record-centric views. |
| Object Explorer | Instance navigation | **Graph Explorer** | Overlap on instance drill-in; Weave adds multi-user Figma-style collab. |
| OSDK | Code generation from ontology | **Build Engine** | The crown jewel to emulate: ontology → typed SDK. Achievable over OWL/SHACL. |
| AIP Logic | LLM-powered functions | **Events & Actions + Build** | Weave: Anthropic Agent SDK/Bedrock agents grounded by the graph + Guardrails. |
| AIP Chatbot Studio | Agents | **Events & Actions Engine** | Weave: NL authoring + agents-over-graph; OSDK-style deploy. |

**Takeaway:** Foundry already implements all four Weave loop stages, but as a *closed, proprietary*
stack. Weave is recognisably "Foundry on open W3C standards, for the mid-market." Every Weave engine
has a direct Foundry antecedent — which validates the architecture and warns that the differentiation
must be the *substrate and reach*, not the *feature list*.

---

## A2. Data model and non-technical authoring UX

**Data model.** Foundry's model is a **property graph of typed objects and links bound to backing
datasets**, with an explicit kinetic overlay (actions/functions). It is *not* RDF/OWL; it is a
proprietary object model. Object instances are materialised from pipeline outputs into an
object store (the OMS/OSS/Funnel service split is described only in the secondary teardown
*[secondary]* — public vendor docs do not specify the storage/index engine, so depth is bounded here
per the opacity caveat). The model's strengths versus RDF: native typed write-back, a first-class
action/permission model, and tight code-gen. Its weakness versus RDF: no open semantics, no
standards-based reasoning, no portable serialisation — migration out is, per the teardown,
*"a monumental undertaking"* (proprietary lock-in by design).

**Non-technical authoring UX.** Foundry's authoring is **forms/visual-canvas first, code-optional**:
Pipeline Builder (visual DAG), Ontology Manager (forms to define object/link/action types), Workshop
(widget canvas), AIP Logic (block-based prompt builder). This is genuinely lower-friction than
hand-writing OWL — but the independent review is explicit that *"no-code"* is partly a **misconception**:
real deployments require domain experts plus *"significant engineering investment"*, and the
ontology-modelling step in particular *"requires immense domain expertise"* *[secondary]*.

**Implication for Weave's NL+forms thesis:** Foundry validates forms-first authoring but leaves a
real gap at the *true* non-expert end. Weave's wedge — **NL + forms authoring over a *shipped*
universal ontology** — directly attacks the "requires immense domain expertise to even start"
weakness: clients extend a pre-built ~9-type ArchiMate-aligned model instead of facing a blank canvas.

---

## A3. Placement on the three-paradigm frame and four loop stages

### Three-paradigm frame

- **Data-bound-actionable — exemplar (strong).** Foundry *defines* this paradigm: live state bound to
  source data, with write-back and actions. Nothing in the study matches its kinetic layer.
- **Descriptive-modeled — partial.** You model object/link/action types, but the model is *engineered
  from data*, not drawn from notations. No native ArchiMate/BPMN/capability-map authoring; the model
  is an IT/data artefact, not a business-architecture artefact. Weave's descriptive/EA strength is a
  genuine gap here.
- **Mined-observed — weak/absent.** Foundry does not do process mining (event-log discovery of how the
  business *actually* runs). It reflects whatever pipelines feed it. This is Celonis/Signavio territory
  (R3) and a paradigm Foundry does **not** unify — supporting brief hypothesis H1 (no incumbent unifies
  all three).

### Four loop stages (model → generate → automate → govern)

| Stage | Foundry rating | Evidence |
|---|---|---|
| **Model** | Strong (data-centric) | Ontology object/link/action/function types; binds to source data. Weak on notation-driven business modelling. |
| **Generate** | Strong | OSDK (typed SDK from ontology), Workshop apps, AIP Logic functions, function-backed actions. The clearest exemplar of "generate from the model." |
| **Automate** | Strong | Action side effects (webhooks/notifications), AIP Logic/Chatbots, Automate. Human-in-the-loop gating on critical actions. |
| **Govern** | Strong-but-proprietary | Roles permissioning, writeback lineage, derivation chains, Apollo deployment. All proprietary; no open PROV/SHACL equivalent. |

**Net:** Foundry is the benchmark on **generate + automate** and the exemplar of **data-bound**. It is
*weak* on descriptive/notation modelling and *absent* on mined-observed — precisely the union Weave
claims as whitespace (H1 holds against this subject).

---

## A4. Defensible differentiation for Weave

1. **Open W3C semantics vs a proprietary object model.** Foundry's Ontology is a closed property graph;
   exit is *"a monumental undertaking"* *[secondary]*. Weave's RDF/OWL 2 DL / SHACL / SPARQL / PROV-O /
   SKOS stack makes the model **portable, reasoning-capable, and standards-validated**. This is both a
   technical and a *procurement* differentiator (no lock-in) — the single sharpest wedge (H2).
2. **Mid-market reach vs enterprise-only price.** Foundry is custom, high-cost, and heavily
   contract-driven — TrustRadius confirms *"Palantir Foundry does not currently have any pricing plans
   listed at this time"* (no public tiers; contact-sales only)
   ([TrustRadius](https://www.trustradius.com/products/palantir-foundry/pricing)). Per PeerSpot, large
   enterprises make up ~62% of users *researching* Foundry (932 large / 176 mid / 395 small visitors),
   and among actual reviewers the large-enterprise share is higher at ~74% (41 of 53)
   ([PeerSpot](https://www.peerspot.com/products/palantir-foundry-reviews)) — both figures are
   secondary practitioner data and carry selection bias. Weave's multi-tenant SaaS + transparent
   pricing targets the mid-market Foundry cannot economically serve.
3. **NL + forms authoring over a *shipped* universal ontology.** Foundry starts from a blank,
   data-engineered model that *"requires immense domain expertise"* to build. Weave ships a universal
   ArchiMate-aligned ontology clients *extend* — collapsing time-to-first-model.
4. **Descriptive + actionable in one graph.** Foundry is data-bound but not notation-modelled; EA tools
   (R2) are notation-modelled but not data-bound. Weave binds both — ingest the client's ArchiMate/BPMN
   *and* bind it to live source data.
5. **Closed model→generate→automate loop on open standards.** Foundry proves the loop closes; Weave's
   claim is to close it without the proprietary cage, with PROV-O provenance and SHACL validation as
   open governance primitives.

> **Honest caveat (challenges nothing fixed, but tempers H2):** Foundry's lock-in *is the product* for
> its customers — deep operational dependency is a feature, not a bug, in defense/large-enterprise.
> Weave's openness is a wedge for the *mid-market and the lock-in-averse*, not a universal advantage.
> The bet is that the mid-market values portability; that should be validated with design partners.

---

## A5. What Weave should NOT build

- **A proprietary object model.** Foundry's lock-in is its moat *and* its vulnerability. Do not
  re-invent a closed graph; commit to RDF/OWL/SHACL. (Reinforces CLAUDE.md; flagged only to make the
  contrast deliberate.)
- **A hosted widget canvas competing with Workshop.** Workshop is a mature, large surface. Weave's
  thesis is **generate a real Next.js/shadcn app from the model**, not host a drag-drop runtime. Build
  the generator, not the canvas.
- **A general-purpose data-integration/ETL studio.** Pipeline Builder is deep and commodity-adjacent.
  Use **managed connectors + R2RML/RML virtualisation** to bind sources; do not build a Spark-class
  transformation IDE.
- **A bespoke process-mining engine (for MVP).** Mined-observed is a whole category (R3, Celonis).
  Foundry itself doesn't build it. Defer; integrate or observe later, do not own it now.
- **A proprietary deployment/orchestration layer (Apollo-equivalent).** Lean on AWS (Lambda/ECS/CI-CD
  per CLAUDE.md). Do not build air-gapped delivery infrastructure for a mid-market SaaS.
- **An LLM-agent runtime from scratch.** AIP Logic/Chatbots are deeply integrated, but Weave's stack
  already commits to Anthropic Agent SDK + Bedrock AgentCore + Guardrails. Ground agents in the graph; don't build
  the runtime.

---

## Implications for Weave

### Emulate (copy the pattern)

- **The semantic/kinetic split.** Model the Constitution Engine as a semantic core (objects/links =
  OWL classes/properties) *plus* a kinetic overlay (actions = validated, provenance-tracked write-back;
  functions = ontology-bound logic). This split is Foundry's best idea.
- **OSDK-style code generation.** Ontology → type-safe SDK is the canonical "generate from the model"
  pattern. Generate typed clients (TS/Python) and OpenAPI from OWL/SHACL shapes.
- **Function as the universal composition unit.** One logic primitive (function) that backs actions,
  app widgets, agents, and SDKs — write once, reuse everywhere. Mirror this so AI-authored and
  hand-authored logic are interchangeable.
- **LLM grounded by the model + permissions.** AIP Logic's "give the LLM access only to what the task
  needs, via the ontology + roles" is the right safety pattern — map to graph-scoped context + Bedrock
  Guardrails.
- **Forms/visual-first authoring with a code escape hatch** (Pipeline Builder's "coders and
  non-coders collaborate on one workflow").

### Adopt (use the tech/standard directly)

- **OpenAPI as the polyglot SDK fallback** (Foundry generates OSDK for "any language" via OpenAPI).
  Weave already commits to OpenAPI 3.1 — generate it from the ontology.
- **Vector RAG + embeddings for agent retrieval** (AIP Chatbot pattern) — maps to S3 Vectors in the
  Weave stack.
- **Human-in-the-loop gating on critical actions** as a default, not an option (the teardown shows
  even Palantir keeps humans on critical actions). Wire into the phase-gate/HITL harness.
- **Derivation/lineage chains for trust** — adopt via PROV-O (open standard) rather than a proprietary
  equivalent.

### Avoid (commodity or anti-pattern)

- **Proprietary, non-portable model storage** — the lock-in Foundry's own customers cite as switching
  pain. Anti-pattern for Weave's positioning.
- **Re-building ETL, a widget runtime, process mining, or an agent runtime** (see A5) — commodity or
  category-owned-elsewhere.
- **Over-claiming "no-code."** Foundry's "no-code" is partly marketing; production needs experts.
  Weave should under-promise: "NL+forms for business users to *extend and operate*; experts still
  needed for deep modelling." Avoid the credibility hit Palantir takes on this.

### Differentiate (deliberately diverge, and why)

- **Open W3C stack over proprietary object model** — portability, reasoning, standards validation,
  no lock-in. The core wedge (H2).
- **Shipped universal ArchiMate-aligned ontology** — kills Foundry's "blank canvas needs immense
  expertise" weakness; collapses time-to-first-model.
- **Descriptive + data-bound in one graph** — ingest the client's EA notations (ArchiMate/BPMN, R5)
  *and* bind to live data; Foundry does the latter only, EA tools the former only.
- **Generate a real, owned application** (Next.js/shadcn) rather than host a runtime — clients own and
  can fork the output; no runtime lock-in.
- **Mid-market multi-tenant SaaS with transparent pricing** — serve the segment Foundry's
  contract-driven, high-cost model structurally excludes.

---

## Sources

Primary (vendor docs / standards), accessed June 2026:

- Palantir — Ontology overview: <https://www.palantir.com/docs/foundry/ontology/overview>
- Palantir — Ontology core concepts: <https://www.palantir.com/docs/foundry/ontology/core-concepts>
- Palantir — Object/link types reference: <https://www.palantir.com/docs/foundry/object-link-types/type-reference>
- Palantir — Link types overview: <https://www.palantir.com/docs/foundry/object-link-types/link-types-overview>
- Palantir — Action types overview: <https://www.palantir.com/docs/foundry/action-types/overview>
- Palantir — Functions overview: <https://www.palantir.com/docs/foundry/functions/overview>
- Palantir — Ontology SDK (OSDK) overview: <https://www.palantir.com/docs/foundry/ontology-sdk/overview>
- Palantir — Pipeline Builder overview: <https://www.palantir.com/docs/foundry/pipeline-builder/overview>
- Palantir — Workshop overview: <https://www.palantir.com/docs/foundry/workshop/overview>
- Palantir — AIP Logic overview: <https://www.palantir.com/docs/foundry/logic/overview>
- Palantir — AIP Chatbot/Agent Studio core concepts: <https://www.palantir.com/docs/foundry/agent-studio/core-concepts>
- Palantir — AIP overview: <https://www.palantir.com/docs/foundry/aip/overview>
- Palantir — July 2025 announcements (TypeScript Functions v2; Python OSDK 2.x): <https://www.palantir.com/docs/foundry/announcements/2025-07>

Secondary (independent analysis / practitioner reviews), accessed June 2026 — used for cross-checking
vendor claims, not as primary basis:

- Towards AI — "Inside Palantir AIP: How the World's Most Controversial AI Platform Actually Works" (2025):
  <https://towardsai.com/p/machine-learning/inside-palantir-aip-how-the-worlds-most-controversial-ai-platform-actually-works>
- PeerSpot — Palantir Foundry reviews/pricing: <https://www.peerspot.com/products/palantir-foundry-reviews>
- TrustRadius — Palantir Foundry pricing 2025: <https://www.trustradius.com/products/palantir-foundry/pricing>
