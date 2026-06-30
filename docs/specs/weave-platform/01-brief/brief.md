---
type: Product Brief
title: Weave Platform — Product Brief
description: "Brief for Weave — the operating system for the AI-native company; close the model → generate → automate loop."
tags: [weave-platform, 01-brief, platform, strategy]
status: Draft
timestamp: 2026-06-30T00:00:00Z
resource: docs/specs/weave-platform/01-brief/brief.md
# --- provenance block (merged per frontmatter-schema.md) ---
source: hand-authored
confirmed_by: none
confirmed_on: null
last_verified_sha: 61dfc1553b18b5762902e1d2b3681c82f4ebb26c
expires_on: 2026-12-27
owner: gazzwi86
coverage: n/a
---

# Brief: Weave Platform

## Mission Statement

We are building Weave — the operating system for the AI-native company — so that an
enterprise or mid-market organisation can describe its entire operating model (people,
processes, systems, data, rules, relationships) as a single live, collaborative knowledge
graph, and have Weave generate and run the applications, AI agents, data pipelines, and
automations that operate the business — closing the model → generate → automate loop.

Weave is a living **digital twin of the organization (DTO)** — the analyst-sanctioned
convergence label (Gartner) for a graph that mirrors how a company actually operates. This is
deliberately distinct from a *physical/industrial* digital twin (Azure Digital Twins, Microsoft
Fabric Digital Twin Builder), which models assets, IoT, and sensor telemetry; Weave models the
operating model — people, processes, systems, data, rules, relationships.

The defensible position is **the conjunction**: closing the loop on **open W3C standards**
(versus Palantir Foundry, which closes it behind a proprietary object model at enterprise
prices), at **mid-market reach**, with **whole-business NL + forms authoring** over a shipped
ontology. The open-standards substrate is necessary but commoditising — Ardoq's 2026 GraphLake
acquisition brought RDF/OWL/SHACL to an EA incumbent — so the durable moat is the
generation/automation closure and the "business brain" that grounds agents, not the triple store.

## Problem

A company's operating model — how its people, processes, systems, data, and rules actually
fit together — lives scattered across stale architecture diagrams, Confluence pages,
spreadsheets, CMDBs, and individual employees' heads. None of it is machine-readable, none
of it is executable, and all of it drifts out of date the moment it is written down.

This leaves three categories of mainstream tooling that each solve only one third of the problem:

- **Enterprise-architecture / EA tools** (LeanIX, ServiceNow CMDB, Visio) *describe* the
 business but generate nothing — the model is documentation, not an execution engine.
- **Low-code / app builders** *generate* software but have no authoritative model of the
 business, so every app is built from scratch against tribal knowledge.
- **BI / analytics tools** *report* on the business but cannot act on it.

One vendor — Palantir Foundry — does close model → generate → automate, but behind a
proprietary object model, at enterprise-only pricing, with no path for business users to author
the model on open standards. Weave's opening is the same closure made open (W3C RDF/OWL/SHACL/
PROV-O), whole-business, and authorable by non-technical staff at mid-market reach.

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
 (RDF/OWL/SHACL/SPARQL/PROV); the live model of the business. Ships a process-centric
 ArchiMate-3-aligned **upper ontology — the BPMO framework** (Process at the centre, linked to
 the activities, events, actors, systems, services, data assets, capabilities, domains, goals,
 and governing policies that make the graph a "business brain" agents reason inside), plus W3C
 SHACL/PROV/SKOS scaffolding — a *framework, not a populated taxonomy*: "Weave provides the
 grammar; the company writes the sentences." Clients build their own domain vocabulary and
 instances on top. The canonical BPMO kind and relationship set is defined in the
 `constitution-engine` brief and `CE-READ-1`. See `constitution-engine` brief.
- **Build Engine** — generates applications (UI + API), AI agents, data pipelines, and
 forms/dashboards from the graph model. See `build-engine` brief.
- **Events & Actions Engine** — automations triggered by internal graph changes and external
 events (webhooks, Jira, cron, ServiceNow). See `events-actions-engine` brief.
- **Graph Explorer** — visualises the company as a force-directed network with drill-in focus
 views. MVP ships single-user editing plus async sharing (server-side saved views +
 comments); Figma-style real-time multi-user collaboration (Yjs co-edit, presence, cursors,
 follow-me) is **Phase 2**. See `graph-explorer` brief.
