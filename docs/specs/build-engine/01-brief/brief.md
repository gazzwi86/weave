---
type: Product Brief
title: Build Engine — Product Brief
description: "Brief for the Weave Build Engine — generate apps, AI agents, data pipelines, and dashboards from the company knowledge graph."
tags: [build-engine, 01-brief, generation, agents]
timestamp: 2026-06-30T00:00:00Z
resource: docs/specs/build-engine/01-brief/brief.md
# --- provenance block (merged per frontmatter-schema.md) ---
source: hand-authored
confirmed_by: none
confirmed_on: null
last_verified_sha: 61dfc1553b18b5762902e1d2b3681c82f4ebb26c
expires_on: 2026-12-27
owner: gazzwi86
coverage: n/a
---

# Brief: Build Engine

## Mission Statement

We are building the Weave Build Engine — the place where a company turns its knowledge graph
into working software — so that within the company workspace, teams of humans and AI agents
can spin up and navigate multiple projects, and for each project collaboratively author a
specification and then generate and ship the applications (UI + API), AI agents, data
pipelines, and forms/dashboards it calls for. Every artefact is grounded in the company's
ontology, vocabulary, brand, and governance constraints and stays traceable back to the
graph it came from — replacing months of bespoke, tribal-knowledge-driven delivery with
model-driven generation.

## Problem

Turning a description of how a business works into working software is slow, repetitive, and
disconnected from any authoritative model.

- **Low-code and codegen tools build from scratch.** They have no model of the business, so
 every app, pipeline, or form is assembled against tribal knowledge and re-derives the same
 entities and rules each time.
- **AI code generation is ungrounded.** General-purpose AI coding assistants hallucinate
 domain structure because nothing anchors them to the company's real processes, systems,
 data assets, vocabulary, and constraints — the process-centric model agents should reason
 inside.
- **Generated output ignores company standards.** Artefacts rarely respect the
 organisation's brand, tone of voice, naming/vocabulary, or governance and compliance rules
 — so they need heavy manual rework before they are usable or safe.
- **There is no traceability.** When something is generated, nobody can say which part of the
 model it came from; when the model changes, the generated artefact silently goes stale.

- **Spec, planning, and delivery are disconnected from the model — and from each other.**
 The specification lives in one tool, project management (kanban, issues) in another, and
 the running code in a third; none of them is anchored to the company graph, so context is
 re-gathered and re-explained at every hand-off between idea, business case, spec, and
 implementation.
- **Agents that build code lack project context.** An AI agent dropped into a repository
 with no map of the company's domains, services, or the project's own structure burns
 effort rediscovering what already exists — and still risks reinventing or duplicating it.
- **Agent-driven delivery is ungoverned.** There is no shared place to cap token/budget
 spend, manage secrets safely, classify data, or inherit company → domain → workspace →
 project policy — so autonomous building is either reckless or blocked.

The people who feel this are **engineers and architects** asked to deliver apps, agents, and
pipelines quickly and consistently, the **product owners** iterating on several specs at
once, and the **operations owners** who wait on them. If this is not solved, the value of
having an authoritative graph is never cashed in: the model describes the business, but
humans still hand-build everything that runs it — so Weave's "model → generate" promise
collapses back into ordinary bespoke software delivery.

## Vision

Within 12 months, success for the Build Engine looks like:

- **Projects are born from the graph.** A team spins up a project inside the company
 workspace and generates a working artefact — an application, AI agent, data pipeline, or
 dashboard — that runs a genuine business process and is grounded in the company's
 process-centric model (the processes, activities, actors, systems, services, data assets,
 capabilities, goals, and governing policies the graph links to that process), not assembled
 from scratch.
- **The spec-to-ship loop runs with humans and agents together.** A specification co-authored
 with PO/architect agents drives implementation either autonomously (the dark-factory agent
 teams) or through interactive human-in-the-loop sessions, moving through draft → review →
 approved with HITL gates and a mid-flight replan control, producing portable code a team
 can own.
- **Output meets the Constitution's standards measurably.** Generated artefacts are checked
 against the Constitution's brand, tone of voice, vocabulary, and governance/compliance
 constraints and pass an automated conformance bar (default 90% adherence, configurable per
 scope; measured against the published brand/voice standards) with no critical violations before
 human review — not "compliant by assertion".
- **Delivery is navigable and governed.** Multiple projects run concurrently, each navigable
 with its own dashboard and kanban; each enforces budget/token caps, manages secrets via AWS
 Secrets Manager, classifies data, and inherits company → domain → workspace → project
 policy.
- **Agents build efficiently from context.** Agents use a project anatomy/wiki and the company
 graph to deliver without rediscovering the codebase or the ecosystem, measurably reducing
 wasted effort and duplication.
