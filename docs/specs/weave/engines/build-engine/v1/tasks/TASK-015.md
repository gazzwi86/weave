---
type: Task
title: "Task: TASK-015 — Registry Grid + Project Settings UI (FR-006/008/009/011, E2-S4 contributors UI)"
description: "First Build pages in the shared SPA: Registry grid (status cards, filter, name
  search) and the project settings tabs (governance, model tier, contributors, secrets refs,
  binding slots placeholder). Design tokens only; Lighthouse + ui_verify gated."
tags: [build-engine, arch, task, v1, ui]
status: Backlog
priority: Must Have
entity: build-engine
epic: EPIC-002
milestone: v1.0
created: 2026-07-08
blocked_by: [TASK-014]
unlocks: [TASK-022, TASK-023]
adr_refs: []
source: hand-authored
confirmed_by: "none"
confirmed_on: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/build-engine/v1/tasks/TASK-015.md
---

# Task: TASK-015 — Registry Grid + Project Settings UI

## Story

**Epic:** [EPIC-002 — Project Registry & Settings](../../../build-engine.md#epic-002)
**Status:** Backlog · **Priority:** Must Have

**As a** product owner
**I want** a browsable project registry and per-project settings tabs
**So that** I can find any project fast and govern it without touching an API

> **FRs covered:** FR-006 (grid UI, derived phase display), FR-008/FR-009 (caps + model-tier
> settings UI), FR-011 (secret references display), E2-S4 contributors UI (FR-060), FR-010
> binding **slots placeholder** ("available when connectors ship" — live bindings are TASK-022),
> **FR-066 (E2-S8 "New project" modal — name + description, `POST /api/projects` from
> TASK-014; replaces any "New request" action in the Registry — Request Studio is unchanged
> and lives in per-project nav, see AC-8/AC-9)**.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN the Registry loads, THE SYSTEM SHALL render status cards (phase, budget, owner, demo status) with filter and name search, interactive ≤ 1 s at 100 projects | `should render filtered searchable registry grid` |
| AC-2 | WHEN a filter/search resolves to zero projects, THE SYSTEM SHALL show an empty-state message with a clear-filters action — never a blank grid | `should show empty state when no projects match` |
| AC-3 | WHEN a project admin edits settings (caps, model tier), THE SYSTEM SHALL save via TASK-014 routes; WHEN the API rejects a looser-than-parent cap (422), THE SYSTEM SHALL show the binding parent level in the error — not a generic failure | `should surface binding cascade level on cap rejection` |
| AC-4 | WHEN an editor (non-admin) views settings, THE SYSTEM SHALL render governance fields read-only and hide mutation affordances; a forced request still 403s server-side (defence in depth — UX mirrors, never replaces, the Role Guard) | `should render settings read-only for editor` |
| AC-5 | WHEN contributors are managed, THE SYSTEM SHALL support add/change-role/remove with the admin/editor roles only, and explain that read access is company-wide (tenant membership) | `should manage contributors from settings tab` |
| AC-6 | WHEN secret configuration renders, THE SYSTEM SHALL show reference names only, with no reveal affordance | `should display secret reference names only` |
| AC-7 | WHEN the bindings tab renders before connectors ship, THE SYSTEM SHALL show the Confluence/Jira/ServiceNow slots as "available when connectors ship" — present, labelled, disabled | `should show binding slots placeholder` |
| AC-8 | WHEN "New project" is clicked in the Registry, THE SYSTEM SHALL open a modal collecting **name and description only** and, on save, call `POST /api/projects` (TASK-014) and navigate to the new project — no request/sign-off step in this flow. There is **no "New request" action in the Registry**; requesting work against an existing project remains in that project's Request Studio nav entry, unchanged | `should create project via new-project modal and navigate to it` |
| AC-9 | WHEN no project is selected, THE SYSTEM SHALL hide the "Current project" sidebar navigation group entirely; WHEN a project is selected (from the Registry or by direct navigation), THE SYSTEM SHALL populate that group with the project's name and its screens; WHEN the user returns to the Registry and selects a different project, THE SYSTEM SHALL re-point the group's contents to the newly-selected project **while each already-open screen retains its own state/URL** — never show a stale or empty-context group, and never silently reset an in-progress view | `should show and swap current-project sidebar group on selection` |

## Implementation

### Pseudocode

```
routes (Next.js app router, Build module in the shared SPA):
  /build                       -> RegistryGrid (server component + client filter bar)
  /build/projects/[id]/settings -> SettingsTabs(governance | contributors | integrations)

RegistryGrid: useQuery(GET /api/projects?filters) -> <ProjectCard phase={derived}/> grid
  empty result -> <EmptyState onClear={resetFilters}/>            # AC-2
  "New project" button -> <NewProjectModal name, description/>
    on save: POST /api/projects -> navigate(/build/projects/[id])  # AC-8, no request step
SidebarNav (shell-level, Build module contributes the conditional group):
  selectedProjectId = useSelectedProject()      # null until Registry selection or deep link
  selectedProjectId == null -> "Current project" group ABSENT      # AC-9
  selectedProjectId set     -> group renders {project.name} + screens, swaps on reselect
SettingsTabs:
  role = useProjectRole()      # from session/contributor payload  # AC-4
  governance tab: CapFields (cascade level shown per field), ModelTierSelect
    on 422 CapLooserThanParent -> inline error naming level        # AC-3
  contributors tab: table + AddContributorDialog (role select: admin|editor)  # AC-5
  integrations tab: three disabled BindingSlot cards               # AC-7
all styling via design tokens (docs/standards/design/tokens.md); shadcn primitives
```

### API Contracts

Consumes TASK-014 routes only (`GET /api/projects`, `POST /api/projects`, `PATCH settings`,
contributors CRUD) — shapes pinned there and in `v1-delta.md` §3. No new endpoints. The sidebar
"Current project" group is client-side navigation state (selected project id), not a new
endpoint — it reads whichever project the user is already viewing.

### Diagram References

| Diagram | File | Section | Summary |
|---|---|---|---|
| Architecture delta | `../../tech-spec/v1-delta.md` | §2 diagram | Registry/settings pages → PM Surface API |
| Design system | `../../../../../standards/design/design.md` | component catalogue | Cards, tables, dialogs, empty states to compose from |
| Lighthouse | `../../tech-spec/v1-delta.md` | §6 | Page targets + registry render budget |

### Design Decisions

| Decision | Reference | Impact |
|---|---|---|
| UX role-gating mirrors the Role Guard, never replaces it | AC-4 / FR-060 | Hidden affordances are UX; the 403 is the boundary — E2E asserts both |
| Binding slots ship disabled, not omitted | FR-010 AC | Users see the feature exists and what gates it; TASK-022 flips them live |
| Server components for grid data, client islands for filters | Next.js 15 default | Keeps the interactive ≤ 1 s budget at 100 projects |
| No ad-hoc styling values | `docs/standards/design/` | `ui_verify` gate rejects raw hex/px/duration |
| "New project" replaces "New request" in the Registry (B10) | FR-066 / `ADR-009` | This is a real create operation, not a relabel — the modal calls a new endpoint (TASK-014); Request Studio is untouched and lives per-project |
| "Current project" sidebar group is conditional, not a fixed shell element | FR-066 AC-9 / `v1-delta.md` §2 | Matches the researched "context-scoped sidebar" convention (Vercel dashboard nav, general SaaS nav guidance — cited in `v1-delta.md` §2) — no context shown until a context exists; each screen's state/URL is preserved across a context switch |

## Design Requirements

Cited against `docs/standards/design/*` (rubric), `docs/design/visual-direction.md` (V4-hybrid
recipe), `docs/design/v1-design-requirements.md` (R-bundles), and `docs/design/jtbd.md`. Every
line below cites its source; anything that could not be traced to a cited source is marked
**Advisory** and is not a pass/fail acceptance criterion.

### Page scaffolding + components

- Both routes use standard page scaffolding, not the canvas-first treatment: *"Build… use
  standard page scaffolding (V2-style PageHeader + content), same chrome. Canvas-first is
  Constitution/Explore's identity, not a global rule"* (`visual-direction.md` §"Where
  canvas-first does NOT apply"). Compose `PageHeader` (breadcrumb, `--text-h1` title, purpose
  line, actions) per R1 (`v1-design-requirements.md` R1).
