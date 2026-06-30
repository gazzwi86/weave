---
type: PRD
title: Weave Platform — Product Requirements Document
description: "Cross-cutting platform layer for Weave: generative dashboard (phase-gated by engine availability), tenancy & 4-level settings cascade, auth/RBAC, agent-identity registry, notifications, managed connectors, billing, immutable audit, and Weave-product self-improvement."
tags: [weave-platform, 02-prd, dashboard, generative-ui, tenancy, rbac, connectors, audit, self-improvement]
status: Draft
timestamp: 2026-06-30T00:00:00Z
resource: docs/specs/weave-platform/02-prd/prd.md
# --- provenance block (merged per frontmatter-schema.md) ---
source: hand-authored
confirmed_by: none
confirmed_on: null
last_verified_sha: 61dfc1553b18b5762902e1d2b3681c82f4ebb26c
expires_on: 2026-12-27
owner: gazzwi86
coverage: n/a
---

# PRD: Weave Platform

**Brief:** [brief.md](../01-brief/brief.md)
**Status:** Draft
**Phase:** MVP (Constitution-sourced) + Phase 2 (other engines) · **Owner:** gazzwi86 · **Last Updated:** 2026-06-30

---

## 1. Product Context

### Background

The Weave platform layer is everything that spans all four engines — the Dashboard, tenancy
and the settings cascade, authentication and RBAC, the agent-identity registry, global
navigation and search, notifications, managed connectors, billing/metering, the immutable
audit/provenance service, and Weave-product self-improvement. Each engine (Constitution,
Graph Explorer, Build, Events & Actions) delivers its own vertical; the platform layer holds
them together, governs shared state, and is the single owner of the cross-cutting services
that every engine emits to or reads from.

The user-facing centrepiece is the **Dashboard**. It ships in two stages (user decision):

- **At MVP, the dashboard is a SIMPLE FIXED DEFAULT** — a small, hand-composed set of CE-sourced
 widgets (ontology health / coverage via `CE-METRICS-1`) that persists as every workspace's default
 home. There is no prompt bar, no AI composition, and no broad widget library at MVP. The fixed
 default is deliberately minimal: it surfaces the only live provider data that exists (CE) and gives
 every member a non-blank home from first login.
- **The AI Generative Dashboard is deferred to Phase 2.** The *generative composition* surface
 (describe-what-you-want → best-fit widget streamed live) and the full widget library light up in
 Phase 2 and expand per-engine as each source engine's data ships. It remains fully specified below
 and phase-tagged Phase 2.

The deferred generative pattern is the **Generative Dashboard**: a workspace-intelligence surface
where users describe what they want to see and the AI composes the best-fit widget from a
finite, well-designed component library (KPI card, time-series chart, table, ranked list,
activity feed, heatmap, alert banner) and streams it into the dashboard grid. This is a
*declarative* generative-UI pattern — intent maps to a fixed component set, never to
free-form code. Every widget is backed by a live query against a provider engine's metrics
contract, so the data is current, not a scheduled export.

**Engine-availability sequencing is load-bearing.** The Constitution Engine ships first
(MVP); Build, Events & Actions, and Graph Explorer depend on it and ship after. Therefore a
widget category is only buildable once its source engine is live. At MVP the only live
provider contract is the Constitution Engine's `CE-METRICS-1` (plus `CE-READ-1`/`CE-DIFF-1`/
`CE-VERSION-1`/`CE-EVENT-1`), so MVP dashboard widgets are CE-sourced only; widgets that
read Build/Events/Explorer data are tagged "P0 when source engine ships" and are dark (or
hidden) until then. (Resolves.)

The platform also owns four cross-cutting services that resolve duplicated cross-engine
ownership: **one** immutable audit/provenance service (`PLAT-AUDIT-1`); **one** notification
service (`PLAT-NOTIFY-1`); **one** agent service-principal registry (`PLAT-IDENTITY-1`); and
the **managed connector** contract plus tenancy/settings cascade and metering
(`PLAT-CONNECTOR-1`, `PLAT-SETTINGS-1`, `PLAT-BILLING-1`).

### Goals

1. Give every workspace member a single home that surfaces the health and activity of the
 live Weave deployment at a glance, personalised by role and gated to the engines that are
 actually available.
2. Give every workspace a non-blank home at MVP via a simple fixed default dashboard of CE-sourced
 widgets; then (Phase 2) let users generate any workspace-intelligence view by describing it in
 natural language — without a dashboard-configuration UI — bounded to a finite, design-consistent
 component set.
3. Provide the cross-cutting platform primitives (tenancy + settings cascade, auth, RBAC,
 agent identity, navigation, search, notifications, connectors, billing, audit) that all
 four engines depend on, each as a single owned contract — never duplicated per engine.
4. Run Weave's own product self-improvement loop (signals → drafted GitHub issue → HITL
 approval → dark-factory dispatch), gated to Weave-internal operators only.

### Non-Goals

1. **Engine-specific screens** — Constitution, Graph Explorer, Build, and Events & Actions
 are covered in their own PRDs. The platform reads their metrics/audit contracts; it does
 not re-implement their surfaces.
2. **Client-app self-healing** — Build Engine owns it (`BE-SELFIMPROVE-1`, E11, always HITL).
 The platform owns self-improvement of *Weave-the-product* only (A3); the two share the
 `BE-SELFIMPROVE-1` signal→issue→dispatch component but are configured separately and have
 disjoint approval authorities.
3. **Custom app generation** — that is the Build Engine. The Generative Dashboard renders
 widgets inside Weave's own SPA, never standalone deployed apps.
4. **BI / analytics platform** — the dashboard surfaces operational intelligence from engine
 metrics contracts; it does not run warehouse queries or replace Tableau/Looker.
5. **Realtime collaborative editing** — Graph Explorer owns it and it is Phase 2 (D1). The
 platform ships single-user editing + async sharing (saved views + comments) at MVP.

---

## 2. Personas & Roles

| Persona | Description | Primary need | Permission level |
|---|---|---|---|
| Operations / transformation lead | Owns how the company runs; first adopter | Model coverage, compliance, activity in one view | author |
| CTO / exec sponsor | Funds and governs the initiative | Spend, compliance posture, model health at a glance | admin |
| Enterprise architect | Extends the ontology to the client domain | Ontology health, version status, SHACL errors, growth | publish |
| Compliance / risk officer | Owns governance/compliance content | Cross-engine compliance views + immutable audit feed | author (read audit) |
| Engineer / developer | Builds via the Build Engine | Active projects, token spend, agent activity, connectors | author |
| Business analyst / SME | Edits instance data day to day | Domain changes, project status, role-tailored views | author |
| Ops / SRE | Operates built products | Automation/connector health, error/latency signals | author |
| Automation author | Creates and manages automations | Automation status, run health | author |
| Viewer / stakeholder | Read-only | Read-only explore + dashboards | read |
| **Weave platform operator** *(Weave-internal, NOT a client-tenant role)* | Weave engineering | Approve/dispatch Weave-product self-improvement | platform-internal |
| **Agent principals** *(non-human)* | Per `PLAT-IDENTITY-1` | Least-privilege scope per principal | scoped service principal |

> Role slugs align with the brief's canonical role list and the platform RBAC model resolved
> through `PLAT-SETTINGS-1`. "Weave platform operator" is an internal identity that never
> appears in any client workspace's RBAC. Onboarding maps non-primary roles to the four
> primary paths: Engineer/Automation author → technical; Ops/SRE → admin; Brand/content →
> business; Viewer → business-read-only (resolve-by-default 10).

---

## 3. User Stories

### Epic 0: Foundation & Boilerplate (MVP — Phase 1, FIRST; gates everything)

The shared platform foundation every other epic and engine depends on (audit gap C1). It is the
one-time scaffold the harness's per-project step does not cover.

**E0-S1: Codebase + tooling.** As a platform engineer, I want a scaffolded monorepo so work starts
on a consistent base. **AC:** Given a clone, when `<bootstrap>` runs, then the workspace, package
layout, `uv`+`pnpm`, conventional-commit hooks, and npm scripts exist; `<test>`/`<lint>` run green.
**AC (failure):** a bare `pip install` is rejected by the uv-enforce gate.

**E0-S2: IaC + remote state.** **AC:** Given the Terraform root, when `terraform apply` runs against
the shared dev account, then base AWS (Cognito pool, Bedrock access, networking, Secrets Manager) is
provisioned and state persists in **S3 with DynamoDB locking**; no secret is committed (secret-scan).

**E0-S3: App shell + design system + Storybook.** **AC:** Given the Next.js 15 shell, when it boots,
then it renders the nav/providers/theming using the **design system** (`docs/standards/design/`
tokens), and a **Storybook** renders the component catalogue with a visual-regression baseline.

**E0-S4: CI/CD + quality gates.** **AC:** Given a PR, when CI runs (GitHub Actions, OIDC to AWS, env
protection), then it is **red** on any of: lint error, **complexity** over budget, **SAST** high
finding, **secret** detected, or non-conventional commit.

**E0-S5: Test + release gates.** **AC:** Given the built app, when CI runs, then unit + UI +
**Playwright E2E** + **visual-regression** execute, and the release gate is **red** unless
**Lighthouse = 100 across all four categories** and **axe = 0** (WCAG 2.1 AA).

