---
type: Product Brief
title: Constitution Engine — Product Brief
description: "Brief for the Weave Constitution Engine — the standards-based RDF/OWL knowledge-graph layer holding the company operating model."
tags: [constitution-engine, 01-brief, ontology, semantic-web]
timestamp: 2026-06-29T00:00:00Z
resource: docs/specs/constitution-engine/01-brief/brief.md
---

# Brief: Constitution Engine

## Mission Statement

We are building the Weave Constitution Engine — the authoritative, standards-based
knowledge-graph layer that holds a company's operating model — so that business and
technical users can collaboratively author, validate, query, and trust a live RDF/OWL model
of how the company runs, starting from a **business-process-modelling-ontology (BPMO)
framework** in which **processes sit at the centre**, linked to the data they consume and
produce, the systems and services that run them, the capabilities they realize, the
governance and constraints that bound them, the goals they serve, and the actors and roles
that perform them. This is the "business brain": the model an autonomous **agent reasons within
the bounds of** — what to do, when, with which system, who to contact, and what it may *not* do.
This is Weave's durable differentiator, not the RDF substrate (a standards-based triple store is
commodity); the value is that the model grounds generation and agent behaviour in what the
business has declared true and permitted. Weave ships the framework
(the grammar) on top of which clients build their own domain taxonomy and instances (the
sentences). It is the single source of truth that every other Weave engine (Build,
Events & Actions, Graph Explorer) reads from; if the Constitution Engine is wrong, nothing
generated downstream can be right.

## Problem

Building an authoritative, machine-reasoned model of how a company operates is today either
impossibly expert-bound or hopelessly informal — there is no middle.

- **Formal semantic tooling is expert-only.** Tools like Protégé expose raw OWL/RDF and
 assume a knowledge engineer. A business analyst cannot use them, so the people who
 actually understand the operating model are locked out of authoring it.
- **Informal tooling is not reasoned or validated.** CMDBs, EA repositories, and wikis hold
 loosely-structured data with no formal semantics, no constraint validation, and no
 provenance — so the model cannot be trusted, queried rigorously, or used to drive
 generation.
- **Everyone starts from a blank page.** Teams that attempt a formal model spend months
 designing the structural scaffolding (entity kinds, relationship types, validation, version
 and provenance plumbing) before capturing a single real fact about their business — instead
 of starting from a ready-made framework and writing their own domain taxonomy on top.
- **No shared, live authoring.** Where models exist, they are single-author artefacts that
 drift; business and technical stakeholders cannot co-edit one trusted graph.

The people who feel this are **enterprise architects and ontologists** (forced to choose
between rigour and usability) and the **operations and business analysts** who hold the
real knowledge but cannot encode it. If this is not solved, the graph at the heart of Weave
is never populated with trustworthy content — and every downstream engine inherits a model
that is either too thin to be useful or too informal to be safe to generate from.

## Vision

Within 12 months, success for the Constitution Engine looks like:

- **A populated graph of record.** A real client has built their own domain taxonomy on top
 of the shipped BPMO framework and populated it with real entities and
 relationships, and treats that graph — not a spreadsheet or CMDB — as the authoritative
 description of how they operate.
- **Business users author safely.** A non-technical user adds and edits ontology content
 through natural language and guided forms; every change is validated against SHACL shapes
 before it is committed, so usability never costs correctness.
- **The model is queryable and reasoned.** Stakeholders answer real operating-model
 questions through SPARQL (directly or via generated queries), and OWL reasoning surfaces
 inferred relationships and inconsistencies the authors did not state explicitly.
- **Every change is provenance-tracked.** Who changed what, when, and why is captured as
 PROV-O, so the graph is auditable and trustworthy enough to govern downstream generation.
- **Downstream engines consume it.** At least one other engine (Build, Events & Actions, or
 Graph Explorer) reads the Constitution Engine's graph through a stable interface, proving
 it functions as the shared source of truth rather than a standalone editor.

## Scope

### In Scope

The Constitution Engine holds two things: the **governed content** that constitutes the
company (its structure, vocabulary, identity, and rules) and the **engine capabilities** that
make that content trustworthy and consumable.

**Governed content the graph holds**

