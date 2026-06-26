# Brief: Weave Platform

## Mission Statement

We are building Weave — the operating system for the AI-native company — so that an
enterprise or mid-market organisation can describe its entire operating model (people,
processes, systems, data, rules, relationships) as a single live, collaborative knowledge
graph, and have Weave generate and run the applications, AI agents, data pipelines, and
automations that operate the business — closing the model → generate → automate loop that
no existing enterprise-architecture, BI, or low-code tool closes end-to-end.

## Problem

A company's operating model — how its people, processes, systems, data, and rules actually
fit together — lives scattered across stale architecture diagrams, Confluence pages,
spreadsheets, CMDBs, and individual employees' heads. None of it is machine-readable, none
of it is executable, and all of it drifts out of date the moment it is written down.

This leaves three categories of tooling that each solve only one third of the problem:

- **Enterprise-architecture / EA tools** (LeanIX, ServiceNow CMDB, Visio) *describe* the
  business but generate nothing — the model is documentation, not an execution engine.
- **Low-code / app builders** *generate* software but have no authoritative model of the
  business, so every app is built from scratch against tribal knowledge.
- **BI / analytics tools** *report* on the business but cannot act on it.

The people who feel this most acutely are **operations and transformation teams** (who own
how the company runs but have no single source of truth) and **CTOs, architects, and
engineers** (who are asked to "make the company AI-native" but have no machine-readable
model for agents, pipelines, or apps to build on).

If this is not solved, AI transformation stalls at the proof-of-concept stage: every
automation is bespoke and brittle, the operating model rots faster than it can be
maintained, and the gap between how a company is *described* and how it actually *runs*
never closes — so the promised value of AI agents (running real business processes) is
never realised at scale.

## Vision

Within 12 months of launch, success looks like:

- **One graph of record.** A real client has modelled a meaningful slice of their company
  in Weave — typed entities (people, processes, systems, data, rules, capabilities) and
  their relationships — as a single live graph that business and technical users edit
  together, and which they trust enough to retire at least one legacy source of truth
  (a CMDB export, an architecture wiki, or a spreadsheet register).
- **The loop closes at least once, for real.** From that graph, Weave generates and runs at
  least one working artefact — an application, an AI agent, or a data pipeline — that
  operates a genuine business process, not a demo.
- **Business users edit without code.** Operations and transformation staff add and change
  graph content through natural language and guided forms, with no RDF or SPARQL knowledge
  required, while the underlying model stays standards-compliant and validated.
- **The model stays alive.** Changes to the graph and relevant external events (a new Jira
  ticket, a CMDB sync, a webhook) propagate through Weave automatically, so the model
  reflects reality instead of drifting from it.
- **A repeatable engagement motion.** The workshop methodology has taken at least one client
  from blank slate to populated graph, proving Weave is sellable as a guided engagement, not
  just a tool licence.

## Scope

Weave is delivered as four engines on a shared multi-tenant platform. Each engine has its
own brief; this platform brief owns only the cross-cutting whole and the boundaries between
engines.

### In Scope

- **Constitution Engine** *(ships first / MVP)* — the ontology and knowledge-graph layer
  (RDF/OWL/SHACL/SPARQL/PROV); the live model of the business. Ships the universal business
  ontology that clients populate and extend. See `constitution-engine` brief.
- **Build Engine** — generates applications (UI + API), AI agents, data pipelines, and
  forms/dashboards from the graph model. See `build-engine` brief.
- **Events & Actions Engine** — automations triggered by internal graph changes and external
  events (webhooks, Jira, cron, ServiceNow). See `events-actions-engine` brief.
- **Graph Explorer** — visualises the company as a force-directed network with drill-in focus
  views and Figma-style real-time multi-user collaboration. See `graph-explorer` brief.
- **Shared platform foundation** — multi-tenant cloud SaaS (logical isolation per tenant),
  authentication/authorisation, the AI-native layer used across engines (NL editing,
  generation, suggestions), and managed connectors (Snowflake, Databricks, S3, Azure Data
  Lake, Jira, ServiceNow, Confluence).
- **Engagement layer** — the workshop methodology packaged as a repeatable product and GTM
  motion.

### Out of Scope

- **No open-source / self-hosted community edition** — Weave is fully commercial, closed
  source; no OSS core.
- **No single-tenant or on-premise deployment in v1** — multi-tenant cloud SaaS only.
- **Not a replacement for system-of-record tools** — Weave augments ServiceNow, Jira,
  Confluence, LeanIX, and data warehouses via connectors; it does not replace them.
- **No micro-frontend architecture** — a single modular React SPA, not independently
  deployed MFEs.
- **No non-business / non-enterprise domains** — Weave models how companies operate; it is
  not a general-purpose knowledge-graph or personal-knowledge tool.
- **No multi-cloud in v1** — AWS only (see Constraints).

## Target Users

The adoption arc runs ops-first, then technical: operations teams populate and trust the
graph, leadership governs and funds, then architects and engineers build on top.