**E0-S6: Auth + model connectivity.** **AC:** Given a request, when auth resolves, then Cognito
issues a JWT with role claims + agent service principals; and the **model-routing abstraction**
resolves provider+model per env (local→Ollama, cloud→Bedrock) from one config — no AWS creds for the
local inner loop (`_dev-environment.md §3`).

**E0-S7: API + observability scaffold.** **AC:** an **OpenAPI 3.1** contract is generated + validated
in CI (`api-conventions.md`); **OTel/ADOT** spans emit; a health route + smoke test pass.

**E0-S8: AI evaluation harness.** **AC:** **promptfoo** CI evals + **Bedrock Model Evaluation** run on
prompt/agent changes (`testing-agents.md`). **Priority:** Should.

**E0-S9: Local dev environment.** **AC:** Given a clone, when `docker compose up` runs, then a full
local stack (Oxigraph, Postgres, LocalStack S3/SQS/SNS, Redis, Ollama) starts with seed data and
**zero live AWS** for the inner loop (`_dev-environment.md` DX1/DX4).

**Priority:** Must Have (E0-S8 Should). Full detail: [EPIC-000.md](./epics/EPIC-000.md).

---

### Epic 1: Dashboard — Fixed MVP Default (MVP) + Generative Composition (Phase 2)

> **Staging (user decision).** At MVP the dashboard is a **simple fixed default** (E1-S0) — a
> hand-composed set of CE-sourced widgets, no prompt bar, no AI composition. The **generative
> composition surface and full widget lifecycle (E1-S1–E1-S7) are deferred to Phase 2** and light
> up per-engine as data sources ship. The generative capability is fully specified below and
> **phase-tagged Phase 2** throughout.

**E1-S0: Simple fixed default dashboard (MVP)**
As **any workspace member**, I want a useful default home on first login so the workspace is not
blank before the generative dashboard ships.
- **AC:** Given first login to a workspace at MVP, then the dashboard renders a **fixed, hand-composed
 set of CE-sourced widgets** (ontology health / coverage via `CE-METRICS-1`) — the handful of widgets
 that exist because CE is the only live provider; there is no prompt bar and no AI composition.
- **AC:** Given the fixed default, then it **persists as the workspace default** across sessions and
 devices (server-side, not localStorage); it is read-only-composed at MVP (members do not add/remove
 tiles until the Phase-2 lifecycle ships).
- **AC:** Given a Phase-2 engine ships new metrics, then its widgets become **available to add to the
 default via the generative surface** — the fixed default is the floor, not a ceiling.
- **AC (failure):** Given `CE-METRICS-1` errors on load, then each affected tile renders the defined
 "data source unavailable" state with retry, never a blank tile, and the rest of the default still loads.
- **AC:** Each tile shows a data-source footer label naming its contract (`CE-METRICS-1`).
- **Priority:** Must Have (MVP)

**E1-S1: Request a widget by describing what you want** *(Phase 2)*
As **any workspace member**, I want to type a natural-language prompt into the dashboard
prompt bar and have the AI render the best-fit widget so that I get workspace intelligence
without a configuration UI.
- **AC:** Given the Dashboard is open, when I focus the prompt bar (Cmd+K or click) and submit
 a prompt, then the AI selects a component type from the finite library, calls the owning
 engine's metrics contract for an available data category, and streams the widget into the
 grid; the streaming header + skeleton appear within a configurable target (default 1 s,
 tunable per workspace).
- **AC (failure — provider unavailable):** Given the source engine's metrics endpoint returns
 an error/timeout or is not yet GA (engine not shipped), when I submit the prompt, then the
 widget shows a defined "data source unavailable" state (named reason + retry control), never
 a blank or hallucinated widget. (Resolves.)
- **AC (failure — LLM provider down):** Given the AI provider is unconfigured/unreachable,
 when I submit, then the prompt bar shows a defined offline state (HTTP 503 surfaced as a
 readable message, matching the prototype `LlmBar` 503 behaviour) and the prompt is
 retryable.
- **AC (failure — budget cap mid-stream):** Given the workspace AI budget cap (resolved via
 `PLAT-SETTINGS-1`) is reached during streaming, then generation halts with the E8-S2 cap
 message and any partial widget is rolled back (no partial save).
- **AC:** Each rendered widget shows a footer label naming its data source contract(s).
- **Priority:** Must Have

**E1-S2: AI picks the best component type for the intent** *(Phase 2)*
As **any workspace member**, I want the AI to choose the visualisation so the widget is
useful without me specifying a chart type.
- **AC:** Given a prompt, when the AI resolves intent, then it maps to exactly one component
 type by declarative rule (count/status→KPI, trend→line/area, comparison→bar, ranked→list,
 log→activity feed, ratio→pie/donut, two-dim matrix→heatmap, alert→banner).
- **AC:** Given I name a type in the prompt ("…as a table"), the named type overrides the rule.
- **AC (failure):** Given a prompt whose data shape has no matching component, then the widget
 declines with the unsatisfiable-prompt message (E1-S1) rather than forcing an ill-fit chart.
- **AC (change visualisation, FR-006):** Given a rendered widget, when I pick a different
 component type from the widget's inline "Change visualisation" control, then the same
 underlying data re-renders in the new type with no new prompt and no re-fetch; an
 incompatible type (e.g. a single scalar as a heatmap) is disabled in the control with a reason.
- **Priority:** Must Have

**E1-S3: Refine a widget after generation** *(Phase 2)*
As **any workspace member**, I want to refine a widget with a follow-up prompt so I can
iterate without starting over.
- **AC:** Given a rendered widget, when I submit a refine prompt, then it applies as a delta on
 the current widget definition and re-renders; refinement history is retained (default 10
 steps, tunable per workspace).
- **AC:** Given I save the widget, then the final resolved prompt + parameters are stored, not
 the history.
- **AC (failure):** Given a refine prompt that cannot be applied, then the prior widget state
 is preserved and an inline error is shown (no silent reset).
- **Priority:** Must Have

**E1-S4: Pin a widget (server-side, per-user)** *(Phase 2)*
As **any workspace member**, I want to pin a widget so it persists across sessions and
devices and reloads with live data.
- **AC:** Given a rendered widget, when I pin it, then its definition (resolved
 intent/parameters, component type, data-source bindings, title, column span) is persisted
 **server-side, scoped to (tenant, user)** — never localStorage-only — so it is cross-device,
 RBAC-scoped, and audit-visible. (Resolves + cross-seam; supersedes prior OQ-08.)
- **AC:** Given pinned widgets, then they arrange in a responsive grid (default 1–4 columns,
 tunable) and can be dragged to reorder.
- **AC:** Given a pinned widget, then it auto-refreshes at a configurable interval (default
 5 min, tunable per workspace) or on demand.
- **AC (failure):** Given a refresh whose provider errors, then the widget retains its last
 successful render with a stale-data badge + timestamp; it does not blank out.
- **Priority:** Must Have

**E1-S5: Publish a widget to the workspace library (server-side, team-shared)** *(Phase 2)*
As **any workspace member**, I want to publish a pinned widget so colleagues can add it.
- **AC:** Given a pinned widget, when I publish with a name + description, then it is stored
 server-side, workspace-scoped, and listed in the Workspace Library panel with author +
 publish date (mirrors Explorer Saved Views `D2`).
- **AC:** Given a library widget, when another member adds it, then an independent (tenant,
 user) copy is created that refreshes from the same contract but is independently refinable.
- **AC (failure):** Given a publish by a user lacking author permission, then it is rejected
 with HTTP 403 and the reason surfaced.
- **Priority:** Must Have

**E1-S6: Default starter widgets (first load)**
As a **new user**, I want useful starter widgets so the screen is not blank.
- **AC:** Given first login to a workspace, then the dashboard pre-populates with
 role-appropriate **MVP-eligible (CE-sourced) starter widgets only**; widgets whose source
 engine is not GA are not offered as starters.
- **AC:** Given starter widgets, then they are labelled "Suggested" and individually removable;
 once the user pins/removes any, the Suggested state clears.
- **AC (failure):** Given a starter widget's source contract (`CE-METRICS-1`) errors on first
 load, then that widget renders the defined unavailable state with retry, never a blank tile,
 and the rest of the starter set still loads.
- **Priority:** Must Have

**E1-S7: Prompt examples and suggestions**
As a **new user**, I want clickable example prompts so I learn what to ask.
- **AC:** Given an empty prompt bar, then a set of role-tailored example prompts (default 4–6,
 tunable) is shown, scoped to **available** data categories; they disappear after the user
 has generated a configurable number of widgets (default 3, tunable).
- **AC:** Given I click an example, then it populates the bar and generates the widget.
- **AC (failure):** Given a clicked example resolves to a category whose source engine is not
 GA, then it surfaces the "source engine not yet available" state rather than appearing to fail.
- **Priority:** Should Have

---

### Epic 2: Widget Library (engine-sourced data categories, phase-gated)

> Each widget category is available **once its source engine is live**. MVP-eligible =
> Constitution-sourced via `CE-METRICS-1` / `CE-DIFF-1` / `CE-VERSION-1` / `CE-EVENT-1`.
> Categories sourced from Build/Events/Explorer are "P0 when source engine ships" and render
> a "source engine not yet available" state until then. (Resolves.)

