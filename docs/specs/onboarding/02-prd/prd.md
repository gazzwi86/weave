---
type: PRD
title: Onboarding — Product Requirements Document
description: "Full product requirements for Weave Onboarding: the Hammerbarn demo workspace (per-user writable copy, manual reset), guided tours, role-tailored paths, training library, hands-on exercises, onboarding checklist, help launcher, and activation analytics."
tags: [onboarding, 02-prd, hammerbarn, guided-tour, training, activation]
status: Draft
timestamp: 2026-06-30T00:00:00Z
resource: docs/specs/onboarding/02-prd/prd.md
# --- provenance block (merged per frontmatter-schema.md) ---
source: hand-authored
confirmed_by: none
confirmed_on: null
last_verified_sha: 61dfc1553b18b5762902e1d2b3681c82f4ebb26c
expires_on: 2026-12-27
owner: gazzwi86
coverage: n/a
---

# PRD: Onboarding

**Brief:** [brief.md](../01-brief/brief.md)
**Status:** Draft
**Phase:** MVP (Constitution + Explorer portion) · full demo Phase 2 (Build + Events GA) · **Owner:** gazzwi86 · **Last Updated:** 2026-06-30

---

## 1. Product Context

### Background

Weave is conceptually novel — four engines, a semantic knowledge graph, and ideas like
ontologies, SHACL validation, and governed automation that most new users have never
encountered. Without a working example to learn from and guided paths through the product,
new users face a blank slate and an unfamiliar paradigm.

Onboarding solves this with three interlocking mechanisms:

1. **Hammerbarn demo workspace** — a fully-modelled, explorable example company (a fictional
 home-improvement retailer) that shows users what a complete Weave implementation looks like
 before they touch their own workspace. The seed is **built as a live pipeline** through the
 Constitution, Build, and Events engines (not a static migration snapshot), so it stays in
 step with the real product (decision E2).
2. **Guided overlay layer** — contextual tours, tooltips, beacons, and modals overlaid on
 the live product, role-tailored, always skippable, always re-accessible.
3. **Activation path** — a hands-on exercise set and an onboarding checklist that drives a
 new user to a first real outcome in their own workspace within their first session.

Onboarding is not a separate app or an external doc site. It is an overlay layer within the
single React SPA, keyed to navigation and screen anchors, consuming the platform RBAC model
for role-tailoring. Onboarding **owns no graph data of its own** — it reads the company model
through Constitution Engine contracts and renders it through the Graph Explorer canvas, so it
inherits the universal-ontology framing (Weave ships the grammar; the company writes the
sentences — decision A1).

### Goals

1. Every new user lands in a fully-modelled example (Hammerbarn) and can immediately see
 what "good" looks like — before touching their own workspace.
2. Contextual guidance covers every primary navigation area that has shipped, and is available
 at any time from the persistent help launcher.
3. New users reach a first real outcome in their own workspace quickly (time-to-outcome is a
 measure-and-report baseline for cohort 1, not a GA gate — decision E4).
4. Onboarding paths are role-tailored along **4 primary paths**, with an explicit mapping from
 the 9 canonical platform roles (decision: role-paths = 4 primary; others map to nearest).
5. Onboarding effectiveness is measurable by role (completion, activation, time-to-first-outcome).

### Non-Goals

1. **Producing final training videos** — v1 ships placeholders and the hosting framework;
 video production is a separate content effort.
2. **The Constitution Engine modelling tools** — onboarding curates and integrates the
 Hammerbarn seed; the modelling/authoring capability is owned by the Constitution Engine and
 consumed via CE-WRITE-1.
3. **The RBAC/identity system itself** — platform-owned (PLAT-IDENTITY-1, PLAT-SETTINGS-1);
 onboarding consumes resolved roles to tailor the experience.
4. **The tenant/sandbox isolation mechanism** — the per-user-copy storage topology is owned by
 the platform tenant model (PLAT-SETTINGS-1); onboarding states the isolation expectation and
 defers the mechanism to the tech spec (OQ-02).
5. **Rendering and removability of Dashboard starter widgets** — owned by the Platform
 Generative Dashboard (Platform PRD E1-S6 / FR-012); onboarding only contributes the
 role→widget-set mapping.
6. **Producing the Hammerbarn seed artefacts** — CE owns the ontology/glossary/brand/governance
 seed, Build owns the Kitchen Designer project + app, Events owns the example automations;
 onboarding is the **integrator** (cross-spec seam).
7. **Notification centre** — owned by the platform notification service (PLAT-NOTIFY-1);
 onboarding publishes `onboarding-activation` events to it, it does not build a centre.
8. **Formal certification / LMS** and **external marketing-site education** — out of v1.
9. **The governed-contribution / proposed-node ("under review") lifecycle** — owned by the
 Constitution Engine; out of scope for onboarding v1. Onboarding exercises write directly to
 the user's sandbox draft; they do not teach or surface the proposed/quarantine lifecycle in
 v1. If a future content task adds an exercise that demonstrates it, the
 lifecycle behaviour remains CE-owned.

---

## 2. Personas & Roles

The onboarding paths map the **9 canonical platform human roles** (Platform brief, Roles &
Access) onto **4 primary paths** (decision: 4 primary, others map to nearest). The mapping is
authoritative for FR-013/FR-014.

| Persona (path) | Canonical roles mapped to it | Primary need | Permission level |
|---|---|---|---|
| **Business** | Business analyst / SME; Brand / content owner; Viewer / stakeholder (read-only variant) | Concept-light, jargon-free path; NL not SPARQL; hands-on exercises | read / author-instance |
| **Technical** | Enterprise architect; Engineer / developer; Automation author | Faster path; skips concept intros; modelling + Build + automation depth | author-structure / publish / build |
| **Compliance** | Compliance / risk officer | Governance, SHACL rules, PROV-O audit trail, compliance views | author-governance / audit-read |
| **Admin** | Workspace admin / owner; Ops / SRE | Workspace setup: RBAC, connectors, billing, retention, runs | admin |

> Mapping rules (FR-014): Viewer / stakeholder resolves to the **Business path in read-only
> variant** (exercises that require writes are shown locked). A user holding **multiple roles**
> (roles combine on one identity per the platform model) is prompted to choose a starting path;
> the union of their roles' capabilities still governs what each exercise/tour can do. A user
> with **zero roles** defaults to the Business read-only variant.
> Role slugs are the canonical platform RBAC slugs resolved via PLAT-IDENTITY-1 — IdP-agnostic
> (Cognito or Auth0); onboarding never reads a Cognito group directly.

### Onboarding-internal roles

| Role | Description | Permission level |
|---|---|---|
| **Onboarding / content admin** | Weave-internal: curates tours, exercises, training content, and the Hammerbarn seed pipeline | admin (Weave-internal) |
| **Platform analytics system** | Non-human principal that records onboarding/activation analytics events | service principal (PLAT-IDENTITY-1) |

