---
type: Product Brief
title: Events & Actions Engine — Product Brief
description: "Brief for the Weave Events & Actions Engine — graph-change and external-event triggered governed automations."
tags: [events-actions-engine, 01-brief, automation, events]
timestamp: 2026-06-30T00:00:00Z
resource: docs/specs/events-actions-engine/01-brief/brief.md
source: hand-authored
confirmed_by: none
confirmed_on: null
last_verified_sha: 61dfc1553b18b5762902e1d2b3681c82f4ebb26c
expires_on: 2026-12-27
owner: gazzwi86
coverage: n/a
---

# Brief: Events & Actions Engine

## Mission Statement

We are building the Weave Events & Actions Engine — the automation layer that makes the
company reactive — so that events in the company's integrated systems (a delivery arriving at
a store, a Jira ticket changing state, a webhook firing, a scheduled time) automatically
trigger governed actions — notifications, API calls, agent runs, or graph updates — grounded
in the company's documented processes and rules, with changes inside the graph itself
available as an additional trigger source. This replaces brittle, hand-wired point-to-point
integrations with automation the business can see, reason about, and trust.

## Problem

Companies automate today with tools that are either too shallow, too ungrounded, or too
expensive — and none of them understand the business they are automating.

- **Consumer automation is too shallow.** Tools like IFTTT offer single-step
 "if-this-then-that" applets with no multi-step logic, no governance, and no model of the
 organisation — unusable for real business processes.
- **Developer iPaaS is powerful but ungrounded.** Tools like n8n, Zapier, and Make support
 multi-step workflows, branching, and hundreds of integrations, but every workflow is
 hand-wired against raw APIs with no shared model of the business. The automation has no
 semantic understanding of *what* it is acting on, no link to documented processes, and no
 built-in compliance — so it drifts into brittle, undocumented spaghetti that no one can
 reason about or govern.
- **Ontology-grounded automation exists only at the top end.** Palantir Foundry does it
 right — automations trigger on typed ontology conditions and run governed, typed Actions
 defined on the model — but it is an enterprise-only, heavyweight, high-cost platform out of
 reach for the mid-market.

The result is that the events flowing through a company's integrated systems (a delivery
arriving, a ticket changing state, a constraint being breached) are either ignored or wired
into automations that no one trusts, because nothing connects those automations to the
company's actual processes, rules, and regulatory obligations.

The people who feel this are **operations and process owners** (who know the process but get
brittle, opaque automations) and **the compliance and risk functions** (who cannot prove
that automated actions follow policy). If this is not solved, Weave's graph describes how the
company should react — but the reactions themselves stay manual or ungoverned, and the
"automate" third of model → generate → automate never materialises.

## Vision

Within 12 months, success for the Events & Actions Engine looks like:

- **Integrated-system events drive real automations.** An event in a connected system — a
 delivery arriving, a ticket changing state, a webhook, a schedule — triggers a governed
 action (a Slack notification, an API call, an agent run, a graph update) that runs a genuine
 business process end to end.
- **Automations are grounded, so they are predictable and high-quality.** Each automation is
 defined against the company's ontology, documented processes, and rules, so it acts on typed,
 understood entities and stays within policy — not hand-wired against raw APIs.
- **Natural-language authoring is the biggest advantage.** A user describes an automation in
 plain language that references the model directly — for example, "send a Slack notification
 to channel X whenever a delivery arrives, to automate this step of the goods-inwards process
 (the referenced BPMO `Process`/`Activity`) in the ontology" — and an AI agent builds it,
 grounded in the exact process step it points at. A visual, n8n-style flow canvas complements
 this for
 inspection and manual alteration, and the two representations stay in sync.
- **A two-tier automation model.** Simple flows are declarative JSON (runtime-interpreted);
 complex flows are Anthropic Agent SDK agentic actions/triggers (reasoning, multi-step),
 supported in v1 (`EA-AUTOMATION-1`). Execution is interpreter-first; a portable, downloadable
 Agent-SDK artefact export (skills, commands, agents) is a fast-follow — agentic capability is
 in v1, only the downloadable-artefact promise follows.
- **Compliance is provable.** Because automations are grounded in the Constitution's rules and
 obligations, the compliance and risk functions can see and prove that automated actions
 follow policy, with a full audit trail.
- **Graph changes are an optional trigger too.** Where useful, a change inside the graph
 (a node added, a constraint violated) can also trigger an automation — a secondary
 convenience layered on top of the primary integrated-system event model.

## Scope

### In Scope

**Triggers (event sources)**

- **Primary — integrated-system events:** webhooks, Atlassian (Jira + Confluence), ServiceNow,
 Slack, cron/schedule, and similar events from the platform-managed connectors. The v1 managed
 connector set is the 7 platform connectors (Snowflake, Databricks, S3, Azure Data Lake,
 Atlassian, ServiceNow, Slack) — Slack is a **platform-managed connector** (`PLAT-CONNECTOR-1`),
 not engine-owned. (Specific connector priority is deferred to the roadmap.)