**E2-S1: Ontology health widgets** *(MVP — CE-sourced)*
As an **enterprise architect**, I want ontology-health widgets so I can monitor the model.
- **AC:** Given `CE-METRICS-1` (`entity_count_by_kind`, `latest_version`,
 `draft_published_delta`, `shacl_errors_by_severity`, `owl_inconsistencies`), then prompts
 like "ontology health" / "what changed since last publish" resolve to widgets bound to it.
- **AC (failure):** Given `CE-METRICS-1` errors, then the widget shows the unavailable state.
- **Priority:** Must Have (MVP)

**E2-S2: Graph completeness / knowledge-gap widgets** *(MVP — CE-sourced)*
As an **operations lead**, I want to see how completely the model is populated.
- **AC:** Given `CE-METRICS-1` + `CE-READ-1`, then data includes model coverage % per kind,
 entities missing required properties (SHACL warnings), capabilities with no owner, domains
 with zero instances; prompts like "show me knowledge gaps" resolve.
- **AC (failure):** unavailable state on contract error.
- **Priority:** Must Have (MVP)

**E2-S3: AI/token spend widgets** *(P0 when metering is live; CE-portion at MVP)*
As a **CTO**, I want to monitor AI spend so I can manage costs.
- **AC:** Given `PLAT-BILLING-1` metering (per-token AI generation + per-run automation),
 then data includes spend 7d/30d, by engine/user/project, budget burn vs cap (resolved via
 `PLAT-SETTINGS-1`), cost trend; a burn-rate alert fires at a configurable projected-burn
 threshold (default 90% projected, tunable per scope).
- **AC (failure):** Given a metering-pipeline gap, then the widget marks data as
 "metering delayed" with the last-known timestamp (metering events are never dropped —
 separate queue from run outcome per `PLAT-BILLING-1`).
- **Priority:** Must Have (token dimension available once `PLAT-BILLING-1` meters generation
 at MVP; per-run automation dimension P0 when Events ships)

**E2-S4: Active project pipeline widgets** *(P0 when Build Engine ships)*
As an **engineer**, I want to see active Build projects.
- **AC:** Given the Build Engine is GA and exposes its project metrics, then data includes
 project count by phase, projects at risk, artefacts shipped, agent success/failure rate.
- **AC (failure / engine not GA):** the category renders "Build Engine not yet available".
- **Priority:** P0 when Build Engine ships (dark until then)

**E2-S5: Compliance status widgets** *(MVP — CE-sourced)*
As a **compliance officer**, I want compliance widgets without opening Constitution.
- **AC:** Given `CE-METRICS-1` (`shacl_errors_by_severity`) + `CE-READ-1`, then data includes
 active SHACL contraventions by severity/domain, policy coverage gaps, self-audit results;
 contraventions deep-link to the entity via `CE-READ-1` (`/resource/{iri}`).
- **AC (failure):** unavailable state on contract error.
- **Priority:** Must Have (MVP)

**E2-S6: Self-improvement findings widgets** *(Weave-internal; client-scoped deferred)*
As a **Weave platform operator**, I want to see open Weave-product self-improvement proposals.
- **AC:** Given `BE-SELFIMPROVE-1` configured for Weave-the-product (A3), then data includes
 open proposal count by impact (HIGH/MEDIUM/LOW), oldest unactioned, recent (7d) — scoped to
 Weave-product proposals only, visible only to the Weave-internal platform-operator identity.
- **AC:** Given a non-platform-operator (any client-tenant role), then this widget is not
 offered and its data is not returned (no project-level/client-scoped proposals in v1).
 Client-scoped self-improvement (Polaris-style project+org proposals) is **deferred** — see
 OQ-08. (Resolves.)
- **Priority:** Should Have (Weave-internal)

**E2-S7: Ontology and project issue widgets** *(MVP for CE issues; Build issues gated)*
As an **enterprise architect**, I want issues across ontology and projects in one widget.
- **AC:** Given `CE-METRICS-1` (`owl_inconsistencies`) + `CE-READ-1` + `CE-VERSION-1`, then
 data includes unsatisfiable OWL classes, open validation warnings, and version-pin mismatches
 computed via the canonical version-lag in `CE-VERSION-1` (default stale = lag ≥ 2, tunable);
 Build-project issues appear once Build is GA.
- **AC (failure):** unavailable state per contract.
- **Priority:** Must Have for CE issues (MVP); Build-project rows P0 when Build ships

**E2-S8: Event automation and connector-health widgets** *(connector-health MVP; automation gated)*
As an **ops / SRE**, I want automation + connector status without opening Events.
- **AC:** Given `PLAT-CONNECTOR-1` health-status read API (`status, last_sync, last_error,
 error_count`), then connector-health widgets are available at MVP for the 7 v1 connectors.
- **AC:** Given the Events Engine is GA, then automation counts/failure-rate are added via the
 Events metrics surface; until then those rows render "Events Engine not yet available".
- **AC (failure):** a degraded/disconnected connector publishes a `PLAT-NOTIFY-1` event.
- **Priority:** Connector-health Must Have (MVP); automation rows P0 when Events ships

**E2-S9: Collaboration activity widgets** *(Phase 2 — Explorer realtime)*
As **any user**, I want to see graph collaboration activity.
- **AC:** Given async sharing at MVP (saved views + comments per `D1`/`D2`), then "recent graph
 edits by contributor" is sourced from `CE-EVENT-1` actor data and is MVP-eligible.
- **AC:** Given Graph Explorer realtime collab (Phase 2, `D1`), then active-canvas-session and
 presence widgets become available; until then they render "available in Phase 2". Presence /
 active-session is an **Explorer engine surface not yet contracted** — a realtime presence
 contract is a Phase-2 deliverable (tracked, no contract ID exists yet), consistent with how the
 not-yet-shipped Build/Events metrics rows are flagged.
- **Priority:** Should Have; realtime sub-widgets Phase 2

**E2-S10: Sentiment analysis on audit logs** *(MVP — reads PLAT-AUDIT-1)*
As an **ops lead**, I want sentiment over audit + agent-decision logs to spot rising error
patterns.
- **AC:** Given `PLAT-AUDIT-1` query API, then a periodic NLP job (`claude-haiku-4-5`, PII
 scrubbed before the model) computes a daily numeric sentiment per engine where
 positive=+1/neutral=0/negative=−1 and the daily score is the mean of classified entries, so
 a percentage drop is computable. (Resolves.)
- **AC:** Given the daily score series, then a spike alert fires when the score drops by more
 than a configurable threshold (default 20% vs trailing 7-day mean, **provisional — tune in
 tech spec**, owner Architect) and surfaces the driving entries as ranked "issue signals".
- **AC (failure):** Given the NLP provider is unavailable, then the widget shows last computed
 scores with a "sentiment refresh delayed" badge.
- **Priority:** Should Have (MVP, reads PLAT-AUDIT-1)

**E2-S11: Agent activity feed widget** *(per-engine; populated as engines ship)*
As an **engineer**, I want a feed of agent activity across engines.
- **AC:** Given `PLAT-AUDIT-1` + `PLAT-IDENTITY-1` (canonical principal IRI), then the feed
 shows agent principal, engine, action type, status, reverse-chronological, filterable.
- **AC:** Given only CE is GA, then the feed shows CE agent activity only and labels other
 engines as not-yet-available (no fabricated rows).
- **AC (failure):** Given `PLAT-AUDIT-1` is unreachable, then the feed shows the unavailable
 state rather than an empty feed that could be misread as "no agent activity".
- **Priority:** Should Have; rows per engine appear as each engine ships

**E2-S12: Version pinning status widget** *(P0 when Build/Events ship; CE-version source MVP)*
As an **architect**, I want to see which projects/automations pin which ontology version.
- **AC:** Given `CE-VERSION-1` canonical version-lag, then lag is computed centrally (not
 re-implemented); rows where lag ≥ default amber threshold (2, tunable) highlight amber, lag ≥
 default red threshold (4, tunable) red.
- **AC:** Given Build/Events are not GA, then there are no consumer rows to show and the widget
 states so; CE's own draft-vs-published delta is shown at MVP.
- **AC (failure):** Given `CE-VERSION-1` is unreachable, then lag is shown as "unknown" rather
 than defaulting to 0 (which would falsely imply every pin is current).
- **Priority:** P0 when Build/Events ship

**E2-S13: Graph growth trend widget** *(MVP — CE-sourced)*
As an **operations lead**, I want graph growth over time.
- **AC:** Given `CE-METRICS-1` history, then a line chart shows entity + relationship count
 over a configurable window (default 30/90 days, tunable).
- **AC:** Given a flat/declining trend beyond a configurable window (default 14 days, tunable),
 then a "model may be stagnating" footer advisory appears.
- **AC (failure):** Given `CE-METRICS-1` history is unavailable, then the chart shows the last
 cached series with a staleness badge, not an empty or zeroed chart.
- **Priority:** Must Have (MVP)

