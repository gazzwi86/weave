---
type: PRD
title: Events & Actions Engine — Product Requirements Document
description: "Full product requirements for the Weave Events & Actions Engine: ontology-grounded two-tier automations (simple declarative + Agent-SDK agentic), NL-first authoring, visual flow canvas, governed actions, a reliable run engine, and compliance reporting over the platform audit trail."
tags: [events-actions-engine, 02-prd, automation, events, agent-sdk, compliance]
status: Draft
timestamp: 2026-06-30T00:00:00Z
resource: docs/specs/events-actions-engine/02-prd/prd.md
# --- provenance block (merged per frontmatter-schema.md) ---
source: hand-authored
confirmed_by: none
confirmed_on: null
last_verified_sha: 61dfc1553b18b5762902e1d2b3681c82f4ebb26c
expires_on: 2026-12-27
owner: gazzwi86
coverage: n/a
---

# PRD: Events & Actions Engine

**Brief:** [brief.md](../01-brief/brief.md)
**Status:** Draft
**Phase:** MVP (Constitution-Engine-grounded core) · Phase 2 (graph-change triggers, portable artefact export, advanced composition)
**Owner:** gazzwi86 · **Last Updated:** 2026-06-30

> **DRAFT** — not yet human-confirmed (`confirmed_by: none`).

---

## 1. Product Context

### Background

Companies automate today with tools that are either too shallow (IFTTT), too ungrounded
(n8n / Zapier / Make — powerful but hand-wired against raw APIs with no model of the business),
or too expensive (Palantir Foundry — ontology-grounded, but enterprise-only). The result: the
events flowing through a company's integrated systems either go ignored or get wired into
automations that no one trusts, because nothing connects those automations to the company's
documented processes, obligations, and rules.

The Events & Actions Engine closes this gap. Its positioning: **Foundry-style ontology-grounded,
governed actions combined with n8n-style multi-step flexibility — for the mid-market**.

Two ideas make it different from every iPaaS on the market:

1. **Grounding** — every automation is linked to a specific entity in the Constitution Engine
 graph — a BPMO `Process`, an `Activity` (a step within a process), or a governing `Policy`
 (the rule a process is `governedBy`) per `CE-READ-1` — and pinned to a published version via
 `CE-VERSION-1`. Automations act on typed, understood entities and stay within the company's
 documented policies. No orphan automations.
