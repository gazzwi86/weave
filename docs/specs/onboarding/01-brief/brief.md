---
type: Product Brief
title: Onboarding — Product Brief
description: "Brief for Weave Onboarding — in-product guided training through a fully-modelled example company."
tags: [onboarding, 01-brief, training, ux]
timestamp: 2026-06-29T00:00:00Z
resource: docs/specs/onboarding/01-brief/brief.md
---

# Brief: Onboarding

## Mission Statement

We are building Weave Onboarding — the in-product training and guided-onboarding layer — so
that a brand-new user can learn Weave by exploring a fully-modelled example company
(Hammerbarn) and being guided through the product with contextual tooltips, modals, training
videos, and hands-on exercises, reaching their first real outcome in their own workspace
quickly rather than bouncing off a powerful but unfamiliar platform. Onboarding is what turns
Weave's breadth from an obstacle into a guided path.

## Problem

Weave is broad and conceptually novel — four engines, a semantic knowledge graph, and ideas
like ontologies, SHACL validation, and governed automation that most new users have never
met. That power is also a barrier.

- **Blank-slate paralysis.** A new user lands in an empty workspace with no data and no model,
  facing the hardest possible starting point — a blank graph — with no sense of what a "good"
  Weave model even looks like.
- **Unfamiliar concepts, especially for business users.** The ops and business roles Weave
  needs to adopt first are precisely the people least likely to know what an ontology or a
  SPARQL query is, so the platform feels like expert software.
- **Breadth is overwhelming.** With Constitution, Explorer, Build, and Automate all available,
  a new user has no obvious first path and can easily bounce off before reaching any value.
- **No worked example to learn from.** Without a complete, realistic model to explore, users
  cannot see how the pieces fit together or what to aim for in their own workspace.

The people who feel this are **every new user** — business and operations staff, architects and
engineers, trial evaluators, and workshop attendees — all of whom must climb the same curve. If
this is not solved, Weave's ops-first adoption strategy fails at the first step: the people who
are supposed to populate and trust the graph give up before they understand it, and the most
powerful platform in the category loses to whatever is easier to start.

## Vision

Within 12 months, success for Onboarding looks like:

- **Every new user starts in a fully-modelled example.** A new user lands in the Hammerbarn
  demo workspace and can explore a complete, realistic company — full ontology, glossary,
  brand, processes, and a generated example app — so they see what "good" looks like before
  touching their own.
- **The product guides itself.** Contextual tooltips, modals, and beacons walk users through
  the navigation, screens, and features, role-personalised, brief, and always skippable, so no
  one is left guessing what a screen is for.
- **Users learn by doing.** Hands-on exercises and tasks in the demo workspace (add an entity,
  run a query, build a simple automation) turn passive reading into practice, with progress
  tracked.
- **Help and training are always one click away.** A persistent help and guided-tour launcher
  gives access to tours, contextual help, and a training library (videos and walkthroughs) at
  any time, not just on first run.
- **New users reach a first real outcome quickly.** Guided by an onboarding checklist, a user
  completes a meaningful first action in their own workspace — a clear activation milestone —
  rather than stalling on the blank slate.
- **Onboarding is tailored to role and access.** Different roles and identities — with
  different access rights — get a context-specific onboarding experience: a business analyst, an
  architect, a compliance officer, and a workspace admin each see guidance, exercises, and a
  first-outcome path suited to what they can and need to do, rather than one generic tour.
- **Onboarding is measurable and improvable.** Completion of tours, exercises, and the
  activation milestone is tracked (by role), so onboarding effectiveness can be measured and
  improved over time.

## Scope

### In Scope

**The Hammerbarn demo workspace**

- A fully-modelled example company (Hammerbarn) shipped as a separate, explorable workspace:
  complete ontology populated across the core types, glossary, brand and voice, governance
  content, business processes, and org chart — plus an example generated app (the kitchen
  designer), example automations, and an example Build project.
- Safe sandbox interaction: users can explore and complete exercises without affecting real
  data.

**Guided onboarding overlays**

- Contextual **tooltips, modals, and beacons/hotspots** that guide users through the navigation,
  screens, features, windows, and dashboards.
- **Guided tours** (linear) for core paths plus **contextual tooltips** for complex areas;
  skippable, resumable, with progress indicators.
- **Role-tailored** tours and guidance keyed to the user's role and access rights (see
  `weave-platform` Roles & Access).

**Training content**

- A **training library** with **placeholders for training videos** (real video production is a
  later content task) and written walkthroughs.
- **Hands-on tasks/exercises** in the demo workspace (e.g. add an entity, run a query, build a
  simple automation) with progress tracking.
- An **onboarding checklist** that drives the user to a first activation milestone in their own
  workspace.

**Help system**

- A persistent **help & guided-tour launcher** in the top header, re-accessible at any time,
  with contextual help per screen.

**Measurement**

- Tracking of tour, exercise, checklist, and activation completion, segmented by role, to
  measure and improve onboarding.

### Out of Scope

- **Producing the final training videos** — v1 ships placeholders and the framework to host
  them; real video content is a separate production effort.
- **The modelling capability that builds the demo** — the Constitution Engine; onboarding
  curates and ships the Hammerbarn dataset, it does not build new modelling tools.
- **The roles/identity/RBAC system itself** — owned by the platform; onboarding consumes roles
  to tailor the experience, it does not define access control.
- **Formal certification / LMS** — a structured certification programme is a later addition
  (related to the workshop methodology), not part of this in-product onboarding v1.
- **External/marketing-site education** — onboarding here is in-product.