**E2-S14: RBAC and access coverage widget** *(MVP — platform-sourced)*
As a **workspace admin**, I want RBAC coverage at a glance.
- **AC:** Given the platform RBAC model (resolved via `PLAT-SETTINGS-1`) + `PLAT-IDENTITY-1`,
 then data includes users with no role, areas with no owner, recent role changes (default 7d,
 tunable), and agent principals with broad scope.
- **AC (failure):** Given the RBAC/identity source is unavailable, then the widget shows the
 unavailable state rather than reporting zero gaps (which would falsely imply full coverage).
- **Priority:** Should Have (MVP)

**E2-S15: Workspace onboarding progress widget** *(MVP — CE-sourced)*
As an **operations lead** in a new workspace, I want a setup-progress widget.
- **AC:** Given `CE-METRICS-1`, then completion % spans: ontology populated (≥1 entity per
 kind), first published version, plus connector configured via `PLAT-CONNECTOR-1`; each
 incomplete item has a "Complete now" deep-link; widget auto-dismisses at 100%.
- **AC:** Build-project completion item appears only once Build is GA.
- **AC (failure):** Given `CE-METRICS-1` is unavailable, then the widget shows the last computed
 completion % with a staleness timestamp rather than a false 0% or 100%.
- **Priority:** Must Have (MVP)

---

### Epic 3: Tenancy, Workspaces & Settings Cascade

**E3-S1: Create and switch workspaces (4-level cascade)**
As a **workspace admin**, I want to create and switch tenant contexts.
- **AC:** Given the 4-level cascade Company → Domain → Workspace → Project (`PLAT-SETTINGS-1`,
 A4), when I switch context, then the app reloads into that node's effective settings and all
 data is tenant-isolated at the storage layer per the §6 isolation mechanism.
- **AC:** Given workspace creation, then it requires name, slug, parent (Domain), and billing
 plan; the new node inherits parent settings (tighter-wins).
- **AC (failure):** Given a switch to a context the caller cannot access, then it is rejected
 with HTTP 403 and zero cross-tenant data is loaded (cross-tenant-read test, §6).
- **Priority:** Must Have

**E3-S2: Invite and manage members (bounded revocation)**
As a **workspace admin**, I want to invite/assign/remove members with controlled access.
- **AC:** Given an invite, then a Cognito-triggered email is sent; the admin assigns one or
 more canonical roles resolved through `PLAT-SETTINGS-1`.
- **AC (revocation, reconciled):** Given a member is removed or their role changed, then the
 enforcement mechanism is short-lived access tokens (default TTL ≤ 60 s, tunable) plus a
 per-request session-version check against a revocation list, so the next request bearing a
 prior token is rejected within a single bounded latency (default ≤ 60 s, tunable). FR-021
 and FR-024 use this one mechanism and one latency — "immediate" is replaced by the bounded
 value. (Resolves.)
- **Priority:** Must Have

**E3-S3: Settings cascade (budgets, retention, policy, RBAC)**
As a **workspace admin**, I want settings to inherit down the 4-level cascade with tighter-wins.
- **AC:** Given `PLAT-SETTINGS-1`, when I read a setting at any node, then the resolution API
 returns the effective value AND which level set it; a child may only tighten a parent value;
 loosening requires parent approval. Applies to AI budget caps, data retention, data
 classification, and RBAC. (Resolves.)
- **AC:** Given data-retention config per data type (audit, PROV-O, model versions) within
 platform minimums, then retention resolves through the cascade.
- **AC (failure):** Given an attempt to loosen a parent constraint without approval, then it is
 rejected and the attempt is recorded to `PLAT-AUDIT-1`.
- **Priority:** Must Have

---

### Epic 4: Authentication, RBAC & Agent Identity

**E4-S1: Sign in with Cognito (default) or Auth0 (multi-IdP)**
As **any user**, I want SSO so I do not manage a separate Weave password.
- **AC:** Given default auth, then AWS Cognito (email/password + hosted UI) is used.
- **AC:** Given an enterprise SSO requirement, then Auth0 SAML/OIDC is configured per workspace
 (Google Workspace, Okta, Azure AD).
- **AC (failure):** Given an IdP outage, then sign-in shows a defined error and does not fall
 back to an unauthenticated session.
- **Priority:** Must Have

**E4-S2: RBAC enforced at the API boundary**
As a **workspace admin**, I want RBAC enforced at the API so users only do what their role
permits.
- **AC:** Given every API request carries a Cognito JWT, then the platform validates role
 membership (resolved through `PLAT-SETTINGS-1`) and rejects unauthorised ops with HTTP 403.
- **AC:** Roles control read/author/publish/admin per engine/area; the full matrix is in the
 tech spec.
- **AC (failure):** Given a JWT for a role lacking a permission, then the op returns 403 and
 the denial is recorded to `PLAT-AUDIT-1`.
- **Priority:** Must Have

**E4-S3: Agent identities via the platform registry (IAM-backed)**
As a **workspace admin**, I want agents to act under named, least-privilege identities so
their actions are auditable.
- **AC:** Given `PLAT-IDENTITY-1`, then each agent principal is minted/scoped by the registry,
 reconciling Platform agent classes + Build's 5 dark-factory roles + Events' per-automation
 principals into one canonical principal IRI; the IRI appears in PROV-O and every
 `PLAT-AUDIT-1` entry. (Resolves + cross-seam.)
- **AC (machine auth path):** Given an agent must access AWS/secrets, then it assumes an **IAM
 role via STS** (short-lived credentials; never raw secret values) — the human auth path
 (Cognito) and the machine auth path (IAM/STS) are distinct; the registry records which IAM
 role maps to which canonical principal IRI and to which RBAC role at the Weave API boundary.
- **AC:** Admins can view agent principals + scopes in Settings.
- **AC (failure):** Given a principal attempts an out-of-scope action, then it is denied
 (least-privilege) and logged to `PLAT-AUDIT-1`.
- **Priority:** Must Have

---

### Epic 5: Global Navigation & Search

**E5-S1: Primary navigation (top header)**
As **any user**, I want persistent top-bar navigation.
- **AC:** Given any screen, then the top bar shows: [Weave logo + workspace switcher]
 [Dashboard · Constitution · Explorer · Build · Automate · **Compliance** · Settings]
 [Search] [Notifications] [Help] [Account]; the active area is highlighted; the left sidebar
 updates to the active engine.
- **AC:** Audit is a **sub-view under Compliance**, not a separate top-level area — the
 Compliance area is the platform-owned cross-cutting surface that aggregates per-engine
 compliance views (resolve-by-default 8). This resolves the brief's deferred Compliance-merge
 question and + the compliance-nav cross-seam.
- **AC:** Areas whose engine is not GA (Explorer/Build/Automate at MVP) are shown disabled with
 a "coming soon" affordance, not hidden, so the IA is stable.
- **AC (failure):** Given a user navigates to an area their role cannot access, then they are
 routed to a 403 state (not a blank shell) and the denial is recorded to `PLAT-AUDIT-1`.
- **Priority:** Must Have

**E5-S2: Global search (Cmd+K)**
As **any user**, I want global search across available engines.
- **AC:** Given Cmd+K, then results are grouped (Entities, Projects, Automations, Wiki, Specs,
 Users), keyboard-navigable, ranked by relevance + recency, with `:type` narrowing; results
 return within a configurable target (default 300 ms after a 150 ms debounce, **provisional**,
 owner Architect).
- **AC:** Given an engine is not GA, then its result group is omitted (no empty fabricated
 group).
- **AC (failure):** Given the search index is unavailable, then a defined error state is shown.
- **Priority:** Must Have

**E5-S3: Help & guided tour launcher**
As a **new user**, I want help + a role-tailored guided tour.
- **AC:** Given the ? launcher, then it opens help-doc search, "Take a tour" (role-tailored to
 the four primary onboarding paths), shortcuts, and a docs link.
- **AC (failure):** Given the docs source is unreachable, then the launcher still opens with
 shortcuts + an offline notice, rather than failing to open.
- **Priority:** Should Have

---

### Epic 6: Notifications (PLAT-NOTIFY-1)

**E6-S1: In-app + Slack notification centre**
As **any user**, I want a notification bell so I do not miss alerts that need attention.
- **AC:** Given `PLAT-NOTIFY-1` (one service, **open/registerable** type taxonomy — not a
 fixed enum), then engines publish notification events; delivery is in-app + Slack (Slack via
 `PLAT-CONNECTOR-1`). Covered types include: budget, HIGH SHACL violation, self-improvement
 proposal, build state, HITL-gate fired, automation-failure, connector-degraded,
 onboarding-activation, version-pin mismatch. (Resolves transport ambiguity +
 notifications cross-seam.)
- **AC:** Given a notification, then clicking it deep-links to the relevant screen; "mark all
 read" clears the badge; in-app delivery target is a configurable default (default 30 s,
 **provisional**, owner Architect).
- **AC (failure):** Given a delivery-channel failure (e.g. Slack token invalid), then the
 notification still appears in-app and the channel failure is itself recorded.
- **Priority:** Must Have

**E6-S2: Notification preferences**
As **any user**, I want to choose which types I receive and email-digest cadence.
- **AC:** Given Settings → Notifications, then per-user toggles per registered type + email
 digest (none/daily/weekly) are honoured.