- **The BPMO framework (the grammar, not the taxonomy).** A shipped, process-centric,
 ArchiMate-3-aligned **business-process-modelling ontology** plus W3C SHACL/PROV-O/SKOS
 scaffolding. The shipped **kinds** (13) are: **Process, Activity** (a task/step within a
 process), **Event** (a trigger or boundary event), **DataAsset** (with **Field** for its
 columns/attributes, and document/artefact content), **System, Service, BusinessCapability,
 BusinessDomain, Policy** (a constraint, rule, regulatory requirement, or principle that
 bounds behaviour), **Goal** (a motivation, driver, or outcome), **Actor** (a role, person,
 or service-account identity), **Concept** (SKOS glossary term) and **Class** (OWL type).
 The shipped **relationship types** connect them so a process is fully situated: a Process
 (or Activity) **consumes** and **produces** DataAssets, is **performedBy** an Actor, runs as
 or **dependsOn** a Service that **runsOn** a System, **realizes** a BusinessCapability that
 **servesGoal** a Goal and sits **inDomain** a BusinessDomain, is **governedBy** a Policy, is
 **triggeredBy** an Event and **hasStep** its Activities; plus **accesses** (Service→DataAsset),
 **describes** (e.g. a Concept describing an entity), **partOf**, and the SKOS
 **broader/narrower/related** links. This is a *framework*, NOT a populated business
 taxonomy: Weave ships no client-domain vocabulary. Clients build their own domain taxonomy
 and instances on top of the framework. "Weave provides the grammar; the company writes the
 sentences." The framework is aligned to **ArchiMate 3** (business, application, technology,
 motivation, and strategy layers); **REA** (resource-event-agent economic patterns) and
 **UFO** (foundational-ontology rigour) inform the design behind the curtain but are never
 exposed to the user. (Detailed attributes and relationship cardinalities are specified in
 the data-model tech spec.)
- **Business glossary / controlled vocabulary (SKOS).** Canonical definitions of business
 terms with preferred labels, synonyms/alt-labels, and broader/narrower relationships, so
 the organisation shares one agreed meaning per term and downstream generation uses
 consistent language.
- **Brand, voice & communication standards.** Tone of voice and brand styleguides (visual
 identity — logo usage, colour, typography — and writing style) held as machine-readable,
 governed assets, so artefacts the Build Engine generates are brand- and voice-compliant by
 construction.
- **Governance, policy & compliance constraints.** The rules the business operates under —
 technology-stack standards, regulatory and compliance obligations (e.g. GDPR, SOC 2,
 industry-specific), security and data-handling policies, and business rules — modelled as
 first-class graph content so they can constrain and guardrail what downstream engines
 generate and automate.
- **Strategic / motivation layer.** Mission, vision, goals, drivers, and principles (the
 ArchiMate motivation layer — the "why"), linked to the capabilities and processes that
 serve them.

**Engine capabilities**

- **Artefact & document ingest (cold-start population).** First-class, AI-assisted import of
 a company's *existing* model so they do not start from a blank page: conversational ingest
 of enterprise documents (a BPM, policy, runbook, process doc) where an agent extracts
 candidate entities/relationships and proposes additions through the chat panel, linked to
 the resources the graph already holds; structured model import (ArchiMate Exchange Format,
 BPMN); diagram/image-to-data via a vision model; structured-data import via W3C R2RML
 (relational/CMDB) and RML (CSV/JSON/XML); and SKOS cross-notation reconciliation. Every path
 writes through the same validated mutation API with PROV-O attribution. This is
 user-supplied, materialised-copy import — distinct from the platform's live managed
 connectors — and is the adoption lever for clients leaving Bizzdesign / LeanIX / MEGA.
- **RDF/OWL knowledge graph store.** Persisting all of the above as RDF, with OWL 2 DL
 semantics. Oxigraph for dev/test; production store decided in the tech spec.
- **Authoring surfaces — NL *and* forms, both in v1.** Natural-language (chat) editing AND
 SHACL-shape-driven guided forms that let business and technical users create and modify any
 of the governed content above without writing RDF/SPARQL. Both surfaces ship in v1; neither
 is deferred.
- **SHACL validation.** Every committed change is validated against SHACL shapes; invalid
 changes are rejected or flagged before they enter the trusted graph.
- **SPARQL 1.1 query (SELECT-only, paginated).** Programmatic and user-facing querying of the
 graph, including queries generated from natural language. The query surface is SELECT-only,
 blocks the `SERVICE` keyword (SSRF), and paginates (no silent row cap). Writes never go
 through raw SPARQL Update — only through the validated mutation operations API.