- Registry grid (`/build`): a **card grid**, not a data table — the brief's own pseudocode
  renders `<ProjectCard phase={derived}/>`. Use the Card/container pattern
  (`docs/standards/design/components.md` §Card/container: `--color-surface`,
  `--color-border`, `--radius-base`, `--space-5` padding, `--color-hover` + `--ring-focus` when
  interactive). Filter/search bar uses the Input pattern (`components.md` §Input, textarea,
  select). "New project" uses the primary Button variant (`components.md` §Button).
- Registry list-page layout: `layout-grid.md` "Wide" container (~1440px max width) for
  dense card/list views; grid gaps and card padding are `--space-*` tokens
  (`layout-grid.md` §Spacing system — card padding `--space-4`, gap between cards
  `--space-5`).
- "New project" modal (AC-8): the **Modal/dialog** pattern (`components.md` §Modal/dialog) —
  glass surface, `--z-modal`, `--radius-lg`, `--space-6` padding, focus trap on open, focus
  restored to trigger on close, closes on `Escape`. Fields (name, description) are Input/
  textarea per `components.md` §Input with visible `<label>`s.
- Settings tabs (`/build/projects/[id]/settings`): the **Navigation & tabs** pattern
  (`components.md` §Navigation & tabs) — `role="tablist"`/`role="tab"`/`aria-selected`, active
  indicator slides on switch. Governance/contributors/integrations map to the "form/drawer-page"
  and "table-page" **templates** named in R13's atomic-design structure
  (`v1-design-requirements.md` R13: "templates (canvas-page, table-page, form/drawer-page,
  dashboard-grid layouts)") — this surface consumes those templates rather than owning bespoke
  page CSS.