| User Type | Description | Primary Need |
|-----------|-------------|--------------|
| Operations / transformation lead | Owns how the company runs; first adopter and day-to-day driver of the graph | A single trusted, editable source of truth for the operating model, maintainable without code |
| CTO / board sponsor | Funds and governs the initiative; accountable for AI-native transformation | Confidence that the model is authoritative and that it produces real, governed automation |
| Enterprise architect | Extends the universal ontology to the client's domain; designs the model | Standards-compliant (OWL/SHACL) modelling power with reasoning and validation |
| Engineer / developer | Builds applications, agents, and pipelines from the graph via the Build Engine | Reliable, portable code generation grounded in an authoritative model, not tribal knowledge |
| Business analyst / ops manager | Edits and queries graph content day to day | Natural-language and guided-form editing with no RDF/SPARQL knowledge required |

## Success Criteria

- [ ] **The loop closes for one real client** — one paying client models a meaningful slice
      of their company in Weave AND Weave generates one working artefact (app, agent, or
      pipeline) that runs a genuine business process. Measured by a signed client plus a
      demonstrable artefact in production-like use; source: client engagement record.
      Target: within 6 months of MVP (Constitution Engine) launch.
- [ ] **Non-technical editing is real** — at least one business-role user (no RDF/SPARQL
      knowledge) creates and edits graph entities via natural language and guided forms, with
      every change validated against SHACL. Measured via editor session telemetry; source:
      application analytics. Target: 30 days after the graph editor reaches GA.
- [ ] **A legacy source of truth is retired** — the pilot client decommissions or formally
      supersedes at least one prior source of truth (CMDB export, architecture wiki, or
      register) with the Weave graph. Measured by client sign-off; source: engagement record.
      Target: within 12 months of MVP launch.
- [ ] **The engagement motion is repeatable** — the workshop methodology takes at least one
      client from blank slate to populated graph end to end. Measured by a completed
      engagement; source: engagement record. Target: within 12 months of MVP launch.
- [ ] **First commercial validation** — at least one paid annual contract is signed for the
      Weave platform (pricing model per Key Decisions). Measured by signed contract; source:
      CRM. Target: within 12 months of MVP launch.

## Constraints

**Technical**

- AWS only in v1 — no multi-cloud (Cognito/Auth0 auth, Bedrock AgentCore + Anthropic models,
  Aurora PostgreSQL, S3 Vectors, Lambda/Fargate compute).
- Full W3C semantic web stack is mandatory, not optional: RDF/OWL 2 DL, SHACL validation,
  SPARQL 1.1, PROV-O provenance, Turtle serialisation.
- Single modular React SPA (Next.js 15, TypeScript strict) — no micro-frontends.
- Real-time multi-user collaboration is required at launch (non-negotiable), implying
  conflict-free concurrent editing of graph state.
- RDF store is Oxigraph for dev/test; the production store (Neptune vs Jena Fuseki) is
  deferred to the Constitution Engine tech spec.

**Business**

- Fully commercial, closed source — no open-source core, no community edition.
- Multi-tenant cloud SaaS with logical isolation per tenant; no on-prem/single-tenant in v1.
- Two revenue lines: platform SaaS subscription plus a paid consulting/workshop engagement
  arm.
- Target market is enterprise (500+ staff) and mid-market (50–500); the product must serve
  both tiers.

**Timeline / sequencing**

- The Constitution Engine ships first; the Build, Events & Actions, and Graph Explorer
  engines depend on it and cannot precede it.
- All success criteria are anchored to the MVP (Constitution Engine) launch; a fixed
  calendar launch date is not yet set.

## Key Decisions

For the full master list of confirmed architecture decisions, see
`CLAUDE.md § Architecture decisions (confirmed)`. Decisions most material to the platform
brief:

| Decision | Rationale | Date |
|----------|-----------|------|
| Constitution Engine ships first as the MVP | The graph is the foundation every other engine reads from; nothing generates or automates without it | 2026-06-24 |
| Full W3C semantic web stack (RDF/OWL/SHACL/SPARQL/PROV) | Maximum reasoning, validation, interoperability, and linked-data portability; the graph must be authoritative, not decorative | 2026-06-24 |
| Single modular React SPA, not micro-frontends | Simpler to start; can extract MFEs later if scale demands | 2026-06-24 |
| Multi-tenant cloud SaaS, AWS-only in v1 | Shared infrastructure with logical isolation; focus over multi-cloud breadth | 2026-06-24 |
| Real-time multi-user collaboration required at launch | Figma-style co-editing is a core differentiator, not a later add-on | 2026-06-24 |
| Weave ships a universal business ontology; clients extend it | Palantir-style typed head start; clients populate rather than model from zero | 2026-06-24 |
| Fully commercial, closed source | No OSS core; protect the platform IP and the engagement business | 2026-06-24 |
| Pricing: hybrid — workspace-tier subscription + usage on generation/automation | Avoids per-seat friction so the graph spreads org-wide (ops-first), while capturing value where it is created (Build Engine generations, agent/automation runs) | 2026-06-26 |