- **Agent-grounding read capability.** Because processes are linked to the systems, data,
 actors, capabilities, and governance that surround them, the graph expresses what an agent
 **may** do, on **which** systems and data, within **which** process, and **who** to contact
 or escalate to. The engine exposes these agent-authority questions as read-side SPARQL over
 the BPMO graph (e.g. "which steps may an autonomous agent execute alone vs. route to a
 human", "who may read this sensitive data asset", "which actor does this exception escalate
 to") so downstream agents reason **within** the bounds the model states rather than from
 hardcoded policy. This corroborates the platform's separation of the model layer (what is
 true and permitted) from the execution layer (what an agent actually does at run time).
- **OWL reasoning.** Inference of implied relationships and detection of logical
 inconsistencies.
- **PROV-O provenance + versioning.** Every change records who, what, when, and why; history
 is auditable.
- **Draft → published version lifecycle.** The ontology, glossary, and governed content are
 authored in a draft state and versioned on publish; each published version carries an
 identifier and a PROV-O change log of what changed. Downstream projects (Build) and
 automations (Events) pin to a specific published version, so model evolution never silently
 breaks what depends on it.
- **A stable read interface** other engines consume to read the graph as the source of truth,
 addressable by published version.

### Out of Scope

- **Graph visualisation and the collaborative canvas** — the force-directed view, drill-in
 focus views, and the structured C4 view belong to the **Graph Explorer** engine (embeddable
 via contract GE-CANVAS-1). The Constitution Engine owns the model, store, validation, and
 semantic authoring operations; Graph Explorer owns how that graph is seen and manipulated.
 Note: Figma-style real-time multi-user co-editing (presence, cursors, follow-me) is a
 **Phase 2** Graph Explorer capability — the MVP is single-user editing plus async sharing
 (saved views + comments); it is out of scope here either way.
- **Code/app/agent/pipeline generation** — that is the Build Engine.
- **Automations and event handling** — that is the Events & Actions Engine.
- **Managed source-system connectors** — platform-level capability (contract
 PLAT-CONNECTOR-1), not owned by this engine's brief. The v1 connector set is 7 integrations:
 Snowflake, Databricks, S3, Azure Data Lake, Atlassian (Jira + Confluence), ServiceNow, and
 Slack. Connector-data ingestion into the graph is a platform ingestion responsibility that
 writes through this engine's validated write API (CE-WRITE-1).
- **Choosing the production RDF store** (Neptune vs Jena Fuseki) — deferred to the tech spec.
- **Designing brand or creative assets** — the engine *holds and governs* tone of voice,
 styleguides, glossary, and policies as authoritative content and serves them to downstream
 engines; it does not design logos, write brand strategy, or author the source policies.
- **Enforcing constraints at generation time** — the Constitution Engine *publishes*
 governance constraints, brand standards, and vocabulary; the Build and Events & Actions
 engines are responsible for *applying* them when they generate or automate.
- **Process mining / discovery and conformance checking** — the engine *ingests* observed
 behaviour (e.g. an OCEL 2.0 event log) as data and can model it, but it does NOT build a
 process-discovery engine, conformance-checking algorithms, or a process query language
 (PQL). Heavy mining is integrated or partnered, not built here.
- **Query-time live federation of external data** — current external-data ingestion is a
 **materialised copy** (R2RML/RML import into the graph), NOT query-time virtual-graph
 SPARQL→SQL federation against live source systems. Virtual-graph federation is an open
 question pending a tech-spec decision, not a v1 capability.

## Target Users

The expanded governed content (vocabulary, brand, governance) means the engine serves not
just modellers but the owners of each kind of authoritative content.

| User Type | Description | Primary Need |
|-----------|-------------|--------------|
| Enterprise architect / ontologist | Builds the client's domain taxonomy on top of the shipped framework and curates its structure | Standards-compliant (OWL/SHACL) modelling with reasoning and validation, without hand-writing RDF |
| Business analyst / SME | Authors and maintains instance data and glossary terms for their domain | Natural-language *and* guided-form editing (both in v1); one agreed definition per business term |
| Brand / marketing owner | Maintains tone of voice and brand styleguides as governed assets | A single authoritative home for brand standards that downstream generation provably honours |
| Compliance / risk officer | Maintains regulatory, security, and policy constraints | Constraints captured as first-class, queryable, provenance-tracked content that guardrails automation |
| Downstream platform engineer | Consumes the graph from Build / Events / Explorer engines | A stable, validated read interface and confidence the model is internally consistent |

## Success Criteria

