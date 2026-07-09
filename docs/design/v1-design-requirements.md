---
type: Design
title: "v1 design requirements — input to the architect pass"
description: "WS2 output: findings + morning rulings converted into requirement bundles for the
  /architect pass to attach to owning v1 task briefs. Cites finding IDs (F-Dnn, assessment
  2026-07-09) and the chosen V4-hybrid direction."
tags: [design, requirements, v1, architect-input]
status: "Approved direction — pending attachment to task briefs (WS1 step 4)"
timestamp: 2026-07-09T00:00:00Z
resource: docs/design/v1-design-requirements.md
source: docs/design/design-assessment-2026-07-09.md + user MCQs 2026-07-09
owner: gazzwi86
---

# v1 design requirements (architect input)

Rules of use: the /architect pass attaches each bundle to the owning v1 task brief as a **Design
requirements** section (the design agent automates this once wired). Bundles cite finding IDs from
`design-assessment-2026-07-09.md`; the visual language is `visual-direction.md` (V4 hybrid);
success criteria come from `jtbd.md`. Nothing here invents scope — every item traces to an
approved finding or ruling.

## R1 — App shell v2 (V4-hybrid chrome) · F-D01/02/03/05/06/07/09

- Icon rail primary nav + contextual secondary sidebar (collapse toggle day one); slim header with
  breadcrumb; centered gradient-border command/search bar; bell (icon + unread badge), help icon,
  avatar menu (profile, role, sign out).
- ⌘K command palette: navigation + entity jump + actions, grouped results, keyboard hints.
- Page scaffolding primitives: `PageHeader` (breadcrumb, `--text-h1` 36/700 title, purpose line,
  actions), button system (one primary/secondary/ghost rule), `EntityRef` (friendly label + mono
  ID chip) and relative-time components used everywhere raw URNs/ISO timestamps appear (F-D08).
- Logo: cropped mark + lockup assets generated from `logo.png`; fuzzy tiny render fixed.

## R2 — Dashboard (Blocker F-D10)

- Bento grid per JTBD: KPI tiles (entities, published version, builds, conformance) sourced
  CE-READ-1/CE-METRICS-1, "Needs you" list, audit-sourced activity feed with friendly actors,
  recent model changes. No raw principal URN anywhere on the surface.

## R3 — Instance browser (Blocker F-D11, F-D12/13)

- Browse/search/list surface for instances: kind chips filter, searchable dense table
  (name, kind chip w/ colour+glyph, key relationship, updated), right inspector (properties,
  edges, PROV, edit entry), "view on canvas" cross-link.
- Authoring becomes actions on this surface: guided SHACL form in a drawer (kind stays visible,
  object properties use entity pickers, inline on-blur validation rendering CE-WRITE-1 422s
  per-field); chat is a glass aside with template chips, clear-history, and graceful
  can't-parse replies. Created-entity confirmations show friendly label + mono ID, not raw IRI.

## R4 — Explorer canvas (Blocker F-D15, F-D16/17)

- Fit-to-viewport on load and on "Reset layout"; corner-docked chrome (zoom/fit/layout
  bottom-right or top-right — never floating mid-canvas), collapsible legend (kind colour+shape)
  docked bottom-left, search in the canvas toolbar.
- `rdf:type` edges hidden by default; named edges labelled by label/curie in mono, sized
  subordinate to node labels. Node select → glass inspector (properties, edges, PROV, edit,
  expand-neighbours per research pattern 8); per-expansion node cap (pattern 10).
- Stray/isolated nodes handled by layout (no orphan floaters at seed scale).

## R5 — Query & ask (Blocker F-D18, F-D19)

- Ask lifecycle states: submitting (progress), provider-missing/timeout/error (explicit message +
  example questions), success. Never dead air.
- Result frame with **Graph / Table / Raw** toggle (research pattern 1); generated SPARQL always
  inspectable ("view SPARQL" disclosure); grounded IRIs glow on canvas with non-matches dimmed
  (V3 Ask pattern); version selector labelled; speech input affordance on the ask bar
  (V4 direction).
- SPARQL editor remains the expert path (SELECT-only, versioned) with clear Run primary.

## R6 — Marketing entry (Blocker F-D25, F-D26)

- `/login` route exists and works (dev-session aware); Log in / Get started CTAs functional.
- Hero visual = real product shot (canvas); sections per approved IA outline (§6): how-it-works
  with screenshots, feature grid, pricing placeholder.

## R7 — Tenancy wording sweep (F-D04, binding ruling)

- Members: no workspace switcher — static company name in the chrome; all "applies to every
  workspace" copy replaced with company-scope language. Super-admin: provisioning list remains
  (Settings → Workspaces). E2E tests address the sandbox workspace by URL, not via member-visible
  UI.

## R8 — Audit & compliance surfaces (F-D21/22/23)

- Audit dashboard + Compliance page rebuilt as tiles/charts (KpiCard/BarChart/area per
  generative-ui catalogue), "▲ 1" text trends replaced; drill from tile → pre-filtered logs.
- Logs table: relative time + friendly actor (raw on expand), tabular-nums, horizontal scroll
  affordance, 7-dimension filter bar per PLAT-AUDIT-1 spec, export/verify actions grouped.
- Compliance routes under `/audit/compliance` (ruling); nav highlight stays in Audit section.

## R9 — Settings completeness (F-D24)

- Add Members (roles per PLAT-EPIC-004) and Notifications preferences (PLAT-NOTIFY-1) sections;
  settings overview or Members as landing; budget scope copy per R7.

## R10 — Notifications (per `notifications-recommendation.md` + ruling)

- 8 types, role defaults per the matrix; `model.version.published` **batched per session**
  (collapsed "v0.3.0→v0.3.4" entries); bell panel styled (day groups, deep links, mark-read);
  `audit.chain.invalid` non-suppressible for admin + compliance; preference schema carries the
  channel dimension (email column rendered disabled with post-v1 pill).

## R11 — Build request (F-D20)

- Form fields per BE-EPIC-001: name, grounding-entity picker (graph-backed), target repo, run
  mode; labelled fields (no placeholder-only); post-submit visible request record with status +
  provenance link.

## R13 — Storybook design system (user ruling 2026-07-09, `visual-direction.md` §Delivery)

- Storybook workbench in `packages/frontend`; reusable **dumb** components extracted from the V4
  mock + existing app (props-in/markup-out, no data fetching, `var(--token)` only).
- Starting set per `visual-direction.md`: NavRail, SecondarySidebar, AppHeader/CommandBar,
  PageHeader, EntityRef, KindChip, KpiTile, DataTable, InspectorPanel, GlassPanel, AskBar,
  CanvasLegend, CanvasToolbar, Bell panel, EmptyState.
- Stories cover states (default/hover/selected/loading/empty/error) and both themes; component
  lands in Storybook before any page consumes it; R1–R12 surfaces refit onto the library rather
  than owning bespoke CSS.
- Dev-time only (not shipped); `ui_verify`/Lighthouse/token gates continue to run against app
  pages. **Sequencing: R13 components precede the page refits in R1–R11** — it is the foundation
  bundle.

## R12 — Kind list polish (F-D14, minor)

- `skos:definition` descriptions when CE-V1-TASK-011 lands; rows link to kind detail/shape view;
  pluralisation fixed.