- **Shared platform foundation** — multi-tenant cloud SaaS (tenant isolation enforced at the
 storage layer — named-graph-per-tenant with query-rewriting that rejects unscoped queries,
 or store-per-tenant; final mechanism set in the Constitution Engine tech spec),
 authentication/authorisation, a single agent-identity registry, the AI-native layer used
 across engines (NL editing, generation, suggestions), and **7 v1 managed connectors**:
 Snowflake, Databricks, S3, Azure Data Lake, Atlassian (Jira + Confluence — one OAuth
 family), ServiceNow, and Slack.
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
- The Constitution-Engine MVP launch ships single-user editing + async sharing. Real-time
 conflict-free multi-user collaboration (Yjs CRDT co-editing) is a Graph-Explorer **Phase 2**
 capability, delivered at Graph Explorer launch — NOT at the Constitution MVP launch.
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
| Real-time multi-user collaboration is Phase 2 (Graph Explorer) | MVP ships single-user editing + async sharing (saved views + comments); Yjs co-editing is the costliest, hosting/identity-dependent capability and is sequenced after the Constitution MVP (D1) | 2026-06-30 |
| Weave ships a process-centric upper ontology (framework, not taxonomy); clients build their own vocabulary on top | The ArchiMate-3-aligned **BPMO framework** — Process at the centre, linked to activities, events, actors, systems, services, data assets, capabilities, domains, goals, and policies, plus SHACL/PROV/SKOS scaffolding; "Weave provides the grammar; the company writes the sentences" (A1). Canonical kind/relationship set: `constitution-engine` brief + `CE-READ-1` | 2026-06-30 |
| Fully commercial, closed source | No OSS core; protect the platform IP and the engagement business | 2026-06-24 |
| Pricing: hybrid — workspace-tier subscription + usage on generation/automation | Avoids per-seat friction so the graph spreads org-wide (ops-first), while capturing value where it is created (Build Engine generations, agent/automation runs) | 2026-06-26 |
| Differentiate on loop-closure + authoring + the "business brain", NOT on the semantic substrate | RDF/OWL/SHACL/SPARQL are commodity (mature triple stores plus open source); storage and standards conformance are not a moat. The defensible value is generation/automation closure, whole-business NL+forms authoring over a shipped ontology, and the business brain that grounds agents within the model's bounds | 2026-06-30 |

### Competitive landscape & closing window

The market is converging on Weave's thesis from several directions, so the open-standards wedge
is real but time-limited. Three signals frame the moat:

- **Ardoq GraphLake (2026)** — an EA incumbent acquired an RDF/OWL/SHACL graph stack, bringing
 the full W3C substrate to enterprise architecture. The semantic substrate is commoditising; it
 cannot be the differentiator.
- **Microsoft Fabric Digital Twin Builder** — reaches data-bound modelling plus dashboards,
 Q&A agents, and automation, but is *industrial/asset*-scoped and non-W3C. The risk is
 Microsoft generalising it from industrial to whole-organization with its distribution reach.
- **Catio** — demonstrates AI auto-discovery of the (tech-stack) model beating manual EA
 authoring, raising the bar on cold-start population.

**Moat thesis:** differentiate on (1) generation/automation *closure* on open standards — the
column no mainstream EA, BI, or governance tool fills; (2) whole-business **NL + forms
authoring** over a shipped ontology; and (3) the **business brain** that grounds agents so they
reason within the bounds the model states. Do not position on the triple store, and do not claim
incumbents lack process mining — Palantir Foundry (Machinery) and Celonis (OCDM) both do process
mining, so that claim is falsifiable.

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
| Dashboard | platform | Home — generative workspace intelligence; AI-composed widgets on demand |
| Constitution | constitution-engine | The model — ontology, glossary, brand, governance, org chart, versions |
| Explorer | graph-explorer | Visual, collaborative graph canvas |
| Build | build-engine | Projects — spec → generate → ship |
| Automate | events-actions-engine | Event-driven automations |
| Compliance | cross-cutting | Conformance checks + audit / decision logs |
| Settings | platform | Workspace, members, integrations, billing |

> Note: 3–6 primary items is the UX sweet spot. **Resolved at PRD:** Compliance stays a
> top-level, platform-owned cross-cutting area that aggregates per-engine compliance views, and
> **Audit is a sub-view under Compliance** (not a separate top-level area). Areas whose engine
> is not yet GA (Explorer/Build/Automate at the Constitution MVP) render disabled rather than
> hidden, keeping the IA stable.

### Generative Dashboard