2. **Natural-language-first authoring** — a user describes an automation in plain language that
 references the model directly ("send a Slack notification to channel X whenever a delivery
 arrives, following the goods-inward receipt process") and an AI agent builds it, grounded in
 the exact process step it pointed at. A visual n8n-style flow canvas complements this for
 inspection and manual control, and both representations are projections of one canonical
 automation definition.

Automations are realised through the two-tier model in `EA-AUTOMATION-1`: a **simple tier**
(declarative JSON, runtime-interpreted) and a **complex tier** (Anthropic Agent SDK agentic
actions/triggers for reasoning and multi-step work, supported in v1). Execution is
**interpreter-first** in v1; a portable, downloadable Agent-SDK artefact export is a **fast-follow**
(Phase 2). Agentic capability is NOT deferred — only the downloadable-artefact promise is.

### Goals

1. Let an operations owner automate a business process in plain language, grounded in the
 documented process (via `CE-READ-1`), with no code required.
2. Ensure every automation is traceable to a BPMO `Process`/`Activity` or governing `Policy` — no
 orphan automations.
3. Provide a visual flow canvas for inspection and fine-grained control that is a projection of
 the same canonical definition as the chat (single source of truth, no divergent edit model).
4. Give the compliance function proof that automated actions followed the Constitution's rules,
 served as a filtered VIEW over the platform audit trail (`PLAT-AUDIT-1`) — 100% of runs logged.
5. Run automations reliably — at-least-once delivery, per-step idempotency, retry, and DLQ.
6. Meter every automation run via `PLAT-BILLING-1` (per-run dimension) so usage-based billing is
 accurate.

### Non-Goals

| Non-goal | Owner instead |
|---|---|
| Authoring the ontology — the BPMO `Process`/`Activity`/`Event` model, `Policy` rules, or any other kinds | Constitution Engine (CE) |
| Building or operating managed connector infrastructure / credentials / ingestion | Platform (`PLAT-CONNECTOR-1`) |
| Self-healing of built products or the dark factory (`BE-SELFIMPROVE-1`) | Build Engine (E11) / Platform self-improvement |
| Generating shipped apps, agents, or pipelines as delivered software products | Build Engine (`BE-ARTEFACT-1`). Automations here use the Agent SDK for *operational* automation only |
| The org-wide graph visualisation / collaborative canvas | Graph Explorer (`GE-CANVAS-1`). The flow canvas here is automation-specific |
| Owning the immutable audit/provenance store | Platform (`PLAT-AUDIT-1`). This engine EMITS run/step events; its run-log is a view |
| Owning the notification delivery service | Platform (`PLAT-NOTIFY-1`). This engine publishes notification events |
| Owning agent service-principal identity | Platform (`PLAT-IDENTITY-1`). This engine requests per-automation principals |

---

## 2. Personas & Roles

| Persona | Description | Primary need | Permission level |
|---|---|---|---|
| Operations / process owner | Owns a business process, wants its reactions automated | Automate a process step in plain language, grounded in the documented process, no code | author |
| Automation author / business analyst | Builds and maintains automations across processes | NL authoring + visual canvas to refine, test, version, and manage automations | author / publish |
| Compliance / risk officer | Accountable for automated actions following policy | Proof, via audit reports, that every run followed CE rules | read (audit) |
| Integration / platform engineer | Manages connector references, complex multi-step automations | Reliable event sources/targets and control over branching, retries, error handling | author / admin |
| Process participant / domain staff | Recipient/actor of automated actions (e.g. store manager) | Timely, reliable, correctly-targeted actions (e.g. the right Slack notification) | read |
| Workspace admin | Governs automation defaults/limits in a workspace | Set defaults, rate limits, retention, HITL thresholds within the platform settings cascade | admin |

> Role slugs align with the platform RBAC model resolved through `PLAT-SETTINGS-1`. Agent
> (non-human) actors are service principals minted by `PLAT-IDENTITY-1`, never human roles.

---

## 3. User Stories

### Epic 1: Automation Registry

**E1-S1: Browse all automations**
As an **automation author**, I want to see all automations in a list with status and recent run
data so that I can manage my automation library at a glance.
- **AC:** Given a workspace with automations, when I open Automate → Automations, then each row
 shows name, status chip (Active/Draft/Paused), trigger-type icon, linked CE entity (label + IRI,
 resolved via `CE-READ-1`), pinned ontology version (`CE-VERSION-1`), last run (relative ts),
 7-day run count, and Edit/Pause/Delete buttons. Filters: All/Active/Draft/Paused/Mine; sort by
 last run, run count, name; search by name or linked entity.
- **AC:** Given the CE read interface (`CE-READ-1`) is unavailable, when the list renders, then
 rows still display from the engine's own store and the CE-derived label shows a "CE unavailable —
 showing cached label" badge rather than failing the whole list.
- **Priority:** Must Have

**E1-S2: Automation health indicators**
As an **automation author**, I want health indicators on each automation card so that I can spot
failures and stale version pins without opening each automation.
- **AC:** Given an automation whose last run exhausted retries, when the card renders, then a red
 dot + "Last run failed (N retries exhausted)" tooltip appears.
- **AC:** Given an automation whose pin lags the latest published version by ≥ the canonical
 staleness threshold (`CE-VERSION-1`; default lag ≥ 2, tunable per workspace), when the card
 renders, then an amber "Pin stale — N versions behind" chip appears.
- **AC:** Given a connector the automation depends on reports `degraded`/disconnected via
 `PLAT-CONNECTOR-1` health-status, when the card renders, then a warning chip appears.
- **AC:** Given the `PLAT-CONNECTOR-1` health API itself errors, when the card renders, then the
 chip shows "connector health unknown" (fail-visible, not silently green).
- **Priority:** Must Have

### Epic 2: Natural-Language Automation Builder

**E2-S1: Describe an automation in plain language, grounded in the ontology**
As an **operations owner**, I want to describe an automation in natural language that references a
specific BPMO `Process` or `Activity` (or a governing `Policy`) in my company's ontology so that the
AI builds it grounded in my actual documented process — not hand-wired against raw APIs.
- **AC:** Given the Builder is open in split-pane (chat left, canvas right), when I type a
 description (e.g. "When a delivery arrives at any Hammerbarn store, send a Slack notification to
 the #goods-inward channel for that store, following the goods-inward receipt process"), then the
 AI (claude-opus-4-8) resolves the referenced CE process via `CE-READ-1` (`GET /api/sparql`,
 SELECT-only, paginated), resolves related entities, and drafts a simple-tier automation
 (Webhook → Slack notification) with grounding `weave:Process/goods-inward-receipt-process` pinned
 via `CE-VERSION-1`.
- **AC:** Given the description is ambiguous and matches multiple processes, when the AI cannot
 resolve a single entity, then it asks ONE clarifying question inline (not a modal); after a
 default of 3 unresolved clarification rounds (tunable per workspace) it falls back to the
 explicit "Link to ontology" searcher (E6-S1) rather than looping.
- **AC (failure mode):** Given the `CE-READ-1` SPARQL lookup times out or returns 5xx, or the
 referenced entity exists only in a draft (unpublished) version, when the AI attempts to ground,
 then it does NOT fabricate an IRI — it surfaces "couldn't reach / resolve the ontology; the
 process may need publishing in the Constitution Engine first" and leaves the draft ungrounded
 (and therefore non-activatable per E6-S1).
- **Priority:** Must Have

**E2-S2: Refine an automation through the chat**
As an **automation author**, I want to refine a draft automation by typing follow-up instructions
so that I can iterate without switching to the canvas.
- **AC:** Given a draft automation, when I type a follow-up (e.g. "add a HITL approval gate before
 the Slack notification for deliveries over the high-value threshold"), then the canonical
 definition is updated transactionally and the canvas re-projects with a diff summary in chat.
- **AC:** Given any AI draft action, when I click "Undo last AI change", then the canonical
 definition reverts to the prior committed state and both views re-project.
- **AC (failure mode):** Given the AI edit fails validation against the definition schema, when the
 apply is attempted, then the canonical definition is left unchanged and the chat shows the
 specific validation error — no partial/torn write to the definition.
- **Priority:** Must Have

**E2-S3: Save as Draft, Test, and Activate**
As an **automation author**, I want to save a draft, dry-run it, and activate it when ready so that
I can test and review before it goes live.
- **AC:** Given a draft, when I click "Save as Draft", then the canonical definition is persisted
 and the automation does not run.
- **AC:** Given a draft, when I click "Test" with a sample event payload, then it runs in dry-run
 mode (no real external calls, no `CE-WRITE-1` commit, no metering) and shows the expected result.
- **AC:** Given I click "Activate", then activation validation runs: (a) a grounding link resolves
 to an entity present in a PUBLISHED version via `CE-READ-1`/`CE-VERSION-1`; (b) all required
 trigger/action fields are populated; (c) the secret-scan (E2 / FR-008) passes; (d) any
 high-value action carries a HITL gate (Security NFR). On pass, the automation is published and
 begins running.
- **AC (failure mode):** Given the secret-scan service is unavailable at activation, when Activate
 is clicked, then activation is **fail-closed** (blocked) with "secret-scan unavailable — cannot
 activate" — never fail-open.
- **AC (failure mode):** Given the grounding IRI does not resolve in the pinned published version,
 when Activate is clicked, then activation is blocked with "grounding entity not found in the
 selected published version".
- **Priority:** Must Have

### Epic 3: Visual Flow Canvas

**E3-S1: Visual flow canvas with the full node set**
As an **automation author**, I want a visual flow canvas showing trigger, condition, action, gate,
and control nodes so that I can inspect and edit the automation without reading JSON.
- **AC:** Given an automation definition, when the canvas renders, then it draws a directed acyclic
 graph with node types: Trigger (webhook / Jira / ServiceNow / Slack / cron / graph-change),
 Condition (if/else on an entity property or ontology attribute), Action (Slack notification /
 API call / agent run / graph update / sub-automation), HITL Gate (approvers + deadline),
 Error Handler (retry + on-failure), End.
- **AC:** Given the canvas, when I interact with it, then it is zoomable, pannable, keyboard-
 navigable (Tab cycles nodes, Enter opens inspector, Escape closes), shows a minimap when content
 overflows the viewport, has a fit-to-view control, and exports the current view as PNG. Exact
 input bindings are deferred to the design spec (OQ-08).
- **AC (failure mode):** Given a definition with a cycle or a disconnected node, when the canvas
 validates, then the offending nodes are highlighted and Activate is blocked with "automation
 graph must be acyclic and fully connected".
- **Priority:** Must Have

**E3-S2: Canvas and chat are projections of one canonical definition**
As an **automation author**, I want canvas edits and chat edits to never diverge so that neither
representation is stale.
- **AC:** Given the canonical automation definition (one JSON document) is the single source of
 truth and both chat and canvas are projections over it, when I make a canvas edit (node property,
 node add/remove, edge change), then it is applied as a transaction against the definition and the
 chat shows "Canvas updated — [diff]".
- **AC:** Given an AI edit from chat, when applied, then the canvas re-projects within a default of
 500 ms (ASSUMPTION — tunable; confirm in tech spec) with a "Syncing…" indicator while in flight.
- **AC (failure mode / conflict):** Given a canvas edit and an AI edit target the definition
 concurrently, when both attempt to commit, then the definition uses last-writer-wins with an
 optimistic version token; the losing edit is rejected and its author shown the diff to re-apply.
 No silent merge.
- **Priority:** Must Have

### Epic 4: Trigger Sources

**E4-S1: Configure webhook triggers**
As an **integration engineer**, I want to configure a webhook trigger so that any external system
that can POST HTTP can trigger an automation.
- **AC:** Given a webhook trigger node, when configured, then the engine issues an endpoint URL
 whose path embeds an **opaque tenant+automation token** resolved server-side; the inbound request
 is mapped to its tenant via that token BEFORE any tenant-scoped resource is touched (tenant is
 NEVER inferred from the request body). The node inspector shows a copyable URL and a "Send test
 event" pane; the event schema is auto-inferred on first test or specified manually.
- **AC (security):** Given any automation whose webhook drives a write or external action, when it
 is activated, then HMAC-SHA256 verification is **REQUIRED** (secret in AWS Secrets Manager, never
 in the definition) — it is optional only for read-only/no-side-effect automations.
- **AC (failure mode):** Given an inbound payload with a bad/absent HMAC (where required), an
 unresolvable token, an oversized body (> default 256 KB, tunable per tenant), or a payload that
 does not match the inferred schema, when it is received, then it is rejected and routed to DLQ
 with a typed reason ("signature invalid" / "unknown endpoint" / "payload too large" / "schema
 mismatch"); per-endpoint rate limiting applies (default 100 req/min, tunable per tenant).
- **Priority:** Must Have

**E4-S2: Jira/Confluence (Atlassian) and ServiceNow triggers**
As an **integration engineer**, I want to trigger automations from Atlassian and ServiceNow events
so that Weave automations can respond to external ticketing systems.
- **AC:** Given a configured Atlassian connector (`PLAT-CONNECTOR-1`, one OAuth family covering
 Jira + Confluence), when I add a Jira trigger, then event types issue created/updated/
 status-changed-to-[value]/comment-added are selectable with filters (project key, issue type).
- **AC:** Given a configured ServiceNow connector (`PLAT-CONNECTOR-1`), when I add a ServiceNow
 trigger, then incident created/state-changed and change-request state-changed are selectable with
 filters (category, assignment group).
- **AC (failure mode):** Given the connector is unconfigured or reports `degraded` via the
 `PLAT-CONNECTOR-1` health-status read API, when I try to activate, then activation is blocked and
 the trigger node shows the connector status; the engine does NOT operate its own connector or
 hold credentials.
- **Priority:** Must Have

**E4-S3: Slack and cron triggers**
As an **integration engineer**, I want to trigger automations on a schedule or from a Slack event
so that time-based and Slack-native workflows are supported.
- **AC:** Given a cron trigger, when configured, then it accepts cron syntax with a human-readable
 preview, interval (every N min/hours), and calendar-based (first/next business day) modes.
- **AC:** Given the **platform-managed Slack connector** (`PLAT-CONNECTOR-1`; Slack is one of the 7
 v1 managed connectors, token in AWS Secrets Manager), when I add a Slack trigger, then "message in
 channel (optional keyword filter)" and "slash command" event types are selectable.
- **AC (failure mode):** Given the Slack connector reports `degraded`, when a Slack-triggered
 automation is active, then inbound Slack events are buffered to the run queue if the connector
 delivery interface still delivers, else the automation is auto-flagged "connector degraded" via a
 `PLAT-NOTIFY-1` event and runs are not silently lost.
- **Priority:** Must Have

**E4-S4: Graph-change triggers (secondary)**
As an **automation author**, I want to trigger automations from changes inside the company graph so
that internal model changes can drive reactions.
- **AC:** Given a graph-change trigger, when configured, then entity-type + event (added / property
 updated / deleted / constraint-violated) + filter (property or SHACL shape) are selectable, and
 the trigger consumes the Constitution Engine change stream `CE-EVENT-1`
 (`{change_type, entity_iri, version_iri, actor, ts}`). The UI labels this trigger "Secondary".
- **AC (degradation):** Given `CE-EVENT-1` transport is not yet available (transport deferred to CE
 tech-spec), when a graph-change trigger is active, then the engine **degrades to polling**
 `CE-READ-1` with a since-version diff and accepts the higher latency — there is NO claim of a
 push-only path. Graph-change triggers are therefore **Should Have** and depend on CE.
- **AC:** Given high-frequency entity types, when graph-change automations are created, then a
 per-workspace cap (default 10 graph-change automations, tunable; the real constraint is event
 volume) prevents runaway load.
- **Priority:** Should Have (depends on `CE-EVENT-1`)

### Epic 5: Action Types

**E5-S1: Slack notification action**
As an **automation author**, I want to send a Slack notification so that process-relevant events
notify the right people on the right channel.
- **AC:** Given a Slack Notification action, when configured, then the target (channel or a person
 from the graph's `Person.slack_id`) and a rich-text body with `{{entity.property}}` interpolation
 against the triggering entity are set, with an inline preview; delivery is via the
 platform-managed Slack connector (`PLAT-CONNECTOR-1`) and/or `PLAT-NOTIFY-1` (Slack channel),
 with the bot token held in AWS Secrets Manager and never shown in the definition.
- **AC (failure mode):** Given Slack delivery fails (rate-limited / channel gone / connector
 degraded), when the action runs, then it follows the Error Handler retry policy then DLQ; the
 per-step idempotency marker (E8-S1) prevents a re-send of an already-delivered message on retry.
- **Priority:** Must Have

**E5-S2: API call / outbound webhook action**
As an **integration engineer**, I want to make an outbound HTTP call so that automations can update
external systems beyond managed connectors.
- **AC:** Given an API Call action, when configured, then method, URL (with interpolation), headers
 (with Secrets Manager references for auth — never inline secrets), and JSON body are set;
 optionally the response is mapped (JSONPath → target entity property IRI) for a follow-on graph
 update via `CE-WRITE-1`. A "Run test call" performs a dry run with no graph commit.
- **AC (security):** Given an interpolated value resolves to a secret at run time, when the outbound
 payload is assembled, then the run-time egress secret-scrub (FR-008b) redacts it before the call,
 and a `PLAT-AUDIT-1` event records the redaction.
- **AC (failure mode):** Given the call returns 5xx/timeout, when the action runs, then it retries
 per the Error Handler then DLQs; 4xx is treated as terminal (no retry) unless explicitly
 configured retriable.
- **Priority:** Must Have

**E5-S3: Agent run action (complex tier)**
As an **automation author**, I want to trigger an Anthropic Agent SDK agent as an action so that
complex, reasoning-heavy responses can be automated.
- **AC:** Given an Agent Run action (the complex tier of `EA-AUTOMATION-1`), when configured, then
 an agent artefact reference, input payload (triggering entity IRI + optional context), and a
 timeout (default 60 s, tunable per automation) are set. v1 executes the agent via the
 interpreter runtime (interpreter-first); the artefact-resolution contract and execution runtime
 binding (AgentCore Runtime vs ECS Fargate per CLAUDE.md) are deferred to OQ-04 / OQ-09.
- **AC (governance):** Given an Agent Run action, when it is about to dispatch, then it passes the
 governance gate sequence (E5-S5) and runs under a per-automation least-privilege service
 principal minted by `PLAT-IDENTITY-1`; its principal IRI is recorded in every `PLAT-AUDIT-1`
 event and any PROV-O attribution.
- **AC (failure mode):** Given the agent run times out or the runtime is unreachable, when the run
 is in flight, then the run is recorded as a terminal failure in the run log; per-step idempotency
 (E8-S1) prevents a duplicate agent run on SQS redelivery (the in-flight agent step's completion
 marker gates re-execution).
- **Priority:** Must Have (the complex/agentic tier is a v1 capability per `EA-AUTOMATION-1`; only
 the execution runtime *substrate* — AgentCore Runtime vs ECS Fargate — and the artefact-resolution
 contract are deferred to OQ-09, not the capability)

**E5-S4: Graph update action**
As an **automation author**, I want to write a property change or new relationship back to the
company graph so that external events keep the ontology current.
- **AC:** Given a Graph Update action, when configured, then target entity IRI (resolved from the
 triggering event), operation (update property / add relationship), property IRI, and value are
 set.
- **AC:** Given the action runs, then the write goes through `CE-WRITE-1`
 (`POST /api/operations/apply`) with `actor` = the automation's `PLAT-IDENTITY-1` service-principal
 IRI; CE validates on a throwaway clone and commits only on no `sh:Violation`, returning
 `201 {activity_iri, applied_count, version_iri}` (a PROV-O activity attributed to the principal)
 or `422 {violations:[…]}`.
- **AC (failure mode):** Given `CE-WRITE-1` returns 422, when the action runs, then the run records
 a terminal "SHACL validation failed" step with the violation list — NOT retried (terminal). Given
 it returns 5xx/timeout, then it is retried per the Error Handler then DLQs (distinct from 422).
- **AC (provenance):** Given the PROV-O attribution, then the automation principal is represented as
 a `prov:SoftwareAgent` IRI distinct from human (`user`) and interactive-LLM (`llm`) actor classes
 so compliance reports (E9-S2) can filter by actor class.
- **Priority:** Should Have (depends on `CE-WRITE-1`)

**E5-S5: HITL approval gate + autonomous-action governance**
As an **operations owner**, I want a deterministic governance gate before any autonomous action so
that sensitive actions cannot proceed without the right human approving them.
- **AC (gate sequence):** Given any autonomous action (Agent Run, Graph Update, or high-value API
 call), when it is about to dispatch, then the engine runs the deterministic 4-step gate against
 the grounded process step, in order: (1) **explicit deny** on the step → blocked regardless of
 authority; (2) the principal's **authority level < required** → routed to human; (3) the step's
 **`automatable` flag is false** → routed to human regardless of any value threshold;
 (4) otherwise the **HITL trigger fires** if configured. Explicit deny beats even the highest
 authority level.
- **AC (HITL config completeness):** Given a HITL Gate node, when saved, then it MUST carry
 `escalatesTo` (a Role from the org model), `escalationDeadline` (an ISO-8601 `xsd:duration`), and
 the bound `triggeredByStep`; a definition missing any of these fails validation and cannot
 activate (mirrors the grounded `HITLTriggerShape` minCount 1 constraints).
- **AC (no self-approval):** Given the automation's service principal is the subject of a HITL gate,
 when an approval is attempted, then that same principal CANNOT approve it (no-self-approval
 invariant); only a human approver in `escalatesTo` may decide.
- **AC (run behaviour):** Given a HITL gate fires, when the run pauses, then approver(s) receive an
 in-app + optional Slack notification (published via `PLAT-NOTIFY-1`) showing the trigger, the
 pending action, and Approve/Reject; on approval the run continues, on rejection it terminates with
 a required reason; the decision (approve/reject, approver identity, ts, reason) is emitted to
 `PLAT-AUDIT-1`.
- **AC (failure mode):** Given the escalation deadline passes with no decision, when the deadline
 fires, then the run escalates to `escalatesTo` (notify + optional Slack alert) and remains paused;
 it is never auto-approved.
- **Priority:** Must Have

**E5-S6: Saved object-bound action type (ad-hoc action button)**
As an **operations owner**, I want a named, parameterized change template bound to a specific CE
object type — invokable ad-hoc against a single instance (an action button), not only from inside
an automation flow — so that a permitted user can apply a governed, validated change to one entity
on demand (e.g. "ApproveClaim" on a `Claim`).
- **AC:** Given the Builder, when I define a **saved object-bound action**, then I bind it to a CE
 object type (resolved via `CE-READ-1`, e.g. class `Claim`), declare its **typed inputs**
 (name + datatype + required/optional, defaults declarable per input), and define its **effects**
 as a `CE-WRITE-1` operation set against the bound instance; the action is grounded to the CE type
 and pinned via `CE-VERSION-1` like any automation.
- **AC:** Given a permitted user invokes the action ad-hoc against a single instance (the action
 button on that entity), then the engine resolves the target instance IRI, applies the declared
 effects via `CE-WRITE-1` (`POST /api/operations/apply`) — SHACL-validated on a throwaway clone,
 committed only on no `sh:Violation` — and the existing **deterministic governance gate**
 (E5-S5: deny→authority→`automatable`→HITL) runs before any effect; a high-value or non-automatable
 action routes to the HITL gate exactly as in a flow.
- **AC (provenance):** Given the action is **user-invoked**, then PROV-O attribution and the
 `PLAT-AUDIT-1` event record the invoking **human user** (`user` actor class) as the actor — distinct
 from the `prov:SoftwareAgent` automation principal used for flow-driven writes — so compliance
 reports (E9-S2) can still filter by actor class; the run is metered via `PLAT-BILLING-1` (per-run).
- **AC (failure mode):** Given `CE-WRITE-1` returns `422 {violations}`, then the action records a
 terminal "SHACL validation failed" step with the violation list and applies **no** partial change
 (the write is atomic per `CE-WRITE-1`); a 5xx/timeout is retried per the Error Handler then DLQ'd,
 distinct from the terminal 422.
- **AC (failure mode):** Given the invoking user lacks the authority the bound step requires, then the
 invocation is routed to a human per the governance gate (or rejected) — it is never applied on the
 invoker's behalf without clearing the gate.
- **Priority:** Should Have (depends on `CE-WRITE-1`)

### Epic 6: Ontology Grounding

**E6-S1: Every automation must be linked to a published ontology entity**
As a **compliance officer**, I want every automation grounded in a specific BPMO `Process`,
`Activity`, or governing `Policy` so that no automation runs without a documented justification.
- **AC:** Given an automation with no grounding link, when I open Activate, then it is disabled with
 "Link this automation to a BPMO `Process`, `Activity`, or `Policy` first".
- **AC:** Given the Builder, when I click "Link to ontology", then a searcher over CE BPMO
 `Process`/`Activity` entities and the `Policy` kinds they are `governedBy` (via `CE-READ-1`)
 opens; selecting one sets the grounding link; the grounding (label + IRI + kind) shows on the
 registry card and Builder header.
- **AC (failure mode):** Given a referenced process exists only in a draft (unpublished) version,
 when grounding is attempted, then it is rejected with "publish this process in the Constitution
 Engine first" — grounding may only resolve to an entity present in a PUBLISHED version
 (`CE-VERSION-1`).
- **Priority:** Must Have

**E6-S2: Ontology version pinning**
As an **integration engineer**, I want each automation pinned to a specific published ontology
version so that ontology evolution does not silently break live automations.
- **AC:** Given activation, when the automation publishes, then it records the pinned
 `version_iri` (the newest published version at that moment via `CE-VERSION-1`); the pin is
 immutable except via an explicit "Upgrade pin".
- **AC:** Given "Upgrade pin", when invoked, then it shows a `CE-DIFF-1` diff of the grounded
 entities (added/removed/modified nodes AND edges) between the pinned and target versions and
 requires confirmation.
- **AC:** Given an active automation whose pin lags latest (default lag ≥ 2, `CE-VERSION-1`,
 tunable), when it runs, then it continues against the pinned version's schema — no silent
 breakage.
- **AC (failure mode — forced obsolescence):** Given a pinned version is withdrawn (regulatory /
 security) or the grounded entity IRI is absent in the pinned snapshot, when this is detected
 (activation-time check + on the next `CE-EVENT-1`/poll), then affected automations are
 auto-paused and flagged "pinned version withdrawn — review required" with a `PLAT-NOTIFY-1` event.
- **Priority:** Must Have

### Epic 7: Two-Tier Automation Model & Composition

**E7-S1: Two-tier model — interpreter-first, with portable export as a fast-follow**
As a **platform engineer**, I want automations realised through the two-tier model so that simple
flows run cheaply and complex flows can reason, with portability on the roadmap.
- **AC:** Given an automation, when it is classified, then the engine assigns a tier per
 `EA-AUTOMATION-1`: **simple** (declarative JSON, runtime-interpreted) for trigger→action(s)
 without reasoning; **complex** (Anthropic Agent SDK agentic action/trigger) when an Agent Run or
 multi-step reasoning is present. The tier is auto-selected and overridable in Builder → Settings.
- **AC (v1 runtime):** Given v1, when an automation is activated, then it is executed by the
 **runtime interpreter** over the canonical definition (interpreter-first); a downloadable,
 portable Agent-SDK artefact is NOT promised at v1.
- **AC (Phase 2 export):** Given the fast-follow export capability (Phase 2), when an automation is
 exported, then a portable Agent-SDK artefact (skill / command / agent) is produced, versioned by
 semver, and downloadable as a `pip`-installable package; this does not block v1 GA.
- **AC (failure mode):** Given tier classification is ambiguous, when auto-selection runs, then it
 defaults to the simple tier unless an Agent Run node is present, and surfaces the choice to the
 author for override — never silently picks the costlier tier.
- **Priority:** Must Have (v1 interpreter) · Phase 2 (artefact export)

**E7-S2: Sub-automation composition**
As an **automation author**, I want to reference one automation from another so that I can compose
workflows from reusable blocks.
- **AC:** Given a Sub-automation node, when configured, then I select an automation from the
 registry and map input/output properties; calls are synchronous (within the parent's timeout) or
 async (fire-and-forget).
- **AC (failure mode):** Given a sub-automation call introduces a cycle (A→B→A), when validated,
 then activation is blocked with "sub-automation cycle detected".
- **Priority:** Should Have

### Epic 8: Run Engine & Reliability

**E8-S1: At-least-once delivery with per-step idempotency**
As an **integration engineer**, I want at-least-once delivery and per-step idempotent execution so
that no event is dropped and no side effect fires twice.
- **AC:** Given a trigger event, when it is enqueued, then it is consumed from an SQS queue; ordering
 is NOT guaranteed (SQS standard). Each run is assigned a `run_id` derived from the trigger event
 ID; a duplicate delivery detects the existing `run_id` and is discarded.
- **AC (per-step idempotency):** Given a run that fails mid-flight after a side effect (e.g. Slack
 sent, then crash before ack), when the message is redelivered, then each completed step's
 idempotency completion marker is checked first and completed steps are SKIPPED — the run replays
 from the last incomplete step, not from the top. Best-effort steps (where dedupe is impossible)
 are documented per action type.
- **AC (paused runs):** Given a HITL-gated run (which may pause for hours or business days far
 exceeding any SQS visibility timeout), when it pauses, then it is **acked/removed from the queue**
 and persisted as a durable paused-run record (state machine — runtime model in OQ-09), resumed on
 approval — it is NEVER held as an in-flight SQS message.
- **Priority:** Must Have

**E8-S2: Retry policy and dead-letter handling**
As an **integration engineer**, I want configurable retries and a DLQ so that failures are handled
and inspectable.
- **AC:** Given an Error Handler node, when configured, then max retries (default 3, max 10 —
 tunable per automation), backoff (default exponential 2s/4s/8s, tunable), and on-failure action
 (notify / log / create self-healing issue via `BE-SELFIMPROVE-1` / stop) are set.
- **AC:** Given retries are exhausted, when the run fails terminally, then the event moves to a
 per-workspace SQS DLQ (default retention 14 days, tunable; not auto-reprocessed); run history
 shows the last error and a "Retry from DLQ" button.
- **AC (failure mode):** Given DLQ depth > 0, when monitored, then a `PLAT-NOTIFY-1` event fires and
 the depth is exposed as a CloudWatch metric.
- **Priority:** Must Have

**E8-S3: Run metering for usage-based billing**
As the **Weave platform**, I want every run to emit a metering event so that per-run billing is
accurate.
- **AC:** Given a run completes (success/failure/rejected), when it terminates, then it emits a
 metering event to `PLAT-BILLING-1` on the **per-run** dimension:
 `{automation_id, tenant_id, run_id, trigger_type, action_types[], duration_ms, outcome, ts}`;
 token usage for Agent Run actions is metered by `PLAT-BILLING-1` on the **per-token** dimension
 (the two dimensions co-exist per the platform billing decision).
- **AC (reliability):** Given metering, when emitted, then it uses a separate queue from run
 outcome so metering events are never dropped even if the run fails (per `PLAT-BILLING-1`).
- **AC (failure mode):** Given the metering queue is unavailable, when a run completes, then the
 metering event is durably buffered and retried — a billing event is never silently lost.
- **Priority:** Must Have

### Epic 9: Audit & Compliance Reporting (views over PLAT-AUDIT-1)

**E9-S1: Emit run/step audit events to the platform audit trail**
As a **compliance officer**, I want every run recorded immutably so that I can prove automated
actions followed CE rules.
- **AC:** Given any run or step, when it executes, then the engine EMITS a typed `PLAT-AUDIT-1`
 event (`{seq, ts, actor_principal_iri, engine:"events", event_type, target_iri, diff_summary,
 signature}`) — the engine keeps NO independent signed store; the run-log is a filtered VIEW over
 `PLAT-AUDIT-1`. Events-specific fields (`grounded_entity_iri`, `ontology_version_pinned`,
 `trigger_payload_hash`, per-step `step_type`/`step_config_hash`/`outcome`/`external_call_url`,
 `hitl_decision`) ride as a typed payload.
- **AC:** Given `PLAT-AUDIT-1`, then append-only + signature + sequence are enforced by the platform
 service at the DB-constraint level; a delete attempt is rejected and itself logged. The engine
 does not re-implement signing.
- **AC:** Given HITL decisions, when made, then approve/reject + approver Cognito identity + ts +
 reason are emitted as distinct `PLAT-AUDIT-1` events.
- **AC (failure mode):** Given `PLAT-AUDIT-1` is unavailable at run time, when an audit-bearing step
 completes, then the event is durably buffered and retried (audit completeness is never sacrificed
 for run throughput); if buffering also fails the run is marked degraded and flagged.
- **Priority:** Must Have

**E9-S2: Compliance reporting for regulated processes**
As a **compliance officer**, I want a compliance report for a specific ontology process so that I
can prove automated actions followed obligations.
- **AC:** Given the Audit & Compliance screen, when I filter by grounded process IRI (typeahead via
 `CE-READ-1`) + date range, then a report (a VIEW over `PLAT-AUDIT-1`) shows run count, success %,
 failure breakdown, HITL approvals vs rejections, and any step that hit a `CE-WRITE-1` 422 SHACL
 violation; it can filter by actor class (human / interactive-LLM / `prov:SoftwareAgent`
 automation principal).
- **AC:** Given a report, when exported (PDF or JSON), then it includes `PLAT-AUDIT-1` sequence
 numbers + signatures and a signature-verification section.
- **AC (failure mode):** Given a "Red run" (any 422 SHACL violation or HITL rejection), when the
 report renders, then it is flagged distinctly.
- **Priority:** Must Have

### Epic 10: Templates & Library

**E10-S1: Reusable automation templates**
As an **automation author**, I want pre-built templates so that I start from a working pattern.
- **AC:** Given Automate → Templates, when it loads, then at least these ship at v1 GA: "Notify on
 delivery arrival" (webhook → Slack), "Escalate unresolved incident" (ServiceNow → condition →
 HITL gate → agent run), "Update graph on Jira close" (Jira → `CE-WRITE-1` graph update),
 "Daily compliance summary" (cron → agent run → Slack), "New employee onboarding" (graph-change →
 multi-step agent run), "Stock reorder trigger" (graph-change: SHACL violation → API call → Slack).
- **AC:** Given a template, when I click "Use template", then it opens pre-populated in the Builder
 and I MUST set a grounding link to a published entity before activating.
- **AC (failure mode):** Given a template references a connector/trigger type not available in the
 tenant (e.g. graph-change before `CE-EVENT-1`), when opened, then the unavailable nodes are
 flagged and the template cannot activate until resolved.
- **Priority:** Should Have

### Epic 11: Automation Settings (within the platform cascade)

**E11-S1: Workspace and automation settings, resolved through PLAT-SETTINGS-1**
As a **workspace admin**, I want defaults and limits governed through the platform settings cascade
so that company/domain minimums cannot be loosened locally.
- **AC:** Given Automate Settings, when I view a setting (default HITL timeout, default retry policy,
 default pin behaviour, max concurrent runs [default 20, tunable], max runs/automation/min
 [default 60, tunable], notification prefs, audit retention [default 12 months; min 30 days;
 tunable], HITL high-value threshold), then each shows its **source level** (Company / Domain /
 Workspace / Project) resolved via `PLAT-SETTINGS-1` (tighter-wins).
- **AC (cascade enforcement):** Given a company/domain has set a minimum (e.g. audit retention or
 the HITL high-value threshold), when a workspace tries to LOOSEN it, then the change is rejected
 ("loosening requires parent approval"); tightening locally is allowed.
- **AC (high-value threshold):** Given the HITL high-value threshold, then it is a **per-tenant,
 currency-configurable default** (~£10,000-equivalent; unit-/currency-aware, not a fixed GBP
 literal) above which any external-effect action requires a HITL gate — enforced at the engine
 level, not just the UI.
- **Priority:** Must Have

---

## 4. Functional Requirements

| ID | Requirement | Story | Priority | Phase / depends-on |
|---|---|---|---|---|
| FR-001 | Automation registry: list with status, trigger type, linked CE entity (`CE-READ-1`), pinned version (`CE-VERSION-1`), last run, 7d run count; filters + search. Failure: CE unavailable → cached label + badge, list still renders | E1-S1 | P0 | MVP (CE-READ-1, CE-VERSION-1) |
| FR-002 | Health indicators: failed-run dot, stale-pin chip (`CE-VERSION-1` lag default ≥ 2, tunable), connector-degraded chip (`PLAT-CONNECTOR-1`), "health unknown" on health-API error | E1-S2 | P0 | MVP (PLAT-CONNECTOR-1) |
| FR-003 | Builder split-pane (NL chat + flow canvas) as projections of one canonical definition | E2-S1 | P0 | MVP |
| FR-004 | NL authoring: AI resolves referenced CE entity via `CE-READ-1` SPARQL (SELECT-only, paginated); drafts trigger+condition+action+grounding pinned via `CE-VERSION-1` | E2-S1 | P0 | MVP (CE-READ-1) |
| FR-005 | Multi-process disambiguation: 1 inline clarifying question; default 3 rounds (tunable) then fall back to "Link to ontology" searcher; never fabricate an IRI | E2-S1 | P0 | MVP |
| FR-006 | Follow-up chat edits commit transactionally to the canonical definition; "Undo last AI change"; failed AI edit leaves definition unchanged | E2-S2 | P0 | MVP |
| FR-007 | Save as Draft (no run) / Test (dry-run, no external calls, no `CE-WRITE-1`, no metering) / Activate (validation + publish) | E2-S3 | P0 | MVP |
| FR-008 | Secret-scan on every activation; detected credential blocks; scanner unavailable → **fail-closed**. Reuses the platform scrubber pattern set (does not reinvent) | E2-S3 | P0 | MVP |
| FR-008b | Run-time egress secret-scrub on interpolated outbound payloads (not just activation-time); redaction logged to `PLAT-AUDIT-1` | E5-S2 | P0 | MVP (PLAT-AUDIT-1) |
| FR-009 | Canvas node types: Trigger, Condition, Action, HITL Gate, Error Handler, End; node inspector; capability-level interactions (zoom/pan/minimap/fit/keyboard) | E3-S1 | P0 | MVP |
| FR-010 | Canvas validation: reject cyclic/disconnected graphs at activation | E3-S1 | P0 | MVP |
| FR-011 | Canonical-definition single source of truth; canvas + chat are projections; AI edit re-projects (default 500 ms, ASSUMPTION-tunable); concurrent-edit = optimistic LWW, loser shown diff | E3-S2 | P0 | MVP |
| FR-012 | Webhook trigger: opaque tenant+automation token resolved server-side BEFORE tenant scope; HMAC-SHA256 REQUIRED for write/external automations; per-endpoint rate limit (default 100/min) + body cap (default 256 KB); bad sig/unknown token/oversize/schema-mismatch → DLQ with typed reason | E4-S1 | P0 | MVP |
| FR-013 | Atlassian (Jira) trigger via `PLAT-CONNECTOR-1`: created/updated/status-changed/comment-added; filter project + issue type; blocked if connector degraded | E4-S2 | P0 | MVP (PLAT-CONNECTOR-1) |
| FR-014 | ServiceNow trigger via `PLAT-CONNECTOR-1`: incident created/state-changed, change-request state-changed; filter category; blocked if degraded | E4-S2 | P0 | MVP (PLAT-CONNECTOR-1) |
| FR-015 | Cron trigger: cron expr + human preview; interval; calendar-based | E4-S3 | P0 | MVP |
| FR-016 | Slack trigger via platform-managed Slack connector (`PLAT-CONNECTOR-1`, token in Secrets Manager): message-in-channel (keyword filter), slash command; degraded → buffer or flag, never silent loss | E4-S3 | P0 | MVP (PLAT-CONNECTOR-1) |
| FR-017 | Graph-change trigger: consumes `CE-EVENT-1`; **degrades to polling `CE-READ-1` since-version** if transport not ready (no push-only claim); per-workspace cap default 10 (tunable) | E4-S4 | P1 | Phase 2 / Should Have (CE-EVENT-1; degrade to CE-READ-1) |
| FR-018 | Slack notification action via `PLAT-CONNECTOR-1` / `PLAT-NOTIFY-1`: channel or `Person.slack_id`; `{{entity.property}}` interpolation; preview; token in Secrets Manager; delivery failure → retry/DLQ; per-step idempotency prevents re-send | E5-S1 | P0 | MVP (PLAT-CONNECTOR-1, PLAT-NOTIFY-1) |
| FR-019 | API call action: method/URL/headers (Secrets Manager refs)/body with interpolation; optional response→`CE-WRITE-1` graph update; egress scrub; 5xx retry, 4xx terminal; test run | E5-S2 | P0 | MVP |
| FR-020 | Agent run action (complex tier, `EA-AUTOMATION-1`): artefact ref + input + timeout (default 60s); runs under `PLAT-IDENTITY-1` principal; interpreter-first v1; timeout = terminal failure, per-step idempotency prevents duplicate on redelivery. Capability is v1; only runtime substrate + artefact-resolution contract are OQ-09 | E5-S3 | P0 | MVP (capability); runtime substrate OQ-09 |
| FR-021 | Graph update action via `CE-WRITE-1` (`POST /api/operations/apply`, actor = principal IRI); 201 commit or 422 SHACL (terminal, not retried); 5xx retried; PROV-O via `prov:SoftwareAgent` actor | E5-S4 | P1 | Phase 2 / Should Have (CE-WRITE-1) |
| FR-022 | Governance gate before any autonomous action: deterministic 4-step deny→authority→`automatable`→HITL against the grounded process step; non-automatable step → human regardless of value | E5-S5 | P0 | MVP |
| FR-023 | HITL gate config completeness (SHACL-mirrored): `escalatesTo` (Role) + `escalationDeadline` (xsd:duration) + bound `triggeredByStep` mandatory; **no-self-approval** invariant; decision emitted to `PLAT-AUDIT-1`; deadline → escalate, never auto-approve | E5-S5 | P0 | MVP (PLAT-AUDIT-1, PLAT-NOTIFY-1) |
| FR-024 | Grounding required for activation; "Link to ontology" searcher over BPMO `Process`/`Activity` + governing `Policy` (`CE-READ-1`); NL auto-resolves; grounding may only resolve to a PUBLISHED-version entity (`CE-VERSION-1`) | E6-S1 | P0 | MVP (CE-READ-1, CE-VERSION-1) |
| FR-025 | Version pin on activation (`CE-VERSION-1` newest published); immutable except "Upgrade pin" (shows `CE-DIFF-1` diff incl. edges, requires confirm); withdrawn pin / missing grounded IRI → auto-pause + `PLAT-NOTIFY-1` | E6-S2 | P0 | MVP (CE-VERSION-1, CE-DIFF-1) |
| FR-026 | Two-tier model (`EA-AUTOMATION-1`): simple declarative interpreted + complex Agent-SDK agentic; auto-tiered, overridable; **interpreter-first** v1; no downloadable-artefact promise at v1 | E7-S1 | P0 | MVP |
| FR-027 | Portable Agent-SDK artefact export (skill/command/agent), semver, `pip`-installable, referenceable as sub-automation | E7-S1 | P1 | Phase 2 (fast-follow export) |
| FR-028 | Sub-automation node: registry select + input/output mapping; sync or async; cycle detection blocks activation | E7-S2 | P1 | Phase 2 |
| FR-029 | At-least-once via SQS (ordering NOT guaranteed); `run_id` from trigger event ID dedupes duplicate delivery; **per-step idempotency markers** replay from last incomplete step | E8-S1 | P0 | MVP |
| FR-029b | HITL-gated/paused runs acked/removed from SQS and persisted as durable paused-run records (state machine, OQ-09), resumed on approval — never held as in-flight SQS messages | E8-S1 | P0 | MVP |
| FR-030 | Retry: max retries (default 3, max 10, tunable), backoff (default exp 2s/4s/8s, tunable), on-failure incl. self-healing issue via `BE-SELFIMPROVE-1`; DLQ (default 14d retention, tunable); "Retry from DLQ"; depth>0 → `PLAT-NOTIFY-1` + CloudWatch | E8-S2 | P0 | MVP |
| FR-031 | Run metering to `PLAT-BILLING-1` **per-run** dimension; agent token usage on **per-token** dimension; separate queue, never dropped; metering-queue unavailable → durably buffered | E8-S3 | P0 | MVP (PLAT-BILLING-1) |
| FR-032 | EMIT run/step events to `PLAT-AUDIT-1` (engine keeps no independent signed store; run-log is a view); Events-specific fields as typed payload; append-only + signature + seq enforced by platform; emit failure → buffer/retry | E9-S1 | P0 | MVP (PLAT-AUDIT-1) |
| FR-033 | Compliance report (VIEW over `PLAT-AUDIT-1`): filter by grounded process (`CE-READ-1`) + date range + actor class; run count, success %, HITL decisions, 422 SHACL violations; export PDF/JSON with `PLAT-AUDIT-1` seq+signatures | E9-S2 | P0 | MVP (PLAT-AUDIT-1, CE-READ-1) |
| FR-034 | Templates: ≥ 6 at v1 GA; "Use template" → pre-populated; grounding to published entity required before activate; unavailable nodes flagged | E10-S1 | P1 | MVP (some templates Phase-2-gated on CE-EVENT-1/CE-WRITE-1) |
| FR-035 | Automation settings resolved through `PLAT-SETTINGS-1` cascade (each shows source level; loosening a parent minimum rejected); defaults all "default X, tunable"; HITL high-value threshold per-tenant currency-configurable default (~£10k-equiv) enforced at engine level | E11-S1 | P0 | MVP (PLAT-SETTINGS-1) |
| FR-036 | Saved object-bound action type: named parameterized change template bound to a CE object type (`CE-READ-1`, pinned `CE-VERSION-1`) with declared typed inputs (defaults declarable) + SHACL-validated effects via `CE-WRITE-1`; invokable ad-hoc by a permitted user against a single instance (action button), not only in a flow; runs the E5-S5 governance gate; PROV-O + `PLAT-AUDIT-1` attribute the **invoking human** (`user` actor class, distinct from `prov:SoftwareAgent`); metered per-run (`PLAT-BILLING-1`); 422 terminal/no partial write, 5xx retried; insufficient authority → routed to human | E5-S6 | P1 | Phase 2 (CE-WRITE-1) |

> Every FR ties to a delivery phase and the engine(s)/contract(s) it cannot ship before.

---

## 5. Inter-engine Interfaces

> Single source of truth: [`docs/specs/_inter-engine-contracts.md`](../../_inter-engine-contracts.md).
> This engine PROVIDES `EA-AUTOMATION-1` and CONSUMES the contracts below.

### Consumed (this engine calls / reads)

| Provider engine | Contract | Version pin | Used for |
|---|---|---|---|
| Constitution Engine | `CE-READ-1` (`GET /api/sparql` SELECT-only paginated; `/api/ontology/types\|resource`) | `?version=<pinned iri>` (latest at activation) | Resolve grounding entity, NL lookup, registry labels, compliance-report process filter |
| Constitution Engine | `CE-VERSION-1` (`/api/ontology/versions`, canonical lag) | n/a (provider canonical) | Pin to newest published, compute staleness (default lag ≥ 2) |
| Constitution Engine | `CE-DIFF-1` (`/api/ontology/diff`) | between pinned + target | "Upgrade pin" diff (nodes + edges) |
| Constitution Engine | `CE-WRITE-1` (`POST /api/operations/apply`) | target pinned `version_iri` | Graph update action (201/422), PROV-O attribution |
| Constitution Engine | `CE-EVENT-1` (graph-change stream) | tracks pinned version | Graph-change triggers (Should Have; degrade to `CE-READ-1` polling if transport not ready) |
| Platform | `PLAT-CONNECTOR-1` (7 v1 connectors incl. **Slack**, Atlassian, ServiceNow; health-status read API; delivery interface) | n/a | Slack/Jira/ServiceNow triggers + Slack action delivery; health gating |
| Platform | `PLAT-AUDIT-1` (immutable append-only signed log) | n/a | Emit run/step/HITL audit events; run-log + compliance report are VIEWS |
| Platform | `PLAT-NOTIFY-1` (open-taxonomy notification service) | n/a | HITL-gate-fired, run-failure, connector-degraded, pin-withdrawn notifications |
| Platform | `PLAT-IDENTITY-1` (agent service-principal registry) | n/a | Per-automation least-privilege principal IRI (PROV-O + audit actor) |
| Platform | `PLAT-BILLING-1` (per-run + per-token metering) | n/a | Run metering (per-run); agent token usage (per-token) |
| Platform | `PLAT-SETTINGS-1` (4-level cascade) | n/a | Resolve defaults/limits/thresholds; enforce tighter-wins |
| Build Engine | `BE-SELFIMPROVE-1` (signal→issue→dispatch) | n/a | "create self-healing issue" on-failure action (HITL-gated, no autonomous merge) |

### Provided (this engine exposes to others)

| Contract | Consumers | Shape (link) | Stability |
|---|---|---|---|
| `EA-AUTOMATION-1` — two-tier automation model (simple declarative interpreted + complex Agent-SDK agentic); grounded in `CE-READ-1`, pinned `CE-VERSION-1`, writes via `CE-WRITE-1`, graph-change via `CE-EVENT-1`, metered `PLAT-BILLING-1`, audited `PLAT-AUDIT-1` | Onboarding (Hammerbarn example automations), Platform dashboard (automation/run health) | [contracts §5](../../_inter-engine-contracts.md) | beta |

---

## 6. Non-Functional Requirements

### Performance

> Every threshold below is an ASSUMPTION (unverified) to be confirmed in tech spec, expressed as a
> configurable default. The trigger-to-first-action target must be **re-derived once the transport
> is fixed (OQ-07/OQ-09)** — SQS standard adds non-deterministic dwell latency, so a 2 s p95 may be
> unachievable with that transport.

- Trigger receipt → first action dispatched: default ≤ 2 s p95 for webhook (ASSUMPTION — re-derive
 against the chosen transport; SQS-standard dwell may force a higher target).
- Cron accuracy: default within ± 30 s of scheduled time (ASSUMPTION, tunable).
- HITL gate notification delivery: default ≤ 30 s after the gate fires (ASSUMPTION).
- Run-history query (last 30 days): default ≤ 1 s p95 (ASSUMPTION).
- Canvas initial render (≤ 20 nodes): default ≤ 500 ms (ASSUMPTION).

### Security

- All connector credentials and webhook/HMAC secrets in **AWS Secrets Manager** only; never in
 automation definitions, run logs, or audit records.
- Secret-scan on every activation (fail-closed on scanner error) + run-time egress scrub on
 interpolated outbound payloads (FR-008 / FR-008b), reusing the platform scrubber pattern set.
- Input validation at boundaries: webhook payloads validated/size-capped; tenant resolved from an
 opaque server-side token, never from the request body (security.md: validate/sanitise at
 boundaries).
- Service principals: each automation runs under a per-automation least-privilege principal minted
 by `PLAT-IDENTITY-1` (NOT a parallel identity model); its scope is derived from the grounded
 process step's role/authority; the principal IRI is in every `PLAT-AUDIT-1` entry and PROV-O
 attribution. Per-automation-principal scaling is an OQ (OQ-10).
- No-self-approval: an automation's principal cannot approve a HITL gate it is the subject of.
- HITL high-value threshold (per-tenant currency-configurable default ~£10k-equiv) enforced at the
 engine level, not just UI.

### Reliability

- At-least-once delivery (SQS standard; ordering NOT guaranteed); `run_id` dedupe + per-step
 idempotency markers (replay from last incomplete step). Best-effort steps documented per action
 type.
- HITL/paused runs acked off the queue and persisted as durable paused-run records (state machine —
 OQ-09); never in-flight SQS messages; SQS visibility timeout pinned in tech spec relative to max
 in-flight (non-paused) action duration.
- DLQ default retention 14 days (tunable); not auto-reprocessed.
- 422 SHACL from `CE-WRITE-1` is terminal (not retried); 5xx is retried then DLQ.
- Metering + audit events durably buffered if their queues/services are unavailable (never dropped).

### Observability

- Each run emits an OpenTelemetry span tree: root run span; trigger span; condition/action spans
 (attributes: `automation_id`, `run_id`, `tenant_id`, `step_type`, `external_call_latency_ms`,
 `outcome`). Logs correlate by `run_id`.
- DLQ depth per workspace exposed as a CloudWatch metric with a pre-configured alarm at depth > 0.

### Accessibility

- Registry, Builder chat, templates: WCAG 2.1 AA; the CI accessibility gate is zero violations
 (axe) on these surfaces.
- Canvas keyboard-navigable (Tab cycles nodes, Enter opens inspector, Escape closes); minimap and
 controls carry aria-labels.

### Isolation & data safety

- Multi-tenant cloud SaaS. Tenant isolation mechanism (named): every inbound webhook resolves a
 tenant via an **opaque server-side token** before any tenant-scoped resource is read/written;
 every persisted automation/run/audit record is tenant-scoped; tenant-scoped data access uses
 **named-graph + query-rewriting that REJECTS unscoped queries** (final mechanism — store-per-tenant
 vs named-graph + rewriting — is a tech-spec OQ, OQ-11, but the expectation + test are stated here).
- **Cross-tenant-read test:** given a tenant-A principal, when any registry/run/audit/SPARQL query
 is issued without a tenant scope or with tenant-B scope, then zero tenant-B records are returned
 and the attempt is logged.

### Browser / device support

- Latest 2 versions of Chrome, Edge, Firefox, Safari (desktop). The flow canvas is a
 desktop-first authoring surface.

---

## 7. Key Design Decisions Captured

| Decision | Rationale |
|---|---|
| Two-tier model `EA-AUTOMATION-1`: simple declarative (interpreted) + complex Agent-SDK agentic; **interpreter-first**, portable export a fast-follow | Agentic capability shipped in v1; only the downloadable-artefact promise is relaxed to "export follows" (locked decision C4) |
| Slack is a **platform-managed connector** (`PLAT-CONNECTOR-1`, token in Secrets Manager), one of 7 v1 connectors | Resolves the "Slack connector no engine owns" contradiction; engine consumes, never operates connectors (C2/C3) |
| Graph update goes through `CE-WRITE-1`; grounding/version via `CE-READ-1`/`CE-VERSION-1`; graph-change via `CE-EVENT-1` | CE owns the only mutation entry point + read/version/event contracts; this engine cites them, never invents CE push/write APIs |
| Run-log + compliance report are VIEWS over `PLAT-AUDIT-1`; engine emits typed events, keeps no signed store | One platform-owned immutable audit/provenance system of record (A2); removes the duplicate Events audit store |
| Billing via `PLAT-BILLING-1`: per-run (automation execution) + per-token (agent usage), co-existing | Resolves the runs-vs-tokens conflict; both dimensions are billable (C1) |
| Deterministic governance gate deny→authority→`automatable`→HITL, + no-self-approval, + HITL config completeness | Encodes the grounded prototype governance model; non-automatable step → human regardless of value |
| Canonical automation definition = single source of truth; canvas + chat are projections; concurrent edit = optimistic LWW | Removes the ambiguous "two views stay in sync" without a canonical model |
| Webhook tenant resolved from opaque server-side token; HMAC required for write/external automations | Closes the unauthenticated-public-endpoint tenant-isolation/abuse hole |
| HITL/paused runs persisted as durable paused-run records, acked off SQS | A paused run can sit for business-days, exceeding any SQS visibility timeout |
| Per-step idempotency markers (replay from last incomplete step) | run_id dedupe alone does not prevent re-firing side effects on mid-run redelivery |
| Settings resolved through `PLAT-SETTINGS-1` cascade; loosening a parent minimum gated | Events settings are not flat workspace settings; cascade is a platform invariant |
| Automation principal = `prov:SoftwareAgent`, distinct from human/llm actor classes | Compliance reports can distinguish automation-driven from human/interactive-LLM changes |

---

## 8. Open Questions (for Tech Spec)

| # | Question | Owner |
|---|---|---|
| OQ-01 | Canvas framework: React Flow vs custom SVG renderer (dictates available interactions; UI bindings deferred until decided). | Architect / Design |
| OQ-02 | Automation-definition storage: JSON document (DynamoDB) vs structured SQL (PostgreSQL) given compliance-query needs. | Architect |
| OQ-03 | `CE-EVENT-1` transport (SNS / WebSocket / change-feed) — deferred to CE tech spec; until ready, graph-change triggers degrade to `CE-READ-1` polling. | Architect + CE team |
| OQ-04 | Portable Agent-SDK artefact **export** mechanism (Phase 2): codegen from canonical definition → packaged skill/command/agent. v1 runtime is the interpreter, so this does not gate v1. | Architect |
| OQ-05 | (Resolved) Notifications reuse `PLAT-NOTIFY-1`; open-taxonomy types cover HITL-gate/automation-failure/connector-degraded/pin-withdrawn. | — (resolved) |
| OQ-06 | Compliance-report PDF generation: Lambda + headless Chromium vs a Python PDF library. | Architect |
| OQ-07 | Webhook ingestion: API Gateway + Lambda vs a dedicated high-throughput ingestion service; chosen transport feeds the latency re-derivation. | Architect |
| OQ-08 | Exact canvas input bindings / node-rendering detail — deferred to the design spec once OQ-01 is settled. | Architect / Design |
| OQ-09 | Run-engine runtime model (interpreter execution substrate, paused-run state machine — Step Functions vs runs table) and Agent Run execution runtime binding (AgentCore Runtime vs ECS Fargate per CLAUDE.md) + artefact-resolution contract. | Architect + Build team |
| OQ-10 | Service-principal granularity at scale: per-automation principal (Cognito user-pool scaling) vs pooled-with-scoped-claims, derived from the grounded step's role/authority via `PLAT-IDENTITY-1`. | Architect + Platform |
| OQ-11 | Final multi-tenant isolation mechanism: store-per-tenant vs named-graph + query-rewriting (expectation + cross-tenant-read test already stated in §6). | Architect |
| OQ-12 | ODRL policy enforcement is NOT in the v1 stack; v1 uses SHACL + data-classification properties. Revisit ODRL in a later stack decision. | Architect |
| OQ-13 | **Ontology-bound function — shared primitive ownership.** Whether one typed, graph-aware logic unit (a single definition bound to a CE object type) should be referenceable as an Events action (`EA-AUTOMATION-1`), a Build SDK method (`BE-SDK-1`), and an agent tool at once — and **which engine owns** its definition, registry, and versioning (Events vs Build vs a CE-owned shared contract). The saved object-bound action (E5-S6) is the Events-side seed of this primitive. Cross-engine; coordinate with Build OQ-12 and the PO. (P2) | Architect + PO (Events/Build) |

---

## 9. Acceptance Criteria (PRD-level)

The Events & Actions Engine PRD is satisfied when:

- [ ] A user types "when a delivery arrives at any store, notify the #goods-inward Slack channel,
 following the goods-inward receipt process"; the AI resolves the process via `CE-READ-1`,
 drafts a Webhook → Slack automation, and sets a grounding link pinned via `CE-VERSION-1`
 (target ≤ default 10 s, ASSUMPTION-tunable). If CE is unreachable, no IRI is fabricated and the
 draft remains ungrounded.
- [ ] Canvas and chat are projections of one canonical definition; a canvas edit produces a diff
 summary in chat; a concurrent AI edit resolves by optimistic LWW with the loser shown the diff.
- [ ] An automation cannot be activated without a grounding link to a PUBLISHED-version entity; the
 secret-scan is fail-closed if its service is down.
- [ ] An autonomous action against a non-`automatable` step is routed to a human regardless of any
 value threshold; an automation's principal cannot approve its own HITL gate; HITL config
 missing `escalatesTo`/`escalationDeadline`/`triggeredByStep` fails validation.
- [ ] A HITL-gated run pauses, is acked off SQS as a durable paused-run record, notifies the approver
 via `PLAT-NOTIFY-1`, resumes on approval, and the decision is emitted to `PLAT-AUDIT-1`.
- [ ] A run fails, retries per policy (default 3, exponential), then the event appears in the DLQ;
 "Retry from DLQ" re-queues it; a mid-run redelivery does NOT re-fire an already-completed step
 (per-step idempotency).
- [ ] A graph update goes through `CE-WRITE-1`; a 422 SHACL violation is terminal (not retried) and
 shown; a 5xx is retried; the change is attributed to a `prov:SoftwareAgent` principal.
- [ ] Every run emits a per-run metering event to `PLAT-BILLING-1` (and per-token for agent usage),
 never dropped; the run-log and compliance report are VIEWS over `PLAT-AUDIT-1`.
- [ ] A compliance report for a process + date range shows runs, success %, HITL decisions, and 422
 SHACL violations, filterable by actor class, exportable as PDF with `PLAT-AUDIT-1`
 seq + signatures.
- [ ] An audit event cannot be deleted (enforced by `PLAT-AUDIT-1` at the DB-constraint level); the
 attempt is logged.
- [ ] Cross-tenant-read test passes: a tenant-A principal issuing an unscoped/tenant-B query returns
 zero tenant-B records and the attempt is logged.

---

## 10. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| `CE-EVENT-1` transport not ready at GA | Med | Med | Graph-change triggers are Should Have and degrade to `CE-READ-1` polling; no push-only dependency |
| `CE-WRITE-1` not landed when graph-update action needed | Med | Med | FR-021 is Phase-2/Should Have, gated on `CE-WRITE-1`; templates needing it flag unavailability |
| SQS-standard dwell makes the 2 s p95 unachievable | Med | Med | Latency target re-derived against the chosen transport (OQ-07/OQ-09); flagged as ASSUMPTION |
| Per-automation Cognito principals don't scale | Med | Low | OQ-10 evaluates pooled-with-scoped-claims via `PLAT-IDENTITY-1` |
| Unauthenticated webhook endpoint abused | High | Med | Opaque server-side token + required HMAC for write/external + rate limit + size cap + DLQ |
| Audit/metering loss under platform-service outage | High | Low | Durable buffering + retry; run marked degraded if buffering also fails; never silently dropped |
| Secret leakage via run-time interpolation | High | Low | Run-time egress scrub (FR-008b) in addition to activation-time scan; redaction logged |
| Non-automatable step automated by mistake | High | Low | Deterministic governance gate routes non-automatable steps to humans regardless of value |

---

## Related

- [Brief](../01-brief/brief.md)
- [Inter-engine contracts](../../_inter-engine-contracts.md)
- [Constitution Engine PRD](../../constitution-engine/02-prd/prd.md) — `CE-READ-1`, `CE-WRITE-1`, `CE-DIFF-1`, `CE-VERSION-1`, `CE-EVENT-1`
- [Weave Platform PRD](../../weave-platform/02-prd/prd.md) — `PLAT-CONNECTOR-1`, `PLAT-AUDIT-1`, `PLAT-NOTIFY-1`, `PLAT-IDENTITY-1`, `PLAT-BILLING-1`, `PLAT-SETTINGS-1`
- [Build Engine PRD](../../build-engine/02-prd/prd.md) — `BE-SELFIMPROVE-1`, Agent SDK runtime
- [Graph Explorer PRD](../../graph-explorer/02-prd/prd.md) — `GE-CANVAS-1` (org-wide canvas, distinct from the automation flow canvas)

---
*Generated by Weave PO agent. Review and approve before proceeding to Roadmap.*