- **Secondary — graph-change triggers:** a node added, a relationship changed, or a
 constraint violated inside the graph may also trigger an automation — a convenience layered
 on top of the primary model, not the focus.

**Authoring (natural-language-first)**

- A conversational AI automation builder where the user describes an automation in plain
 language that references the model directly — specific BPMO entities: a `Process`, an
 `Activity` (a step within a process), an `Event`, or a governing `Policy` in the ontology —
 and an agent creates or edits it, grounded in what was referenced.
- A visual, n8n-style flow canvas that visualises the automation and allows manual
 inspection and alteration, kept in sync with the conversational representation.

**Automation model (two-tier — `EA-AUTOMATION-1`)**

- Simple tier: declarative JSON (event → action), runtime-interpreted. Complex tier: Anthropic
 Agent SDK agentic actions/triggers (reasoning, multi-step), supported in v1.
- Execution is interpreter-first in v1; a portable, downloadable Agent-SDK artefact export
 (skills, commands, agents — versioned, reusable, `pip`-installable) is a fast-follow.
- Every automation is grounded in the company's ontology, documented processes, and rules, so
 it acts on typed, understood entities and stays within policy.

**Actions (effects)**

- Notifications (e.g. Slack), API calls and webhooks to external systems, agent runs, and
 graph updates, with HITL approval gates available for sensitive actions.

**Governance & observability**

- An audit trail of every automation run (trigger, decision, action, outcome) and compliance
 grounding so the risk function can prove automated actions follow the Constitution's rules
 and obligations.

### Out of Scope

- **Authoring the ontology — the BPMO `Process`/`Activity`/`Event` model, `Policy` rules, or
 any other kinds — itself** — that is the Constitution Engine; the Events Engine consumes and
 references them via `CE-READ-1`.
- **Self-healing of built products and the dark factory, and engine self-improvement** — those
 live in the Build Engine. This engine automates the *business*, not Weave's own delivery.
- **Generating apps, agents, or pipelines as shipped products** — the Build Engine. (Automations
 here use the Agent SDK as operational automation, not as delivered software products.)
- **The org-wide graph visualisation and collaborative canvas** — Graph Explorer. The flow
 canvas here is automation-specific, not the company network view.
- **Building net-new managed connector infrastructure** — connectors are a platform-level
 managed capability this engine consumes; system-wide compliance checking of apps and
 integrations beyond automation runs is a related cross-cutting concern, not owned here.

## Target Users

| User Type | Description | Primary Need |
|-----------|-------------|--------------|
| Operations / process owner | Owns a business process and wants its reactions automated | To automate a process step in plain language, grounded in the documented process, without code |
| Automation author / business analyst | Builds and maintains automations across processes | Natural-language authoring plus a visual canvas to refine, test, and manage automations |
| Compliance / risk officer | Accountable for automated actions following policy | Proof that every automation follows the Constitution's rules, with a full audit trail |
| Integration / platform engineer | Manages connectors and complex multi-step automations | Reliable event sources and action targets and control over branching, error handling, and retries |
| Process participant / domain staff | Recipient or actor of automated actions (e.g. a store manager) | Timely, reliable, correctly-targeted actions (e.g. the right Slack notification) |

## Success Criteria

- [ ] **An automation runs end to end from a real event.** An event in an integrated system
 triggers a governed action (e.g. a Slack notification, API call, or agent run) that
 completes a genuine business process step. Measured by automation run logs; source: the
 engine's run history. Target: within 6 months of the engine's first release.
- [ ] **Natural-language authoring works and is grounded.** A user creates a working
 automation by describing it in plain language that references a specific BPMO `Process` or
 `Activity` (or a governing `Policy`), with no manual coding, and the resulting automation is
 linked to the element it referenced. Measured by authoring telemetry and the automation-to-ontology
 link; source: application analytics. Target: 30 days after GA.
- [ ] **The two representations stay in sync.** An automation authored conversationally is
 viewable and editable on the visual canvas and vice versa, with changes consistent across
 both. Measured by functional test and user sessions; source: QA + analytics. Target: at
 GA.
- [ ] **The two-tier model works; portable export is a fast-follow.** v1 runs simple declarative
 automations (interpreted) and complex Agent-SDK agentic actions; the downloadable, versioned
 Agent-SDK artefact export (skill, command, or agent) lands as a Phase-2 fast-follow.
 Measured by run logs (v1 tiers) and the artefact store (Phase-2 export); source: the run
 history + automation registry. Target: tiers at GA; export Phase 2.
- [ ] **Compliance is provable.** For at least one regulated process, the risk function can
 produce an audit report showing automated actions followed the Constitution's rules, with
 100% of automation runs logged. Measured by an audit report and log completeness; source:
 the audit trail. Target: within 6 months of first release.

## Constraints

**Technical**