The Dashboard is a **generative UI** surface — a design pattern in which the AI dynamically
composes and renders UI widgets in response to natural-language prompts, rather than serving
a fixed pre-built layout. The user asks what they want to see; the AI fetches the relevant
data from the appropriate engine and renders the best-fit component (KPI card, time-series
chart, table, activity feed, heatmap, etc.) directly in the dashboard grid.

**What makes it different from a conventional dashboard:**

- There is no "dashboard configuration" form. The user types a prompt and a widget appears.
- Widgets are data-live: they query engine APIs at render time (and optionally poll for updates).
- The AI chooses the appropriate visualisation for the data — a compliance contravention count
 becomes a severity-bucketed bar chart; a token-spend trend becomes a line chart; a list of
 active proposals renders as a ranked card stack.
- Generated widgets are saveable and shareable: once a user creates a useful widget, they pin
 it to their dashboard and can publish it to a workspace-shared library.
- The default dashboard ships with a set of pre-built "starter widgets" (below) so the screen is
 not blank on first load; users customise from there.

**Available data sources (widget library — phase-gated by engine availability):**

> A widget category is buildable only once its source engine is live. At the Constitution-Engine
> MVP, only Constitution-sourced widgets (via the `CE-METRICS-1` contract) are available;
> Build/Events/Explorer-sourced categories are tagged "available when their engine ships" and
> render an explicit unavailable state until then. See the platform PRD §Epic 2 for the
> per-category phasing.

| Category | Widget examples |
|---|---|
| Ontology health | Entity counts by kind (spanning the BPMO kinds, via `entity_count_by_kind`), latest published version, draft vs published delta, SHACL validation error count |
| Graph completeness | Model coverage % (domains/capabilities/systems populated vs blank), knowledge gaps (entities missing required properties), unmapped instance count |
| Token & AI spend | Usage by engine / user / project, cost trend (7d/30d), budget burn vs cap, per-engine cost breakdown |
| Active projects | Project count by phase, recent activity, budget burn, artefacts shipped, success/failure rate |
| Compliance status | Active SHACL contraventions by severity and domain, policy coverage gaps, self-audit query results |
| Self-improvement findings | Open proposals from the self-improvement engine, ranked by impact (HIGH/MEDIUM/LOW), org vs project scope |
| Ontology & project issues | Validation warnings, unsatisfiable OWL classes, entities with no owner, version pin mismatches |
| Event automation status | Running automations, recent trigger counts, failure rates, connector health (the 7 v1 connectors: Snowflake, Databricks, S3, Azure Data Lake, Atlassian, ServiceNow, Slack) |
| Collaboration activity | Active canvas sessions, recent graph edits, top contributors, workshop sessions logged |
| Sentiment on logs | NLP analysis of audit and agent-decision logs to surface operational sentiment trends — rising error rates, repeated agent failures, unusual patterns |
| Agent activity | What AI agents are doing right now across all engines (Build, Automate, self-improvement) |
| Version pinning | Which Build projects and Automations are pinned to which ontology versions; alert if pinned to a version ≥ 2 behind latest |
| RBAC & access | Roles assigned vs unassigned users, any areas with no assigned owner, recent permission changes |
| Graph growth | Entity and relationship count over time — is the model being actively maintained or drifting stagnant? |
| Workspace onboarding | For new workspaces: model completeness score and next recommended action |

### Global chrome elements

- **Workspace switcher** — company tenant plus the Hammerbarn demo workspace (a **per-user
 writable** copy that persists changes across sessions and resets only on an explicit button;
 its seed content is **live-pipeline built** via CE/Build/Events, with the CE+Explorer portion
 available at MVP and the full demo gated on Build/Events GA — see the `onboarding` brief).
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
 human's identity. Principals are minted and scoped by a single platform **agent-identity
 registry** that reconciles platform agent classes, Build's dark-factory roles, and Events'
 per-automation principals into one canonical principal IRI.
- **Two auth paths are distinct:** humans authenticate via Cognito/Auth0; agents that access
 AWS/secrets assume an **IAM role via STS** (short-lived credentials, never raw secret
 values). The registry records which IAM role maps to which canonical principal IRI.
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

# Related

- [Weave Platform Strategy — 20 Questions](20Q-platform-strategy.md)
- [Build Engine — Product Brief](../../build-engine/01-brief/brief.md)
- [Constitution Engine — Product Brief](../../constitution-engine/01-brief/brief.md)
- [Events & Actions Engine — Product Brief](../../events-actions-engine/01-brief/brief.md)
- [Graph Explorer — Product Brief](../../graph-explorer/01-brief/brief.md)
- [Onboarding — Product Brief](../../onboarding/01-brief/brief.md)