## Navigation

First-draft information architecture for the Weave SPA. This section owns the **primary
navigation** (top header bar, company-workspace level) and the global app chrome; each engine's
brief owns its own **secondary navigation** (left sidebar). Pattern follows the validated
app-shell convention: a top bar for global context plus a left sidebar for within-area
navigation.

### App shell

- **Top header bar — primary navigation + global chrome.** Persistent across the app.
  - Left: Weave home, and the **workspace switcher** (the company/tenant, plus the demo
    "Hammerbarn" workspace).
  - Centre: the **primary navigation** (top-level areas, below).
  - Right: **global search**, **notifications**, **help & guided-tour launcher** (onboarding),
    and the **account/user menu**.
- **Left sidebar — secondary navigation.** Contextual to the active primary area; each engine
  defines its own. Collapsible (icons + hover tooltips when collapsed), current item
  highlighted, collapse preference persisted.
- **Main content area.** The active screen.

### Primary navigation (top header)

| Area | Engine / scope | Purpose |
|---|---|---|
| Dashboard | platform | Home — recent activity, metrics, spend, suggestions |
| Constitution | constitution-engine | The model — ontology, glossary, brand, governance, org chart, versions |
| Explorer | graph-explorer | Visual, collaborative graph canvas |
| Build | build-engine | Projects — spec → generate → ship |
| Automate | events-actions-engine | Event-driven automations |
| Compliance | cross-cutting | Conformance checks + audit / decision logs |
| Settings | platform | Workspace, members, integrations, billing |

> Note: 3–6 primary items is the UX sweet spot. This draft has seven; **Compliance** is the
> likely merge candidate (it could fold into Constitution and Automate), kept top-level here for
> visibility. To be confirmed at PRD/UX.

### Global chrome elements

- **Workspace switcher** — company tenant plus the Hammerbarn demo workspace.
- **Global search** — across entities, automations, projects, and docs.
- **Notifications** — budget alerts, approvals, automation outcomes.
- **Help & guided-tour launcher** — onboarding overlays, tours, and the training library (see
  the `onboarding` brief).
- **Account/user menu** — profile, roles, sign-out.

### Secondary navigation

Each engine's left-sidebar secondary navigation is defined in its own brief's Navigation
section: `constitution-engine`, `graph-explorer`, `build-engine`, `events-actions-engine`.

## Roles & Access

First-draft model of the canonical roles and the access model, covering **both human and
non-human (agent) identities**. Referenced by the `onboarding` brief (role-tailored onboarding)
and by each engine. The detailed permission matrix is refined at PRD / tech spec.

### Canonical human roles

| Role | Primary access |
|---|---|
| Workspace admin / owner | Full control: settings, members & roles, integrations, billing, and all engines |
| Enterprise architect | Author ontology structure, types, and rules; full model read; build and explore |
| Business analyst / SME | Author instance data and glossary; explore; limited structural change |
| Brand / content owner | Author brand and voice content; read the model |
| Compliance / risk officer | Author governance/compliance content; audit logs and compliance views; read the model |
| Engineer / developer | Build projects — spec, generate, code, artefacts; read the model |
| Ops / SRE | Operate built products — self-healing, runs, deployments |
| Automation author | Create and manage automations; read the model |
| Viewer / stakeholder | Read-only explore and dashboards |

### Non-human (agent) identities

AI agents and bots are first-class identities, not anonymous background processes.

- **Agents act under their own distinct identity** (a service/agent principal), never under a
  human's identity.
- **Scoped, least-privilege permissions per agent function** — e.g. a build agent, an
  automation agent, and an NL-authoring agent each hold only the permissions their job needs.
- **Every change is attributed to the acting identity** — human or agent — in PROV-O provenance
  and the immutable audit/decision log, in the graph and in any integrated/external system.
- **Non-repudiable human-vs-agent attribution.** Because agent actions are recorded against
  agent identities, it is always unambiguous whether a person or an agent made a change — so no
  one has to rely on plausible deniability, and humans are not wrongly credited or blamed for
  what an agent did in Weave or in connected tools.

### Access model

- **RBAC** — roles grant permissions scoped to engines/areas and to action level (e.g. read vs
  author vs publish vs administer). Roles can be combined on one identity.
- **Tenant-scoped** — a user's roles apply within a company workspace (tenant); the Hammerbarn
  demo is a separate workspace with its own access.
- **Least privilege by default** — admins assign roles; new identities start minimal.
- **Identity** — authentication via AWS Cognito (default) or Auth0 (multi-IdP), per the stack;
  org-chart identities may sync from SSO/HR systems.
- **Onboarding adapts** — the onboarding experience is tailored to the user's role(s) and access
  rights.

---
*Generated by Weave PO agent. Review and approve before proceeding to PRD.*