- **The model stays alive in both directions.** Creating or updating a project writes its new
 and changed artefacts — services, APIs, data assets, components — back into the company
 ontology, and every artefact stays traceable to the graph elements and spec it came from, so
 when the model changes the affected artefacts are known.
- **Every agent decision is auditable.** Agent actions and the reasoning behind them are emitted
 to the platform's one immutable audit/provenance service; the Build decision log is a view over
 it, available for compliance, replay, and self-improvement.
- **Built products heal themselves — always with a human gate.** Built products and the dark
 factory observe their own logs to raise issues and dispatch fixes through the same agent
 pipeline; every fix passes a human gate (no autonomous merge). Improving Weave-the-product
 itself (Build's own prompts, workflows, and harness) is owned by the Weave Platform, which
 configures a shared signal→issue→dispatch engine that Build provides.

## Scope

The Build Engine is the company workspace's "Build" area: it holds many **projects** (one
per coded product/app), and for each project it runs the spec-to-ship loop, generation,
governance, and self-improvement.

### In Scope

**Projects & navigation**

- Multiple projects under the company workspace, each navigable with its own dashboard
 (recent activity, metrics, spend).
- Project lifecycle from idea → business case → initiative sign-off → specification →
 implementation.

**Specification & planning**

- Specification authoring co-authored with PO/architect agents, with a spec lifecycle
 (draft → review → approved) and reviewers/timelines.
- Project management: kanban and graph views, issues, and dependency-aware task flow (moving
 a task to in-progress inherits its dependency trace).
- A project-level ontology view — this project's slice of the graph and its relationships,
 derived in part from the spec.
- A project anatomy/wiki (files, functions, and semantic explanations; capabilities,
 services, architectural decisions, runbooks) so agents traverse the codebase efficiently
 instead of rediscovering it.

**Generation (apps first)**

- Generate **applications (UI + API) first**, then AI agents, data pipelines, and
 forms/dashboards (ordering refined at roadmap).
- All output is grounded in the company graph and Constitution — applying the process-centric
 model (process ↔ activity ↔ actor ↔ system ↔ service ↔ data asset ↔ capability ↔ goal ↔
 policy), glossary, brand/voice, and governance constraints, with conformance measured against
 the published standards (default 90% bar, configurable) before an artefact is considered done.
- Three run modes: autonomous dark-factory agent teams, interactive human-in-the-loop sessions,
 **and a Spike sandbox run that never merges to production** — all with HITL gates and a
 mid-flight replan control (instruction + criticality, must-fix-before-production).
- Portable code the team can own, pushed to the team's own repositories.

**Bidirectional graph sync**

- Write-back: new and changed artefacts (services, APIs, data assets, components) flow back
 into the company ontology, with full traceability between artefact, graph, and spec.

**Governance & operations of delivery**

- Project settings: token/budget caps and alerts, members and roles, data classification,
 and cascading policy inheritance (company → domain → workspace → project).
- Secrets and environment management via AWS Secrets Manager.
- Integrations consumed by reference through the platform managed-connector capability (v1
 family: Snowflake, Databricks, S3, Azure Data Lake, Atlassian (Jira + Confluence), ServiceNow,
 Slack) — Build uses Jira (task federation, Weave remaining source of truth) and Slack; no
 connector credential is stored in Build.
- A decision log of agent actions and the reasoning behind them, surfaced as a view over the
 platform's one immutable audit/provenance service, for compliance, replay, and self-improvement.

**Self-healing** *(client-app + dark-factory; always HITL)*

- Operational self-healing for built products: observe deployment signals, raise issues, and
 dispatch fixes via agent teams — every fix passes a human gate, no autonomous merge.
- Dark-factory self-healing: the build agents monitor their own logs and dispatch remediations
 through the same HITL-gated pipeline.
