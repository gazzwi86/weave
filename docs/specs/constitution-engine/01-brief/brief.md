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
of how the company runs, starting from a universal business ontology they extend rather than
build from scratch. It is the single source of truth that every other Weave engine (Build,
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
- **Everyone starts from a blank ontology.** Teams that do attempt a formal model spend
  months designing entity types and relationships before capturing a single real fact about
  their business.
- **No shared, live authoring.** Where models exist, they are single-author artefacts that
  drift; business and technical stakeholders cannot co-edit one trusted graph.

The people who feel this are **enterprise architects and ontologists** (forced to choose
between rigour and usability) and the **operations and business analysts** who hold the
real knowledge but cannot encode it. If this is not solved, the graph at the heart of Weave
is never populated with trustworthy content — and every downstream engine inherits a model
that is either too thin to be useful or too informal to be safe to generate from.

## Vision

Within 12 months, success for the Constitution Engine looks like:

- **A populated graph of record.** A real client has extended the shipped universal ontology
  with their own domain and populated it with real entities and relationships, and treats
  that graph — not a spreadsheet or CMDB — as the authoritative description of how they
  operate.
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

- **The universal business ontology.** A shipped, ArchiMate-3-aligned core taxonomy of ~9
  canonical top-level entity types — Actor/Role/Org-Unit, Capability, Process/Activity,
  System/Application, Data/Information asset, Rule/Policy, Event, Product/Service, and
  KPI/Metric — with the relationships between them. Clients extend it; they do not start
  from a blank ontology. (Detailed attributes and relationship cardinalities are specified
  in the data-model tech spec.)
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

- **RDF/OWL knowledge graph store.** Persisting all of the above as RDF, with OWL 2 DL
  semantics. Oxigraph for dev/test; production store decided in the tech spec.
- **Authoring surfaces.** Natural-language editing and guided forms that let business and
  technical users create and modify any of the governed content above without writing
  RDF/SPARQL.
- **SHACL validation.** Every committed change is validated against SHACL shapes; invalid
  changes are rejected or flagged before they enter the trusted graph.
- **SPARQL 1.1 query + update.** Programmatic and user-facing querying of the graph,
  including queries generated from natural language.
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
  focus views, and Figma-style real-time co-editing UX belong to the **Graph Explorer**
  engine. The Constitution Engine owns the model, store, validation, and semantic authoring
  operations; Graph Explorer owns how that graph is seen and collaboratively manipulated.
- **Code/app/agent/pipeline generation** — that is the Build Engine.
- **Automations and event handling** — that is the Events & Actions Engine.
- **Managed source-system connectors** (Snowflake, Jira, ServiceNow, etc.) — platform-level
  capability, not owned by this engine's brief.
- **Choosing the production RDF store** (Neptune vs Jena Fuseki) — deferred to the tech spec.
- **Designing brand or creative assets** — the engine *holds and governs* tone of voice,
  styleguides, glossary, and policies as authoritative content and serves them to downstream
  engines; it does not design logos, write brand strategy, or author the source policies.
- **Enforcing constraints at generation time** — the Constitution Engine *publishes*
  governance constraints, brand standards, and vocabulary; the Build and Events & Actions
  engines are responsible for *applying* them when they generate or automate.

## Target Users

The expanded governed content (vocabulary, brand, governance) means the engine serves not
just modellers but the owners of each kind of authoritative content.

| User Type | Description | Primary Need |
|-----------|-------------|--------------|
| Enterprise architect / ontologist | Extends the universal ontology to the client's domain and curates its structure | Standards-compliant (OWL/SHACL) modelling with reasoning and validation, without hand-writing RDF |
| Business analyst / SME | Authors and maintains instance data and glossary terms for their domain | Natural-language and guided-form editing; one agreed definition per business term |
| Brand / marketing owner | Maintains tone of voice and brand styleguides as governed assets | A single authoritative home for brand standards that downstream generation provably honours |
| Compliance / risk officer | Maintains regulatory, security, and policy constraints | Constraints captured as first-class, queryable, provenance-tracked content that guardrails automation |
| Downstream platform engineer | Consumes the graph from Build / Events / Explorer engines | A stable, validated read interface and confidence the model is internally consistent |

## Success Criteria

- [ ] **The shipped ontology gets extended and populated.** A real client extends the
      universal ontology and populates instances across at least 6 of the 9 core entity
      types. Measured by graph statistics; source: graph store. Target: 30 days after the
      engine reaches GA.
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
  validation, SPARQL 1.1 (query + update), PROV-O provenance, SKOS for the glossary.
- RDF store is Oxigraph in dev/test; the production store (Neptune vs Jena Fuseki) is
  deferred to this engine's tech spec and must support SPARQL 1.1 and the expected scale.
- Natural-language authoring relies on the platform AI layer (Anthropic models via Bedrock);
  NL→RDF output must always pass SHACL before commit — the model never writes unvalidated
  triples to the trusted graph.
- Must expose a stable, versioned read interface (REST + SPARQL) for other engines.
- OWL reasoning must remain tractable at client scale; expressivity may be bounded (e.g. a
  DL profile) if needed for performance — decided in the tech spec.

**Business**

- The universal ontology is Weave IP shipped to every tenant; client extensions are
  tenant-isolated and not shared back by default.
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
| Ship an ArchiMate-3-aligned ~9-type universal ontology; clients extend it | Grounded in a recognised EA standard; clients populate rather than model from a blank slate | 2026-06-26 |
| Engine holds governed content beyond structure: SKOS glossary, brand/voice standards, governance/compliance constraints, and a strategic/motivation layer | A company's "constitution" is its vocabulary, identity, and rules — not just its org chart; these are exactly what downstream generation must obey | 2026-06-26 |
| Publish-vs-apply boundary | The Constitution Engine publishes constraints, brand, and vocabulary; the Build and Events & Actions engines apply/enforce them at generation and run time, keeping the model layer free of enforcement logic | 2026-06-26 |
| Constitution / Graph Explorer split | Model, store, validation, and semantic authoring live here; the visual canvas and real-time collaborative editing UX live in Graph Explorer | 2026-06-26 |
| NL authoring must pass SHACL before commit | Usability must never cost correctness; the AI layer never writes unvalidated triples to the trusted graph | 2026-06-26 |
| Oxigraph for dev/test; production RDF store deferred to tech spec | Unblock development now; choose Neptune vs Jena Fuseki against real scale and SPARQL requirements later | 2026-06-24 |
| Ontology, glossary, and graph use a draft → published version lifecycle with PROV-O change logs; downstream pins to a published version | As ontologies evolve, unversioned change silently breaks Build projects and Events automations; version pinning prevents this | 2026-06-26 |

## Navigation

First-draft **secondary navigation** (left sidebar) for the **Constitution** primary area.
The primary top-header nav is defined in the `weave-platform` brief. Grouped for scannability;
collapsible with the active item highlighted.

**Model**

- **Overview** — model health, counts by type, recent changes, draft vs published status.
- **Ontology / Types** — the schema: the ~9 ArchiMate-aligned core types and client extensions.
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
