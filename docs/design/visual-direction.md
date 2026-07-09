---
type: Design
title: "Weave — chosen visual direction (V4 hybrid)"
description: "User-selected direction from the WS2 mock round (2026-07-09): V3 canvas-first body
  with V2 chrome (nav, header, search, borders), real logo.png mark. The recipe
  every design requirement and the design agent build against."
tags: [design, direction, app-shell, canvas]
status: "Approved — user MCQ, 2026-07-09 morning; confirmed as NORTH STAR + Storybook
  component-library delivery approach, user 2026-07-09"
timestamp: 2026-07-09T00:00:00Z
resource: docs/design/visual-direction.md
source: WS2 mock review (mocks V1/V2/V3), user selection
owner: gazzwi86
---

# Chosen visual direction — "V4 hybrid"

User ruling (2026-07-09, MCQ): bulk of the UI from **V3 Canvas First**, chrome from **V2 Linear
Dense**. Reference mock: `docs/design/mocks/mock-v4-hybrid.html` (V1/V2/V3 kept as provenance).

## The recipe

**From V2 (chrome):**

- Primary navigation: far-left icon rail (logo mark top; area icons w/ tooltips; avatar bottom).
- Secondary navigation: contextual sidebar driven by the rail (grouped items, phase pills,
  collapse toggle per the Airtable lesson).
- Header: slim bar with breadcrumb; centered command/search bar with the **multicolour gradient
  border** (the signature chrome accent); right cluster bell + help + avatar.
- ⌘K command palette (nav + entities + actions mixed results).
- **Border-based elevation** ladder (Supabase pattern) — borders, not shadows, everywhere outside
  the canvas.

**From V3 (body — the bulk of the UI):**

- Constitution lands on the **full-bleed living canvas**; floating glass panels for nav-in-context,
  legend, KPI strip, and the node inspector (glass stays canvas/overlay-only per the design
  system).
- **NL ask bar** persistent on the canvas — asks answer
  in place: answer panel + generated-SPARQL disclosure + grounded nodes glowing, non-matches
  dimmed.
- Instances screen per V3 (with V2's denser table treatment): kind chips, table, right inspector,
  "view on canvas" cross-link.
- Glass asides for AI/chat authoring (chat proposes, form applies — an aside, never the page).

**Logo:** the real `logo.png` (repo root — spectrum node-graph W + wordmark on navy). Requirement:
produce cropped/SVG header variants (mark-only ~24px, full lockup for marketing); the raw PNG has
padding and must not ship as-is.

**Where canvas-first does NOT apply:** Audit trail, Settings, Build, and other table/form-heavy
areas use standard page scaffolding (V2-style PageHeader + content), same chrome. Canvas-first is
Constitution/Explore's identity, not a global rule.

## Delivery approach — Storybook component library (user ruling, 2026-07-09)

The V4 mock is the **north star**; nailing this style in the built app is a priority. The landing
mechanism is a **design system in the app via Storybook**:

- Extract **reusable dumb (presentational) components** from the V4 mock and the existing app —
  props in, markup out, no data fetching, all styling via `var(--token)`.
- Each component gets stories covering its states (default/hover/selected/loading/empty/error)
  and both themes; Storybook is the dev workbench where look-and-feel is iterated and reviewed
  **before** pages consume the component.
- Pages are then refit to consume the library — the shell and surfaces stop owning bespoke CSS.
- Storybook is a dev-time tool (not shipped runtime); existing gates are unaffected — `ui_verify`,
  Lighthouse-100, and token conformance still gate the app pages themselves.

**Atomic design structure (user ruling, 2026-07-09):** the library loosely follows atomic design
— **atoms** (KindChip, EntityRef, phase pill, buttons, inputs) → **molecules** (CommandBar,
AskBar, KpiTile, table row, legend) → **organisms** (NavRail, SecondarySidebar, AppHeader,
DataTable, InspectorPanel, GlassPanel, Bell panel) → **templates** (canvas-page, table-page,
form/drawer-page, dashboard-grid layouts) → **pages** (Storybook page stories binding fixture
data). The app's container layer supplies DATA into design-system templates/pages — it never
composes raw components ad hoc or owns presentational markup/content. If a screen needs a layout
the system lacks, the template is added to the design system first, then consumed.

Recommended build order: atoms/molecules/organisms in Storybook first, then templates, then app
pages refit as thin data-binding containers.

## Decisions bound with this direction (same MCQ round)

| Decision | Ruling |
|---|---|
| 5 demo Blockers (F-D10/11/15/18/25) | All become v1 task requirements now |
| Compliance placement | Stays under Audit trail; route fixed to `/audit/compliance` (F-D23) |
| Design agent | Shape approved — advisor consult + wiring in progress |
| `model.version.published` noise | Batched per session (all members, collapsed entries) |
| Tenancy wording sweep (F-D04) | Confirmed — v1 requirement, switcher removed for members |