- Governance/caps/model-tier fields: Input/select pattern (`components.md` §Input, textarea,
  select) with the full state table (default/hover/focus-visible/disabled/error).
- Contributors tab: a real data table (name, role, remove action) — prefer native `<table>`
  semantics (`docs/standards/accessibility.md` §ARIA conventions: "Prefer native semantics…
  `<table>`"); the `DataTable` organism named in the Storybook component set
  (`v1-design-requirements.md` R13) is the reusable building block once it lands. Role
  (admin/editor) is rendered as a **badge**, never colour alone: `components.md` §Badge/chip —
  icon + text, semantic soft-bg pairing (do not invent a new colour mapping; use
  `--color-info`/`--color-success` soft-bg pairs from `color.md` §Semantic status colours, paired
  with the role label text).
- Binding slots (AC-7): disabled Card instances (`components.md` §Card/container, `disabled`
  state per §Shared interaction rules — `aria-disabled`, no pointer) labelled "available when
  connectors ship."
- IDs shown anywhere on either surface (project id, contributor user id) use `--font-mono` per
  `docs/standards/design/typography.md` §Mono usage ("IDs & IRIs… task IDs… tenant/workspace
  IDs"). Where a raw project IRI would otherwise be shown, pair it with a friendly label per the
  `EntityRef` pattern (`v1-design-requirements.md` R1: "friendly label + mono ID chip… used
  everywhere raw URNs/ISO timestamps appear").
- "Current project" sidebar group (AC-9) is contributed to the shell's contextual secondary
  sidebar: *"Secondary navigation: contextual sidebar driven by the rail (grouped items, phase
  pills, collapse toggle…)"* (`visual-direction.md` §"From V2 (chrome)"); the `SecondarySidebar`
  organism is named in R13's Storybook set (`v1-design-requirements.md` R13).

### Tokens/type-scale bindings

- Colour, spacing, radius, shadow, and motion are `var(--token)` only — **zero literal hex/px/ms**
  anywhere on either surface (`docs/standards/design/tokens.md` §Conformance: "Zero literal
  hex/px in catalogue application components"; enforced by the `CE-BRAND-1` conformance gate and
  `ui_verify`).
- Type: `PageHeader` title `--text-h1` (36px/700); card titles/panel headers `--text-h4`
  (`typography.md` type-scale table); body copy `--text-body` (15px default); secondary/caption
  text (owner, updated-at, budget figures) `--text-body-sm`/`--text-caption`; form labels
  `--text-label` (`typography.md`).
- Numeric/metric values (budget figures, contributor counts) use `--font-mono` with tabular
  figures on, per `typography.md` §Mono usage ("Metrics & numbers — KPI values, counts…").
- Spacing: card padding `--space-4`, gap between cards `--space-5`, block/section gaps
  `--space-6`/`--space-8` (`tokens.md` §space, `layout-grid.md` §Spacing system table).
- Radius: cards/inputs `--radius-base`/`--radius-sm`; modal `--radius-lg` (`tokens.md` §radius).
- Motion: hover/press micro-interactions `--duration-fast`/`--duration-instant` +
  `--ease-standard`; modal reveal `--duration-slow` `--ease-out`; skeleton loading uses the
  `shimmer` keyframe at `--duration-shimmer` `--ease-linear` (`tokens.md` §motion,
  `motion.md` §Micro-interactions, §Keyframes). Every animated pattern ships a
  `prefers-reduced-motion` fallback per `motion.md` §prefers-reduced-motion (shimmer →
  static skeleton block; modal reveal → opacity-only).
- Focus: every focusable element (card, tab, input, badge remove-button, modal trigger) renders
  `--ring-focus` on `:focus-visible` (`tokens.md` §shadow; `components.md` §Shared interaction
  rules).

### Required states

- **Loading:** grid and settings tabs render skeleton tiles holding their final layout span
  during data fetch, using the `shimmer` keyframe over `--color-raised`
  (`components.md` §Data-widget states — the visual token for a streaming/loading region;
  `motion.md` §Keyframes #4). Reduced motion → static `--color-raised` block, no sweep.
- **Empty (AC-2):** zero-filter-match state is a defined empty-state composition, never a blank
  grid — "Empty-state and error-state components are design-system catalogue items; the AC-2/AC-3
  states are compositions, not new patterns" (task brief §Implementation Hints); render via the
  `EmptyState` component named in R13 (`v1-design-requirements.md` R13).
- **Validation error (AC-3, 422 cap-cascade rejection):** inline field error naming the binding
  parent level, using the Input error/invalid state (`components.md` §Input: `--color-danger`
  border, `aria-invalid` + `aria-describedby` pointing to the message in `--color-danger` text).
- **Read-only / permission state (AC-4, editor role):** governance fields render in the `disabled`
  input state (`components.md` §Input: `--color-border-soft`, `--color-bg` fill,
  `--color-text-subtle`, `aria-disabled`) with mutation affordances hidden, not merely disabled —
  matching the brief's "hide mutation affordances" wording. This is UX only; the 403 boundary is
  server-side (AC-4) and is out of this agent's scope to verify beyond confirming the UI mirrors
  it.
- **Service/write failure (advisory intent behind the task's error-state note — see GAPS for the
  ADR-013/503 citation correction):** where a settings write genuinely fails server-side for a
  reason other than 422/403 (e.g. the 500/`ce_write_unavailable`-shaped failures documented
  elsewhere in this epic's tasks), render the offline/unavailable treatment from
  `components.md` §Data-widget states — `AlertBanner`-style row, `--color-danger` soft bg + icon +
  retry, `role="alert"` (`accessibility.md` §ARIA conventions: "errors blocking an action →
  `role=\"alert\"`"). The write must remain retryable; no partial state persists.
- **Secret display (AC-6):** reference-name-only rendering with no reveal affordance is a content
  rule (brief AC-6), not a new visual state — render the name as a chip/badge
  (`components.md` §Badge/chip) with no interactive reveal control at all (absence of the
  affordance, not a disabled one).
- **Binding-slots-disabled (AC-7):** disabled Card state, per §Page scaffolding above.
- **Success:** grid populated / settings saved — standard surface states, no special treatment
  beyond the toast pattern for a save confirmation (`components.md` §Toast/notification:
  `--color-raised`, `aria-live="polite"`).

### Accessibility (beyond the global gate, what `ui_verify --full` checks)

- Every card, tab, input, and modal trigger is keyboard-reachable in logical order; no positive
  `tabIndex` (`accessibility.md` §Keyboard navigation §General rules).
- Modal (New project) traps focus on open, restores focus to the trigger on close, closes on
  `Escape` (`accessibility.md` §General rules; `components.md` §Modal/dialog).
- Tabs use `role="tablist"`/`role="tab"`/`aria-selected` (`accessibility.md` §ARIA conventions;
  `components.md` §Navigation & tabs).
- Contributors table and any list uses native `<table>`/`<label>` semantics before reaching for
  ARIA roles (`accessibility.md` §ARIA conventions "Prefer native semantics").
- Icon-only controls (remove-contributor, clear-filters) carry `aria-label`
  (`accessibility.md` §ARIA conventions "Names").
- Form validation errors use `aria-invalid` + `aria-describedby`; save-blocking errors use
  `role="alert"` (`accessibility.md` §ARIA conventions "State", "Live regions").
- Read-only (editor) state reflects via `aria-disabled` on hidden/inert controls, not silent
  removal without an accessible explanation of why the field is uneditable (inference from
  `accessibility.md` §ARIA conventions "State" combined with AC-4's "explain" framing —
  **Advisory**: the brief text for AC-4 does not itself mandate an explanatory string, only
  read-only rendering).
- Contrast: text ≥ 4.5:1, large text/UI ≥ 3:1 — met by construction when tokens are used as
  specified (`color.md` computed ratios; `accessibility.md` §Conformance target). No literal
  colour values.
- `@axe-core/playwright` zero violations (`serious`/`critical`/`moderate`) on both routes
  (`accessibility.md` §CI gate).

### Responsive behaviour

- Usable at 320 CSS px with no horizontal scroll, and at 200% zoom without loss of function
  (`accessibility.md` §Conformance target "Reflow"/"Zoom"; `layout-grid.md` §Breakpoints &
  responsive behaviour).
- Registry grid collapses per the breakpoint table: single column below `--bp-sm`, more columns
  as width grows per the "Wide" container rules (`layout-grid.md` §Breakpoints & responsive
  behaviour, §Container & content widths). No design-system component names a fixed card-grid
  column count for a non-bento list — the grid should follow the same collapsing discipline as
  the bento grid (4→3→2→1 as width drops) as the nearest cited analogue
  (`layout-grid.md` §Bento dashboard grid) — **Advisory**: the exact column counts for a plain
  card grid (as opposed to the bento dashboard) are not pinned by a standard; pick a sensible
  responsive count and do not regress below single-column at 320px.
- Settings tabs collapse sub-nav-style below `--bp-md` (`layout-grid.md` §Breakpoints:
  "Sub-nav collapses to a compact form" at `--bp-md`) and use the "Reading"/"Wide" container width
  as appropriate to form vs table content (`layout-grid.md` §Container & content widths).
- Density: both surfaces honour the `[data-density]` comfortable/compact remap
  (`layout-grid.md` §Density modes) without introducing a second spacing token set; interactive
  target sizes stay ≥24×24 CSS px in both densities (`accessibility.md` §Conformance target
  "Target size").

### JTBD success criteria (see GAPS — no direct entry exists)

No `jtbd.md` entry exists for "Build → Registry" or "Build → Project Settings" specifically. The
closest entries are "Settings" (company/workspace scope, tenant admin — `jtbd.md` §Settings) and
"Build → Request application" (the Request Studio flow, which AC-8 explicitly does **not**
replace with this task's "New project" modal). Neither maps cleanly onto this surface, so no
JTBD success line is asserted as an acceptance criterion here. As an **advisory** analogue only:
the company Settings job — "govern without a runbook," "one predictable place" — is the closest
in spirit to project-level governance and is offered as design intent, not a citable AC.

## GAPS

- **Uncited claim in the originating request corrected, not carried forward:** the request that
  produced this section named "the ADR-013 503 on project-scope settings write" as a state to
  cover. Primary-source check: `docs/specs/weave/engines/build-engine/decisions/ADR-013.md`
  specifies a **fail-open, company-scope cascade retry** on `InvalidScopeIri` — no 503, no
  user-facing error at all; domain/project-level cap overrides are simply inert (deferred).
  `TASK-014`'s `PATCH /api/projects/{id}/settings` error table is `400/403/404/422/500` — no 503
  is defined there either. No AC line cites a "503 on project-scope settings write" because no
  cited source supports one. The real, citable design implication of ADR-013 for this surface is
  narrower: a project- or domain-level cap override a user sets in the Governance tab will not
  currently take effect (only the company default cap is reachable) — worth a UI note if/when the
  Governance tab is built, but that is a product-copy decision for the architect/PO, not a design
  system citation, and is flagged here rather than asserted.
- **No `jtbd.md` entry** for the Registry grid or per-project Settings surface (see §JTBD success
  criteria above). Recommend a follow-up `jtbd.md` addition scoped to Build's project-admin
  persona.
- **No R-bundle in `v1-design-requirements.md`** (R1–R13) covers the Build engine's Registry or
  Settings surfaces — all bundles are scoped to Constitution, Platform/Audit, or Marketing. The
  anchor citation used throughout this section is `visual-direction.md`'s standard-page-scaffolding
  rule plus the generic R1/R13 shell primitives, which do apply (Build shares the SPA shell), but
  there is no Build-specific approved bundle to cite for surface-specific details (e.g. exact
  lifecycle-phase colour mapping). Recommend a follow-up R-bundle for Build engine v1 surfaces.
- **No pagination component** is named anywhere in `docs/standards/design/*`. The task's own
  Implementation Hints ask for a filter/search bar but the AC only requires "interactive ≤ 1 s at
  100 projects" — no AC requires pagination. Not asserted as a requirement; flagged so the
  engineer does not invent an uncited pagination pattern.
- **Lifecycle-phase chip colours** are not pinned by a standard (phase is not a BPMO kind and not
  a semantic status in `color.md`). Use the Badge/chip *pattern* (icon + text, never colour alone)
  cited above; the specific colour-per-phase mapping is left to implementation and should be
  checked at QA time against whatever mapping ships, not against a citation that does not exist
  yet.

## Test Requirements

### Unit Tests (minimum 4)

- `should render filtered searchable registry grid` (component test, mocked query)
- `should show empty state when no projects match`
- `should surface binding cascade level on cap rejection`
- `should display secret reference names only`

### Integration Tests (minimum 2)

- `should render settings read-only for editor` (rendered against role payload)
- `should show binding slots placeholder`
- `should show and swap current-project sidebar group on selection`

### E2E Tests (Playwright, minimum 3 — Law B: backend state asserted)

- `should manage contributors from settings tab` (add editor → DB row asserted; remove →
  row gone; UI reflects)
- `should deny settings mutation to editor end to end` (editor session forces a PATCH → 403
  + audit entry asserted server-side; UI shows read-only)
- `should filter registry and open a project` (grid → settings navigation)
- `should create project via new-project modal and navigate to it` (modal save → DB row
  asserted via TASK-014's `POST /api/projects` → redirected to the new project; Law B)

### AC-to-Test Mapping

| AC | Type | Test |
|---|---|---|
| AC-1 | Unit | `should render filtered searchable registry grid` |
| AC-2 | Unit | `should show empty state when no projects match` |
| AC-3 | Unit | `should surface binding cascade level on cap rejection` |
| AC-4 | Integration + E2E | `should render settings read-only for editor` / `should deny settings mutation to editor end to end` |
| AC-5 | E2E | `should manage contributors from settings tab` |
| AC-6 | Unit | `should display secret reference names only` |
| AC-7 | Integration | `should show binding slots placeholder` |
| AC-8 | E2E | `should create project via new-project modal and navigate to it` |
| AC-9 | Unit | `should show and swap current-project sidebar group on selection` |

## Dependencies

- **blocked_by:** [TASK-014]
- **unlocks:** [TASK-022] (extends the integrations tab), [TASK-023] (source-control tab
  mounts in these settings tabs)
- **External prerequisites:** `docs/standards/design/` tokens (present); SPA shell routes
  (Platform, live); Playwright + ui_verify harness (live)

## Cost Estimate

- **Complexity:** L
- **Estimated tokens:** ~18k input, ~10k output
- **Estimated cost:** ~$0.70 (claude-sonnet-5 implementation tier)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (consumes TASK-014; cited)
- [x] Diagram references included
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing (incl. Playwright E2E with backend assertions)
- [ ] Coverage ≥ 80% changed code; delta mutation ≥ 70%
- [ ] Lighthouse: Performance ≥ 90, Accessibility ≥ 95, Best-practices ≥ 90 on both routes
- [ ] `ui_verify` gate passes; zero ad-hoc style values (design tokens only)
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] Docstrings/JSDoc on exported components
- [ ] Conventional commit(s); PR references this task and EPIC-002

## Implementation Hints

- Compose from the design system's existing card/table/dialog/empty-state components
  (`docs/standards/design/components.md`) — build no bespoke primitives.
- The role payload for AC-4 comes with the project settings response (TASK-014) — do not add
  a separate "my role" endpoint.
- Empty-state and error-state components are design-system catalogue items; the AC-2/AC-3
  states are compositions, not new patterns.
- Keep filter state in the URL (searchParams) so filtered views are shareable and the
  back-button behaves; this also makes the Playwright assertions trivial.
- Visual/behavioral reference: `docs/design/mocks/mock-v5-delta.html`, screen 10 (Project
  Registry: grid, "New project" modal, lifecycle-phase chips) — build the modal fields to match.
  The "Current project" conditional sidebar group is demonstrated by the mock's shell navigation
  logic (`currentProjectGroupHTML()`), not a numbered screen of its own — see it exercised by
  navigating from screen 10 into any per-project screen (9/11/12/13/14) and back.

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
*Design Requirements section appended by the Weave Design Agent (Hook 1, brief time) — pending
Approve/Amend/Reject sign-off through the same architect gate as every other section.*
