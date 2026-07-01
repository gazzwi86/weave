# Weave

**The operating system for the AI-native company.**

Weave lets an organisation describe its entire operating model — people, processes, systems,
data, rules, relationships — as a single live knowledge graph, then generates and runs the
applications, AI agents, data pipelines, and automations that operate the business.

It closes the loop that no existing enterprise-architecture, BI, or low-code tool closes
end-to-end: **model → generate → automate → govern**.

---

## The problem

A company's operating model lives scattered across stale architecture diagrams, Confluence
pages, spreadsheets, CMDBs, and individual employees' heads. None of it is machine-readable,
none of it is executable, and all of it drifts out of date the moment it is written down.

Three categories of tooling each solve only one third of the problem:

| Category | What it does | What it misses |
|---|---|---|
| EA tools (LeanIX, ServiceNow CMDB, Visio) | Describes the business | Generates nothing — the model is documentation, not an execution engine |
| Low-code / app builders | Generates software | Has no authoritative model of the business — every app is assembled from tribal knowledge |
| BI / analytics | Reports on the business | Cannot act on it |

AI transformation stalls here. Every automation is bespoke and brittle, the operating model
rots faster than it can be maintained, and the promised value of AI agents — running real
business processes — is never realised at scale.

---

## What Weave does

Weave ships a **universal business ontology** (ArchiMate-3-aligned, RDF/OWL/SHACL/PROV-O)
that clients populate and extend rather than build from scratch. Business and technical users
co-edit the graph through natural language and guided forms — no RDF or SPARQL knowledge
required — while the underlying model stays standards-compliant and fully validated.

From that graph, Weave generates and runs:

- **Applications** (UI + API) grounded in the company's ontology, vocabulary, brand, and
  governance constraints — compliant by construction, portable code the team owns
- **AI agents** built against the Anthropic Agent SDK, with budget caps, secrets management,
  and an immutable decision log
- **Data pipelines** and dashboards derived from the live model
- **Automations** triggered by graph changes or external events (Jira, ServiceNow, webhooks, cron)

Every artefact stays traceable to the graph element and spec it came from. When the model
changes, the affected artefacts are known.

---

## The four engines

### Constitution Engine *(ships first — the MVP)*

The authoritative knowledge-graph layer. Holds the live RDF/OWL model of the business,
validates every change against SHACL shapes, tracks full PROV-O provenance, and exposes a
stable versioned interface the other engines read from. If the Constitution Engine is wrong,
nothing generated downstream can be right.

### Build Engine

Turns the knowledge graph into working software. Teams spin up projects, co-author
specifications with PO and architect agents, then generate artefacts via autonomous
dark-factory agent teams or interactive human-in-the-loop sessions — with HITL gates, budget
caps, and a mid-flight replan control. Generated artefacts write back into the company
ontology, keeping the model alive in both directions.

### Events & Actions Engine

Automates business processes triggered by internal graph changes or external events —
webhooks, Jira tickets, ServiceNow workflows, cron schedules. Each automation is governed by
the Constitution's rules and policy constraints, and every action is attribution-tracked.

### Graph Explorer

Visualises the company as a force-directed knowledge network with drill-in focus views and
Figma-style real-time multi-user collaboration. Business and technical stakeholders explore,
annotate, and collaboratively edit the live graph — the visual surface on top of the
Constitution Engine's model.

---

## Stack

| Layer | Choices |
|---|---|
| Backend | Python 3.12+, FastAPI, Pydantic v2 |
| Frontend | TypeScript strict, Next.js 15 App Router, Tailwind CSS, shadcn/ui |
| API | REST (OpenAPI 3.1) + SPARQL 1.1 |
| Auth | AWS Cognito / Auth0 |
| Agents | Anthropic Agent SDK; AWS Bedrock AgentCore runtime |
| Models | claude-opus-4-8 (elicitation/arch), claude-sonnet-5 (generation), claude-haiku-4-5 (validation) |
| RDF store | Oxigraph (dev/test) → Neptune or Jena Fuseki (prod) |
| Relational | AWS Aurora PostgreSQL Serverless v2 |
| Vector | AWS S3 Vectors |
| Cache | AWS ElastiCache (Redis 7) |
| IaC | Terraform, GitHub Actions, AWS Lambda + ECS Fargate |
| Semantic web | OWL 2 DL, SHACL, SPARQL 1.1, PROV-O, SKOS, ArchiMate 3 |

---

## MVP success criterion

One real client models their company in Weave, and Weave auto-generates one working artefact
— an application, data pipeline, or AI agent — that runs a genuine business process.

---

## Status

Weave is in active development. The Constitution Engine is the first milestone; the Build,
Events & Actions, and Graph Explorer engines depend on it and ship after it.

Specs live in `.claude/specs/`. See `CLAUDE.md` for the full harness, stack decisions, and
development conventions.