- [ ] **The framework gets built on and populated.** A real client builds their own domain
 taxonomy on top of the shipped BPMO framework and populates instances across at least 8 of
 the 13 framework kinds — including **Process** and at least two of the things a process
 connects to (DataAsset, System/Service, Actor, BusinessCapability, Policy, or Goal) — so
 the process-centric "business brain" is exercised, not just an entity list. Measured by
 graph statistics; source: graph store. Target: 30 days after the engine reaches GA.
- [ ] **The model answers its competency questions.** The client's graph answers the small
 shipped framework competency-question set (e.g. "what data does this process consume and
 produce?", "which systems run it?", "who performs it?", "what governs it?") plus the 2–5
 client-declared domain competency questions. Measured by a competency-question test run;
 source: query logs. Target: 30 days after GA.
- [ ] **Validated, code-free authoring works.** At least 90% of business-user edits are made
 through natural language or guided forms (no raw RDF/SPARQL), and 100% of committed
 changes pass SHACL validation, with invalid changes demonstrably blocked. Measured via
 editor telemetry and validation logs; source: application analytics. Target: 30 days
 after GA.
- [ ] **Governed content is consumed downstream, provably.** At least one downstream artefact
 honours Constitution-published content — a generated artefact applies a brand
 styleguide value, uses a glossary term, or is blocked/guardrailed by a governance
 constraint. Measured by a generation/automation audit trail; source: engine logs.
 Target: by MVP loop-close (within 6 months of MVP launch).
- [ ] **The model is reasoned and queryable.** OWL reasoning surfaces at least one inferred
 relationship or flagged inconsistency in a real client graph, and users answer real
 operating-model questions via SPARQL (direct or NL-generated). Measured via reasoning
 and query logs; source: application analytics. Target: 30 days after GA.
- [ ] **Every change is provenance-tracked.** 100% of committed changes carry PROV-O records
 (who, what, when). Measured by audit sampling; source: provenance store. Target: at GA.
- [ ] **It functions as the source of truth.** At least one other engine (Build, Events &
 Actions, or Graph Explorer) reads the graph through the stable interface in
 production-like use. Measured by integration in a real deployment; source: deployment
 records. Target: by MVP loop-close.

## Constraints

**Technical**

- Standards are mandatory, not negotiable: OWL 2 DL ontology, Turtle serialisation, SHACL
 validation, SPARQL 1.1 (SELECT-only query surface; writes via the validated operations API,
 not raw SPARQL Update), PROV-O provenance, SKOS for the glossary. ODRL is NOT in the v1
 stack — PII/sensitive handling uses SHACL plus data-classification properties in v1; ODRL
 policy enforcement is deferred to a later stack decision.
- RDF store is Oxigraph in dev/test; the production store (Neptune vs Jena Fuseki) is
 deferred to this engine's tech spec and must support SPARQL 1.1 and the expected scale.
- Natural-language authoring relies on the platform AI layer (Anthropic models via Bedrock);
 NL→RDF output must always pass SHACL before commit — the model never writes unvalidated
 triples to the trusted graph.
- Must expose a stable, versioned read interface (REST + SPARQL) for other engines.
- OWL reasoning must remain tractable at client scale; expressivity may be bounded (e.g. a
 DL profile) if needed for performance — decided in the tech spec.

**Business**

- The BPMO framework is Weave IP shipped to every tenant; the client-built domain
 taxonomy and instances are tenant-isolated and not shared back by default.
- Governance, brand, and compliance content is authoritative and auditable — provenance and
 validation are product requirements, not nice-to-haves, because downstream generation
 relies on them.

**Timeline / sequencing**

- This engine is the MVP and ships first; the core ontology, validated authoring, store, and
 read interface are prerequisites for any other engine.
- Brand, glossary, governance, and motivation content are in the engine's scope but may be
 sequenced after the core ontology + authoring loop within the MVP — phasing decided at PRD.

## Key Decisions

For the platform-wide master list see `CLAUDE.md § Architecture decisions (confirmed)` and
the `weave-platform` brief. Decisions specific to the Constitution Engine:

| Decision | Rationale | Date |
|----------|-----------|------|
| Constitution Engine is the MVP and ships first | It is the source of truth every other engine reads; nothing generates or automates without it | 2026-06-24 |
| Ship a process-centric, ArchiMate-3-aligned **BPMO framework** (13 kinds + relationship types + W3C scaffolding), NOT a populated taxonomy; clients build their own domain taxonomy on top (decision A1) | Grounded in a recognised EA standard and a business-process-modelling ontology where processes sit at the centre, linked to data, systems, services, capabilities, governance, goals, and actors — the "business brain" an agent reasons inside. Gives clients the grammar and the plumbing without imposing a business vocabulary they would have to fight. "Weave provides the grammar; the company writes the sentences." REA and UFO inform the design behind the curtain. | 2026-06-30 |
| Every authoring surface offers an AI / auto-population on-ramp — **no manual-only modeller** | The cold-start blank-page problem is the main adoption barrier; every place a user can author (chat, forms, ontology import, document ingest, structured-data import) must offer an AI-assisted or auto-population path, never hand-RDF-only. | 2026-06-30 |
| Document & artefact ingest is a **first-class CE capability** (conversational document ingest, model import, diagram-to-data, structured-data import, cross-notation reconciliation) that writes through the validated mutation API | The cold-start lever for clients leaving Bizzdesign / LeanIX / MEGA: they already hold the model in documents and tools; CE must absorb it. Distinct from the platform's live managed connectors. | 2026-06-30 |
| Engine holds governed content beyond structure: SKOS glossary, brand/voice standards, governance/compliance constraints, and a strategic/motivation layer | A company's "constitution" is its vocabulary, identity, and rules — not just its org chart; these are exactly what downstream generation must obey | 2026-06-26 |
| Publish-vs-apply boundary | The Constitution Engine publishes constraints, brand, and vocabulary; the Build and Events & Actions engines apply/enforce them at generation and run time, keeping the model layer free of enforcement logic | 2026-06-26 |
| Constitution / Graph Explorer split | Model, store, validation, and semantic authoring live here; the visual canvas and real-time collaborative editing UX live in Graph Explorer | 2026-06-26 |
| NL authoring must pass SHACL before commit | Usability must never cost correctness; the AI layer never writes unvalidated triples to the trusted graph | 2026-06-26 |
| Two authoring surfaces ship in v1: NL chat AND SHACL-shape-driven guided forms (decision B4) | A confirmed platform decision ("NL + forms editing for business users"); the prototype already ships forms (Inspector / NodeEditModal / AddNodeForm). Neither surface is deferred | 2026-06-30 |
| Glossary term and OWL class are ONE punned resource — a single URI is both `owl:Class` and `skos:Concept` (decision B1); SHACL validation runs with `inference='none'` | Avoids a fragile cross-notation linking property; DL-completeness is not load-bearing because validation does not rely on OWL inference | 2026-06-30 |
| Oxigraph for dev/test; production RDF store deferred to tech spec | Unblock development now; choose Neptune vs Jena Fuseki against real scale and SPARQL requirements later | 2026-06-24 |
| Ontology, glossary, and graph use a draft → published version lifecycle with PROV-O change logs; downstream pins to a published version | As ontologies evolve, unversioned change silently breaks Build projects and Events automations; version pinning prevents this | 2026-06-26 |

## Navigation

First-draft **secondary navigation** (left sidebar) for the **Constitution** primary area.
The primary top-header nav is defined in the `weave-platform` brief. Grouped for scannability;
collapsible with the active item highlighted.

**Model**

- **Overview** — model health, counts by type, recent changes, draft vs published status.
- **Ontology / Types** — the schema: the 13 ArchiMate-aligned BPMO framework kinds and the
 client-built domain taxonomy on top.
- **Instances / Data** — the populated entities and their relationships.
- **Org chart** — people, roles, and org units (often sourced from SSO/HR integrations).

**Vocabulary & standards**

- **Glossary** — SKOS controlled vocabulary (preferred terms, synonyms, definitions).
- **Brand & voice** — tone of voice and brand styleguides.
- **Rules & policies** — SHACL shapes and business rules.
- **Governance & compliance** — regulatory, security, and data-handling obligations as content.
- **Strategy & motivation** — mission, vision, goals, drivers, principles.

**Tools**

- **Query** — SPARQL and natural-language query of the graph.
- **Mapping** — mappings between data and the rules/processes that govern it.
- **Versions** — draft → published lifecycle, change log, and diffs (PROV-O backed).
- **Authoring & questionnaires** — NL/forms authoring plus questionnaire/interview elicitation
 that feeds the model.

---
*Generated by Weave PO agent. Review and approve before proceeding to PRD.*

# Related

- [Weave Platform — Product Brief](../../weave-platform/01-brief/brief.md)
