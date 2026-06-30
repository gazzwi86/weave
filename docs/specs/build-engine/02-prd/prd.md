---
type: PRD
title: Build Engine — Product Requirements Document
description: "Full product requirements for the Weave Build Engine: the spec-to-ship loop that turns a company knowledge graph into working applications, AI agents, data pipelines, and dashboards — generation grounded in and written back to the Constitution graph."
tags: [build-engine, 02-prd, generation, agents, dark-factory, kanban]
status: Draft
timestamp: 2026-06-30T00:00:00Z
resource: docs/specs/build-engine/02-prd/prd.md
# --- provenance block (merged per frontmatter-schema.md) ---
source: hand-authored
confirmed_by: none
confirmed_on: null
last_verified_sha: 61dfc1553b18b5762902e1d2b3681c82f4ebb26c
expires_on: 2026-12-27
owner: gazzwi86
coverage: n/a
---

# PRD: Build Engine

**Brief:** [brief.md](../01-brief/brief.md)
**Status:** Draft
**Phase:** MVP (P0) + Phase 2 (P1) · **Owner:** gazzwi86 · **Last Updated:** 2026-06-30

---

## 1. Product Context

### Background

The Build Engine is where the company knowledge graph becomes working software. A team
describes what they want to build — in natural language, through AI-assisted intake — and the
engine closes the loop from idea through specification, planning, autonomous or interactive
generation, and deployment. Every generated artefact is grounded in the company's
process-centric model (the BPMO graph the Constitution Engine serves — processes and their
activities, actors, systems, services, data assets, capabilities, goals, and governing
policies), its vocabulary, brand, and governance rules, and writes new
services/APIs/data-assets back into that graph.

The engine runs multiple concurrent **projects** (one per built product), each managed as a
first-class workspace within the Build area. For each project, the spec-to-ship loop runs
through: **Request Studio intake** → **AI-assisted specification** → **HITL spec review** →
**implementation by autonomous dark-factory agents, an interactive human-in-the-loop session,
or a Spike sandbox run** → **artefact deployment** → **client-app self-healing** →
**write-back to the company graph**.

Key patterns confirmed from the Blushift prototype and the dark-factory harness:

- **Request Studio** is the AI request intake (CTA "New Request"): the user describes what they
 want, the AI drafts a brief, PRD, and tech spec, and computes a blast-radius impact analysis,
 which the team reviews and approves before a project starts.
- **Dark-factory agents** (Engineer, QA, Architect, Review, Sandbox) execute tasks; each task
 has a typed YAML brief, a dependency chain, and a HITL gate. Each agent step emits a **typed
 result block** the orchestrator branches on.
- **Three run modes** are selectable at intake: Draft-spec-only, Spec→review→build, and
 **Spike (sandbox repo, never merges to production)**.
- **Generation is gated** by SAST, type checks, delta-scoped mutation testing, a
 package-existence (slopsquatting) check, and a conformance check against published brand /
 voice standards — so conformance is measured, not asserted.
- **Self-healing** (E10) observes deployed-app signals and dispatches fixes through the same
 dark factory, **always behind a human gate** (no autonomous merge).
- **Bidirectional graph sync**: generated artefacts write back into the company ontology through
 the Constitution Engine's validated write path.

> Decision note: Weave-the-product self-improvement (improving Build's own prompts, workflows,
> model routing, and harness) is **owned by the Weave Platform**, configured through the shared
> `BE-SELFIMPROVE-1` engine that Build provides — see §5. Build no longer enumerates a
> self-improvement proposal taxonomy of its own.

### Goals

1. Let any team go from a natural-language description to a generated, deployed artefact
 grounded in the company graph — without starting from a blank project or tribal knowledge.
2. Provide a complete spec-to-ship project management surface (kanban, task tree, spec
 lifecycle, dependency tracking, budget, demo readiness) inside Weave — no external PM tool
 required.
3. Execute implementation autonomously (dark factory), interactively (human-in-the-loop), or in
 a Spike sandbox, all with HITL gates and a replan control, producing portable code the team
 can own.
4. Govern every project: cascading budget/token caps, secrets in AWS Secrets Manager, tenant
 isolation, and a decision log that is a view over the platform immutable audit service.
5. Keep the company graph alive in both directions: Constitution Engine content grounds
 generation; generated artefacts write back into the graph.
6. Surface client-app self-healing for deployed products and dispatch fixes through the dark
 factory, always human-approved.

### Non-Goals

1. **Authoring the company ontology, glossary, brand, or governance rules** — owned by the
 **Constitution Engine** (Build consumes via `CE-READ-1` / `CE-BRAND-1`, writes via `CE-WRITE-1`).
2. **Business-process automation and the external event bus** — owned by the **Events & Actions
 Engine** (`EA-AUTOMATION-1`). Build self-heals only its own products and factory.
3. **Company-wide graph visualisation and the collaborative canvas** — owned by **Graph
 Explorer**. Build embeds the project-scoped slice via `GE-CANVAS-1` but owns no canvas of its own.