---

## 3. User Stories

### Epic 1: Hammerbarn Demo Workspace

**Hammerbarn → BPMO-kind mapping.** The Hammerbarn seed is
authored content, not a build-time constant. Every Hammerbarn entity class maps onto the
process-centric **BPMO framework** kinds and relationships (CE-READ-1). **Process is the spine**:
Hammerbarn's named business processes anchor the graph, edging out to the actors, systems,
services, data, capabilities, goals, and policies that surround them — making the demo a worked
"business brain" agents can reason inside. Instance categories like "Product" or "Store" are
**Class** definitions (the company's own vocabulary) with **instances** as Concepts/DataAssets —
not new kinds (decision B1).

| Hammerbarn entity class | BPMO kind | Linking relationship(s) | Notes |
|---|---|---|---|
| Goods inward, Stock mgmt, Customer order, Staff onboarding, Supplier mgmt, Store ops | **Process** | spine — see edges below | the named business processes (count = seed content, not a fixed promise) |
| Steps within each process (e.g. Receive delivery, Scan SKU, Put away) | **Activity** | `hasStep` (Process→Activity) | the ordered tasks that make up a process |
| Process triggers (e.g. Delivery arrived, Order placed, New hire approved) | **Event** | `triggeredBy` (Process←Event) | trigger / boundary events that start a process |
| Roles & people (Receiver, Store manager, Buyer, HR, Customer) | **Actor** | `performedBy` (Process/Activity→Actor) | who performs the process/activity |
| POS, WMS, ERP, CRM | **System** | `runsOn` (Service→System) | the 4 named systems |
| Kitchen Designer app, ordering service, reorder service | **Service** | `runsOn` (→System), `accesses` (→DataAsset) | generated/integrated services |
| Product catalogue, store register, customer records | **DataAsset** | `consumes`/`produces` (Process/Activity↔DataAsset) | data the processes touch |
| SKU, price, on-hand-qty, store-region | **Field** | (attribute of a DataAsset) | columns/attributes of DataAssets |
| Retail Operations, Supply Chain, Merchandising (coarser than a single process) | **BusinessCapability** | `realizes` (Process→BusinessCapability), `servesGoal` (→Goal), `hasCapability` | abilities the processes realise; several processes can realise one capability |
| Retail / Supply-chain domains | **BusinessDomain** | `inDomain` | top-level grouping |
| Outcomes/drivers (e.g. on-shelf availability, fast fulfilment) | **Goal** | `servesGoal` (BusinessCapability→Goal) | motivation a capability serves |
| Governance rules (returns policy, stock-count SOP, data-retention rule) | **Policy** | `governedBy` (Process/DataAsset→Policy) | constraints/rules/regulatory requirements |
| Glossary terms (home-improvement domain) | **Concept** (skos:Concept) | `broader`/`narrower`/`related`, `describes` | punned with Class where they are also types (decision B1) |
| Product, Store, Supplier, Customer, Employee (type defs) | **Class** (owl:Class) | (OWL type; punned with Concept) | the company's domain vocabulary, punned with Concept |

> Counts ("8 product types", "40+ glossary terms", "3 automations") are **content targets owned
> by the content admin**, not contractual constants. The seed is produced
> as a **live pipeline** (decision E2): CE produces ontology/glossary/brand/governance via
> CE-WRITE-1, Build produces the Kitchen Designer project + app (BE-ARTEFACT-1), Events produces
> the example automations (EA-AUTOMATION-1).

**E1-S1: Explore a fully-modelled example company on first sign-in**
As a **new user**, I want to enter a complete, explorable example workspace (Hammerbarn) on
first sign-in so that I can see what a finished Weave model looks like before facing my own
blank workspace.
- **AC:** Given a newly provisioned tenant, when the user opens the workspace switcher, then a
 "Hammerbarn Demo" workspace is present with no setup or invitation, and is labelled
 "Demo — fictional data".
- **AC:** Given the Hammerbarn workspace, when the user opens Constitution and Explorer, then
 the ontology (entities across the BPMO kinds — Process and its surrounding actors, systems,
 services, data, capabilities, goals, policies), glossary, brand, and governance content
 render, sourced via CE-READ-1 (`?version=latest`) and the Explorer canvas (GE-CANVAS-1).
- **AC (failure mode):** Given a seed artefact whose producing engine has not shipped (Build /
 Events at MVP), when the user opens that area, then the area is **feature-flagged off** with a
 "Coming soon" note — the workspace must not render a broken/empty Build or Automate tab.
- **Priority:** Must Have (CE+Explorer content) · Could Have→Must at Build/Events GA (Build
 project, app, automations)

**E1-S2: Reset the writable demo sandbox to its original state**
As a **new user**, I want to reset my demo sandbox copy to its original state so that I can
redo exercises or undo accidental changes.
- **AC:** Given a user's first open of Hammerbarn, when the copy is provisioned, then it is a
 **per-user WRITABLE copy** keyed by `(tenant_id, user_id)` (decision E1); edits **persist
 across sessions** and devices and are server-side, never localStorage.
- **AC:** Given sandbox edits, when the user clicks the explicit "Reset demo" button and
 confirms, then the sandbox is restored to the canonical Hammerbarn state; reset is **not**
 automatic and never fires on a timer (decision E1).
- **AC:** Given a reset operation, when it runs, then it completes within a **default 30 s,
 tunable** target (decision E4); the duration is the reset-op target, not a
 session timeout.
- **AC (failure mode):** Given a reset triggered while an exercise is in progress, when the
 reset confirms, then the in-progress exercise is abandoned with a warning, exercise
 completion flags for that exercise are cleared, and the sandbox is left in the known canonical
 state.
- **AC (failure mode):** Given a reset that fails or exceeds the target, when the error is
 detected, then the user sees a retry + error toast and the sandbox is left in a known state
 (either fully reset or unchanged), never partial.
- **Priority:** Must Have · **depends-on:** PLAT-SETTINGS-1 (per-user copy/isolation),
 CE-WRITE-1 (seed re-apply)

**E1-S3: Hands-on edits land in the writable sandbox only**
As a **new user**, I want hands-on exercises in the demo workspace that make changes to my
own writable copy so that I can practice without affecting anyone else.
- **AC:** Given an exercise that writes, when the write executes, then it targets the user's
 sandbox copy only (via CE-WRITE-1 with `target=draft` on the sandbox graph) and is isolated
 from the canonical Hammerbarn dataset and from every other user's sandbox.
- **AC:** Given a user is in their sandbox copy, when any demo screen renders, then a "Practice
 mode" banner is visible at the top.
- **AC (failure mode):** Given a write attempt against the **canonical** Hammerbarn graph by a
 non-content-admin identity, when it is issued, then it is rejected with HTTP 403 and the
 attempt is recorded via PLAT-AUDIT-1 (mirrors the prototype's protected-demo behaviour;
 resolves).
- **Priority:** Must Have · **depends-on:** CE-WRITE-1, PLAT-SETTINGS-1

---

### Epic 2: Guided Tours & Contextual Overlays

> **Phasing:** Constitution and Explorer tours/exercises are **MVP-P0**.
> Build, Events (Automate), and Platform-Dashboard tours that target screens owned by
> not-yet-GA engines are **Phase 2 (Build/Events GA)** and feature-flagged off until their
> target engine ships.

**E2-S1: Linear guided tour for each shipped engine area**
As a **new user**, I want a step-by-step guided tour for each shipped engine area so that I am
walked through the navigation, screens, and key features in context.
- **AC:** Given a shipped area (MVP: Constitution, Explorer; Phase 2: Platform Dashboard, Build,
 Events), when the user starts its tour, then each step highlights the target element
 (dimmed overlay + spotlight), shows a tooltip (**default ≤ 40 words, tunable** — see NFR
 copy-budget note), and shows Back/Next + a step indicator (e.g. "3 of 9"). Step
 count is a **default 5–12, tunable** authoring guideline.
- **AC:** Given a tour, when the user clicks "Skip tour" or presses Escape, then the tour exits
 without deleting progress; "Resume tour" picks up from the last completed step (resume point
 persisted server-side per `(tenant, user)`).
- **AC:** Given a tour, when the user navigates, then it is keyboard navigable
 (Tab/Arrow/Enter/Escape), not time-limited, and never requires interacting with the
 highlighted element to advance.
- **AC (failure mode):** Given a tour step whose anchor element is absent (UI changed, or the
 area's engine has not shipped), when the step would render, then the step is **skipped with a
 logged warning** and never blocks the tour; a tour for a not-yet-shipped engine is
 feature-flagged off, not broken.
- **Priority:** Must Have (Constitution, Explorer) · Phase 2 (Build, Events, Dashboard)
 · **depends-on:** the target engine's UI shipping

**E2-S2: Contextual tooltips and beacons on complex UI areas**
As a **new user**, I want persistent contextual beacons on complex UI elements so that I
understand a feature without starting a guided tour.
- **AC:** Given a complex element exists in the current build (e.g. SPARQL editor, flow canvas,
 SHACL validation panel, PROV-O provenance chain, agent tool-use console, generative dashboard
 prompt bar), when its screen renders, then a pulsing beacon appears on it.
- **AC:** Given a beacon, when clicked, then a tooltip (**default ≤ 60 words, tunable** — see
 copy-budget note) opens explaining the element with a "Learn more" link to the relevant
 training walkthrough.
- **AC:** Given a beacon, when dismissed, then dismissal is persisted **per user, server-side**;
 a "Show all hints" toggle in the Help launcher restores all dismissed beacons.
- **AC (failure mode):** Given a beacon whose target element is absent or unmounts while its
 tooltip is open, when the screen renders or the unmount occurs, then the beacon/tooltip is
 hidden and a warning logged — no orphaned tooltip.
- **Priority:** Must Have (elements on shipped screens) · Phase 2 (elements on Phase-2 screens)

**E2-S3: Welcome modals for first visit to each shipped area**
As a **new user**, I want a welcome modal on my first visit to each shipped area so that I get
a 2–3 sentence orientation before exploring.
- **AC:** Given a shipped area, when the user visits it for the first time, then a welcome modal
 shows the area name, a 2–3 sentence description, and CTAs. **If a tour exists** for that area
 the CTAs are "Take a tour" and "Explore freely"; **if no tour exists** (e.g. Compliance,
 Settings) the modal shows only "Explore freely" / "Read the guide" — no dead "Take a tour"
 CTA.
- **AC:** Given a dismissed welcome modal for an area, when the user revisits that area, then it
 never fires again (dismissal persisted server-side per user).
- **AC (failure mode):** Given an area that has not shipped, when feature-flagged off, then no
 welcome modal exists for it.
- **Priority:** Must Have (shipped areas)

> Area list reconciliation : welcome modals fire for the areas that have shipped and
> appear in platform navigation. Tours exist for Constitution, Explorer (MVP) and Build, Events,
> Dashboard (Phase 2). Compliance and Settings get welcome modals with the no-tour CTA set.
> Compliance is the contested 7th nav item (platform brief) — if platform drops it, onboarding
> drops its modal with it.

---

### Epic 3: Role-Tailored Onboarding Paths

**E3-S1: Role-tailored tour content and first-outcome milestone**
As a **new user**, I want the tours, exercises, and first-outcome milestone to reflect my role
in Weave so that I am guided toward the actions most valuable for my job — not a generic
sequence.
- **AC:** Given a signed-in user, when their onboarding path is resolved, then it is one of the
 **4 primary paths** (Business, Technical, Compliance, Admin) determined from the canonical
 role(s) resolved via the platform RBAC model / PLAT-IDENTITY-1 — **IdP-agnostic** (Cognito or
 Auth0), per the Personas mapping table.
- **AC:** Given a user with multiple roles, when they first sign in, then they are prompted to
 choose a starting path; given a user with zero roles, when resolved, then they default to the
 Business read-only variant.
- **AC:** Given any user, when they open Help launcher → "Change my onboarding path", then they
 can switch paths at any time.
- **AC:** Each path's first milestone (measure-and-report, not a GA gate):
 Business → browse the Hammerbarn ontology and use the chat panel to find **Process**es with no
 assigned owner (no `performedBy` Actor; NL, not SPARQL); Technical → create your first entity type in your own
 workspace; Compliance → view the compliance dashboard and inspect one policy's enforcement
 status; Admin → invite a team member and configure a data connector.
- **AC (failure mode):** Given a path whose first-milestone screen belongs to a not-yet-GA
 engine, when the path is resolved, then the milestone is shown **locked** with a prerequisite
 note rather than a broken deep-link.
- **Priority:** Must Have · **depends-on:** PLAT-IDENTITY-1, PLAT-SETTINGS-1

**E3-S2: Role→starter-widget-set mapping (consumed by Platform)**
As a **new user**, I want the dashboard to show role-appropriate starter widgets on first load
so that the dashboard makes sense from the moment I land.
- **AC:** Given a role path, when the Platform Dashboard loads starter widgets (rendering and
 removability **owned by Platform PRD E1-S6 / FR-012**), then onboarding supplies
 the role→widget-set mapping consumed by that feature. Onboarding does **not** render or remove
 widgets and does not re-specify widget lists here (single source of truth = Platform).
- **AC:** The mapping is: Business → ontology health + graph completeness; Technical → token
 spend + active projects + agent activity; Compliance → compliance status + audit feed +
 self-improvement findings; Admin → RBAC coverage + connector health + onboarding progress.
- **AC (failure mode):** Given a mapped widget whose source engine has not shipped, when the
 Dashboard resolves widgets, then Platform omits it (handled by Platform E1-S6); onboarding's
 mapping carries an engine-availability tag so MVP = CE-sourced widgets only (resolve-by-default
 #5).
- **Priority:** Should Have · **depends-on:** Platform E1-S6 / FR-012, CE-METRICS-1

---

### Epic 4: Hands-On Exercises

**E4-S1: A set of hands-on exercises in the writable demo workspace**
As a **new user**, I want structured hands-on exercises in the Hammerbarn sandbox so that I
practice each engine capability by doing.
- **AC:** Given v1 GA, when the exercise set is listed, then it contains at least the following,
 each with a title, goal, 3–5 step instructions, a completion check, and a completion indicator
 (checkmark + micro-animation). Each exercise is **role-gated** and **phase-tagged**:

 | ID | Exercise | Path(s) | Completion check (mechanism) | Phase |
 |---|---|---|---|---|
 | CE-01 | Explore the Hammerbarn ontology; find Store entities missing a required property | all | UI nav signal: entity-list + missing-property view visited (analytics event) | MVP |
 | CE-02 | Add a product category (e.g. "Outdoor Furniture") via the chat panel (NL) | Business, Technical | `SPARQL ASK { ?s a weave:Class; rdfs:label "Outdoor Furniture" }` over the **user sandbox graph** (CE-READ-1) returns true after the CE-WRITE-1 commit | MVP |
 | CE-03 | Run a SPARQL query for **Process** nodes with no `performedBy` Actor (unowned processes) | **Technical only** (gated; Business uses CE-03b) | query executes and returns rows (CE-READ-1 `/api/sparql`) | MVP |
 | CE-03b | NL-query equivalent: ask the chat panel for processes with no assigned owner (no `performedBy` Actor) | **Business** | NL query resolves and renders results (Query NL mode) | MVP |
 | GE-01 | Spotlight the "Goods Inward" process neighbourhood in Explorer | all | spotlight activated on target node (GE-CANVAS-1 state) | MVP |
 | GE-02 | Apply the maturity-score heatmap overlay | all | overlay activated (Explorer overlay state) | MVP |
 | BE-01 | Open the Kitchen Designer project; find the tech spec + ADRs | Technical, Admin | Decisions tab opened (analytics event) | **Phase 2 (Build GA)** |
 | AE-01 | Draft an automation: new Delivery → notify #goods-inward Slack channel | Technical | automation saved as Draft, grounded in the Goods Inward **process** (triggered by a Delivery **Event**; EA-AUTOMATION-1; Slack via PLAT-CONNECTOR-1) | **Phase 2 (Events GA)** |

 (Resolves : CE-03 raw SPARQL gated to Technical; CE-03b NL path for Business;
 completion checks name a concrete CE-READ-1/CE-WRITE-1/GE-CANVAS-1 signal.)
- **AC:** Given a user who resets their sandbox, when an exercise that was complete is redone,
 then exercise progress can be re-earned (completion flags cleared on reset — E1-S2).
- **AC (failure mode):** Given an exercise gated behind a feature the user's role cannot access
 or an engine that has not shipped, when the exercise list renders, then that exercise is
 hidden or shown disabled with an explanation — never a broken step.
- **Priority:** Must Have (CE/GE exercises) · Phase 2 (BE-01, AE-01)
 · **depends-on:** CE-READ-1, CE-WRITE-1, GE-CANVAS-1; BE-ARTEFACT-1 (BE-01); EA-AUTOMATION-1 (AE-01)

**E4-S2: Exercise progress visible in the onboarding checklist**
As a **new user**, I want my exercise progress reflected in the onboarding checklist so that I
know how far I have come.
- **AC:** Given a completed exercise, when the checklist renders, then the matching item shows
 complete with a timestamp.
- **AC (failure mode):** Given an analytics/state-write failure on completion, when detected,
 then the completion is retried and the checklist reflects the last persisted state (no
 silent loss).
- **Priority:** Should Have · **depends-on:** E5-S1

---

### Epic 5: Onboarding Checklist & Activation

**E5-S1: Onboarding checklist widget on the Dashboard**
As a **new user**, I want an onboarding checklist on my Dashboard that tracks progress from
demo exploration to first real outcome so that I always have a clear next step.
- **AC:** Given the Dashboard, when it renders, then the checklist widget shows
 **role-configurable** items: explore the Hammerbarn demo (auto-complete on first demo visit);
 complete the guided tour for your primary area; complete ≥ 1 hands-on exercise; **reach your
 activation milestone** (per-path, E5-S2); plus admin-only "invite a team member" and
 "configure a data connector".
- **AC:** Given an item, when rendered, then it shows a checkbox, label, "Why this matters"
 description, and a "Do it now" deep-link.
- **AC:** Given all items complete, when 100% is reached, then a celebration moment plays and
 the widget relabels "Onboarding complete"; the widget **auto-dismisses after a default 7 days,
 tunable per workspace** (decision E4 — config-driven, not hard-coded).
- **AC:** Given a dismissed checklist, when the user opens Help launcher → "Show onboarding
 checklist", then it is restored.
- **AC (failure mode):** Given a checklist item whose engine has not shipped, when rendered,
 then it is shown **locked** with a prerequisite note.
- **Priority:** Must Have · **depends-on:** Platform Dashboard, PLAT-SETTINGS-1 (per-user state)

**E5-S2: Activation milestone detection (idempotent)**
As a **platform analytics system**, I want to automatically detect when a user reaches their
activation milestone so that completion is tracked without manual marking.
- **AC:** Given a per-path activation milestone, when its triggering action occurs **in the
 user's own workspace**, then it is detected from a concrete signal: Business/Technical →
 CE-EVENT-1 change event `{change_type:"added", actor:<user principal>}` for the first
 committed entity (or SPARQL run via CE-READ-1 for Technical); Compliance → first governance/
 compliance entity or SHACL validation result viewed via **CE-READ-1** (a CE-grounded, contracted
 signal — replaces the earlier uncontracted "compliance widget pinned / Dashboard state" read);
 Admin → first team-member invite, detected via a
 **platform member-management capability not yet published as a contract** (see OQ-08 —
 onboarding does not over-claim PLAT-IDENTITY-1, the agent service-principal registry, for
 human-invite detection). If CE-EVENT-1 transport is not ready, degrade to polling CE-READ-1
 with a since-version (CE-EVENT-1 note; resolve-by-default #4).
- **AC:** Given milestone detection, when it fires, then the checklist item auto-completes, an
 `onboarding-activation` event is published to PLAT-NOTIFY-1, an analytics event is recorded
 (see E8 schema), and a celebratory toast fires.
- **AC (idempotency / failure mode):** Given the same milestone re-triggering, when detected
 again, then the toast and analytics event fire **exactly once per `(tenant, user, milestone)`**
 using a persisted `activated` flag — no double-fire. If the activation
 engine is unavailable, the milestone stays locked rather than mis-firing.
- **Priority:** Must Have · **depends-on:** CE-EVENT-1 (Should Have; degrade to CE-READ-1 poll),
 PLAT-NOTIFY-1, PLAT-IDENTITY-1

---

### Epic 6: Training Library

**E6-S1: Training library accessible from the help launcher**
As a **new user**, I want a training library so that I can learn at my own pace beyond tours.
- **AC:** Given Help launcher → "Training", when opened, then it shows video walkthrough cards
 (thumbnail placeholder labelled "Video — coming soon", title, duration, description — real
 video streams from S3/CloudFront when produced) and written walkthroughs (Markdown +
 screenshots).
- **AC:** Given the library, when rendered, then content categories cover Introduction,
 Ontologies, Graph Explorer, Build (Phase 2), Automation (Phase 2), Compliance & Governance,
 Administration. Phase-2 categories are shown but flagged "available when the engine ships".
- **AC:** Given a search field, when a keyword is entered, then content is filtered; results
 return within a **default ≤ 300 ms, tunable** target.
- **AC (failure mode):** Given a video asset that fails to load, when playback is attempted,
 then the card shows the placeholder/error state, never a broken player.
- **Priority:** Must Have (placeholders + written) · **depends-on:** S3/CloudFront hosting (OQ-04)

**E6-S2: What's New changelog**
As any user, I want a "What's new" feed in the help launcher so that I know what changed.
- **AC:** Given Help launcher → "What's new", when opened, then it shows the **last N release
 items (default 5, tunable**): version, date, headline, 1–2 sentence description;
 a blue dot on the help icon flags unread items.
- **AC (failure mode):** Given the release feed is unavailable, when opened, then the panel
 shows an empty-state message, not an error blocking the launcher.
- **Priority:** Should Have

---

### Epic 7: Help Launcher

**E7-S1: Persistent help launcher in the top header**
As any user, I want a persistent help launcher (? icon) in the top header so that help is
never more than one click away.
- **AC:** Given any screen, when the user opens the ? launcher, then the panel offers: search
 across help + training content; "Take a tour" (current area's tour, or a list if none);
 "Show hints"; "Training library"; "Keyboard shortcuts"; "What's new"; "Contact support"
 (new tab).
- **AC:** Given the launcher, when the user presses Shift+? (or ? outside a text field) it
 opens, and Escape closes it; the launcher is keyboard-accessible throughout.
- **AC (failure mode):** Given the current area has no tour, when "Take a tour" is chosen, then
 the launcher shows the list of available tours — no dead action.
- **Priority:** Must Have

**E7-S2: Contextual help panel per screen**
As any user, I want screen-relevant help so that I get targeted help without searching.
- **AC:** Given the launcher open on a screen, when "Help for this page" renders, then it shows
 2–4 links relevant to the active engine/screen.
- **AC (failure mode):** Given no contextual links exist for a screen, when rendered, then the
 section is hidden (not an empty box).
- **Priority:** Should Have

---

### Epic 8: Onboarding Analytics

**E8-S1: Track tour, exercise, checklist, and activation completion by role**
As an **onboarding admin** (Weave-internal), I want completion rates by role so that I can
measure and improve onboarding.
- **AC:** Given Settings → Onboarding analytics, when opened, then it shows: tour completion %
 per tour per role; exercise completion % per exercise per role; checklist completion within a
 **default 7-day window, tunable**; activation rate within that window by role;
 time-to-activation (median + p90); per-tour drop-off step.
- **AC (event schema, resolves):** Each analytics event carries
 `{ event_name, role_path, milestone?, tenant_id, user_principal_iri, anonymised_cohort_key,
 ts_first_signin, ts_event }`. `user_principal_iri` is retained **per-tenant only** (raw);
 cross-workspace aggregation (E8-S2) uses only `anonymised_cohort_key` (a non-reversible hash;
 no tenant-identifiable fields).
- **AC:** Given the analytics view, when accessed, then it is restricted to workspace admins
 (RBAC via PLAT-SETTINGS-1); access attempts are audited via PLAT-AUDIT-1.
- **AC:** Given an event, when emitted, then the dashboard reflects it within a **default 5 min,
 tunable** freshness target.
- **AC (failure mode):** Given an analytics event delivery failure, when detected, then the
 event is retried via a durable queue; metering/activation correctness does not depend on
 dashboard freshness.
- **Priority:** Should Have · **depends-on:** PLAT-IDENTITY-1, PLAT-SETTINGS-1, PLAT-AUDIT-1

**E8-S2: Anonymised cohort analytics**
As a **Weave product team** (internal), I want anonymised cross-workspace cohort data so that
we can improve onboarding globally.
- **AC:** Given cohort analytics, when aggregated, then they use only the non-reversible
 `anonymised_cohort_key` — **no PII, no tenant-identifiable field** — reconciling E8-S1's
 per-tenant raw retention with this no-PII global view.
- **AC (failure mode):** Given a cohort below a minimum size (**default k=20, tunable**), when
 aggregated, then it is suppressed to prevent re-identification.
- **Priority:** Should Have

---

## 4. Functional Requirements

| ID | Requirement (observable + failure mode summarised; full AC in stories) | Story | Priority | Phase / depends-on |
|---|---|---|---|---|
| FR-001 | Hammerbarn demo workspace present in switcher for every new user, no setup; labelled "Demo — fictional data". Failure: not-shipped areas feature-flagged off | E1-S1 | P0 | MVP · PLAT-SETTINGS-1 |
| FR-002 | Hammerbarn ontology/glossary/brand/governance seed mapped onto the process-centric **BPMO framework** kinds/relationships (CE-READ-1; Process spine + Activity/Event/Actor/System/Service/DataAsset/Capability/Domain/Goal/Policy); produced as a live pipeline via CE-WRITE-1. Failure: missing seed area → "coming soon" | E1-S1 | P0 | MVP · CE-WRITE-1, CE-READ-1 |
| FR-003 | Hammerbarn Build project + Kitchen Designer app (BE-ARTEFACT-1) and example automations (EA-AUTOMATION-1). Failure: area off until engine GA | E1-S1 | P0→ | Phase 2 (Build/Events GA) · BE-ARTEFACT-1, EA-AUTOMATION-1 |
| FR-004 | "Demo — fictional data" label throughout Hammerbarn | E1-S1 | P0 | MVP |
| FR-005 | Per-user WRITABLE copy keyed `(tenant_id,user_id)`, server-side persistent; "Reset demo" manual button restores canonical within default 30 s tunable; reset never auto-fires. Failure: mid-exercise reset clears flags; reset failure → retry, known state | E1-S2 | P0 | MVP · PLAT-SETTINGS-1, CE-WRITE-1 |
| FR-006 | "Practice mode" banner visible whenever in sandbox copy | E1-S3 | P0 | MVP |
| FR-007 | Writes go to sandbox only via CE-WRITE-1 `target=draft`; canonical-graph writes by non-content-admin → 403 + PLAT-AUDIT-1 entry | E1-S3 | P0 | MVP · CE-WRITE-1, PLAT-AUDIT-1 |
| FR-008 | Guided tours for shipped areas; default 5–12 steps tunable; spotlight + ≤40-word tooltip + Back/Next + indicator + Skip. Failure: absent anchor → skip step + log; not-shipped engine → flagged off | E2-S1 | P0 (CE,GE) / P2 (Build,Events,Dashboard) | MVP / Phase 2 · target engine UI |
| FR-009 | Tours keyboard-navigable; skippable; resumable from last step (resume point server-side per (tenant,user)) | E2-S1 | P0 | MVP |
| FR-010 | Beacons on complex elements when present in the build; per-element server-side dismissal; "Show all hints" restores. Failure: target unmounts → hide beacon/tooltip + log | E2-S2 | P0 (shipped) / P2 | MVP / Phase 2 |
| FR-011 | Beacon tooltip default ≤60 words tunable + "Learn more" link | E2-S2 | P0 | MVP |
| FR-012 | Welcome modal on first visit to each shipped area; CTAs adapt: tour areas → "Take a tour"+"Explore freely"; no-tour areas (Compliance, Settings) → "Explore freely"/"Read the guide" only (no dead CTA). Dismissal persisted server-side | E2-S3 | P0 | MVP (shipped areas) |
| FR-013 | 4 primary role paths (Business/Technical/Compliance/Admin) with explicit 9→4 mapping; resolved from canonical RBAC role(s) via PLAT-IDENTITY-1, IdP-agnostic; per-path first milestone. Failure: not-GA milestone screen → locked | E3-S1 | P0 | MVP · PLAT-IDENTITY-1, PLAT-SETTINGS-1 |
| FR-014 | Multi-role → choose-path modal; zero-role → Business read-only default; Viewer → Business read-only; "Change path" in Help launcher | E3-S1 | P0 | MVP · PLAT-IDENTITY-1 |
| FR-015 | Onboarding supplies role→starter-widget-set mapping (engine-availability tagged); rendering/removability owned by Platform E1-S6. No widget rendering in onboarding | E3-S2 | P1 | MVP · Platform E1-S6/FR-012, CE-METRICS-1 |
| FR-016 | Role-gated, phase-tagged exercise set (CE-01/02/03, CE-03b NL, GE-01/02 MVP; BE-01, AE-01 Phase 2); each: goal, 3–5 steps, completion check, indicator. CE-03 raw SPARQL = Technical only; CE-03b NL = Business | E4-S1 | P0 (CE,GE) / P2 (BE,AE) | MVP / Phase 2 · CE-READ-1, CE-WRITE-1, GE-CANVAS-1 |
| FR-017 | Exercise completion checked against a named signal (SPARQL ASK over sandbox graph via CE-READ-1, CE-WRITE-1 commit, GE-CANVAS-1 state, or analytics nav event). Failure: gated/unavailable exercise hidden/disabled + explanation | E4-S1 | P0 | MVP · CE-READ-1, CE-WRITE-1, GE-CANVAS-1 |
| FR-018 | Exercise progress reflected in checklist with timestamp; write failure → retry, last-persisted state | E4-S2 | P1 | MVP |
| FR-019 | Onboarding checklist widget on Dashboard: role-configurable items, progress bar, "Do it now" deep-links. Failure: not-GA item → locked + prereq note | E5-S1 | P0 | MVP · Platform Dashboard, PLAT-SETTINGS-1 |
| FR-020 | Checklist 100% → celebration + relabel; auto-dismiss after default 7 days tunable per workspace (config-driven) | E5-S1 | P0 | MVP |
| FR-021 | Checklist dismissible; restorable from Help launcher | E5-S1 | P0 | MVP |
| FR-022 | Activation auto-detected per path from CE-EVENT-1 (degrade to CE-READ-1 poll); Compliance via CE-READ-1 (governance/SHACL view); Admin via the platform member-management capability (not-yet-contracted, OQ-08); idempotent exactly-once per (tenant,user,milestone); publishes onboarding-activation to PLAT-NOTIFY-1. Failure: engine unavailable → milestone locked, no mis-fire | E5-S2 | P0 | MVP (Business/Tech/Compliance via CE) · CE-EVENT-1, CE-READ-1, PLAT-NOTIFY-1 |
| FR-023 | Training library: placeholder video cards + written walkthroughs; searchable (default ≤300 ms tunable). Failure: video load fail → placeholder/error state | E6-S1 | P0 | MVP · S3/CloudFront (OQ-04) |
| FR-024 | Training categories incl. Phase-2 categories flagged "available when engine ships" | E6-S1 | P0 | MVP |
| FR-025 | "What's new": last N release items (default 5 tunable); unread blue dot. Failure: feed unavailable → empty state | E6-S2 | P1 | MVP |
| FR-026 | Help launcher: search, tour launch (list if none), show hints, training, keyboard shortcuts, What's new, contact support | E7-S1 | P0 | MVP |
| FR-027 | Help launcher keyboard shortcut (Shift+?); Escape closes | E7-S1 | P0 | MVP |
| FR-028 | Contextual help: 2–4 screen-specific links; hidden if none | E7-S2 | P1 | MVP |
| FR-029 | Onboarding analytics by role; defined event schema with per-tenant raw user IRI + non-reversible cohort key; default 7-day window + 5-min freshness tunable; delivery failure → durable retry | E8-S1 | P1 | MVP · PLAT-IDENTITY-1, PLAT-AUDIT-1 |
| FR-030 | Analytics restricted to workspace admins (PLAT-SETTINGS-1 RBAC); access audited via PLAT-AUDIT-1; cohort aggregation no-PII with k-anonymity (default k=20 tunable) | E8-S1/E8-S2 | P1 | MVP · PLAT-SETTINGS-1, PLAT-AUDIT-1 |

> Every FR is phased and tagged with the engine(s) it cannot ship before. "P0→" / "P2" mark
> Phase-2 (Build/Events GA) items. Activation targets are measure-and-report baselines, not GA
> gates (decision E4).

---

## 5. Inter-engine Interfaces

> All contracts referenced by ID from `docs/specs/_inter-engine-contracts.md`. Onboarding is a
> pure consumer — it provides no contract of its own (it owns no graph data; analytics is
> internal).

### Consumed (this engine calls / reads)

| Provider engine | Contract | Version pin | Used for |
|---|---|---|---|
| Constitution Engine | CE-READ-1 | `?version=latest` (Hammerbarn seed pinned at the published seed version) | Render Hammerbarn ontology/glossary; SPARQL ASK exercise-completion checks (CE-02, CE-03) |
| Constitution Engine | CE-WRITE-1 | latest | Live-pipeline seed authoring; sandbox writes (`target=draft`); CE-02 commit |
| Constitution Engine | CE-EVENT-1 | latest | Activation detection (`change_type:"added"` on the user's own store); Should Have — degrade to CE-READ-1 poll |
| Constitution Engine | CE-VERSION-1 | latest | Resolve the published seed version; poll-fallback since-version for activation |
| Constitution Engine | CE-METRICS-1 | latest | Business-path starter widgets (ontology health / completeness) |
| Graph Explorer | GE-CANVAS-1 | latest | Render Hammerbarn graph (`mode:"force"\|"c4"`); GE-01/GE-02 spotlight + overlay exercise checks |
| Build Engine | BE-ARTEFACT-1 | latest | Kitchen Designer project/app seed + BE-01 exercise (Phase 2, Build GA) |
| Events & Actions | EA-AUTOMATION-1 | latest | Example automations seed + AE-01 draft-automation exercise (Phase 2, Events GA) |
| Platform | PLAT-SETTINGS-1 | latest | Per-user sandbox copy/isolation; RBAC for analytics; tunable thresholds resolve through the cascade |
| Platform | PLAT-IDENTITY-1 | latest | Resolve canonical role(s) → path (IdP-agnostic); user principal IRI for analytics; invite milestone |
| Platform | PLAT-NOTIFY-1 | latest | Publish `onboarding-activation` notification events (open type taxonomy) |
| Platform | PLAT-AUDIT-1 | latest | Audit canonical-write rejections and analytics-view access |
| Platform | PLAT-CONNECTOR-1 | latest | AE-01 Slack channel target; Admin connector-config milestone (Phase 2) |

### Provided (this engine exposes to others)

| Contract | Consumers | Shape (link) | Stability |
|---|---|---|---|
| _none_ | — | Onboarding owns no inter-engine contract; the role→widget-set mapping is consumed by Platform E1-S6 as configuration, not a published contract | n/a |

---

## 6. Non-Functional Requirements

### Performance

- Hammerbarn workspace initial render (graph canvas, full seed): **default ≤ 3 s p95, tunable**.
- Sandbox reset op: **default ≤ 30 s, tunable** (reset-op duration target — decision E1).
- Tour step transition: **default ≤ 200 ms, tunable** (unverified PO default; confirm at tech
 spec).
- Training search: **default ≤ 300 ms, tunable**.
- Analytics dashboard freshness: **default ≤ 5 min, tunable**.

> **Copy-budget note :** tour tooltip ≤ 40 words and beacon tooltip ≤ 60 words are
> unverified PO defaults; the difference reflects beacons being self-contained vs tour steps
> being sequenced. Both are tunable authoring guidelines, to confirm against a UX guideline at
> tech spec.

### Security

- All onboarding APIs are authz-checked against the caller's identity resolved via
 PLAT-IDENTITY-1 (IdP-agnostic). Onboarding stores no credentials; the AE-01 Slack token lives
 in AWS Secrets Manager and is reached only through the platform-managed connector
 (PLAT-CONNECTOR-1) — never read by onboarding.
- Input at boundaries (exercise NL/SPARQL submissions) is validated and forwarded to CE; SPARQL
 goes through CE-READ-1 which is SELECT-only with the `SERVICE` keyword blocked (SSRF) — no
 query construction in onboarding.
- No PII in cross-workspace cohort analytics (E8-S2); per-tenant user IRI never leaves the
 tenant boundary.

### Reliability

- Activation detection is **idempotent** (exactly-once per `(tenant,user,milestone)` via a
 persisted flag). Analytics events use a durable queue with retry; dashboard freshness is
 best-effort and never gates correctness.
- CE-EVENT-1 is Should Have for activation; the system degrades to polling CE-READ-1 with a
 since-version when the stream is unavailable.

### Observability

- OTel spans for: tour-start/step/complete, exercise-start/complete, reset-op, activation-detect,
 with attributes `{role_path, area, exercise_id, milestone, tenant_id}` (no PII attribute).
- Reset-op and activation-detect emit metrics for the analytics dashboard; failures log
 correlated with the request id.

### Accessibility

- All overlays/modals/tooltips: **WCAG 2.1 AA**, zero-violations gate in CI (axe).
- Tours fully keyboard-navigable (Tab/Arrow/Enter/Escape); beacons carry `aria-label`s; tooltip
 text screen-reader readable; no element-interaction required to advance a tour.

### Isolation & data safety

- **Three isolation boundaries, each enforced:**
 1. **Per-user sandbox:** sandbox graphs keyed by `(tenant_id, user_id)`; every sandbox API
 call authz-checked against the caller's PLAT-IDENTITY-1 identity; no cross-user read/write.
 2. **Sandbox vs canonical:** writes to the canonical Hammerbarn graph by any non-content-admin
 identity rejected (403) and logged via PLAT-AUDIT-1 (mirrors the prototype's protected-demo
 ValueError→400 behaviour).
 3. **Sandbox vs real tenant:** sandbox writes can never reach a real tenant workspace.
- **Mechanism (named, per resolve-by-default #6):** named-graph-per-`(tenant,user)` with
 query-rewriting that **rejects any unscoped query**, OR store-per-tenant — final topology
 deferred to OQ-02 (Architect), but the expectation and the test are pinned here.
- **Cross-tenant-read test:** Given a tenant-A / user-A JWT, when a sandbox query is issued
 without an explicit scope, then zero tenant-B and zero other-user triples are returned.

### Internationalisation

- Onboarding copy is authored in English for v1, but all user-facing strings (tour steps,
 tooltips, modal text, checklist labels, training metadata) are externalised as i18n strings so
 translations can be added without code changes. No hardcoded user-facing strings.

### Browser / device support

- Latest 2 versions of Chrome, Edge, Firefox, Safari; desktop-first. Onboarding state is
 server-side per `(tenant, user)` so it survives device switches (localStorage is cache only —
 resolves).

---

## 7. Key Design Decisions Captured

| Decision | Rationale |
|---|---|
| Per-user **writable** Hammerbarn copy; edits persist; **manual** reset only (no auto-30s) | Decision E1. Reset-op target = 30 s; not a session timeout. Reconciles with the prototype's protected canonical demo by adding a user-owned writable copy rather than mutating canonical |
| Hammerbarn entities map onto the process-centric **BPMO framework** (CE-READ-1), with **Process** as the spine; seed is authored content, not a constant | Decision A1/B1;. The six named business processes are **Process** (with Activity steps, Event triggers, performedBy Actors), not BusinessCapability; "Product/Store/Supplier" are Class definitions, not new kinds; instances are Concepts/DataAssets. Counts are content targets, not promises |
| Seed built as a **live pipeline** (CE/Build/Events), not a static snapshot | Decision E2. Keeps the demo in step with the real product; full demo GA gated on engine GA; CE+Explorer portion at MVP |
| **4 primary role paths** with explicit 9→4 mapping; IdP-agnostic role resolution | Decisions (role-paths=4);. Roles combine on one identity; resolution via PLAT-IDENTITY-1, never a raw Cognito group |
| Activation/time-to-outcome = **measure-and-report baselines**, not GA gates | Decision E4;. 60% / 30 min are cohort-1 instruments; thresholds set after the baseline |
| Every threshold = **"default X, tunable"** or cited | Decision E4;. No bare confabulated numbers |
| Onboarding owns **no inter-engine contract**; role→widget mapping is config consumed by Platform |. Single source of truth for widget rendering = Platform E1-S6 |
| Onboarding state is **server-side per (tenant,user)** |. localStorage cannot satisfy cross-device/resumable state |
| Phase-gate all demo content + tours by engine availability; MVP = CE-sourced only | Resolve-by-default #5; |

---

## 8. Open Questions (for Tech Spec)

| # | Question | Owner |
|---|---|---|
| OQ-01 | Tour framework: build in-house React overlay vs adopt a library (Shepherd.js / Intro.js / Driver.js)? | Architect |
| OQ-02 | Sandbox isolation **topology**: named-graph-per-(tenant,user) + query-rewriting vs store-per-tenant vs delta-from-canonical. Expectation + cross-tenant-read test pinned in §6; topology choice deferred. **Gated on PLAT-SETTINGS-1 tenant model.** | Architect |
| OQ-03 | Live-pipeline seed orchestration: how CE/Build/Events seed jobs are sequenced and re-run on product change (resolved as live-pipeline per E2; remaining is the orchestration mechanism) | Architect |
| OQ-04 | Training video hosting: S3 + CloudFront (in-stack) vs third-party player (Wistia/Vimeo)? | Architect |
| OQ-05 | Analytics instrumentation: OTel + CloudWatch vs product-analytics tool (PostHog self-hosted). Event schema + cohort-key hashing pinned in E8; tool choice deferred | Architect |
| OQ-06 | Tour anchor strategy: CSS selectors vs first-class `data-tour-id` attributes across the SPA (needs coordination with each feature team) | Architect |
| OQ-07 | ODRL policy enforcement is **not** in the v1 stack; PII/sensitive handling in the demo uses SHACL + data-classification properties. Confirm whether any demo content needs policy enforcement | Architect |
| OQ-08 | Human team-member-invite detection (Admin activation milestone) needs a platform member-management capability that is **not yet published as an inter-engine contract**. Confirm the signal/contract for invite detection rather than over-claiming PLAT-IDENTITY-1 | Architect / Platform |

---

## 9. Acceptance Criteria (PRD-level)

The Onboarding PRD is satisfied when:

- [ ] A brand-new user signs in; the Hammerbarn Demo workspace is in the switcher and its
 shipped areas (MVP: Constitution, Explorer) render real seed content; not-yet-shipped
 areas are feature-flagged off, not broken.
- [ ] A user's role path is resolved via PLAT-IDENTITY-1 to exactly one of the 4 primary paths
 per the 9→4 mapping, IdP-agnostic; a multi-role user is asked to choose; a zero-role user
 gets Business read-only.
- [ ] A user edits their **writable** sandbox; edits persist across a sign-out/sign-in; only an
 explicit "Reset demo" click restores canonical state (within the default-30 s target).
- [ ] A canonical-graph write by a non-content-admin identity is rejected (403) and logged via
 PLAT-AUDIT-1; the cross-tenant-read test returns zero foreign triples.
- [ ] Business path completes CE-03b (NL query) — never required to write raw SPARQL; Technical
 path completes CE-03 (SPARQL); each completion verified against a named CE-READ-1/
 CE-WRITE-1/GE-CANVAS-1 signal.
- [ ] Activation fires **exactly once** per `(tenant,user,milestone)` from a CE-EVENT-1 signal
 (or CE-READ-1 poll fallback) and publishes an `onboarding-activation` event to
 PLAT-NOTIFY-1; re-triggering does not double-fire.
- [ ] Every numeric threshold in the PRD is either "default X, tunable" or cited; no bare number
 remains.
- [ ] Cohort analytics expose no PII and suppress sub-k cohorts; per-tenant user IRI never
 crosses the tenant boundary.

---

## 10. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Sandbox isolation topology undecided (OQ-02) blocks the writable-copy P0 | High | Med | Pin expectation + cross-tenant test now; gate the writable-copy build on PLAT-SETTINGS-1; demote nothing — MVP exercises that write run only once the tenant model exists |
| Hammerbarn seed depends on 3 engines reaching GA | High | High | Phase-gate: ship CE+Explorer demo at MVP; Build/Events content + their tours/exercises feature-flagged off until GA (E2 phasing) |
| Tour anchors break when feature teams change UI | Med | High | OQ-06 `data-tour-id` strategy; absent-anchor steps skip + log, never block |
| Activation double-fire / mis-fire pollutes metrics | Med | Med | Idempotent exactly-once flag; engine-unavailable → milestone locked |
| Activation targets (60%/30min) treated as GA gates | Med | Med | Explicitly measure-and-report baselines for cohort 1; threshold set after baseline (decision E4) |
| Two PRDs owning starter widgets drift | Med | Med | Onboarding contributes mapping only; Platform E1-S6 owns rendering |

---

## Related

- [Brief](../01-brief/brief.md)
- [Inter-engine contracts](../../_inter-engine-contracts.md)
- [Weave Platform PRD](../../weave-platform/02-prd/prd.md) — auth, RBAC (PLAT-IDENTITY-1/SETTINGS-1), help launcher chrome, Dashboard E1-S6
- [Constitution Engine PRD](../../constitution-engine/02-prd/prd.md) — Hammerbarn seed authoring (CE-WRITE-1)
- [Graph Explorer PRD](../../graph-explorer/02-prd/prd.md) — Hammerbarn graph canvas (GE-CANVAS-1)
- [Build Engine PRD](../../build-engine/02-prd/prd.md) — Kitchen Designer project (BE-ARTEFACT-1)
- [Events & Actions PRD](../../events-actions-engine/02-prd/prd.md) — example automations (EA-AUTOMATION-1)

---
*Generated by Weave PO agent. Review and approve before proceeding to Roadmap.*