## Target Users

| User Type | Description | Primary Need |
|-----------|-------------|--------------|
| New business user / SME | First-time non-technical user who must populate and trust the graph | A concept-light, guided path with hands-on exercises that build confidence without jargon |
| New technical user (architect / engineer) | First-time technical user extending the model or building | A faster, deeper path that can skip basics and reach modelling/build capability quickly |
| Trial evaluator / buyer | Assessing whether Weave delivers value | A quick route to a convincing "aha" via the demo company, with minimal setup |
| Workshop attendee | Learning Weave within a facilitated session | Guidance that complements a live facilitator and a shared example to follow |
| Onboarding / content admin | Curates tours, exercises, and the demo dataset | Tools to configure, sequence, and update the onboarding experience and training content |

## Success Criteria

- [ ] **The demo company ships complete.** The Hammerbarn workspace is available to every new
      user with a fully populated ontology, glossary, brand, processes, org chart, and at least
      one example generated app and automation, all explorable. Measured by a content
      completeness check; source: the demo workspace. Target: at onboarding GA.
- [ ] **Guided coverage of the product.** Every primary navigation area and its key screens has
      a guided tour or contextual tooltips. Measured by a coverage audit against the navigation
      map; source: onboarding configuration. Target: at GA.
- [ ] **Role-tailored paths are live.** At least four role-specific onboarding paths exist
      (e.g. business user, technical user, compliance, admin), each with its own first-outcome
      milestone. Measured by configuration review; source: onboarding configuration. Target: at
      GA.
- [ ] **New users activate.** At least 60% of new users complete the onboarding checklist and
      reach their first activation milestone within their first week (target to validate).
      Measured by activation analytics segmented by role; source: application analytics. Target:
      90 days after GA.
- [ ] **Time-to-first-outcome is short.** The median new user reaches a first real outcome in
      their own workspace within 30 minutes of first sign-in (target to validate). Measured by
      analytics; source: application analytics. Target: 90 days after GA.
- [ ] **Tours are skippable, resumable, and measured.** Every tour can be skipped and resumed,
      and completion of tours, exercises, and the checklist is tracked by role. Measured by
      functional test and analytics instrumentation; source: QA + analytics. Target: at GA.

## Constraints

**Technical**

- Onboarding is in-product, delivered as an overlay layer within the single React SPA — a tour
  framework keyed to navigation/screen anchors, not tightly coupled to each engine's internals.
- The Hammerbarn demo is a separate, isolated, resettable workspace; sandbox interactions never
  affect real tenant data.
- Training videos are placeholders in v1; the framework hosts them (e.g. S3/CloudFront) when
  produced.
- Role-tailoring consumes the platform Roles & Access model; onboarding does not define access
  control.
- Tours and tooltips must be accessible and keyboard-navigable, and always skippable.
- Whether to build the tour framework or adopt a library is decided at the tech spec.

**Business**

- The demo company is clearly fictional (Hammerbarn, inspired by Bunnings/Kingfisher/B&Q) to
  avoid trademark issues while staying realistic.
- Onboarding supports the trial-conversion and workshop GTM motions.

**Timeline / sequencing**

- Onboarding tours the engines, so it follows or parallels their delivery; a basic onboarding
  (tours of Constitution and Explorer) can ship with the MVP.
- A complete demo requires the Constitution Engine (to model Hammerbarn) and at least one
  generated artefact from the Build Engine (the example app), so the full demo follows Build.

## Key Decisions

For the platform-wide master list see `CLAUDE.md § Architecture decisions (confirmed)` and the
`weave-platform` brief. Decisions specific to Onboarding:

| Decision | Rationale | Date |
|----------|-----------|------|
| In-product guided onboarding via an overlay framework (tooltips, modals, beacons, tours) | Guides users through a broad, novel platform in context, where the work happens | 2026-06-26 |
| A fully-modelled Hammerbarn demo workspace is the learning sandbox | Users learn from a complete, realistic example and see what "good" looks like before touching their own | 2026-06-26 |
| Combine a fully-populated demo with focused guided tours | Research shows a sandbox plus targeted tours beats either a feature-by-feature tour or an empty start | 2026-06-26 |
| Onboarding is tailored to role and access | Different roles need different paths; tailoring keys off the platform Roles & Access model | 2026-06-26 |
| Training videos are placeholders in v1 | Ship the framework and host real video content later as a separate production effort | 2026-06-26 |
| Onboarding effectiveness is measured (activation and completion by role) | Onboarding must be improvable, not assumed effective | 2026-06-26 |
| Sequencing: basic onboarding with the MVP, full demo after Build | The full demo needs a generated artefact; a basic tour of Constitution and Explorer can ship earlier | 2026-06-26 |

## Navigation

Onboarding is an overlay layer, not a primary navigation area, so it has no left sidebar of its
own. It surfaces across the app's information architecture (see the `weave-platform`
Navigation section):

- **Help & guided-tour launcher** — in the top header global chrome, re-accessible at any time.
- **Hammerbarn demo** — appears in the workspace switcher as a separate demo workspace.
- **Onboarding checklist** — a persistent widget (e.g. on the Dashboard) tracking progress to
  the first activation milestone.
- **Training library** — opened from the help launcher (videos and walkthroughs).
- **Contextual tooltips, modals, and beacons** — overlaid on each engine's screens, keyed to
  navigation/screen anchors and the user's role.

---
*Generated by Weave PO agent. Review and approve before proceeding to PRD.*

# Related

- [Weave Platform — Product Brief](../../weave-platform/01-brief/brief.md)