- **AC (failure):** Given a preference write fails, then the prior preference is retained and an
 error is shown; a missing preference defaults to "on" so no critical alert is silently muted.
- **Priority:** Should Have

---

### Epic 7: Managed Connectors (PLAT-CONNECTOR-1)

**E7-S1: Configure a data connector**
As a **workspace admin**, I want to configure managed connectors.
- **AC:** Given `PLAT-CONNECTOR-1`, then the **7 v1 integrations** are: Snowflake · Databricks
 · S3 · Azure Data Lake · **Atlassian (Jira + Confluence, one OAuth/connector family)** ·
 ServiceNow · **Slack** (C2/C3). The config UI captures connection type, credentials (**AWS
 Secrets Manager only — no plain-text field**), sync direction (read/write/bidirectional),
 and sync frequency. (Resolves — Atlassian groups Jira+Confluence; "Azure Data
 Lake" is CLAUDE.md's "Azure".)
- **AC:** Credentials are stored exclusively in AWS Secrets Manager; the UI never displays a
 secret after entry; Slack token lives in Secrets Manager (C2).
- **AC (failure):** Given an invalid credential at save, then config fails closed (connector
 marked disconnected) and no secret is logged.
- **Priority:** Must Have

**E7-S2: Monitor connector health**
As a **workspace admin / ops**, I want connector health.
- **AC:** Given `PLAT-CONNECTOR-1` health-status read API, then each connector shows status
 (connected/degraded/disconnected), last_sync, last_error, error_count.
- **AC:** Given a degraded/disconnected connector, then a `PLAT-NOTIFY-1` event fires.
- **AC (failure):** Given the health read API itself is unreachable, then the row shows
 "health unknown" with the last successful poll time, never a false "connected".
- **Priority:** Must Have

**E7-S3: Connector-data ingestion + write-back semantics**
As a **workspace admin**, I want connector data ingested into the graph and agent write-backs
handled safely.
- **AC:** Given inbound connector data, then **platform ingestion** writes it into the graph
 via `CE-WRITE-1` (validated operations; resolves the duplicated Platform OQ-05 / CE OQ-05
 and the connectors cross-seam) under a connector-scoped agent principal (`PLAT-IDENTITY-1`).
- **AC (write-back failure):** Given an agent write-back to an external system
 (ServiceNow/Jira), then each write carries an idempotency key; on target 4xx/5xx the platform
 retries with bounded backoff (default 3 attempts, tunable) then publishes a
 `connector-degraded` `PLAT-NOTIFY-1` event and records the failure to `PLAT-AUDIT-1`; on an
 out-of-band change conflict the write is rejected and surfaced, not silently overwritten.
 (Resolves.) Bidirectional sync is v1 for the Atlassian + ServiceNow families;
 whether all 7 support write is OQ-07.
- **Priority:** Must Have (read/ingest); bidirectional per OQ-07

---

### Epic 8: Billing, Metering & Budgets (PLAT-BILLING-1)

> **Scope note :** the platform owns the cascade budget caps (`PLAT-SETTINGS-1`,
> 4-level tighter-wins), the two-dimension metering pipeline (`PLAT-BILLING-1`), and hard
> enforcement (reject before any AI API call at cap). The richer generation-loop FinOps
> mechanisms — per-spec and per-PR caps, model-tier gating, and cost-estimate-before-generation
> gating — are **Build-Engine generation-loop scope**, not platform v1; they consume the
> platform cap + metering primitives.

**E8-S1: Usage dashboard in Settings**
As a **workspace admin**, I want token usage + billing summary.
- **AC:** Given `PLAT-BILLING-1` (two dimensions: per-run automation + per-token AI), then
 Settings → Billing shows cycle spend, per-engine token breakdown, per-run automation count,
 plan tier, renewal date; usage updates with a configurable lag (default < 5 min,
 **provisional**, owner Architect).
- **AC (failure):** Given a metering delay, then the screen shows last-known totals with a
 staleness timestamp; metering events are never dropped (separate queue from run outcome).
- **Priority:** Must Have

**E8-S2: Set and enforce budget caps (cascade-resolved)**
As a **workspace admin**, I want budget caps enforced.
- **AC:** Given a cap set at any cascade node (`PLAT-SETTINGS-1`, tighter-wins; v1 supports the
 full Company/Domain/Workspace/Project cascade per A4), then spend is tracked against the
 effective cap; notifications fire at configurable thresholds (default 80% and 100%, tunable).
- **AC:** Given spend reaches 100% of the effective cap, then further AI-generation requests
 are rejected **before any AI API call** with the readable message ("Monthly AI budget cap
 reached…"). (Resolves cap depth.)
- **AC:** Given an admin raises the cap (within cascade rules), then it takes effect within a
 bounded latency (default ≤ 60 s, tunable) consistent with the cascade resolution path.
- **AC (failure):** Given metering lag risks a missed 100% gate, then the enforcement pre-check
 uses the most recent committed meter and fails closed at the cap.
- **Priority:** Must Have

---

### Epic 9: Immutable Audit (PLAT-AUDIT-1) & Weave-Product Self-Improvement

> A2: the platform owns **one** immutable audit/provenance service. Engines EMIT typed events;
> Build's decision-log and Events' run-log are VIEWS over it; CE PROV-O remains semantic
> provenance AND writes a corresponding `PLAT-AUDIT-1` entry. A3: the platform owns
> Weave-product self-improvement via the shared `BE-SELFIMPROVE-1` component; approval is
> Weave-internal only.

**E9-S1: Immutable, hash-chained audit trail (PLAT-AUDIT-1)**
As a **compliance officer**, I want an immutable, tamper-evident record of every consequential
platform event.
- **AC:** Given `PLAT-AUDIT-1`, then each entry is `{ seq, ts, actor_principal_iri, engine,
 event_type, target_iri, diff_summary, signature }` and forms a **hash chain** (each entry
 stores `prev_hash` and `hash`; per-entry ed25519 signature over the canonicalised entry +
 prev_hash), so tamper-evidence is verifiable, not merely a per-entry signature. (Resolves
; matches prototype hash-chain audit.)
- **AC:** Given the append-only constraint, then deletes are rejected at the **DB-constraint
 level** and the attempt itself is logged.
- **AC:** Given a query, then results are filterable by date/actor/event-type/resource/engine,
 paginated (default ≤ 500 rows/page, tunable), and exportable as JSON/NDJSON with a
 chain-verification procedure (recompute hash over canonicalised entry + prev_hash; verify
 ed25519 signature).
- **AC (tamper test):** Given any historical entry is altered or deleted, then chain
 verification fails at a named row (PRD-level AC §9).
- **AC:** Audit is exposed as a **sub-view under the Compliance area** (E5-S1), readable by the
 Compliance role. (Resolves.)
- **Priority:** Must Have

**E9-S2: Collect Weave-product improvement signals (Weave-internal)**
As a **Weave platform operator**, I want signals collected across dimensions to feed
self-improvement.
- **AC:** Given `BE-SELFIMPROVE-1` configured for Weave-the-product, then the platform collects
 signals across error, quality, performance, security, and engagement dimensions (sentiment,
 error-rate trend, HTTP 5xx rate, HITL-override frequency, retry rate by agent type, spec
 revision cycles, token-per-task cost, latency regression, visual-regression fail rate,
 dependency CVEs, feature-adoption drop, sign-off latency, RBAC gaps, budget-overrun
 frequency, cold-start/timeout rate).
- **AC (provisional thresholds):** Every numeric threshold in this signal set is a configurable
 default and **provisional — to be validated against baseline telemetry in the tech spec**,
 owner Architect: error rate > default 2× 7-day baseline; 5xx > default 1% over a trailing
 5-min window per endpoint; retry rate > default 30%; p99 latency > default 25% vs 7-day
 rolling p99; version lag amber ≥ default 2 / red ≥ default 4; sentiment drop > default 20% vs
 7-day mean; adoption sustained drop ≥ default 2 weeks; budget-overrun count per rolling
 30 days. Each states its data window + aggregation. (Resolves.)
- **AC:** Given collection cadence, then it is configurable: real-time (default < 5 min) for
 error/HTTP/cold-start/timeout; hourly for HITL/retry/token/latency; daily for
 sentiment/spec-revision/adoption/CVE/RBAC.
- **AC:** This is **Weave-internal**: signals are over Weave's own product telemetry; no
 client-tenant role sees this surface.
- **AC (failure):** Given a signal's telemetry source (CloudWatch, CI scan, `PLAT-AUDIT-1`) is
 unavailable or returns insufficient samples, then the signal is marked stale/insufficient and
 does NOT emit a false threshold breach (no draft issue is generated from missing data).
- **Priority:** Must Have (Weave-internal)

**E9-S3: Draft GitHub issues from signals (DRAFT, Weave-internal repo)**
As a **Weave platform operator**, I want signals analysed into drafted GitHub issues in
Weave's product repo.
- **AC:** Given a signal crosses its (provisional) threshold, then `claude-opus-4-8` drafts an
 issue (title, root-cause hypothesis, evidence with links to audit/log records, signal value
 vs baseline, suggested-fix category, auto-labels, impact estimate) in **DRAFT** state in
 **Weave's own product GitHub repo** via a Weave-bot service account whose credential lives in
 **AWS Secrets Manager only** (never env, never logged).
- **AC (duplicate detection):** Given a new draft, then it is embedded (model + cosine metric
 specified in tech spec; S3 Vectors per stack) and compared to open issues; if similarity
 exceeds a threshold (default 0.85, **provisional — tune against a labelled duplicate set in
 tech spec**, owner Architect, OQ-09), evidence is appended to the existing issue instead of
 creating a duplicate. (Resolves.)
- **AC (failure):** Given the GitHub API is unavailable, then the draft is queued locally and
 retried; nothing is silently lost.
- **AC:** This surface is visible **only to the Weave-internal platform-operator identity**;
 the Weave product repo and dark-factory dispatch are not exposed in any client workspace's
 RBAC. (Resolves.)
- **Priority:** Must Have (Weave-internal)

**E9-S4: Human approval + dark-factory dispatch (Weave-internal only)**
As a **Weave platform operator**, I want to approve/reject a draft and dispatch approved ones
to the dark factory.
- **AC:** Given a draft issue, then a **Weave-internal platform operator** (NEVER a client
 workspace admin) sees evidence, the drafted body, a cost estimate, a confidence rating, and
 Approve → publish & dispatch / Reject / Edit actions. (Resolves.)
- **AC:** Given approval, then the issue is published to the Weave repo and a dark-factory task
 is created following the standard task-brief + HITL-gate + `PLAT-AUDIT-1` pipeline via
 `BE-SELFIMPROVE-1`; status pipeline: Draft → Approved/Rejected → Dispatched → Implemented.
- **AC (M3 dispatch target clarified):** At Platform Phase 1, `BE-SELFIMPROVE-1`'s dispatch target
 is Weave's **existing engineering harness/repo** (the dark-factory loop already in this codebase),
 NOT the not-yet-built Build product — Platform P1 delivers and configures the internal instance of
 the shared component; it does not depend on the Build Engine being GA.
- **AC:** Given rejection, then the draft is retained with reason + rejector identity and is
 never deleted (append-only).
- **AC (authz failure):** Given a client-tenant role attempts approval/dispatch, then it is
 rejected with HTTP 403 and logged; the action is not in any client RBAC scope.
- **Priority:** Must Have (Weave-internal)

---

## 4. Functional Requirements

> Every FR carries a Phase/depends-on tag. "MVP" = buildable against CE + platform contracts.
> "P0 when <engine> ships" = the requirement is P0 but dark until its source engine is GA.

| ID | Requirement (behaviour + failure mode + acceptance) | Story | Priority | Phase / depends-on |
|---|---|---|---|---|
| FR-001 | Prompt bar visible, keyboard-focusable (Cmd+K), always present; focus testable headlessly | E1-S1 | P0 | MVP |
| FR-002 | AI selects component type, calls owning metrics contract, streams widget; on provider error → defined unavailable state, never blank/hallucinated | E1-S1 | P0 | MVP (CE contracts) |
| FR-003 | Streaming header/skeleton within default 1 s (tunable); on LLM 503 → offline state, retryable | E1-S1 | P0 | MVP |
| FR-004 | AI declines unsatisfiable prompts with a named reason — missing/unavailable data source (E1-S1) or no matching component for the data shape (E1-S2); never blank/hallucinated | E1-S1, E1-S2 | P0 | MVP |
| FR-005 | Declarative component mapping (count→KPI … alert→banner); no free-form code | E1-S2 | P0 | MVP |
| FR-006 | "Change visualisation" switches type without re-prompt | E1-S2 | P1 | MVP |
| FR-007 | "Refine" delta prompt; history default 10 steps (tunable); failed refine preserves prior state | E1-S3 | P0 | MVP |
| FR-008 | Pin persists widget **server-side, (tenant,user)-scoped** (not localStorage); cross-device, RBAC-scoped, audit-visible | E1-S4 | P0 | MVP |
| FR-009 | Pinned auto-refresh default 5 min (tunable) + manual; provider error → last render + stale badge | E1-S4 | P0 | MVP |
| FR-010 | Responsive grid default 1–4 columns (tunable); drag-reorder | E1-S4 | P1 | MVP |
| FR-011 | Publish to **server-side, workspace-scoped** library; author+date; 403 if no author perm | E1-S5 | P0 | MVP |
| FR-012 | Role-tailored **MVP-eligible (CE-sourced)** starter widgets; "Suggested"; removable | E1-S6 | P0 | MVP |
| FR-013 | Example prompts (default 4–6, tunable) scoped to available categories; disappear after default 3 widgets (tunable) | E1-S7 | P1 | MVP |
| FR-014 | Data-source footer label citing the contract(s) on every widget | E1-S1 | P0 | MVP |
| FR-015 | A widget category is available **once its source engine is live**; CE-sourced categories MVP, others "P0 when source engine ships"; non-GA categories render a defined unavailable state | E2-S1–S15 | P0–P1 per story | phased per category |
| FR-016 | Compliance widgets deep-link to the entity via `CE-READ-1` (`/resource/{iri}`) | E2-S5 | P0 | MVP |
| FR-017 | Sentiment widget over `PLAT-AUDIT-1`; numeric mapping (+1/0/−1, daily mean); spike at default 20% drop vs 7-day mean (provisional) | E2-S10 | P1 | MVP |
| FR-018 | Version-pin lag computed via `CE-VERSION-1` canonical lag; amber ≥ default 2, red ≥ default 4 (tunable) | E2-S12 | P1 | P0 when Build/Events ship |
| FR-019 | Onboarding progress widget; deep-links; auto-dismiss at 100%; Build item only when Build GA | E2-S15 | P0 | MVP |
| FR-020 | Workspace switcher lists accessible workspaces + Hammerbarn demo; reload on switch; 403 + zero cross-tenant data on unauthorized switch | E3-S1 | P0 | MVP |
| FR-021 | Member removal/role-change enforced via short token TTL (default ≤ 60 s) + per-request session-version revocation check; next request with prior token rejected within bounded latency | E3-S2 | P0 | MVP |
| FR-022 | Settings cascade `PLAT-SETTINGS-1` (Company→Domain→Workspace→Project, tighter-wins); resolution API returns effective value + level; loosening needs parent approval; covers budget/retention/classification/RBAC | E3-S3 | P0 | MVP |
| FR-023 | Cognito default; Auth0 SAML/OIDC per workspace; IdP outage → defined error, no unauth fallback | E4-S1 | P0 | MVP |
| FR-024 | RBAC at API via JWT (roles resolved via `PLAT-SETTINGS-1`); 403 + audit on denial; reconciled to FR-021's single revocation latency | E4-S2 | P0 | MVP |
| FR-025 | Agent identities via `PLAT-IDENTITY-1`: canonical principal IRI in PROV-O + every `PLAT-AUDIT-1` entry; AWS/secret access via **IAM role assumed by STS** (not Cognito); registry maps IAM role↔principal↔RBAC role | E4-S3 | P0 | MVP |
| FR-026 | Persistent top bar; 7 areas incl Compliance (Audit is a Compliance sub-view, not separate); non-GA areas shown disabled | E5-S1 | P0 | MVP |
| FR-027 | Global search Cmd+K; grouped; `:type`; default 300 ms / 150 ms debounce (provisional); non-GA engine groups omitted; index-down → defined error | E5-S2 | P0 | MVP |
| FR-028 | Help launcher: docs search, role-tailored tour (4 primary paths), shortcuts, docs link | E5-S3 | P1 | MVP |
| FR-029 | `PLAT-NOTIFY-1` centre: **open type taxonomy** (not fixed enum); in-app + Slack; deep-link; mark-all-read; channel-failure still delivers in-app + logged; default 30 s delivery (provisional) | E6-S1 | P0 | MVP |
| FR-030 | Per-user notification prefs: toggle each registered type; email digest cadence | E6-S2 | P1 | MVP |
| FR-031 | `PLAT-CONNECTOR-1` config: 7 v1 connectors (Snowflake·Databricks·S3·Azure Data Lake·Atlassian[Jira+Confluence]·ServiceNow·Slack); credentials **AWS Secrets Manager only**; sync direction+frequency; invalid cred → fail closed, no secret logged | E7-S1 | P0 | MVP |
| FR-032 | `PLAT-CONNECTOR-1` health read API (status,last_sync,last_error,error_count); degraded/disconnected → `PLAT-NOTIFY-1` event | E7-S2 | P0 | MVP |
| FR-033 | Connector-data ingestion writes to graph via `CE-WRITE-1` under a connector-scoped principal; write-back: idempotency key, bounded retry (default 3, tunable), conflict-reject, failure → `PLAT-NOTIFY-1` + `PLAT-AUDIT-1` | E7-S3 | P0 | MVP (ingest); bidirectional per OQ-07 |
| FR-034 | `PLAT-BILLING-1` usage screen: per-token + per-run dimensions; per-engine breakdown; default < 5 min lag (provisional); metering never dropped (separate queue); delay → last-known + timestamp | E8-S1 | P0 | MVP (token); per-run when Events ships |
| FR-035 | Budget cap resolved via `PLAT-SETTINGS-1` cascade (full 4-level, tighter-wins); alerts default 80%/100% (tunable); hard reject **before any AI API call** at 100%; fail-closed under metering lag | E8-S2 | P0 | MVP |
| FR-036 | `PLAT-AUDIT-1` entries hash-chained (prev_hash→hash) + ed25519 signature; append-only at DB-constraint level; delete rejected + logged | E9-S1 | P0 | MVP |
| FR-037 | Audit queryable by date/actor/type/resource/engine; paginated (default ≤ 500/page, tunable); JSON/NDJSON export with chain-verification procedure | E9-S1 | P0 | MVP |
| FR-038 | Audit exposed as a **sub-view under Compliance** (not a separate top-level area); Compliance role read access | E9-S1 | P0 | MVP |
| FR-039 | Weave-product signal collection via `BE-SELFIMPROVE-1`; all numeric thresholds = configurable defaults, **provisional** (window+aggregation stated); Weave-internal only | E9-S2 | P0 | MVP (Weave-internal) |
| FR-040 | Signal cadence configurable: real-time (default <5 min) errors; hourly agent-quality; daily sentiment/adoption/CVE/RBAC | E9-S2 | P0 | MVP (Weave-internal) |
| FR-041 | On threshold breach `claude-opus-4-8` drafts a DRAFT GitHub issue in **Weave's product repo**; Weave-bot credential in **AWS Secrets Manager**; GitHub-API-down → queued+retried | E9-S3 | P0 | MVP (Weave-internal) |
| FR-042 | Duplicate detection: embed (S3 Vectors, cosine) vs open issues; default 0.85 similarity (provisional, OQ-09) → append evidence not duplicate | E9-S3 | P0 | MVP (Weave-internal) |
| FR-043 | Self-improvement surface + approval/dispatch visible/actionable **only to Weave-internal platform operator**; client-tenant attempt → 403 + logged | E9-S3, E9-S4 | P0 | MVP (Weave-internal) |
| FR-044 | Approval publishes issue + creates dark-factory task via `BE-SELFIMPROVE-1` (task brief + HITL gate + `PLAT-AUDIT-1`); status Draft→Approved/Rejected→Dispatched→Implemented; rejected retained, never deleted. **At MVP the dispatch target is Weave's existing engineering harness/repo (this Claude Code dark-factory harness), NOT the not-yet-built Build-Engine product** (resolves audit M3) | E9-S4 | P0 | MVP (Weave-internal) |

---

## 5. Inter-engine Interfaces

> Contracts referenced by ID from `docs/specs/_inter-engine-contracts.md`. Consumed contracts
> are pinned to a version (`?version=latest` auto-tracks newest published per B2 unless a
> consumer pins).

### Consumed (this engine calls / reads)

| Provider engine | Contract | Version pin | Used for |
|---|---|---|---|
| Constitution Engine | `CE-METRICS-1` | latest | Dashboard CE-sourced widgets (ontology health, completeness, compliance, growth, onboarding, issues) — the MVP-eligible set |
| Constitution Engine | `CE-READ-1` | latest | Entity deep-links, completeness reads, search over entities |
| Constitution Engine | `CE-VERSION-1` | latest | Canonical version-lag for the version-pin widget (no local re-implementation) |
| Constitution Engine | `CE-DIFF-1` | latest | Draft-vs-published delta widgets |
| Constitution Engine | `CE-EVENT-1` | latest | Live activity / recent-edit widgets (Should Have; degrade to polling `CE-READ-1` since-version) |
| Constitution Engine | `CE-WRITE-1` | latest | Connector-data ingestion writes into the graph (validated ops) |
| Build Engine | `BE-SELFIMPROVE-1` | latest | Shared signal→issue→dispatch component for Weave-product self-improvement (configured Weave-internally). At Platform-P1 the dispatch target is Weave's **existing engineering harness/repo**, NOT the not-yet-built Build product (M3) |
| (Build metrics) | *engine surface, not yet contracted* | n/a | Active-project widgets — P0 when Build ships; metrics endpoint to be added to Build PRD |
| (Events metrics) | *engine surface, not yet contracted* | n/a | Automation widgets — P0 when Events ships |

### Provided (this engine exposes to others)

| Contract | Consumers | Shape (link) | Stability |
|---|---|---|---|
| `PLAT-AUDIT-1` | CE, Build, Events (emit); Compliance (read) | [contracts §2](../../_inter-engine-contracts.md) | stable |
| `PLAT-NOTIFY-1` | all engines (publish) | [contracts §2](../../_inter-engine-contracts.md) | stable |
| `PLAT-IDENTITY-1` | CE, Build, Events | [contracts §2](../../_inter-engine-contracts.md) | stable |
| `PLAT-CONNECTOR-1` | Events, Build, CE | [contracts §2](../../_inter-engine-contracts.md) | stable |
| `PLAT-SETTINGS-1` | all engines | [contracts §2](../../_inter-engine-contracts.md) | stable |
| `PLAT-BILLING-1` | all engines (emit meter) | [contracts §2](../../_inter-engine-contracts.md) | stable |

---

## 6. Non-Functional Requirements

### Performance

All targets are configurable defaults, **provisional** pending tech-spec validation against
real telemetry (owner Architect) — they are product assumptions, not contractual SLAs:

- Dashboard initial load (CE-sourced starter widgets, no prompt): default ≤ 2 s (p95).
- Generative widget: streaming header within default 1 s; fully rendered default ≤ 5 s (p95)
 for ≤ 1,000 data points.
- Global search: default ≤ 300 ms after a 150 ms debounce.
- Notification in-app delivery: default ≤ 30 s.
- Workspace switch: default ≤ 2 s.

### Security

- All secrets (connector credentials incl. Slack token, GitHub Weave-bot, API keys) in **AWS
 Secrets Manager only** — never logged, never returned in API responses, never in `.env`.
- RBAC enforced at the API boundary via Cognito JWT; roles resolved through `PLAT-SETTINGS-1`;
 unauthorised ops → HTTP 403 + `PLAT-AUDIT-1` entry. Test: a JWT lacking a permission is
 denied and the denial is audited.
- Agent (machine) auth path is **IAM role via STS** (short-lived; never raw secret values),
 distinct from the human Cognito path (`PLAT-IDENTITY-1`).
- Revocation: short access-token TTL (default ≤ 60 s) + per-request session-version check
 against a revocation list; test: after removal, the next request with the prior token is
 rejected within the bounded latency.
- Input validation at all API boundaries; SPARQL reads inherit CE's SELECT-only + SERVICE-block
 + pagination (B3) — the platform never issues unscoped or `SERVICE` queries.
- PII in audit/log data feeding the sentiment NLP is scrubbed before the model
 (`claude-haiku-4-5`).
- Audit integrity: hash chain (prev_hash→hash) + ed25519 per entry; append-only at DB-constraint
 level; tamper/delete fails chain verification (test in §9).

### Reliability

- `PLAT-NOTIFY-1` channel failure degrades to in-app delivery + logs the channel failure;
 no notification silently dropped.
- `PLAT-BILLING-1` metering events use a separate queue from run outcome — never dropped; budget
 enforcement fails closed under metering lag.
- `CE-EVENT-1` consumption degrades to polling `CE-READ-1` with a since-version if the stream is
 unavailable.
- Connector write-back: idempotency key + bounded retry (default 3) + conflict-reject; failures
 raise `connector-degraded` and audit entries.
- GitHub draft creation queues + retries on API outage.

### Observability

- Every AI widget generation emits an OpenTelemetry span with attributes: `prompt_hash`,
 `component_type`, `data_source_contract`, `token_count`, `latency_ms`, `tenant_id`.
- Notification delivery emits a delivery-receipt event (CloudWatch).
- Every audit write emits a span correlating `seq`, `actor_principal_iri`, `engine`.

### Accessibility

- Prompt bar, notification centre, settings, and Compliance/Audit screens: **WCAG 2.1 AA**;
 zero axe-core violations is a release gate.
- All primary dashboard actions (prompt submit, pin, refine, publish) keyboard-achievable.

### Isolation & data safety

- **Multi-tenant isolation mechanism (named):** the RDF/graph layer uses **named-graph-per-tenant
 with mandatory query-rewriting that REJECTS any unscoped query** (no tenant predicate ⇒ query
 refused), OR store-per-tenant — final choice is OQ-01 (owner Architect + CE team), but the
 *expectation and test are fixed now*. Aurora uses a `tenant_id` row predicate enforced in a
 base query layer; S3 Vectors are tenant-prefixed. (Resolves.)
- **Cross-tenant-read test (mandatory):** a query issued in tenant A's context returns **zero
 rows** from tenant B's seeded data, across RDF, Aurora, and S3 Vectors; an unscoped SPARQL
 query is rejected, not silently broadened.
- Dashboard widget state (pinned + library) is server-side and tenant/RBAC-scoped, so it is
 covered by isolation and audit (not localStorage).

### Browser / device support

- Chrome, Firefox, Safari — latest 2 major versions. Desktop-first; no mobile in v1.

---

## 7. Key Design Decisions Captured

| Decision | Rationale |
|---|---|
| Declarative generative UI (finite component library, RSC streaming) | Preserves design consistency; AI maps intent to a fixed component set, never free-form code. |
| Dashboard widgets are phase-gated by engine availability; MVP = CE-sourced only | Constitution ships first; Build/Events/Explorer data has no backing contract until those engines are GA (resolve-by-default 5; A1 sequencing). |
| One audit/provenance service (`PLAT-AUDIT-1`), hash-chained + ed25519 | A2: engines emit; Build/Events logs are views; tamper-evidence needs a chain, not just per-entry signatures. |
| One notification service (`PLAT-NOTIFY-1`) with an open type taxonomy + Slack | Resolve-by-default 1; engines publish; fixed-enum would not cover HITL/automation-failure/connector-degraded. |
| One agent-identity registry (`PLAT-IDENTITY-1`); machine auth = IAM/STS, human = Cognito | Cognito is human-oriented; agents need IAM roles for AWS/secret access (resolve-by-default 7). |
| Full 4-level settings cascade (`PLAT-SETTINGS-1`), tighter-wins | A4; one cascade resolves budgets, retention, classification, RBAC. |
| Billing meters both per-run automation and per-token AI (`PLAT-BILLING-1`) | C1; metering events never dropped (separate queue). |
| 7 v1 connectors incl. Atlassian-grouped + Slack (`PLAT-CONNECTOR-1`) | C2/C3; Atlassian = Jira+Confluence one OAuth family; Slack platform-managed. |
| Weave-product self-improvement is Weave-internal-only; shares `BE-SELFIMPROVE-1` | A3; client admins must never approve/dispatch changes to Weave's product repo. |
| Widget state persisted server-side (per-user pins + workspace library) | localStorage cannot be cross-device/RBAC/audit-scoped (resolves prior OQ-08). |
| Realtime collaborative editing is Phase 2 (Explorer-owned) | D1; MVP = single-user editing + async sharing (saved views + comments). |

---

## 8. Open Questions (for Tech Spec)

| # | Question | Owner |
|---|---|---|
| OQ-01 | Multi-tenant isolation final mechanism for the RDF layer: named-graph-per-tenant + query-rewriting vs store-per-tenant (Oxigraph/Neptune). Expectation + cross-tenant-read test fixed in §6; mechanism choice deferred. | Architect + CE team |
| OQ-02 | Streaming RSC pattern for widgets: Vercel AI SDK `streamUI`, Next.js server actions, or custom streaming endpoint. | Architect |
| OQ-03 | Widget data caching: cache last result for instant pre-refresh display vs always fetch fresh. | Architect |
| OQ-04 | Global search index: dedicated service (OpenSearch) vs SPARQL (`CE-READ-1`) + PostgreSQL full-text. | Architect |
| OQ-05 | `PLAT-AUDIT-1` storage: append-only DynamoDB vs PostgreSQL with constraint-based immutability, given hash-chain + query/export needs. Single decision (was Platform OQ-09 = Build OQ-04). | Architect |
| OQ-06 | Notification + `CE-EVENT-1` transport: SNS+Lambda fan-out, change-feed, or WebSocket — does NOT presuppose any realtime-sync/Yjs server (Yjs is Phase-2 Explorer). | Architect |
| OQ-07 | Connector bidirectional write support: which of the 7 connectors support write-back in v1 (Atlassian + ServiceNow confirmed); conflict-resolution policy detail. | Architect |
| OQ-08 | Client-scoped self-improvement (Polaris-style project+org proposals over client signals) — in a later phase? If yes, define the proposal entity schema and a client-facing surface; deferred out of v1. | PO + Build team |
| OQ-09 | Duplicate-issue similarity threshold (default 0.85) + embedding model + distance metric, tuned against a labelled duplicate/non-duplicate set. | Architect |
| OQ-10 | Signal collection pipeline: Lambda-per-signal vs shared aggregation service. | Architect |
| OQ-11 | GitHub integration: Weave-bot GitHub App (scoped, no PAT rotation) vs PAT. | Architect |
| OQ-12 | ODRL policy enforcement: deferred from v1 (v1 uses SHACL + data-classification properties for PII/sensitive handling); revisit as a later stack decision. | Architect |
| OQ-13 | Per-user dashboard widget state store choice (server-side decided; which store — Aurora vs DynamoDB) and render-cache strategy. | Architect |
| OQ-14 | **Local development experience / dev-loop — RESOLVED at PRD level** in [`_dev-environment.md`](../../_dev-environment.md): thin shared dev account (Cognito + Bedrock + small entities), everything else local (Oxigraph, Postgres, LocalStack, Redis, Ollama); tiered Ollama+Bedrock model routing via a configurable provider abstraction; full local test pyramid + gates → HITL → dev-AWS smoke → deploy. Residual tech-spec items (orchestration tool, Ollama model selection, smoke-suite scope, Bedrock dev cost guardrails, exact small-entity set) listed in that doc. | Architect (arch-stack + arch-infra) |

---

## 9. Acceptance Criteria (PRD-level)

The Weave Platform PRD is satisfied when:

- [ ] At MVP (only Constitution Engine GA): "show me active compliance contraventions by domain"
 renders a bar chart within the default target with live data from `CE-METRICS-1`; a prompt
 for a Build/Events-sourced category renders the defined "source engine not yet available"
 state rather than empty or fabricated data.
- [ ] A generated widget pinned by a user persists **server-side** and reloads on a different
 device for the same user; it is not visible to another tenant.
- [ ] A published workspace widget is added to a different user's dashboard from the
 server-side library.
- [ ] **Cross-tenant isolation:** a query issued in tenant A's context returns zero rows from
 tenant B's seeded data across RDF, Aurora, and S3 Vectors; an unscoped SPARQL query is
 rejected.
- [ ] A non-admin user is blocked (HTTP 403) outside their role and the denial appears in
 `PLAT-AUDIT-1`.
- [ ] After a member is removed, the next request bearing their prior token is rejected within
 the bounded revocation latency (default ≤ 60 s).
- [ ] An Atlassian (Jira) connector is configured (credential in Secrets Manager, never
 displayed); its health appears via `PLAT-CONNECTOR-1`; a degraded state raises a
 `PLAT-NOTIFY-1` event.
- [ ] A budget cap set at a Domain node enforces (tighter-wins) at a child Workspace; spend
 triggers notifications at default 80%/100% and rejects AI requests **before any AI API
 call** at 100%.
- [ ] A HIGH-severity SHACL contravention publishes a `PLAT-NOTIFY-1` event delivered in-app
 (and Slack if configured) within the default target.
- [ ] **Audit tamper test:** an audit entry records a graph mutation; altering or deleting any
 historical entry fails chain verification at a named row, and the delete attempt is itself
 logged.
- [ ] A Weave-product signal (e.g. rising HITL-override frequency) drafts a DRAFT GitHub issue
 in Weave's repo with root-cause + evidence, visible **only to a Weave-internal platform
 operator**; a client workspace admin attempting to approve/dispatch is rejected (403).
- [ ] A Weave platform operator approves a draft; it publishes to the Weave repo and creates a
 dark-factory task via `BE-SELFIMPROVE-1` following the standard HITL + `PLAT-AUDIT-1`
 pipeline; a rejected draft is retained with reason and cannot be deleted.
- [ ] Sentiment over `PLAT-AUDIT-1` returns a numeric daily score per engine (+1/0/−1 mean); a
 drop beyond the provisional 20% threshold fires an alert-banner widget.

---

## 10. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Dashboard appears empty/broken at MVP because most widgets depend on later engines | High | High | Phase-gate widgets to engine availability; ship a useful CE-sourced starter set; render explicit "not yet available" states (FR-015). |
| Tenant isolation mechanism undecided ⇒ cross-tenant leak | High | Med | Fix the expectation + cross-tenant-read test now (§6); defer only the mechanism (OQ-01); fail-closed on unscoped queries. |
| "Tamper-evident" audit defeated by single signing key | High | Med | Hash chain (prev_hash→hash) + ed25519 + DB-level append-only + chain-verification export (FR-036/037). |
| Client admin gains authority over Weave's product repo | High | Low | Self-improvement approval/dispatch restricted to Weave-internal operator identity, never in client RBAC (FR-043, E9-S3/S4). |
| Provisional thresholds treated as hard SLAs | Med | Med | All numbers marked "default X, tunable" / "provisional — tune in tech spec" with owner (§5, §6, E9-S2). |
| Revocation latency unachievable with long-lived JWTs | Med | Med | Short TTL + per-request session-version revocation check; single bounded latency (FR-021/024). |
| Metering events dropped ⇒ budget over-run | Med | Low | Separate metering queue; fail-closed enforcement at cap (PLAT-BILLING-1, FR-034/035). |

---

## Related

- [Brief](../01-brief/brief.md)
- [Inter-engine contracts](../../_inter-engine-contracts.md)
- [20Q Platform Strategy](../01-brief/20Q-platform-strategy.md)
- [Constitution Engine PRD](../../constitution-engine/02-prd/prd.md)
- [Graph Explorer PRD](../../graph-explorer/02-prd/prd.md)
- [Build Engine Brief](../../build-engine/01-brief/brief.md)
- [Events & Actions Engine Brief](../../events-actions-engine/01-brief/brief.md)

---
*Generated by Weave PO agent. Review and approve before proceeding to Roadmap.*