- Two-tier automation model (`EA-AUTOMATION-1`): simple declarative JSON (interpreted) + complex
 Anthropic Agent SDK agentic actions/triggers, consistent with the Build Engine's agent SDK
 decision. Interpreter-first in v1; portable artefact export is a fast-follow.
- Every automation must be grounded in the ontology — it references a BPMO `Process`,
 `Activity`, or governing `Policy` (the rule that `governedBy` links to that process);
 orphan automations with no link to the model are not allowed.
- Each automation targets a specific published ontology version (pinned), so that ontology
 evolution does not silently break a live automation; upgrading the pin is a deliberate
 action.
- Actions that affect external systems are governed; sensitive actions require an HITL
 approval gate before they fire.
- Event handling must be reliable: at-least-once delivery with idempotent actions, plus retry
 and error handling, so triggers are neither lost nor double-applied harmfully.
- The audit trail is the platform-owned immutable service (`PLAT-AUDIT-1`); this engine EMITS
 typed run/step events to it and its run-log is a VIEW — it keeps no independent signed store.
- Connectors are a platform-managed capability the engine consumes (`PLAT-CONNECTOR-1`, incl.
 Slack); secrets and credentials are held in AWS Secrets Manager, never in automation definitions.

**Business**

- Usage-based revenue is metered via `PLAT-BILLING-1` on BOTH dimensions: automation execution
 **per-run** and AI generation/agent usage **per-token**; runs must be metered (per-run) and
 agent token usage forwarded (per-token).
- Weave remains the source of truth even when an automation federates with external tools
 (e.g. Jira, ServiceNow).

**Timeline / sequencing**

- The engine depends on the Constitution Engine (it needs the ontology, documented processes,
 and rules to ground automations) and ships after it.
- Integrated-system events are the primary trigger model; graph-change triggers are a
 secondary convenience and must not be the primary load.
- Specific connector priority is deferred to the roadmap.

## Key Decisions

For the platform-wide master list see `CLAUDE.md § Architecture decisions (confirmed)` and
the `weave-platform` brief. Decisions specific to the Events & Actions Engine:

| Decision | Rationale | Date |
|----------|-----------|------|
| Integrated-system events are the primary trigger; graph-change triggers are a secondary convenience | The value is reacting to what happens in the real connected systems; internal graph triggers are a useful add-on, not the focus | 2026-06-26 |
| Natural-language-first authoring, with the NL able to reference BPMO `Process`/`Activity` entities (and governing `Policy`) directly | This is the engine's biggest advantage — describe an automation grounded in a specific documented process, no code | 2026-06-26 |
| A visual, n8n-style flow canvas complements NL authoring, kept in sync | Gives inspection and manual control alongside conversational authoring | 2026-06-26 |
| Two-tier automation model (`EA-AUTOMATION-1`): simple declarative (interpreted) + complex Agent SDK agentic; interpreter-first, portable export a fast-follow | Ships agentic capability in v1 while relaxing the downloadable-artefact promise to "export follows"; consistent with the Build Engine's agent SDK choice | 2026-06-30 |
| No orphan automations — every automation is grounded in the ontology | Grounding in documented processes and rules is what makes automations regulated, predictable, and high-quality (vs ungrounded iPaaS) | 2026-06-26 |
| Compliance is provable via an append-only audit trail | The risk function must be able to prove automated actions follow policy | 2026-06-26 |
| Boundary with the Build Engine | This engine automates the business; the Build Engine self-heals its own products and factory | 2026-06-26 |
| Positioning: Foundry-style ontology-grounded, governed actions plus n8n-style multi-step power, for the mid-market | Combines the rigour of Palantir Automate with practical workflow flexibility, at a tier Foundry does not serve | 2026-06-26 |
| Automations pin to a specific published ontology version | Prevents ontology evolution from silently breaking live automations; versioning lifecycle owned by Constitution Engine | 2026-06-26 |
| Connector priority deferred to the roadmap | Ordering is a sequencing decision better made with roadmap context | 2026-06-26 |

## Navigation

First-draft **secondary navigation** (left sidebar) for the **Automate** primary area. The
primary top-header nav is defined in the `weave-platform` brief.

- **Automations** — list of automations with status (active/draft/paused) and recent runs.
- **Builder** — create or edit an automation, natural-language-first with the visual n8n-style
 flow canvas alongside (the two stay in sync).
- **Runs / history** — run log: trigger, decision, action, outcome per execution.
- **Triggers & connectors** — configured event sources and action targets (webhooks, Atlassian,
 ServiceNow, Slack, cron) and their `PLAT-CONNECTOR-1` health.
- **Templates / library** — reusable automation patterns.
- **Audit & compliance** — the append-only audit trail and compliance reporting for regulated
 processes.
- **Automate settings** — defaults, rate limits, pinned ontology version, and approval policies.

---
*Generated by Weave PO agent. Review and approve before proceeding to PRD.*

# Related

- [Weave Platform — Product Brief](../../weave-platform/01-brief/brief.md)