- Build provides the shared signal→issue→dispatch engine; **Weave-the-product self-improvement**
 (improving Build's own prompts, workflows, model routing, and harness) is **owned by the Weave
 Platform**, which configures that shared engine — it is no longer a Build-owned capability.

### Out of Scope

- **Authoring Constitution content** (ontology, glossary, brand, governance, motivation) —
 that is the Constitution Engine; the Build Engine consumes it and writes artefacts back,
 but does not author the governed model.
- **Business-process automations and the external event bus** (e.g. "when a delivery arrives,
 notify the store manager", webhooks, cron, ServiceNow triggers) — that is the Events &
 Actions Engine. Build owns self-healing of *its own* products and factory, not general
 business automation.
- **The org-wide graph visualisation and collaborative canvas** — that is Graph Explorer.
 Build has project-level kanban/graph PM views, not the company network explorer.
- **Managed source-system connectors** themselves — a platform-level capability Build
 consumes.
- **Long-term production hosting/runtime of client artefacts beyond deployment and
 self-healing** — operational hosting model is decided at platform/infra level.
- **Weave-the-product self-improvement** (improving Build's own prompts, workflows, model
 routing, and harness) — owned by the Weave Platform; Build only provides the shared
 signal→issue→dispatch engine the Platform configures.
- **The immutable audit/provenance store itself** — owned by the Weave Platform; Build emits
 typed events to it and surfaces its decision log as a view, keeping no independent signed store.

## Target Users

| User Type | Description | Primary Need |
|-----------|-------------|--------------|
| Product owner | Authors and iterates specifications across several projects at once | Agent-assisted spec authoring with a clear lifecycle, grounded in the company model |
| Technical architect | Designs the high- and low-level solution for a project | A project-level ontology and anatomy that ground design decisions in the real ecosystem |
| Engineer / developer | Owns, extends, and reviews generated code; drives interactive build sessions | Portable, compliant code plus HITL control and a replan lever when the agents drift |
| Delivery / engineering manager | Oversees multiple projects, budgets, and people | Dashboards, kanban, budget/token caps, roles, and policy inheritance across projects |
| Operations owner / SRE | Runs the built products in production | Self-healing that surfaces issues from logs and opens and resolves fixes, with an audit trail |

## Success Criteria

- [ ] **An app is generated and shipped from the graph.** At least one project generates an
 application (UI + API) that runs a genuine business process and is deployed to a
 working environment. Measured by a deployed, demonstrable app; source: deployment
 records. Target: within 6 months of the Build Engine's first release.
- [ ] **Output meets the Constitution's standards measurably.** Generated artefacts pass an
 automated conformance check against the Constitution's brand, vocabulary, and governance
 constraints (measured against the published brand/voice standards) at or above the
 conformance bar — default 90% adherence, configurable per scope — with no critical
 violations before human review. Measured by conformance audit; source: build/decision logs.
 Target: within 6 months of first release.
- [ ] **The spec-to-ship loop works in both modes.** At least one project completes
 spec (draft → approved) → implementation via the autonomous dark factory, and at least
 one via an interactive human-in-the-loop session. Measured by project lifecycle records;
 source: project store. Target: within 6 months of first release.
- [ ] **The graph stays alive in both directions.** At least one project writes its generated
 artefacts (services, APIs, data assets) back into the company ontology, and they are
 queryable in the Constitution Engine. Measured by a before/after graph diff; source:
 graph store. Target: within 6 months of first release.
- [ ] **Delivery is governed.** Budget/token caps are enforced (a run halts or alerts at its
 cap), no secret is ever written into generated code (verified by secret scanning), and
 policy inheritance is applied. Measured by cap-event logs and secret-scan results;
 source: build logs and CI. Target: at first release.
- [ ] **Self-healing closes at least one loop.** At least one issue is automatically raised
 from logs (for a built product or for the dark factory itself) and a fix is opened and
 resolved through to human approval. Measured by the issue and decision-log trail;
 source: compliance/decision log. Target: within 9 months of first release.

## Constraints

**Technical**

- Generated artefacts target Weave's confirmed stacks (TypeScript/Next.js for UI,
 Python/FastAPI for API/services), and AI agents are generated against the **Anthropic Agent
 SDK (Claude Agent SDK)** — Python primary, TypeScript secondary. (CLAUDE.md updated
 2026-06-26; AgentCore runtime fit is revisited in this engine's
 tech spec.)
- Output must be portable code the client team can own and run, not a locked-in runtime.
- Each project targets a specific published ontology version (pinned), so that ontology
 evolution does not silently break a project's generated artefacts; upgrading the pin is a
 deliberate action.
- Measured conformance is a hard requirement: every artefact applies the Constitution's
 ontology, glossary, brand/voice, and governance constraints, and passes the conformance bar
 (default 90% adherence, configurable; measured against the published brand/voice standards)
 before it is considered done.
- Secrets are never embedded in generated code — AWS Secrets Manager only, enforced by secret
 scanning (per the project security rules). An outbound-prompt scrubber redacts secrets/PII
 before any prompt reaches a model provider.
- The decision log is a view over the platform's one append-only, tamper-evident audit/
 provenance service; no agent can alter it, and Build keeps no independent signed store.
- Dark-factory agents are long-running and must respect budget/token caps and HITL gates.

**Business**

- Generated code is portable and owned by the client; no lock-in.
- Weave remains the source of truth even when integrated with external tools (e.g. Jira task
 federation).
- Usage-based revenue is tied to generation and automation runs (per the platform pricing
 decision), so generation events must be metered.

**Timeline / sequencing**

- The Build Engine depends on the Constitution Engine (the MVP) and ships after it.
- Applications (UI + API) are the first generation target; agents, pipelines, and dashboards
 follow.
- Weave-product self-improvement (Platform-owned, configuring Build's shared engine) may
 *propose* changes to Build's agent prompts or harness, but changes are applied only through
 human-approved review (PRs), never auto-applied; client-app self-healing is likewise always
 HITL-gated with no autonomous merge.

## Key Decisions

For the platform-wide master list see `CLAUDE.md § Architecture decisions (confirmed)` and
the `weave-platform` brief. Decisions specific to the Build Engine:

| Decision | Rationale | Date |
|----------|-----------|------|
| Build Engine owns the company workspace's "Build" area: multiple projects, spec lifecycle, PM, generation, and delivery | "Workspace" is the company/Weave level; "project" is the per-product level inside Build — keeps a clean two-tier model | 2026-06-26 |
| Generate applications (UI + API) first; agents, pipelines, dashboards follow | Most demonstrable MVP proof and the tour artefact is an app; exercises the full brand+ontology stack | 2026-06-26 |
| AI agents are generated against the Anthropic Agent SDK (Claude Agent SDK) | Matches the chosen direction and latest Claude models; AgentCore runtime fit revisited at tech spec | 2026-06-26 |
| Measured conformance is a hard requirement (default 90% bar, configurable) | Generation must apply the Constitution's ontology, glossary, brand/voice, and governance and pass an automated conformance check against the published standards — "compliant by construction" is replaced by a falsifiable bar | 2026-06-30 |
| Bidirectional graph sync — Build writes artefacts back into the ontology | Keeps the model alive and the graph reflecting what was actually built, not just planned | 2026-06-26 |
| Three run modes: autonomous dark-factory teams, interactive human-in-the-loop, and a Spike sandbox (no prod merge) | Different work and risk levels need different human involvement; a sandbox mode that never reaches production is a distinct safety control; all share spec lifecycle, gates, and replan | 2026-06-30 |
| Client-app + dark-factory self-healing live in Build (always HITL); general business automation stays in Events & Actions | Build heals its own products and factory; every dispatched fix passes a human gate (no autonomous merge); the Events Engine owns business-process automation | 2026-06-30 |
| Weave-product self-improvement is Platform-owned; Build provides the shared signal→issue→dispatch engine | One Weave-product self-improvement subsystem (Platform), configuring Build's reusable engine; the former Build self-improvement engine folds into Platform | 2026-06-30 |
| Decision log is a view over the platform's one immutable audit/provenance service | One platform-owned, append-only, tamper-evident system of record; Build emits typed events and keeps no independent signed store | 2026-06-30 |
| Descriptive, human-intelligible naming — no codenames | See `.claude/memory/decision_naming-convention.md`; BluShift → Weave, Polaris → self-improvement engine | 2026-06-26 |
| Projects pin to a specific published ontology version | Prevents ontology evolution from silently breaking generated artefacts; versioning lifecycle owned by Constitution Engine | 2026-06-26 |

## Navigation

First-draft **secondary navigation** (left sidebar) for the **Build** primary area. The primary
top-header nav is defined in the `weave-platform` brief. Build has two sidebar levels because it
contains many projects.

**Build root (no project selected)**

- **Projects** — list of project workspaces (cards with status, activity, spend); open or
 create.
- **New Request** — Request Studio: start from a natural-language request → spec → run mode.
- **Templates & module kit** — reusable starting points and pattern kit.
- **Build settings** — defaults, roles, and cascading policies that flow into projects.

**Inside a project (project selected)**

- **Overview** — project dashboard: activity, metrics, spend, status.
- **Spec** — the specification, co-authored with PO/architect agents; lifecycle draft → review
 → approved.
- **Plan / Kanban** — project management: kanban and dependency-aware task flow, issues.
- **Project ontology** — this project's slice of the graph and its relationships.
- **Anatomy / Wiki** — files, functions, capabilities, services, decisions, runbooks for agent
 and human context.
- **Artefacts** — generated apps, agents, pipelines, dashboards and their deploy status.
- **Decision log** — a view over the platform immutable audit/provenance service: agent actions
 and reasoning for this project.
- **Self-healing** — issues raised from deployment signals and the fixes dispatched/resolved
 (always HITL-gated).
- **Settings** — budget/token caps, integrations (Jira, Slack), secrets, data classification,
 policy inheritance, pinned ontology version.

---
*Generated by Weave PO agent. Review and approve before proceeding to PRD.*

# Related

- [Weave Platform — Product Brief](../../weave-platform/01-brief/brief.md)