4. **Weave-the-product self-improvement** (improving Build's prompts/workflows/harness) — owned by
 **Weave Platform**; Build only provides the shared `BE-SELFIMPROVE-1` engine it configures.
5. **The immutable audit/provenance store itself** — owned by **Weave Platform** (`PLAT-AUDIT-1`);
 Build's decision log is a filtered view over it.
6. **Managed source-system connectors themselves** — a platform capability (`PLAT-CONNECTOR-1`);
 Build consumes connector handles (e.g. Jira, Slack).
7. **Long-term production hosting beyond deployment and self-healing** — decided at platform/infra level.

---

## 2. Personas & Roles

| Persona | Description | Primary need | Permission level |
|---|---|---|---|
| Product owner | Authors and iterates specs via Request Studio across several projects | Agent-assisted, graph-grounded spec authoring with a clear lifecycle | author |
| Technical architect | Designs the high/low-level solution; resolves architectural decisions | Project ontology + anatomy grounding design in the real ecosystem | author |
| Engineer / developer | Owns, extends, reviews generated code; drives interactive sessions | Portable compliant code + HITL control + a replan lever | author |
| Delivery / engineering manager | Oversees multiple projects, budgets, people | Dashboards, kanban, cascading caps, roles, policy inheritance | admin (project) |
| Ops / SRE | Runs built products in production | Self-healing that surfaces issues and dispatches HITL-gated fixes, with audit | author |
| Compliance officer | Audits what the dark factory did and why | Queryable, tamper-evident decision-log view + export | read |

> Role slugs align with the platform RBAC model resolved through the tenancy cascade
> (`PLAT-SETTINGS-1`). Dark-factory agents are non-human principals minted by `PLAT-IDENTITY-1`,
> never holders of these human roles.

---

## 3. User Stories

### Epic 1: Request Studio (AI request intake)

**E1-S1: Describe what you want to build in natural language and pick a run mode**
As a **product owner**, I want to type a free-text description ("new motor claims fast-track
service — auto-adjudicate no-signal claims under £2,500") and pick a run mode, so that I do not
start from a blank document and I control how far the engine runs autonomously.
- **AC:** Given the Build root, when I click **"New Request"** (Request Studio CTA, also reachable
 from the project dashboard "Start a Request" button), then a free-text prompt opens with a
 **run-mode selector**: Draft-spec-only / Spec→review→build / **Spike (sandbox, no prod merge)**.
- **AC:** Given a prompt, when the AI drafts the spec, then it pulls grounding context from the
 pinned graph version via `CE-READ-1` — the BPMO kinds and relationships (the processes the
 request touches and their linked activities, actors, systems, services, data assets,
 capabilities, goals, and governing policies), the glossary, and governance rules — plus a
 stakeholder/role resolution query, and streams a brief, PRD, and tech spec section by section.
- **AC (failure mode):** Given the generation call times out (default 60 s, tunable per workspace)
 or the model errors, then the partial draft is preserved as an editable draft, the failed
 section is marked "generation failed — retry", and **no project is created**; a `PLAT-NOTIFY-1`
 generation-failure event fires.
- **Priority:** Must Have

**E1-S2: See blast-radius and risk before the request becomes a project**
As a **product owner**, I want the intake to compute the impact of the request on the existing
model, so that I review the footprint before committing to a project.
- **AC:** Given a drafted spec, when the Critic agent runs, then it flags ambiguity, scope creep,
 and missing acceptance criteria as inline annotations, and a **blast-radius panel** shows domains
 touched (primary / secondary / discarded) and services impacted tagged `modify | consume | NEW`,
 derived from the company graph via `CE-READ-1` (pinned version).
- **AC:** Given the blast-radius panel, then a risk assessment summarises the highest-impact
 changes for HITL review before project creation; quality signals (Critic-flag count, acceptance
 test count, ADR coverage, data-classification/PII status) display green/amber.
- **AC (failure mode):** Given the company graph is unreachable, then intake proceeds with
 blast-radius marked "unavailable — review manually" rather than blocking, and the project cannot
 be auto-created until a human acknowledges the missing impact analysis.
- **Priority:** Must Have

**E1-S3: Pre-generation cost-estimate gate**
As a **delivery manager**, I want intake to estimate the generation cost and block when it exceeds
the per-spec cap, so that there is a pre-flight cost control before any tokens are spent on the build.
- **AC:** Given a drafted spec ready to become a project, when the cost estimate exceeds the
 resolved **per-spec cap** (default ~$25-equivalent, tunable per workspace via `PLAT-SETTINGS-1`),
 then project creation is blocked with the estimate and the binding cap level shown.
- **AC (failure mode):** Given the estimate is within cap but the run later breaches the cascading
 cap mid-build, then the run halts at the cap (E2-S3) rather than silently continuing.
- **Priority:** Must Have

**E1-S4: Collect stakeholder sign-off before creating a project**
As a **product owner**, I want to route the approved spec to a named set of stakeholders for
sign-off, so that the project does not start without the right approvals.
- **AC:** Given a drafted spec, then stakeholders are resolved from the company graph (org-unit
 owners, role holders) via `CE-READ-1` and can be manually adjusted; each can Approve, Request
 changes, or Reject (comment mandatory on changes/rejection).
- **AC:** Given the spec is submitted for review, then it is locked (no further AI generation) and
 only the author may withdraw it; once all required approvals are collected, a project is created
 automatically (E2-S2).
- **AC (failure mode):** Given a stakeholder rejects, then the project is not created, the spec
 returns to Draft with the rejection reason recorded, and the author is notified via `PLAT-NOTIFY-1`.
- **Priority:** Must Have

---

### Epic 2: Project Registry & Settings

**E2-S1: Browse all projects from the Build root**
As a **delivery manager**, I want all projects as status cards, so that I can navigate to any
project or spot which need attention.
- **AC:** Given the Projects screen, then a responsive grid shows per card: name, stack chip,
 current phase + % progress, owner, demo status, budget used/cap, and Dashboard/Board/Replan
 actions; filters (All / In flight / Spec review / Blocked / Recent) and name search are available.
- **AC (failure mode):** Given a project's metrics service is unreachable, then the card renders
 with a "metrics unavailable" badge instead of failing the whole grid.
- **Priority:** Must Have

**E2-S2: Create a project from an approved request**
As a **delivery manager**, I want a project created automatically when a request is fully approved,
so that there is no manual handoff step.
- **AC:** Given all required stakeholders have approved, then a project record is created with:
 name, stack (from tech spec), phase "Kickoff", owner, resolved budget cap, and **pinned ontology
 version** (newest published at creation time, resolved via `CE-VERSION-1`); the Anatomy/Wiki is
 pre-seeded from the tech spec.
- **AC (failure mode):** Given project-record creation fails after approvals, then the approval set
 is retained and the create action is idempotently retryable; no half-created project is left
 navigable.
- **Priority:** Must Have

**E2-S3: Configure cascading project governance**
As a **delivery manager**, I want budget caps, members/roles, integrations, secrets, data
classification, and the pinned ontology version configured per project within the tenancy cascade,
so that each project is governed independently but inherits company/domain/workspace policy.
- **AC:** Given Settings → Budget, then caps resolve through the **Company → Domain → Workspace →
 Project** cascade (`PLAT-SETTINGS-1`, tighter-wins; loosening a parent cap needs parent approval).
 Defaults, all tunable per scope: per-spec cap ~$25-equivalent, per-PR cap ~$8-equivalent,
 burn-rate alert at 90% of cap, overage review trigger at >3× the workspace median spend,
 hard-reject at 100% of the binding cap. Usage is metered per agent type and per token via
 `PLAT-BILLING-1` (per-token dimension) and per-run for any automation it triggers.
- **AC:** Given Settings → Model tiers, then the project may gate which model tiers are permitted
 (standard / fast / premium / experimental), defaulting to the workspace policy.
- **AC:** Given Settings → Integrations, then a Jira project handle and Slack channel are bound by
 **reference** through `PLAT-CONNECTOR-1` (Weave remains source of truth); no connector credential
 is stored in Build.
- **AC:** Given Settings → Secrets, then secrets are AWS Secrets Manager references only; the
 generation secret-scan gate (E8-S1) blocks any plaintext secret in generated code.
- **AC:** Given Settings → Ontology version, then the pinned version shows; "Upgrade pin" displays
 a `CE-DIFF-1` diff of added/removed/modified nodes **and edges** since the pin and requires
 explicit confirmation.
- **AC (failure mode):** Given the binding cap is breached mid-run, then in-flight agent steps stop
 at the next safe checkpoint, the run is marked "halted: budget", and a `PLAT-NOTIFY-1` budget
 event fires — partial work is committed only if it passes the generation gates.
- **Priority:** Must Have

---

### Epic 3: Project Dashboard

**E3-S1: Project dashboard as the primary status view**
As any project member, I want an at-a-glance dashboard, so that I immediately know demo readiness,
budget, forecast, tasks in flight, and blockers.
- **AC:** Given an open project, then the dashboard renders: (1) a **demo-readiness tile** (status
 dot + "Last demo: Xh ago" + a strip of visual-state-capture thumbnails); (2) a **budget tile**
 ($used/$cap with a token breakdown by agent type and a pre-flight estimate-vs-actual ratio —
 target default ×1.0 ±0.2, tunable per workspace, flagged as an assumption to validate);
 (3) a **forecast tile** ("Phase complete in N±M days", cycle-time sparkline, velocity/WIP/defect
 KPIs); (4) **tasks in flight**; (5) **blockers & escalations** with AI remediation text and
 "Help me"/"Mute"; (6) a **git commit ribbon** (last 5 agent commits, hash/message/agent/status).
- **AC:** Given a Weave-product self-improvement proposal relevant to this project exists, then it
 surfaces here as a **read-only** card linking to the Platform self-improvement surface (Build does
 not own the proposal lifecycle).
- **AC (failure mode):** Given a tile's data source errors, then that tile shows a localized error
 state and the rest of the dashboard still renders.
- **Priority:** Must Have

**E3-S2: Quick actions from the dashboard**
As a **product owner**, I want "Run demo", "Replan", "Plan release", and "Open Kanban" actions, so
that I can act without navigating away.
- **AC:** Given the dashboard, then "Run demo" triggers a demo deployment and a fresh visual-state
 capture set (E8-S4); "Replan" opens the replan view (E6-S4); "Plan release" opens the
 release/rollback-plan modal (E8-S4); "Open Kanban" opens the board.
- **AC (failure mode):** Given "Run demo" deployment fails, then the demo-readiness tile shows
 "demo failed" with the error surfaced and the previous demo URL retained.
- **Priority:** Should Have

---

### Epic 4: Kanban & Task Management

**E4-S1: Kanban board with six lanes**
As any project member, I want a kanban across six lanes, so that the state of work is visible.
- **AC:** Given the board, then six lanes (Backlog → Ready → In Progress → Review → QA → Done) each
 show a count; each task card shows task ID, title, assigned agent (colour-coded by state with a
 visible legend), elapsed time, a **retry chip reflecting the per-class ceiling** (E6-S3), and a
 RUNNING indicator when an agent is active.
- **AC (failure mode):** Given a task's agent crashes, then the card shows "agent failed" and the
 task is classified per the retry taxonomy (E6-S3), not left silently RUNNING.
- **Priority:** Must Have

**E4-S2: Task tree (dependency graph) view**
As a **technical architect**, I want to switch to a dependency-graph view of epics → sub-epics →
tasks, so that I can see what blocks what.
- **AC:** Given the board toolbar, when I toggle "Task tree", then an SVG dependency graph renders
 with nodes **colour-coded by task state with a visible legend**; clicking a node opens the Task
 Detail panel; nodes are keyboard-navigable (Enter opens detail).
- **AC (failure mode):** Given the dependency data is incomplete (a referenced predecessor is
 missing), then the orphan is rendered flagged rather than dropped silently.
- **Priority:** Must Have

> Pixel/colour/bezier specifics are demoted to the design system / tech spec; PRD ACs stay
> behavioural (state-coded with a legend).

**E4-S3: Board filters**
As any project member, I want to filter the board by task state.
- **AC:** Given the board, then filters (All / In flight / Blocked / Self-improvement-flagged /
 This phase) apply within the resolved render budget for the board (E9 performance NFR).
- **AC (failure mode):** Given a filter resolves to zero tasks or an invalid filter state, then
 an empty-state message is shown and the filter resets to "All" — never a blank/broken board.
- **Priority:** Must Have

---

### Epic 5: Task Brief & Detail

**E5-S1: Task brief as a self-contained typed YAML document**
As a **dark-factory agent**, I want a structured typed YAML brief that is complete enough to work
from without reading any other spec file, so that I receive unambiguous, machine-readable
instructions and never leak unrelated spec context into my work.
- **AC:** Given a task, then the Architect agent generates a YAML brief before the Engineer begins,
 with **all** of: `id`, `title`, `phase`, `assigned_to`, `acceptance` (numbered testable criteria
 in **EARS notation** — `WHEN <event> THE SYSTEM SHALL <behaviour>` — each mapped to a named test);
 `design_tokens` (from `CE-BRAND-1`), `layout_constraints`, `forbidden_inferences`,
 `required_diagrams`, `provenance` (spec section, ADRs, originating request), `dependency_chain`;
 a **Definition-of-Ready checklist** (pre-filled, gates task start — FR-046); a
 **Definition-of-Done checklist** (pre-filled, gates merge — FR-047); a **test-requirements**
 block (named scenarios `should <X> when <Y>`, minimum **type counts** — e.g. default min 3 unit /
 1 integration / 1 E2E, tunable per workspace via `PLAT-SETTINGS-1` — and an **AC-to-test mapping
 table**); **implementation hints** (patterns, pitfalls, libraries); and a **token-cost estimate**
 for the task. The brief renders syntax-highlighted in the Brief tab.
- **AC:** Given a generated brief, then it is self-contained: an Engineer assigned the task can
 satisfy every acceptance criterion using only the brief and the predecessors' dependency summaries
 (FR-043) — no other spec file is required at implementation time.
- **AC (failure mode):** Given the Architect cannot produce a valid brief (e.g. missing acceptance
 criteria, no AC-to-test map, or an unsatisfiable DoR), then the task is held in Ready with a
 "brief incomplete" flag and routed to replan (spec-ambiguity, E6-S3) — it is **not** dispatched to
 the Engineer, and it does **not** pass the DoR gate (FR-046).
- **Priority:** Must Have

**E5-S2: Task Detail panel with five tabs**
As any project member, I want Brief / Handoff / Tests / Console / Audit tabs, so that I can inspect
every aspect of a task.
- **AC:** Given a task, then: **Brief** shows the typed YAML + state-machine diagram + provenance
 links (spec section, ADR, **Critic finding**, self-improvement proposal — each linkable);
 **Handoff** shows the NL brief beside the typed YAML; **Tests** shows the **visual-state captures**
 (the 8 states defined in E8-S4) with pass/fail + a filterable console log, failing states marked
 red; **Console** shows the live agent tool-use stream with BLOCKED entries red; **Audit** shows
 the last 8 entries from this task's slice of the decision-log view (E7).
- **AC (failure mode):** Given the audit view cannot reach `PLAT-AUDIT-1`, then the Audit tab shows
 "audit unavailable" and never fabricates entries.
- **Priority:** Must Have

> "Council finding" is renamed **Critic finding** (the reviewer agent is the Critic).

---

### Epic 6: Specification Lifecycle & Dark-Factory Execution

**E6-S1: Spec library and viewer/editor**
As a **product owner**, I want a Specs screen across all projects with status filters, a structured
viewer (Spec / Reviews / Timeline / References), and an editor (Brief / PRD / Tech spec / Decisions
/ History) with per-section regenerate, so that I track and refine the pipeline draft→approved.
- **AC:** Given the Specs screen, then specs list with ID, title, status chip (Draft / In HITL
 review / Approved / Changes requested / Rejected), author, last-updated, domain tags; the viewer
 shows quality signals (Critic flags, AC count, ADR coverage, data-classification status); the
 editor regenerates a single section on demand.
- **AC (failure mode):** Given a regenerate call fails, then the previous section content is
 retained (no destructive overwrite) and the failure is surfaced inline.
- **Priority:** Must Have

**E6-S2: Autonomous, interactive, and Spike execution**
As a **delivery manager**, I want tasks executed by dark-factory agents (Engineer, QA, Architect,
Review, Sandbox) in one of three modes, so that autonomy matches risk.
- **AC:** Given delivery mode "Autonomous" and a task in Ready, then it is dispatched to the agent
 in the brief's `assigned_to`; the Engineer implements + runs the generation gates (E8-S1), the QA
 agent validates against acceptance criteria + visual-state captures, the Architect reviews
 ADR/API conformance.
- **AC:** Given any agent is dispatched, then it runs under a **scoped tool allowlist and a
 per-role turn cap** (defaults, tunable per workspace via `PLAT-SETTINGS-1`): the **Engineer** may
 read/write/edit code and run sandboxed bash (default cap ~100 turns); the **QA** agent has the
 same tools **but a tests-only boundary — it may add or extend tests and never modify
 implementation code** (default cap ~40 turns); the **Architect** may read and ask the user but is
 not granted destructive bash (default cap ~80 turns); the **Sandbox** agent runs only in a Spike
 repo with relaxed gates. A tool call outside an agent's scope is BLOCKED and logged to
 `PLAT-AUDIT-1` (E7).
- **AC:** Given **Interactive** mode, then each agent action (edit/bash/write) is proposed and waits
 for human approve/reject before executing; the approving human identity is recorded in the
 decision log (E7).
- **AC:** Given **Spike** mode, then all work runs in a **sandbox repository that can never merge to
 production**; deploy targets are demo-only and write-back to the graph is disabled.
- **AC (failure mode):** Given an agent reaches its turn cap before completing, then the run halts
 to a HITL gate (E6-S4) with state preserved (FR-041) rather than looping unbounded; the partial
 work is not committed unless it passes the generation gates (E8-S1).
- **AC (failure mode):** Given the QA agent attempts to edit implementation code (outside its
 tests-only scope), then the edit is BLOCKED, logged to `PLAT-AUDIT-1`, and the QA pass is marked
 invalid — QA never clears its own boundary.
- **AC (failure mode):** Given generation fails mid-pipeline, then **no partial code is committed**
 (the generation is atomic per task); the task is classified and retried/replanned per E6-S3.
- **Priority:** Must Have

**E6-S3: Typed result handoffs and the four-class retry taxonomy**
As a **delivery manager**, I want every agent step to emit a typed result and failures classified,
so that the orchestrator branches deterministically and never over-retries unfixable failures.
- **AC:** Given any agent step completes, then it emits a typed result block
 (`status: ok|fail|blocked`, `artifact_path`, `failure_class`) that the orchestrator reads to pick
 the next lane transition; the QA pass/fail populates `failure_class`.
- **AC:** Given a QA `fail`, then the failure is classified and retried up to its **per-class
 ceiling** (defaults, tunable per workspace via `PLAT-SETTINGS-1`): **logic = 3**, **dependency =
 1**, **interface = 1**, **spec-ambiguity = 0**. A spec-ambiguity failure routes to replan/
 `/architect` (E6-S4) — it is **never** retried as code.
- **AC:** Given a task hits its per-class ceiling, then it moves to Blockers & Escalations with an
 AI remediation suggestion; the kanban retry chip reflects the per-class ceiling (e.g. "retry 1/1"
 for a dependency failure), not a flat "/3".
- **AC (failure mode):** Given a failure is misclassifiable, then it defaults to spec-ambiguity
 (route to replan) rather than logic (retry), because retrying an ambiguous spec cannot fix it.
- **Priority:** Must Have

**E6-S4: HITL gates, mid-flight replan, and no self-approval**
As a **delivery manager**, I want configurable HITL gates, a replan lever, and a guarantee that no
agent clears its own gate, so that I retain control over quality and risk.
- **AC:** Given gate configuration, then gates can fire at: every task / phase boundary / failure
 only / never; when a gate fires the task moves to Review, a `PLAT-NOTIFY-1` HITL-gate event
 fires, and a deadline (default 24 h, tunable) triggers escalation if unactioned.
- **AC:** Given a HITL gate or escalation, then the approver must be a **human (or higher-authority)
 principal**; an agent principal (minted by `PLAT-IDENTITY-1`, least-privilege, bound to a role)
 **can never approve a gate or escalation its own action triggered** — the approving identity is
 recorded in the decision log (E7). Per-environment deploy authority applies (default: production
 deploy = two-person approval + a passing Critic review, tunable per workspace).
- **AC:** Given a "Replan" instruction (NL + criticality must-fix-before-production | informational),
 then the Architect drafts a revised task plan for human approval before it takes effect; completed
 tasks are not re-run unless explicitly invalidated.
- **AC (failure mode):** Given an attempt to self-approve is detected, then the action is rejected,
 logged to `PLAT-AUDIT-1`, and a `PLAT-NOTIFY-1` security event fires.
- **Priority:** Must Have

---

### Epic 7: Decision Log (view over the platform audit service)

**E7-S1: Per-project decision log as a view over PLAT-AUDIT-1**
As a **compliance officer**, I want every agent action recorded immutably, so that I can audit what
the dark factory did and why.
- **AC:** Given any agent tool use (Read/Edit/Write/Bash/Block) or HITL approval, then a typed event
 is emitted to `PLAT-AUDIT-1` with the canonical actor principal IRI (from `PLAT-IDENTITY-1`);
 the Build **Decision Log screen and the Task Detail Audit tab are filtered views over
 `PLAT-AUDIT-1`** — Build keeps **no** independent signed store. Append-only and tamper-evidence
 (hash-chain + signing) are enforced by `PLAT-AUDIT-1` at the DB-constraint level; delete attempts
 are rejected and themselves logged.
- **AC:** Given a BLOCKED operation (sandbox violation), then it is recorded and flagged but never
 deleted; it appears in the project Decision Log and the per-task Audit tab.
- **AC (failure mode):** Given the audit service is unreachable when an agent attempts a mutating
 action, then the action is **refused** (fail-closed) rather than performed un-audited.
- **Priority:** Must Have

**E7-S2: Decision-log export**
As a **compliance officer**, I want to export the log for a project or date range, so that I can
fulfil audit requests.
- **AC:** Given the Decision Log screen, then export (JSON/NDJSON, filtered by date/agent/op) is
 delegated to the `PLAT-AUDIT-1` query+export interface, including signature-verification metadata
 consistent with the platform chaining scheme.
- **AC (failure mode):** Given an export exceeds the platform size/time budget, then it is paginated
 rather than truncated silently.
- **Priority:** Should Have

---

### Epic 8: Generation, Anatomy, Project Ontology & Deployment

**E8-S1: Generate an application with measured conformance**
As a **product owner**, I want to generate a Next.js UI + FastAPI API from the approved spec and
project ontology, with quality gates, so that the output meets brand/governance standards measurably.
- **AC:** Given an approved spec, when I trigger Application generation, then the pipeline reads spec
 + the project's slice of the BPMO graph (`CE-READ-1` — the process↔system↔data model: the
 processes/activities the app realises and their actors, systems, services, data assets, and
 governing policies) + brand/voice (`CE-BRAND-1`) and produces OpenAPI → FastAPI routes →
 Next.js pages/components.
- **AC:** Before commit, the pipeline runs **all** of: SAST (Bandit for Python, Semgrep);
 AST/type checks (mypy, tsc); **delta-scoped mutation testing with a ≥70% gate** (CLAUDE.md);
 a **package-existence check** on generated `requirements.txt`/`package.json` that **hard-blocks**
 any non-existent (slopsquatted) dependency; a secret-scan gate; and a **conformance check against
 `CE-BRAND-1`** (design tokens + machine-evaluable VoiceRules) — pass bar **default 90% adherence,
 tunable per workspace**, with **no critical violations**. Each gate is a distinct, falsifiable AC.
- **AC (failure mode):** Given any gate fails, then **nothing is committed** (atomic), the failing
 gate + evidence are surfaced on the task, and the failure is classified per E6-S3 (e.g. SAST
 finding = logic; missing package = dependency).
- **Priority:** Must Have

**E8-S2: AI-agent and pipeline generation (Anthropic Agent SDK)**
As a **product owner**, I want to generate an AI agent (Anthropic Agent SDK, Python primary), so
that a built agent is grounded in the company graph and governed.
- **AC:** Given generation type "Agent", then a scaffold using the Anthropic Agent SDK is produced
 with tools grounded in the BPMO graph (BPMO-kind lookup, rule/policy enforcement, SPARQL over the
 process↔actor↔system↔data model via `CE-READ-1`); the agent's authority is bounded by what the
 model states for the process it serves (per `CE-READ-1` agent-grounding — unstated permissions
 default to deny/route-to-human), and it acts under its own named service principal from
 `PLAT-IDENTITY-1` with RBAC derived from the graph.
- **AC:** Generated config MUST use only the confirmed model ids (`claude-opus-4-8`,
 `claude-sonnet-4-6`, `claude-haiku-4-5`); **no prototype placeholder id** (`sonnet-4-5`,
 `opus-4-1`) may appear in generated config.
- **AC (failure mode):** Given a generated agent would require a permission outside the graph RBAC,
 then generation fails with the offending permission named.
- **Priority:** Should Have (after Application generation is stable)

**E8-S3: Anatomy/Wiki and project-ontology view**
As a **dark-factory agent / architect**, I want a project anatomy and an embedded project-ontology
view, so that agents deliver without rediscovering the codebase and architects see the footprint.
- **AC:** Given a project repo, then the Anatomy/Wiki auto-indexes files/functions, capability
 descriptions, a service catalog, an ADR index, and runbook stubs, refreshed on every commit;
 agents load it into context before a task.
- **AC:** Given the Project Ontology screen, then it embeds the Graph Explorer canvas
 (`GE-CANVAS-1`, `mode: "c4"|"force"`, `filterByIri = project IRI`, `readonly`) scoped to this
 project's entities; entities this project generated are visually distinguished; edits go through
 `CE-WRITE-1` (the view does not mutate the graph directly).
- **AC (failure mode):** Given `GE-CANVAS-1` is unavailable, then the screen shows a graceful
 fallback list of project entities from `CE-READ-1` rather than a blank canvas.
- **Priority:** Must Have (anatomy) / Should Have (ontology embed, P1)

**E8-S4: Deployment, visual-state capture, demo, and release/rollback plan**
As a **product owner**, I want to deploy to a preview/demo environment, capture visual states, and
plan a release with a rollback path, so that I can demonstrate and ship safely.
- **AC:** Given "Run demo", then the artefact deploys to a preview environment and a **visual-state
 capture** set is taken — the 8 states **default, hover, focus, active, disabled, loading, empty,
 error** — diffed against the last passing baseline; the demo URL is shareable via a time-limited
 link.
- **AC:** Given "Plan release", then a release/rollback-plan artefact is produced: rollout sequence,
 a **feature-flag-based rollback path**, scope, approvers, and target date, between spec approval
 and build.
- **AC (failure mode):** Given a deploy fails, then the failure is surfaced on the dashboard, the
 prior demo URL is retained, and no half-deployed state is presented as ready.
- **Priority:** Must Have (demo + capture) / Should Have (release plan)

> "Visual-state capture" replaces the undefined "F25 visual test": 8 named UI states diffed against
> a stored baseline.

**E8-S5: Generate a typed client SDK and a standalone graph-surface OpenAPI contract**
As a **technical architect**, I want Build to generate, from a pinned CE ontology version, a typed
client SDK (TypeScript + Python) plus a standalone OpenAPI 3.1 contract for the graph query/write
surface, so that engineers consume the company graph through typed, ontology-derived classes and
methods — owned by the client and forkable — rather than hand-writing SPARQL or untyped HTTP calls.
- **AC:** Given a project pinned to a CE version (`CE-VERSION-1`), when I trigger "Generate SDK",
 then Build reads the BPMO kinds + SHACL shapes via `CE-READ-1` and produces (a) a **typed
 client SDK** packaged as a TypeScript/npm package and a Python/pip package — with typed classes
 over the BPMO kinds (Process, Activity, Actor, System, Service, DataAsset/Field, etc.) and their
 relationships — and (b) a **standalone OpenAPI 3.1 contract** describing the graph query/write
 surface; both are versioned to the pinned CE version and carry the `BE-ARTEFACT-1` provenance
 header (spec ID, pinned CE version, referenced entity IRIs). The SDK package shape + the
 ontology→type mapping follow the `BE-SDK-1` contract.
- **AC:** Given the ontology→type mapping, then a SHACL node shape maps to a typed class, its
 declared properties map to typed fields (cardinality/datatype from the shape), and a named SPARQL
 SELECT maps to a typed query method — so types stay derived from the model, not hand-maintained.
- **AC:** Given the pinned CE version changes (a `CE-DIFF-1` delta exists since the pin), then the
 SDK + OpenAPI contract are **regenerable** against the new version and the regenerated package
 carries a bumped version tag; the previously generated package is retained (no destructive
 overwrite) so a client can pin an older SDK.
- **AC:** Given the generated SDK + OpenAPI contract, then they are **client-owned and forkable** —
 emitted into the project repo as portable source the team can edit and version independently of
 Weave (consistent with Build's portable-code goal); Build does not gate the client's fork.
- **AC (failure mode):** Given `CE-READ-1` is unreachable or the pinned version's SHACL shapes
 cannot be resolved, then SDK generation fails with the unresolved shape/version named and **no
 partial package is emitted** (atomic per generation, per E8-S1) — a half-typed SDK is never
 committed.
- **Priority:** Should Have (P1, after Application generation is stable)

---

### Epic 9: Bidirectional Graph Sync & Staleness

**E9-S1: Write generated artefacts back via the validated write path**
As a **technical architect**, I want generated services/APIs/data-assets written back into the
Constitution graph through the validated path, so that the operating model reflects what was built.
- **AC:** Given an artefact deployment (non-Spike), then Build writes new BPMO `System`/`Service`
 nodes, API endpoints, `DataAsset` (+`Field`) nodes, and their relationships (e.g. `runsOn`,
 `accesses`, `produces`/`consumes`) via **`CE-WRITE-1` (`POST /api/operations/apply`)**:
 applied on a throwaway clone, SHACL-validated, committed only if no `sh:Violation` (Warning/Info
 advisory), each batch carrying a PROV-O activity attributed to the Build service principal.
 Each written entity carries the `BE-ARTEFACT-1` provenance header (spec ID, pinned CE version,
 referenced entity IRIs).
- **AC:** Write-back MUST use `CE-WRITE-1` only; it MUST NOT use any auto-apply bypass (e.g. the
 prototype's legacy unvalidated `/api/llm/mutate`).
- **AC (failure mode):** Given `CE-WRITE-1` returns `422 { violations }`, then the **deployed
 artefact is rolled back via its feature flag** (E8-S4), the violations surface on the task, and
 the write-back is retried only after the artefact or the proposed graph delta is corrected — the
 graph and the deployed state never silently diverge.
- **Priority:** Must Have

**E9-S2: Artefact provenance and staleness**
As a **technical architect**, I want each artefact linked to its source and a stale indicator, so
that when the model changes I know which artefacts are affected.
- **AC:** Given a generated artefact, then it carries the `BE-ARTEFACT-1` provenance header; the
 Artefacts screen lists files with provenance and a **stale indicator computed from `CE-VERSION-1`
 canonical version-lag** (default "stale" threshold = lag ≥ 2, configurable) — Build does not
 recompute lag locally.
- **AC:** Given the pinned version falls "stale", then a `PLAT-NOTIFY-1` version-lag event fires for
 the project; "published version" semantics follow the Constitution snapshot lifecycle
 (draft | released | deprecated, single released version) referenced via `CE-VERSION-1`.
- **AC (failure mode):** Given `CE-VERSION-1` is unreachable, then the stale indicator shows
 "unknown" rather than asserting "current".
- **Priority:** Should Have

---

### Epic 10: Client-App Self-Healing (always HITL)

> Self-healing **configures the shared `BE-SELFIMPROVE-1` signal→issue→dispatch engine** that Build
> provides. Every dispatched fix is **HITL-gated; there is no autonomous merge** (D4). Build heals
> its own deployed products and its own factory; the **Events & Actions Engine** owns business-process
> automation (`EA-AUTOMATION-1`).

**E10-S1: Collect operational signals from a deployed app**
As an **ops / SRE**, I want signals collected from multiple AWS sources, so that issues are caught
before users report them.
- **AC:** Given a deployed app, then signals are collected at configurable intervals with the
 following **default** thresholds, **each tunable per project** and flagged as a product-owner-
 confirmable assumption (not a fixed requirement): CloudWatch errors (5 min, NLP-clustered);
 HTTP 5xx rate CRITICAL at default >1% sustained 5 min; Lambda memory CRITICAL at default >90% of
 limit and cold-start default >20% in a 15-min window; p99 latency WARN at default >25% over a
 7-day baseline (hourly); DLQ depth >0 (15 min); cost anomaly INFO at default >2× the 7-day moving
 average (daily); visual-regression WARN on capture diff (on CI); HIGH/CRITICAL CVE → CRITICAL
 (daily); secret-in-CI → CRITICAL + pipeline block (per commit); `CE-WRITE-1` write-back 422 → WARN
 (on event); HITL-override rate WARN at default >30% (daily); agent-retry rate WARN when tasks hit
 the per-class ceiling (hourly).
- **AC:** Each signal record carries: type, severity (INFO/WARN/CRITICAL), timestamp, value, delta
 vs. baseline, evidence (log excerpt/metric snapshot), and AWS resource ARN; signals display in the
 Self-healing screen grouped by severity with a per-type last-checked timestamp.
- **AC (failure mode):** Given a signal source (e.g. CloudWatch) is unreachable, then that signal
 type shows "collection failed — last good Xh ago" rather than a false green.
- **Priority:** Should Have

**E10-S2: Issue creation and HITL-gated dispatch through the deterministic gate sequence**
As an **ops / SRE**, I want issues created from signals and fixes dispatched only after the
deterministic governance gates, so that self-healing is governed and never bypasses a human.
- **AC:** Given a WARN/CRITICAL signal, then `claude-sonnet-4-6` drafts a project issue (title,
 root-cause hypothesis, evidence, affected resource, suggested fix category); CRITICAL auto-notifies
 via `PLAT-NOTIFY-1`, WARN creates a draft only; duplicate detection appends evidence to an open
 issue with the same signal-type + ARN rather than creating a duplicate.
- **AC:** Given "Dispatch fix", then **before any autonomous step runs** the dispatch passes the
 deterministic gate sequence **explicit-deny → authority → automatable-flag → HITL**; a
 non-automatable or denied action stops at the gate. The fix runs as a normal kanban task
 (Engineer → QA → Architect → **HITL gate** → commit) — **no autonomous merge** (D4).
- **AC:** Given a fix commits, then the issue is marked resolved with the fix commit link, passing
 visual-state captures (if applicable), and the post-fix signal value; if the signal has not
 improved after the fix + a default 30-min observation window (tunable), the issue auto-reopens
 with post-fix data as new evidence.
- **AC (failure mode):** Given a CRITICAL signal but the deny/authority/automatable gate blocks
 auto-dispatch, then the issue is raised and a human is notified for manual dispatch — the engine
 never force-merges past the gate.
- **Priority:** Should Have

**E10-S3: Self-healing screen**
As a **project member**, I want a Self-healing screen of active signals, open issues, and resolved
issues, so that operational health is visible without the AWS Console.
- **AC:** Given the Self-healing screen, then a signal status bar (chip per type, severity-coloured,
 last-checked), ranked open issues (with "Dispatch fix"), and the last 20 resolved issues (with
 resolution method + fix commit) display; the project dashboard shows a summary chip
 (green / amber ≥1 WARN / red ≥1 CRITICAL).
- **AC (failure mode):** Given signal collection has stalled or the issues list fails to load,
 then the affected section shows a "data unavailable — last good Xh ago" state and the summary
 chip renders neutral (grey), never a false green.
- **Priority:** Should Have

---

### Epic 11: Dark-Factory Execution Engine

> **Partition rule (with Epic 6):** Epic 6 owns the **run modes** (E6-S2), the **typed-result +
> four-class retry** contract (E6-S3), and the **HITL gates / replan / no-self-approval** controls
> (E6-S4). Epic 11 owns the **loop mechanics that wrap them** — the bounded autonomous loop, the
> per-task PLAN→DELEGATE→ASSESS→CODIFY lifecycle, the dependency-summary handoff, the state-spine
> schema, model routing, and the orchestrator-side context/preflight controls. Stories here
> **reference** E6-S2/S3/S4 rather than restating them.

**E11-S1: Bounded autonomous run with a hard turn cap**
As a **delivery manager**, I want every autonomous run to carry a hard turn/iteration cap (not only
a cost cap), so that a cheap-but-looping run cannot run away even though it never trips the budget
gate (E1-S3/E2-S3).
- **AC:** Given an autonomous run, then the orchestrator enforces a **turn/iteration cap per project
 run** (default 60 turns, tunable per workspace via `PLAT-SETTINGS-1`) — counting orchestrator
 dispatch cycles, **distinct from the per-agent internal turn caps in FR-022** — **in addition to**
 the cascading cost cap (FR-008); the cap binds independently — reaching either halts the run.
- **AC:** Given a run halts on the turn cap, then it stops at the next safe checkpoint to a HITL gate
 (E6-S4) with full state preserved so it is **resumable from the last completed CODIFY** (FR-042),
 not restarted; a `PLAT-NOTIFY-1` run-halted event fires naming the cap that bound.
- **AC (failure mode):** Given a run is approaching the cap mid-task, then no task is left in a
 partially-committed state — the in-flight task either completes its CODIFY or is rolled back to its
 last checkpoint, so resume is deterministic.
- **Priority:** Must Have

**E11-S2: Per-task PLAN→DELEGATE→ASSESS→CODIFY lifecycle**
As a **delivery manager**, I want each task to execute a defined four-stage lifecycle where CODIFY is
non-skippable, so that work is always planned, delegated, assessed, and recorded — and the
dependency handoff (E11-S3) always has something to carry forward.
- **AC:** Given a Ready task, then it runs **PLAN** (read brief + predecessors' dependency summaries,
 verify the DoR gate — FR-046) → **DELEGATE** (the assigned agent implements under TDD with the
 generation gates — E8-S1) → **ASSESS** (QA validates and classifies any failure per the four-class
 taxonomy — E6-S3) → **CODIFY** (write the dependency summary — FR-043, update the state spine —
 FR-044, run the code-review gate, advance the lane).
- **AC:** Given a task reaches ASSESS with a PASS, then **CODIFY cannot be skipped**: the task moves
 to Done only after its dependency summary is written and the state spine is committed; a task whose
 CODIFY did not complete is not counted as Done by the phase-completion query (FR-044).
- **AC (failure mode):** Given an agent or sandbox crashes mid-lifecycle, then the task resumes from
 its last completed stage on the preserved state, never from scratch, and is never silently left
 RUNNING (E4-S1).
- **Priority:** Must Have

**E11-S3: Per-task dependency-summary handoff**
As a **dark-factory agent**, I want each completed task to write a structured summary (decisions,
edge cases, nuances, context dependents need) that downstream tasks read in PLAN, so that later
tasks do not rediscover what an earlier task already settled.
- **AC:** Given a task completes CODIFY (E11-S2), then it writes a **dependency summary** to the
 tenant-scoped project store (a row keyed by `project_iri` + `task_id`, RLS-isolated per OQ-06)
 capturing key decisions, edge cases handled, and the context a dependent task needs; writing the
 summary is **blocking** before the task is marked Done.
- **AC:** Given a task enters PLAN, then it MUST load the dependency summaries of every task in its
 `dependency_chain` (FR-018) before DELEGATE; the orchestrator receives each predecessor's summary
 (not its source) when a sub-agent completes, so the orchestrator context stays summary-level, not
 code-level.
- **AC (failure mode):** Given a predecessor's summary is missing or unreadable, then the dependent
 task is held in Ready with a "missing handoff" flag and routed to replan (E6-S3) rather than
 dispatched blind.
- **Priority:** Must Have

**E11-S4: State spine as a typed, tenant-scoped contract**
As a **delivery manager**, I want the orchestrator's source of truth to be a typed project-state
record with a dependency-aware "ready" resolver and a "phase-complete" query, committed after every
task, so that work scheduling and resumability are deterministic and survive a crashed run.
- **AC:** Given a project, then its state is a typed record — `{ project_iri, phase, epics: [{id,
 title, status}], tasks: [{id, epic, title, status, blocked_by: []}] }` with task statuses
 `backlog → in_progress → review → done` — persisted as a **per-tenant DB table with row-level
 security** (not a local file), isolated through the `PLAT-SETTINGS-1` tenancy cascade (mechanism
 deferred to OQ-06).
- **AC:** Given the state record, then the orchestrator exposes a **`ready` resolver** (returns the
 tasks whose `blocked_by` are all Done — the DAG frontier that feeds the Ready lane, E4-S1) and a
 **`phase-complete` query** (returns COMPLETE only when every task in the phase is Done) that the
 phase-gate ceremony (FR-052) and the bounded-loop goal condition (FR-041) evaluate against.
- **AC:** Given any task transition, then the state record is **committed after every task** so a
 crashed run resumes from the last committed checkpoint (E11-S1/E11-S2); the commit is the
 resumability contract.
- **AC (failure mode):** Given a write to the state store fails, then the task transition is treated
 as not-committed (the prior state stands) rather than half-applied, and the run halts to HITL with
 the error surfaced.
- **Priority:** Must Have

**E11-S5: Configurable dark-factory model routing (provider + model tiering)**
As a **delivery manager**, I want a configurable provider+model routing layer that sends simpler
agentic work to cheaper/local models and only heavy planning to the premium tier, so that the dark
factory is right-sized for cost without hand-editing each agent.
- **AC:** Given the dark factory runs, then provider+model selection resolves through a config
 surface that maps `{agent-role | task-tier | complexity} → {provider, model}`, resolvable **per
 environment** (local / dev / staging / prod) and overridable per workspace/role/task via
 `PLAT-SETTINGS-1` (see `_dev-environment.md` §3). Heavy/complex planning (architecture,
 elicitation, multi-step generation) routes to the **Bedrock** Claude tier; simpler work
 (validation, formatting, classification, lint, sub-tasks) routes to **Ollama** small models where
 capable; **Bedrock use is minimised** (cost).
- **AC:** Given a provider abstraction with three backends (**Ollama / Bedrock / Anthropic API**),
 then generated config and routed calls MUST use only confirmed Claude model ids on the Claude tier
 (`claude-opus-4-8` / `claude-sonnet-4-6` / `claude-haiku-4-5`) — no prototype placeholder ids; and
 token/run usage is metered through `PLAT-BILLING-1` per the routed provider+model.
- **AC (failure mode):** Given the configured provider for a role is unreachable, then routing falls
 back per the configured policy (e.g. Ollama-down → escalate that role to the Claude tier, or halt
 if no fallback is permitted) and fires a `PLAT-NOTIFY-1` routing-degraded event; a routing miss
 with **no** valid provider/model **halts the task** rather than silently invoking an unapproved
 model.
- **AC (failure mode):** Given a quality-sensitive path (final generation, conformance-graded output)
 is configured to a local small model, then the run is flagged "plumbing-only fidelity" and must be
 re-run against the Claude tier before the phase-gate sign-off (FR-052) — local output never
 satisfies a quality gate on its own (`_dev-environment.md` §3 fidelity caveat).
- **Priority:** Must Have

**E11-S6: Orchestrator preflight, context hygiene, and scaffolding gate**
As a **delivery manager**, I want the orchestrator to verify the environment before work starts,
keep agent context clean on large projects, scaffold the project once behind a human gate, and
self-verify before each handoff, so that long autonomous runs stay correct and within budget.
- **AC:** Given a build is about to start and at each phase boundary, then a **dependency/credential
 preflight** verifies required system dependencies and that required credentials exist as
 Secrets-Manager references (it checks reference **names**, never reads secret values); a critical
 missing dependency STOPs the run to HITL (FR-049).
- **AC:** Given the first run of a new project, then the orchestrator scaffolds the project
 environment (CI config, git hooks, health route, smoke test) and **forces a human
 environment-verification gate** (web Approve/Amend/Reject via `PLAT-NOTIFY-1`) before any feature
 task is dispatched (FR-050).
- **AC:** Given a large project graph, then the orchestrator may spawn **isolated read-only
 investigator runs** that answer one narrow question and return a **pointer + short summary** (not
 raw source) to a tenant-scoped output, keeping the orchestrator context window clean (FR-051,
 addresses OQ-11); investigators cannot spawn sub-investigators.
- **AC:** Given any agent reaches a HITL handoff, then it emits a **self-verification block** — a
 line-by-line check of its governing rules (`complied | violated | n/a`) plus a confidence note
 naming the weakest part of its output; any `violated` line STOPs the handoff for revision (FR-048).
- **AC:** Given an agent session starts on a project, then a **tenant-scoped durable memory store**
 (committed decisions, conventions, references) is injected into its context, and a structured
 elicitation toolkit is offered on conflicting requirements / unclear root cause / competing
 approaches (FR-058) — so agents carry project decisions across sessions rather than rediscovering
 them.
- **AC (failure mode):** Given the preflight, scaffolding gate, or self-verification fails, then the
 run halts to HITL with the specific failure surfaced — it never proceeds to dispatch on an
 unverified environment or an unaudited self-check.
- **Priority:** Should Have (preflight, scaffolding gate, self-verification, isolated investigator —
 all P1) / Could Have (durable memory + elicitation, P2)

---

### Epic 12: Quality Gates & Spec-Coverage

> **Partition rule (with Epic 6 / Epic 8):** Epic 8 (E8-S1) owns the **generation gates**
> (SAST, type-check, mutation, package-existence, secret-scan, brand conformance) that run before a
> single commit. Epic 12 owns the **task- and phase-level quality ceremonies that wrap generation**:
> the Definition-of-Ready and Definition-of-Done gates, the full QA category suite, the cumulative
> spec-coverage audit, cross-task finding propagation, the phase-gate ceremony, the pre-scaffold
> spec-review gate, and reality-drift detection. These reference E8-S1's gates as a subset rather
> than restating them.

**E12-S1: First-class Definition-of-Ready gate**
As a **dark-factory agent**, I want a mechanical Definition-of-Ready checklist verified before a task
is dispatched, so that I never start a task whose prerequisites are incomplete.
- **AC:** Given a task about to be dispatched, then a **DoR gate** verifies a mechanical checklist
 (brief completeness, dependencies resolved, required diagrams present, design decisions/ADRs
 captured, test scenarios + AC-to-test map present, token-cost estimate present); **any single FAIL
 → NOT READY** (no threshold negotiation) and the task is held in Ready and routed to replan
 (E6-S3).
- **AC:** Given the DoR gate passes, then the task enters PLAN (E11-S2) and the checklist result is
 recorded; the gate runs in PLAN before DELEGATE so an unready task never reaches an agent.
- **AC (failure mode):** Given the DoR checklist cannot be evaluated (e.g. the brief is malformed),
 then the task is treated as NOT READY rather than defaulting to ready.
- **Priority:** Must Have

**E12-S2: First-class Definition-of-Done gate**
As a **QA agent**, I want a mechanically-verifiable Definition-of-Done checklist that gates merge,
where I run each command myself rather than trusting a self-report, so that "done" is measured.
- **AC:** Given a task in ASSESS, then a **DoD gate** verifies a checklist where every item names a
 tool/metric (defaults, tunable per workspace via `PLAT-SETTINGS-1`): lint 0 errors, type-check
 clean, complexity budget (cyclomatic ≤10 / cognitive ≤15 / function length ≤50), coverage ≥80%,
 mutation ≥70%, SAST 0-high, boundary input validation present, no `eval`/`Function()`, docs
 updated, conventional-commit git hygiene; the **QA agent runs the commands itself and never trusts
 the Engineer's self-report**. The generation gates (E8-S1) are a subset of the DoD.
- **AC:** Given any DoD item fails, then the task does not merge; the failure is classified per E6-S3
 and the task returns to In Progress or replan.
- **AC (failure mode):** Given a DoD command cannot run (e.g. the mutation tool is unavailable in the
 sandbox), then the item is recorded as NOT VERIFIED (a fail), never as a silent pass.
- **Priority:** Must Have

**E12-S3: Full QA category suite**
As a **QA agent**, I want to validate a task across the full category suite, not just acceptance
criteria, so that coverage, complexity, accessibility, performance, and real browser behaviour are
all checked.
- **AC:** Given a task in ASSESS, then QA validates **all applicable** categories: AC↔test mapping,
 coverage ≥80%, complexity budget, lint, design-decision + diagram conformance, accessibility (axe /
 WCAG 2.1 AA, zero violations on UI surfaces), performance (a load test against the resolved SLO),
 **browser-automation with a backend assertion** (a UI action is verified to have produced the
 expected backend effect, not just a screenshot), delta-scoped mutation on changed files, plus
 **edge-case test extension** (QA adds tests for unhandled edges); each category emits a pass/fail.
- **AC:** Given QA completes, then it emits the typed result (E6-S3) with `failure_class` populated
 from the first failing category; visual-state captures (E8-S4) are part of the UI validation.
- **AC (failure mode):** Given a category's tooling is unavailable, then that category reports NOT
 VERIFIED (a fail for gating purposes) rather than being skipped silently.
- **Priority:** Must Have

**E12-S4: Cumulative spec-coverage audit at phase end**
As a **delivery manager**, I want an end-of-phase audit that proves every `Must` requirement is
actually implemented or asserted by a test, so that the phase cannot close with silently-missing
requirements.
- **AC:** Given a phase reaches completion (FR-044 phase-complete), then a **cumulative spec-coverage
 audit** maps every `Must` FR/NFR in scope to implementing code or an asserting test, classifying
 each **DELIVERED / PARTIAL / MISSING** and emitting a `cumulative_coverage_pct`; the audit result
 is written to the tenant-scoped project store.
- **AC:** Given the audit result, then the phase **halts** unless **≥90% of `Must` items are
 DELIVERED (default, tunable per workspace) and there are zero MISSING** `Must` items; a halt routes
 to replan/escalation (E6-S3/E6-S4) with the MISSING items named.
- **AC (failure mode):** Given a `Must` item is ambiguous to map (cannot be tied to code or a test),
 then it is classified MISSING (the safe default), not PARTIAL, so the gate errs toward halting.
- **Priority:** Must Have

**E12-S5: Phase-gate ceremony with security, mutation, and doc-generation**
As a **delivery manager**, I want the phase-boundary gate to run a defined ceremony — security
review, mutation score, doc generation, and a written phase summary — auto-triggered on phase
completion and requiring a human Approve/Amend/Reject, so that a phase only advances after a real
quality bar and a human sign-off.
- **AC:** Given the phase-complete query returns COMPLETE (FR-044), then the **phase-gate ceremony is
 auto-triggered**: it runs a security review (a CRITICAL finding **blocks** Approve), checks the
 mutation score (below the gate — default 70%, tunable — is flagged RED), runs the cumulative
 spec-coverage audit (FR-053), generates/refreshes docs, and writes a **phase summary** artefact to
 the tenant-scoped store.
- **AC:** Given the ceremony completes, then it routes to a **web HITL approval** via `PLAT-NOTIFY-1`
 (Approve / Amend / Reject), subject to the no-self-approval invariant (E6-S4); **Reject** writes an
 escalation artefact and halts the run, **Amend** returns specific items to replan, **Approve**
 advances to the next phase.
- **AC (failure mode):** Given the ceremony cannot complete a step (e.g. the security-review tool
 errors), then the gate stays closed (fail-closed) and the phase does not advance.
- **Priority:** Must Have

**E12-S6: Pre-scaffold whole-spec review gate**
As a **technical architect**, I want a whole-spec completeness/consistency/readiness review to pass
before any build is scaffolded, so that incomplete specs are caught before tokens are spent on code.
- **AC:** Given a project is approved and about to scaffold, then a **pre-scaffold spec-review gate**
 runs a cascade check (brief → PRD → roadmap → tech spec → implementation-ready) with hard blockers
 per transition plus completeness/consistency review categories; **a critical gap halts** scaffolding
 and routes to spec replan.
- **AC:** Given the spec-review passes, then scaffolding (E11-S6) may proceed; the review result is
 recorded against the project.
- **AC (failure mode):** Given the review cannot reach a required spec artefact, then it reports the
 missing artefact and halts rather than passing on incomplete inputs.
- **Priority:** Must Have

**E12-S7: Cross-task finding propagation and project escalation queue**
As a **QA agent**, I want defects that affect other tasks to be carried forward and recommendations
that recur to be promoted to a project issue, so that the same defect or recommendation does not
silently repeat across tasks.
- **AC:** Given QA finds a defect affecting other tasks, then the finding is recorded with an
 `affects: [task_id…]` list in the tenant-scoped store; later QA passes on any affected task MUST
 read these findings before validating.
- **AC:** Given the same recommendation appears in ≥2 consecutive QA reports (default, tunable), then
 it is promoted to a **project-level issue** with an owner and a deadline and stops repeating
 per-task; the issue surfaces in Blockers & Escalations (E6-S3).
- **AC (failure mode):** Given the findings store is unreachable, then QA does not silently proceed —
 it flags "cross-task findings unavailable" and holds gating decisions that depend on them.
- **Priority:** Should Have

**E12-S8: Reality-drift detection (code vs spec)**
As a **technical architect**, I want periodic detection of drift between code reality and the spec,
surfaced for human resolution, so that the spec and the built system do not silently diverge.
- **AC:** Given a project with generated code, then a **reality-drift check** extracts claims from
 the spec/anatomy and cross-references them against the code graph, producing a
 Confirmed / Contradicted / Unverifiable table with a source-of-truth recommendation; it **never
 auto-resolves** — contradictions are surfaced for human decision.
- **AC:** Given a contradiction is found, then it is raised in Blockers & Escalations (E6-S3) with the
 conflicting spec claim and code reality side by side; this is distinct from artefact version-lag
 (E9-S2), which tracks staleness vs the pinned CE version.
- **AC (failure mode):** Given the code graph is unavailable, then the check reports "drift unknown"
 rather than asserting "in sync".
- **Priority:** Should Have

---

## 4. Functional Requirements

> ACs (Given/When/Then + a failure-mode AC) live with each story in §3. This table carries the
> one-line requirement, its story, priority, and the **Phase / depends-on** tag.

| ID | Requirement | Story | Priority | Phase / depends-on |
|---|---|---|---|---|
| FR-001 | Request Studio (CTA "New Request"): free-text intake + run-mode selector → AI-drafted brief+PRD+tech spec (streaming, `claude-opus-4-8`); grounding via `CE-READ-1` | E1-S1 | P0 | MVP · CE GA |
| FR-002 | Three run modes selectable at intake: Draft-spec-only / Spec→review→build / Spike (sandbox, no prod merge) | E1-S1, E6-S2 | P0 | MVP |
| FR-003 | Intake blast-radius + risk: domains (primary/secondary/discarded), services (`modify\|consume\|NEW`) via `CE-READ-1`; Critic flags + quality signals; HITL before project creation | E1-S2 | P0 | MVP · CE GA |
| FR-004 | Pre-generation cost-estimate gate: block project creation when estimate > per-spec cap (default ~$25-equiv, tunable) resolved via `PLAT-SETTINGS-1` | E1-S3 | P0 | MVP · Platform settings |
| FR-005 | Stakeholder sign-off: reviewers from graph (`CE-READ-1`); approve/changes/reject (comment mandatory); spec locked on submit; auto-create on all-approved | E1-S4 | P0 | MVP · CE GA |
| FR-006 | Projects grid + filters + search; per-card status, budget, demo state, actions; localized error on metrics outage | E2-S1 | P0 | MVP |
| FR-007 | Project auto-created from approved request with pinned version via `CE-VERSION-1`; anatomy pre-seeded; idempotent create | E2-S2 | P0 | MVP · CE GA |
| FR-008 | Cascading governance via `PLAT-SETTINGS-1` (tighter-wins): per-spec/per-PR caps, burn-rate alert, overage-review trigger, model-tier gating, 100% hard-reject — all configurable defaults; metering via `PLAT-BILLING-1` (per-token + per-run) | E2-S3 | P0 | MVP · Platform settings+billing |
| FR-009 | Integrations bound by reference via `PLAT-CONNECTOR-1` (Jira handle, Slack channel); no connector credential stored in Build | E2-S3 | P0 | MVP · Platform connectors |
| FR-010 | Secrets are AWS Secrets Manager references only; secret-scan gate blocks plaintext secrets in generated code | E2-S3, E8-S1 | P0 | MVP |
| FR-011 | "Upgrade pin" shows `CE-DIFF-1` diff (nodes + edges) and requires explicit confirmation | E2-S3 | P0 | MVP · CE GA |
| FR-012 | Project dashboard: 6 areas + commit ribbon; per-tile error isolation; read-only Platform self-improvement card | E3-S1 | P0 | MVP |
| FR-013 | Budget tile estimate-vs-actual ratio (default ×1.0 ±0.2, tunable, flagged assumption) | E3-S1 | P0 | MVP |
| FR-014 | Quick actions (Run demo / Replan / Plan release / Open Kanban) with deploy-failure handling | E3-S2 | P1 | Phase 2 |
| FR-015 | Kanban: 6 lanes; cards state-coded with legend; per-class retry chip; RUNNING + agent-failure states | E4-S1 | P0 | MVP |
| FR-016 | Task tree dependency graph (state-coded, legend, keyboard-nav); orphan flagging | E4-S2 | P0 | MVP |
| FR-017 | Board filters (All / In flight / Blocked / Self-improvement-flagged / This phase) | E4-S3 | P0 | MVP |
| FR-018 | Self-contained typed YAML task brief — superset: EARS acceptance (each mapped to a named test), `design_tokens` from `CE-BRAND-1`, layout_constraints, forbidden_inferences, required_diagrams, provenance, dependency_chain, **DoR checklist** (FR-046), **DoD checklist** (FR-047), **test-requirements** (type counts + AC-to-test map), **implementation hints**, **token-cost estimate**; brief alone + dep summaries suffice to implement; incomplete-brief → replan | E5-S1 | P0 | MVP · CE GA |
| FR-019 | Task Detail 5 tabs (Brief/Handoff/Tests/Console/Audit); Audit tab is a `PLAT-AUDIT-1` view | E5-S2 | P0 | MVP · Platform audit |
| FR-020 | Provenance links on brief (spec section, ADR, **Critic finding**, self-improvement proposal) | E5-S2 | P0 | MVP |
| FR-021 | Spec library + viewer (Spec/Reviews/Timeline/References) + editor (Brief/PRD/Tech spec/Decisions/History); non-destructive regenerate | E6-S1 | P0 | MVP |
| FR-022 | Dark-factory agents (Engineer/QA/Architect/Review/Sandbox) under named principals from `PLAT-IDENTITY-1`; autonomous / interactive / Spike execution; **per-role tool scopes + turn caps** (defaults tunable via `PLAT-SETTINGS-1`; out-of-scope tool call BLOCKED+audited) incl. the **QA tests-only / never-modify-impl boundary**; turn-cap reached → halt to HITL | E6-S2 | P0 | MVP · Platform identity |
| FR-023 | Typed result block per agent step (`status/artifact_path/failure_class`) driving orchestrator branching | E6-S3 | P0 | MVP |
| FR-024 | Four-class retry taxonomy (logic 3 / dependency 1 / interface 1 / spec-ambiguity 0→replan), configurable defaults; spec-ambiguity never code-retried | E6-S3 | P0 | MVP |
| FR-025 | HITL gates (configurable trigger + deadline escalation via `PLAT-NOTIFY-1`); mid-flight replan → Architect plan → human approval | E6-S4 | P0 | MVP · Platform notify |
| FR-026 | No-self-approval invariant: agent principals cannot approve a gate/escalation their own action triggered; approver recorded in `PLAT-AUDIT-1`; per-env deploy authority (default prod = two-person + Critic pass) | E6-S4 | P0 | MVP · Platform identity+audit |
| FR-027 | Decision log = filtered view over `PLAT-AUDIT-1`; Build keeps no independent signed store; mutating action fails closed if audit unreachable | E7-S1 | P0 | MVP · Platform audit |
| FR-028 | Decision-log export delegated to `PLAT-AUDIT-1` query+export (JSON/NDJSON, filtered, signature-verification metadata) | E7-S2 | P1 | Phase 2 · Platform audit |
| FR-029 | Application generation gates (pre-commit, all required): SAST (Bandit/Semgrep), mypy/tsc, delta mutation ≥70%, package-existence hard-block, secret-scan, conformance vs `CE-BRAND-1` (default ≥90%, tunable, no critical violations); atomic on failure | E8-S1 | P0 | MVP · CE GA |
| FR-030 | AI-agent generation (Anthropic Agent SDK); tools grounded in the BPMO graph (process↔actor↔system↔data, policy enforcement); authority bounded by the model (`CE-READ-1` agent-grounding, unstated→deny); principal from `PLAT-IDENTITY-1`; RBAC from graph; only confirmed model ids — no prototype placeholders | E8-S2 | P1 | Phase 2 |
| FR-031 | Anatomy/Wiki auto-index (files/functions, capabilities, service catalog, ADR index, runbooks); loaded into agent context | E8-S3 | P0 | MVP |
| FR-032 | Project Ontology embeds `GE-CANVAS-1` (mode c4/force, filterByIri=project IRI, readonly); edits via `CE-WRITE-1`; fallback list on canvas outage | E8-S3 | P1 | Phase 2 · Explorer canvas |
| FR-033 | Deployment + visual-state capture (8 named states, baseline diff); time-limited shareable demo URL; deploy-failure handling | E8-S4 | P0 | MVP |
| FR-034 | Release/rollback plan artefact (rollout sequence + feature-flag rollback, scope, approvers, target date) | E8-S4 | P1 | Phase 2 |
| FR-035 | Write-back via `BE-ARTEFACT-1` → `CE-WRITE-1` (clone→SHACL→422, PROV-O attribution); MUST NOT use any auto-apply bypass; 422 → feature-flag rollback | E9-S1 | P0 | MVP · CE GA |
| FR-036 | `BE-ARTEFACT-1` provenance header per artefact; stale indicator from `CE-VERSION-1` canonical lag (default ≥2, configurable); version-lag notify via `PLAT-NOTIFY-1` | E9-S2 | P1 | Phase 2 · CE GA |
| FR-037 | Self-healing signal collection (12 types) with configurable-default thresholds flagged as assumptions; per-source collection-failure state | E10-S1 | P1 | Phase 2 |
| FR-038 | Issue creation (`claude-sonnet-4-6`) + duplicate-append; CRITICAL auto-notify; configures shared `BE-SELFIMPROVE-1` engine | E10-S2 | P1 | Phase 2 |
| FR-039 | HITL-gated dispatch through deterministic gate sequence (deny→authority→automatable→HITL); no autonomous merge (D4); auto-reopen after observation window (default 30 min, tunable) | E10-S2 | P1 | Phase 2 |
| FR-040 | Self-healing screen (signal bar, open/resolved issues) + dashboard summary chip | E10-S3 | P1 | Phase 2 |
| FR-041 | Bounded autonomous run: orchestrator-enforced turn/iteration cap on dispatch cycles (default 60, tunable via `PLAT-SETTINGS-1`; distinct from FR-022 per-agent turn caps) **in addition to** the FR-008 cost cap; either cap halts the run to HITL with state preserved; halt fires `PLAT-NOTIFY-1` | E11-S1 | P0 | MVP · runtime OQ-02 |
| FR-042 | Per-task PLAN→DELEGATE→ASSESS→CODIFY lifecycle; CODIFY non-skippable (summary written + state committed before Done); resumable from last completed stage on crash | E11-S2 | P0 | MVP |
| FR-043 | Per-task dependency-summary handoff (decisions/edge-cases/context) to tenant-scoped store (RLS, OQ-06); dependents MUST read predecessors' summaries in PLAN; orchestrator receives summary (not source) on sub-agent completion; missing summary → replan | E11-S3 | P0 | MVP |
| FR-044 | State-spine schema as contract (`{project_iri, phase, epics[], tasks[{id,epic,status,blocked_by[]}]}`) in a **per-tenant DB table with RLS** (OQ-06); `ready` DAG-frontier resolver + `phase-complete` query; committed after every task (resumability contract) | E11-S4 | P0 | MVP · OQ-06 |
| FR-045 | Configurable dark-factory model routing: `{role\|tier\|complexity}→{provider,model}` per environment, overridable via `PLAT-SETTINGS-1`; Ollama/Bedrock/Anthropic-API abstraction; minimise Bedrock; confirmed Claude ids only; metered via `PLAT-BILLING-1`; provider-down → policy fallback + `PLAT-NOTIFY-1`, no-provider → halt; local-fidelity paths re-run on Claude tier before phase-gate (`_dev-environment.md` §3) | E11-S5 | P0 | MVP · Platform settings+billing |
| FR-046 | First-class DoR gate: mechanical checklist verified in PLAN before DELEGATE; any single FAIL → NOT READY → replan; unevaluable brief defaults to NOT READY | E12-S1 | P0 | MVP |
| FR-047 | First-class DoD gate: mechanically-verifiable checklist (lint, type-check, complexity ≤10/15/50, coverage ≥80%, mutation ≥70%, SAST 0-high, boundary validation, no eval, docs, git hygiene — defaults tunable); QA runs commands itself, never self-report; unrunnable command → NOT VERIFIED (fail) | E12-S2 | P0 | MVP |
| FR-048 | Agent self-verification ritual before each HITL handoff: line-by-line rule self-check (`complied\|violated\|n/a`) + confidence note naming weakest part; any `violated` STOPs for revision | E11-S6 | P1 | Phase 2 |
| FR-049 | Dependency/credential preflight before scaffold + at each phase boundary: verify system deps + credential **reference names** exist (never read values); critical-missing → STOP to HITL | E11-S6 | P1 | Phase 2 |
| FR-050 | First-run scaffolding gate: scaffold env (CI, hooks, health route, smoke test) then **force web HITL environment-verification** via `PLAT-NOTIFY-1` before any feature task dispatches | E11-S6 | P1 | Phase 2 |
| FR-051 | Isolated read-only investigator runs: answer one narrow question, return pointer+summary (not source) to tenant-scoped output, keep orchestrator context clean; no sub-investigators (addresses OQ-11) | E11-S6 | P1 | Phase 2 · OQ-11 |
| FR-052 | Phase-gate ceremony auto-triggered on phase-complete (FR-044): security review (CRITICAL blocks Approve), mutation score (default <70% RED), cumulative spec-coverage audit (FR-053), doc-gen, phase-summary artefact → **web HITL Approve/Amend/Reject** via `PLAT-NOTIFY-1` (no self-approval); Reject writes escalation + halts; fail-closed on ceremony error | E12-S5 | P0 | MVP · Platform notify |
| FR-053 | Cumulative spec-coverage audit at phase end: every `Must` FR/NFR → DELIVERED/PARTIAL/MISSING vs code/test, `cumulative_coverage_pct`; phase halts unless ≥90% Must DELIVERED (default, tunable) **and** zero MISSING; ambiguous → MISSING | E12-S4 | P0 | MVP |
| FR-054 | Full QA category suite per task: AC↔test, coverage ≥80%, complexity budget, lint, design/diagram conformance, a11y (axe/WCAG AA), perf load test, browser-automation **with backend assertion**, delta mutation, edge-case test extension; unavailable tooling → NOT VERIFIED (fail) | E12-S3 | P0 | MVP |
| FR-055 | Pre-scaffold whole-spec review gate: cascade check (brief→PRD→roadmap→tech-spec→impl-ready) with hard blockers + completeness/consistency review; critical gap halts scaffolding → spec replan | E12-S6 | P0 | MVP |
| FR-056 | Cross-task finding propagation (`affects:[task_id…]` in tenant-scoped store; affected tasks read before validating) + project escalation queue (recommendation recurring ≥2× → project issue with owner+deadline) | E12-S7 | P1 | Phase 2 |
| FR-057 | Reality-drift detection (code vs spec): Confirmed/Contradicted/Unverifiable table, SOT recommendation, never auto-resolve; contradictions → Blockers & Escalations; distinct from version-lag (FR-036); code-graph unavailable → "drift unknown" | E12-S8 | P1 | Phase 2 |
| FR-058 | Per-project durable memory: tenant-scoped, committed decisions/conventions/references injected into agent sessions at run start; structured elicitation toolkit available on conflicting requirements / unclear root cause | E11-S6 | P2 | Later |
| FR-059 | Ontology→typed-SDK generation (`BE-SDK-1`): from a pinned CE version, generate a typed client SDK (TypeScript/npm + Python/pip) over the BPMO kinds + SHACL shapes — SHACL node shape→class, properties→typed fields, SPARQL SELECT→typed query method — **and** a standalone OpenAPI 3.1 contract for the graph query/write surface; versioned to the pin, `BE-ARTEFACT-1` provenance, regenerable on `CE-DIFF-1` change (bumped tag, prior package retained), forkable/client-owned; `CE-READ-1` unreachable / shapes unresolvable → atomic fail, no partial package | E8-S5 | P1 | Phase 2 · CE GA |

> **Folded out:** the former E12 self-improvement proposal taxonomy (PROMPT/WORKFLOW/RULE/CONTEXT/
> MODEL) and its FRs are **owned by Weave Platform** and removed here (A3, `BE-SELFIMPROVE-1`).
> Build provides the shared engine and surfaces relevant proposals read-only (FR-012).

---

## 5. Inter-engine Interfaces

> Contracts referenced by ID from `docs/specs/_inter-engine-contracts.md`. Consumed contracts are
> pinned to the project's pinned graph version where they read the model.

### Consumed (Build calls / reads)

| Provider engine | Contract | Version pin | Used for |
|---|---|---|---|
| Constitution Engine | `CE-READ-1` | project pinned version | Grounding context, blast-radius, stakeholder resolution, SPARQL reads |
| Constitution Engine | `CE-WRITE-1` | latest (write target = draft/version) | Validated write-back (`POST /api/operations/apply`), clone→SHACL→422 |
| Constitution Engine | `CE-DIFF-1` | from-pin → to-version | "Upgrade pin" diff (nodes + edges) |
| Constitution Engine | `CE-VERSION-1` | n/a (lag source) | Pinned-version resolution + canonical staleness (default lag ≥2) |
| Constitution Engine | `CE-BRAND-1` | project pinned version | Design tokens + VoiceRules; conformance check (default ≥90%) |
| Graph Explorer | `GE-CANVAS-1` | project pinned version | Embedded read-only project-ontology slice (mode c4/force) |
| Weave Platform | `PLAT-AUDIT-1` | stable | Emit audit events; decision-log view + export |
| Weave Platform | `PLAT-IDENTITY-1` | stable | Agent service-principal IRIs (5 dark-factory roles); no-self-approval |
| Weave Platform | `PLAT-SETTINGS-1` | stable | 4-level cascade for budget caps, model-tier gating, RBAC, retry ceilings |
| Weave Platform | `PLAT-BILLING-1` | stable | Per-token generation metering + per-run automation metering |
| Weave Platform | `PLAT-NOTIFY-1` | stable | HITL-gate, budget, generation-failure, version-lag, self-heal events |
| Weave Platform | `PLAT-CONNECTOR-1` | stable | Jira/Slack connector handles (by reference; credentials in Secrets Manager) |

### Provided (Build exposes to others)

| Contract | Consumers | Shape (link) | Stability |
|---|---|---|---|
| `BE-ARTEFACT-1` | Constitution Engine (graph), Platform (audit/provenance) | [contracts §4](../../_inter-engine-contracts.md) | beta |
| `BE-SELFIMPROVE-1` | Weave Platform (Weave-product self-improvement) + Build E10 (client-app self-healing) | [contracts §4](../../_inter-engine-contracts.md) | beta |
| `BE-SDK-1` — ontology→typed-SDK + standalone graph-surface OpenAPI 3.1, versioned to a pinned CE version, `BE-ARTEFACT-1` provenance, regenerable on `CE-DIFF-1`, forkable/client-owned | Client engineering teams (consume the generated graph SDK), downstream apps generated by Build | [contracts §4](../../_inter-engine-contracts.md) | alpha |

---

## 6. Non-Functional Requirements

### Performance

- Project dashboard load: default ≤ 2 s (p95), tunable per environment SLO.
- Kanban with 50 tasks: default ≤ 1 s initial render, ≤ 100 ms lane-filter switch.
- Task detail panel open: default ≤ 500 ms (p95).
- Agent tool-use console: first token default ≤ 500 ms of agent action; subsequent tokens ≤ 200 ms.
- Request Studio generation: first section token default ≤ 2 s; full draft default ≤ 60 s (p95).
- Visual-state capture: default ≤ 30 s for 8 states per task.
- All performance numbers are configurable per-environment SLO targets, not hard product limits;
 they are baselines to validate, not traced requirements.

### Security

- **Outbound-prompt scrubber:** before any prompt reaches a model provider, a redaction pass
 removes secrets/PII (default patterns: SSN, `sk_live_*`-style API keys, sort codes, plus a
 domain blocklist), pattern set configurable per workspace. Test: a prompt seeded with a known
 secret token reaches the provider mock with the token redacted. (CLAUDE.md: never log/transmit PII.)
- **Sandbox agent controls:** writes to protected paths (credentials, `.env`, `~/.kube`, AWS
 config) are BLOCKED and logged to `PLAT-AUDIT-1`; **network egress is restricted to an
 allowlist**; **destructive bash is blocked** (`rm -rf`, `mkfs`, `dd`). Test: an attempted
 protected-path write, an off-allowlist egress, and a destructive bash each yield a BLOCKED audit
 entry and no side effect.
- **Generation gates** (E8-S1): SAST + package-existence + secret-scan run before any commit;
 secrets are AWS Secrets Manager references only — never plaintext in the data model or code.
- **Agent identity:** least-privilege principals from `PLAT-IDENTITY-1`; the no-self-approval
 invariant (FR-026) is enforced and tested (an agent attempting to approve its own gate is rejected
 and logged).

### Reliability

- Generation is **atomic per task**: a mid-pipeline failure commits nothing (E6-S2/E8-S1).
- Write-back is transactional against `CE-WRITE-1`'s clone-validate-or-422 semantics; a 422
 triggers feature-flag rollback so deployed state and graph never silently diverge (FR-035).
- Audit emission is **fail-closed**: a mutating agent action is refused if `PLAT-AUDIT-1` is
 unreachable (FR-027).
- Self-healing dispatch is idempotent (duplicate-append by signal-type+ARN) and re-opens on a
 configurable observation window (FR-039).

### Observability

- Every agent tool use emits an OTel span with attributes: `agent.principal_iri`, `tool`,
 `target`, `duration_ms`, `outcome`, `failure_class`.
- Every generation run emits: `spec_id`, `artefact_type`, `token_count_by_model`, `latency_ms`,
 SHACL result, secret-scan result, SAST result, mutation-score, conformance-score.
- Logs correlate by `project_iri` + `task_id` + `activity_iri` (the `CE-WRITE-1` PROV-O activity).

### Accessibility

- Kanban, task detail, spec editor: WCAG 2.1 AA; task-tree SVG nodes keyboard-navigable
 (Enter opens detail). Zero-violations gate (axe) on these surfaces in CI.

### Isolation & data safety

- **Multi-tenant isolation is required across every Build-touched store** — project records,
 decision-log view, secret references, generated repos, and graph write-back. The expected
 mechanism is **either store/schema-per-tenant OR a tenant partition key with row-level security**
 enforced through the `PLAT-SETTINGS-1` tenancy cascade; for graph access the mechanism is a
 named-graph + query-rewriting layer that **rejects unscoped queries**. The final mechanism is an
 Architect tech-spec decision (OQ-06), but the requirement holds now.
- **Cross-tenant-read test (required):** given a tenant-A principal, a request for any tenant-B
 project record, decision-log entry, or graph triple returns **zero** tenant-B data (the test
 fails the build if any leaks).

### Browser / device support

- Chrome, Firefox, Safari — latest 2 major versions. Desktop-first.

---

## 7. Key Design Decisions Captured

| Decision | Rationale |
|---|---|
| Request Studio (CTA "New Request") is the intake feature name | Locked rename of "Snappy"; descriptive, no codenames. |
| Three run modes incl. Spike (sandbox, no prod merge) | A sandbox mode that never reaches production is a distinct safety control (prototype run-mode selector). |
| Four-class retry taxonomy, not a flat 3-retry ceiling | Flat retries over-retry dependency/interface failures and futilely retry spec-ambiguity; the harness uses logic 3 / dep 1 / iface 1 / spec-ambiguity 0→replan. |
| Typed result block between agents | Prose-only handoffs are the deepest dark-factory fragility; a typed block lets the orchestrator branch deterministically and drives the retry taxonomy. |
| Generation gates make conformance measured, not asserted | "Compliant by construction" is unfalsifiable; SAST, type-check, mutation ≥70%, package-existence, and a ≥90% conformance bar vs `CE-BRAND-1` make it testable. |
| Write-back via `BE-ARTEFACT-1` → `CE-WRITE-1` only | The validated `POST /api/operations/apply` clone→SHACL→422 path is the sole mutation entry; the legacy `/api/llm/mutate` bypass is forbidden. |
| Decision log = view over `PLAT-AUDIT-1` | One platform-owned immutable audit/provenance service; Build emits events, keeps no independent signed store (A2). |
| E12 folds into Platform self-improvement | One Weave-product self-improvement subsystem, Platform-owned, via shared `BE-SELFIMPROVE-1`; Build's old proposal taxonomy removed (A3). |
| Client-app self-healing is always HITL | No autonomous merge; every dispatched fix passes deny→authority→automatable→HITL (D4). |
| No agent self-approval | Agents are least-privilege principals (`PLAT-IDENTITY-1`) that structurally cannot clear a gate their own action triggered. |
| Every numeric threshold is a configurable default | No bare confabulated numbers; budget caps, latency, conformance %, self-heal triggers, observation windows are "default X, tunable" (E4). |
| Task→model routing right-sizing, with a configurable provider+model layer | Opus = elicitation/architecture/security-review; Sonnet = PRD/flows/OpenAPI/code; Haiku = validation/lint/config; only confirmed model ids in generated config. Extended to a **configurable provider+model routing layer** (FR-045): `{role\|tier\|complexity}→{provider,model}` per environment, Ollama/Bedrock/Anthropic-API abstraction, Bedrock minimised, metered via `PLAT-BILLING-1`, policy via `PLAT-SETTINGS-1` — the dark-factory form of right-sizing (`_dev-environment.md` §3). |
| Bounded loop = turn cap **plus** cost cap | A cost cap (FR-008) does not stop a cheap-but-looping run; an orchestrator-enforced turn/iteration cap (FR-041) is the actual runaway-prevention control. Both bind independently. |
| PDAC lifecycle with non-skippable CODIFY | Without a mandatory CODIFY stage (FR-042) the dependency-summary handoff (FR-043) has nothing to carry forward and runs are not resumable; the four stages make every task planned, delegated, assessed, and recorded. |
| State spine is a typed contract, not a UI artefact | The kanban (E4) is the surface; the source of truth is a typed per-tenant state record with a `ready` resolver + `phase-complete` query (FR-044), committed after every task so a crashed run resumes from the last checkpoint. Re-platformed from a local file to a per-tenant DB table with RLS (OQ-06). |
| Defence-in-depth quality gates (DoR/DoD/spec-coverage/phase-gate) wrap generation | E8-S1 generation gates run pre-commit; FR-046/047/053/052 add task-entry readiness, mechanically-verified done, cumulative `Must`-coverage, and a phase ceremony with a human sign-off — quality enforced redundantly, not only at generation. |
| Dark-factory agent roster reconciled to the execution five | The PRD execution roster is Engineer/QA/Architect/**Review/Sandbox** (FR-022). In the reference harness "**Review**" is realised as the `/code-review` **skill** invoked by the Engineer/QA per commit (not a standing agent), and "**Sandbox**" maps to the prototyper/Spike sandbox agent. The harness's **product-owner** agent maps to **Request Studio** (Epic 1), not the execution roster. Tool scopes + turn caps + the QA tests-only boundary are per-role (FR-022). |
| Visual-state capture replaces "F25 visual test"; "council"→"Critic" | Undefined identifiers replaced with defined terms (8 named states + baseline diff; the reviewer is the Critic). |

---

## 8. Open Questions (for Tech Spec)

| # | Question | Owner |
|---|---|---|
| OQ-01 | Repository strategy: per-project repo vs workspace monorepo (and how Spike sandbox repos map) | Architect |
| OQ-02 | Dark-factory runtime: AWS Lambda (short tasks) vs ECS Fargate (long agent chains); per-task budget binding | Architect |
| OQ-03 | Visual-state capture implementation: Playwright vs Puppeteer; screenshot-diff baseline storage | Architect |
| OQ-04 | Audit signing/storage **algorithm and engine** — resolved jointly as Platform OQ-09 = Build OQ-04 (one decision); Build only consumes `PLAT-AUDIT-1` | Architect (Platform-led) |
| OQ-05 | Request Studio generation orchestration: single Opus pass vs multi-agent (PO + Critic + Architect) | Architect |
| OQ-06 | **Multi-tenant isolation mechanism** (store/schema-per-tenant vs partition-key + RLS; named-graph + query-rewriting for graph) — requirement + cross-tenant-read test stated in §6, mechanism deferred | Architect |
| OQ-07 | Jira federation transport (API poll vs webhook) and the Weave-task-id ↔ Jira-field mapping, over `PLAT-CONNECTOR-1` | Architect + Ops |
| OQ-08 | Anatomy/Wiki index build (AST + LLM summaries) and re-index trigger | Architect |
| OQ-09 | Anthropic Agent SDK runtime for generated agents (multi-turn vs single-turn; AgentCore fit) | Architect |
| OQ-10 | **Task-brief model choice** (the per-task default model the Architect assigns) — right-sizing table in §7 is the guide; the binding default is deferred | Architect |
| OQ-11 | **Context-retrieval/ranking at scale** — the prototype 200-node prompt cap is a known scale risk for entity reconciliation in large graphs; a retrieval/ranking strategy is needed | Architect |
| OQ-12 | **Ontology-bound function — shared primitive ownership.** Whether a single typed, graph-aware logic unit (one definition, bound to a CE object type) should be referenceable simultaneously as a Build SDK method (`BE-SDK-1`), an Events action (`EA-AUTOMATION-1`), and an agent tool — and **which engine owns** the primitive's definition, registry, and versioning if so (Build vs Events vs a CE-owned shared contract). Cross-engine; coordinate with Events OQ-13 and the PO. (P2) | Architect + PO (Build/Events) |

---

## 9. Acceptance Criteria (PRD-level)

The Build Engine PRD is satisfied when:

- [ ] A product owner clicks "New Request", picks a run mode, and a brief/PRD/tech spec stream into
 the editor; a blast-radius panel shows domains and `modify|consume|NEW` services from the
 pinned graph; generation timeout preserves a draft and creates no project.
- [ ] A cost estimate above the per-spec cap blocks project creation; within cap, all-approved
 stakeholder sign-off auto-creates a project with a pinned ontology version.
- [ ] A QA `fail` is classified; a spec-ambiguity failure routes to replan (never code-retried);
 a dependency failure retries at most once; the kanban retry chip reflects the per-class ceiling.
- [ ] An agent cannot approve a HITL gate its own action triggered; a self-approval attempt is
 rejected and logged to `PLAT-AUDIT-1`; production deploy requires the configured two-person + Critic gate.
- [ ] Generation commits nothing unless SAST, mypy/tsc, delta mutation ≥70%, package-existence,
 secret-scan, and ≥90% conformance vs `CE-BRAND-1` all pass; a slopsquatted package hard-blocks.
- [ ] Generated services write back only via `CE-WRITE-1` (`POST /api/operations/apply`); a `422`
 triggers a feature-flag rollback; no write uses the `/api/llm/mutate` bypass.
- [ ] The decision log renders as a view over `PLAT-AUDIT-1`; a mutating action is refused when the
 audit service is unreachable; a BLOCKED sandbox entry is present and undeletable.
- [ ] A prompt seeded with a secret reaches the provider mock redacted; an off-allowlist egress and
 a destructive bash each produce a BLOCKED entry with no side effect.
- [ ] A tenant-A principal requesting any tenant-B project record, decision-log entry, or graph
 triple receives zero tenant-B data.
- [ ] A CRITICAL signal raises an issue, notifies, and dispatch is offered — but auto-dispatch only
 proceeds past the deny→authority→automatable→HITL gate; no fix merges without a human.
- [ ] The Project Ontology screen embeds `GE-CANVAS-1` scoped to the project IRI (read-only) and
 degrades to a `CE-READ-1` entity list if the canvas is unavailable.
- [ ] No generated config contains a prototype placeholder model id (`sonnet-4-5`, `opus-4-1`).
- [ ] An autonomous run that loops cheaply still halts at the turn cap (default 60, tunable) and is
 resumable from its last completed CODIFY; the halt fires a `PLAT-NOTIFY-1` event.
- [ ] A task runs PLAN→DELEGATE→ASSESS→CODIFY; it reaches Done only after its dependency summary is
 written and the state spine is committed; a dependent task reads that summary in PLAN.
- [ ] A task that fails its DoR checklist is not dispatched; a task that fails any DoD item does not
 merge; QA runs every DoD command itself rather than trusting a self-report.
- [ ] At phase end the cumulative spec-coverage audit halts the phase unless ≥90% of `Must` items are
 DELIVERED and zero are MISSING; the phase-gate ceremony runs security-review + mutation + doc-gen
 and requires a human Approve/Amend/Reject.
- [ ] No build scaffolds until the pre-scaffold whole-spec review passes; scaffolding forces a human
 environment-verification gate before any feature task is dispatched.
- [ ] Dark-factory model routing resolves `{role|tier|complexity}→{provider,model}` per environment;
 an unreachable provider falls back per policy or halts (never silently invoking an unapproved
 model); a local-fidelity path is re-run on the Claude tier before the phase-gate sign-off.

---

## 10. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Build ships before CE write/brand/version contracts are GA | High | Med | Every CE-dependent FR tagged "CE GA"; consume contracts by ID; degrade gracefully on outage |
| Generated code carries vulnerabilities / fictitious deps | High | High | SAST + package-existence hard-block + mutation ≥70% as pre-commit gates (E8-S1) |
| Cross-tenant data leak across Build stores | High | Med | Isolation NFR + cross-tenant-read test; mechanism deferred to OQ-06 with the test stated now |
| PII/secrets reach a model provider | High | Med | Outbound-prompt scrubber (configurable patterns) + provider-mock redaction test |
| Autonomous self-heal merges an unsafe fix | High | Low | Always-HITL (D4) + deterministic deny→authority→automatable→HITL gate sequence |
| Unsourced thresholds calcify into false requirements | Med | High | All numbers are "default X, tunable" assumptions flagged for PO validation (E4) |
| Confused self-improvement ownership recreates the E12 overlap | Med | Med | E12 folded to Platform; Build provides `BE-SELFIMPROVE-1` only; proposals surface read-only |
| 200-node retrieval cap limits reconciliation in large graphs | Med | Med | Flagged as OQ-11; retrieval/ranking strategy required in tech spec; isolated investigator runs (FR-051) keep orchestrator context clean |
| A cheap autonomous run loops indefinitely under the cost cap | High | Med | Orchestrator turn/iteration cap (FR-041) binds independently of the cost cap; halt to HITL with resumable state |
| A phase closes with a silently-missing `Must` requirement | High | Med | Cumulative spec-coverage audit (FR-053) halts the phase on any MISSING `Must`; phase-gate ceremony (FR-052) requires a human sign-off |
| An unverified or incomplete spec is built before it is ready | Med | Med | DoR gate (FR-046), pre-scaffold spec-review gate (FR-055), and scaffolding HITL gate (FR-050) catch unready inputs before tokens are spent |
| Bedrock spend balloons across the dark factory | Med | Med | Configurable provider+model routing (FR-045) minimises Bedrock, routes simpler work to Ollama; metered per provider via `PLAT-BILLING-1` |

---

## Related

- [Brief](../01-brief/brief.md)
- [Inter-engine contracts](../../_inter-engine-contracts.md)
- [Constitution Engine PRD](../../constitution-engine/02-prd/prd.md) — upstream graph source + validation (`CE-*`)
- [Graph Explorer PRD](../../graph-explorer/02-prd/prd.md) — `GE-CANVAS-1` project-ontology embed
- [Weave Platform PRD](../../weave-platform/02-prd/prd.md) — `PLAT-*` shared services; owns Weave-product self-improvement
- [Events & Actions Engine PRD](../../events-engine/02-prd/prd.md) — `EA-AUTOMATION-1`; business-process automation boundary

---
*Generated by Weave PO agent. Review and approve before proceeding to Roadmap.*
