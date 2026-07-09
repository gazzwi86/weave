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
