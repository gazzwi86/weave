---
type: Task
title: "Task: TASK-022 — External-Space Bindings (FR-010): Confluence/Jira/ServiceNow by Reference"
description: "Bindings CRUD + settings-tab UI over PLAT-CONNECTOR-1 instance handles: bind a
  project to external spaces by reference (no credential in Build), render live health from
  the connector health-read API with an honest 'health unavailable' state."
tags: [build-engine, arch, task, v1, ui]
status: Backlog
priority: Must Have
entity: build-engine
epic: EPIC-002
milestone: v1.0
created: 2026-07-08
blocked_by: [TASK-010, TASK-015]
unlocks: []
adr_refs: []
source: hand-authored
confirmed_by: "none"
confirmed_on: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/build-engine/v1/tasks/TASK-022.md
---

# Task: TASK-022 — External-Space Bindings (FR-010): Confluence/Jira/ServiceNow by Reference

## Story

**Epic:** [EPIC-002 — Project Registry & Settings](../../../build-engine.md#epic-002)
**Status:** Backlog · **Priority:** Must Have

**As a** project admin
**I want** to bind my project to the right Confluence space, Jira board, and ServiceNow
project by reference
**So that** agents pull from and push to the correct external spaces without Build ever
holding a connector credential

> **FRs covered:** FR-010 (E2-S5). **Program dependency:** live behaviour requires the
> Platform v1 connector delivery (PLAT-CONNECTOR-1 — config + health + ingestion, v1.0).
> This task flips TASK-015's disabled slots live. If Platform's connector tasks have not
> landed when this task reaches Ready, it holds there (DAG below) — the UI meanwhile keeps
> the honest placeholder.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN a project admin binds an external space, THE SYSTEM SHALL store `{system, connector_ref, space_ref}` where `connector_ref` is a PLAT-CONNECTOR-1 **connector instance handle** — no credential, token, or URL secret is stored in Build | `should store binding as instance handle reference only` |
| AC-2 | WHEN a binding is created against a connector instance the tenant has not configured, THE SYSTEM SHALL reject with a named error listing available instances (from the connector registry read) | `should reject binding to unknown connector instance` |
| AC-3 | WHEN the bindings tab renders, THE SYSTEM SHALL show each binding's health from the PLAT-CONNECTOR-1 health-read API (`status, last_sync, last_error, error_count`, skipped-count); WHEN the health read fails, THE SYSTEM SHALL show "health unavailable" — never a fake green | `should show health unavailable when connector health read fails` |
| AC-4 | WHEN a duplicate binding `(system, space_ref)` on the same connector instance is submitted, THE SYSTEM SHALL reject via the TASK-010 unique constraint with a friendly conflict message | `should reject duplicate binding with conflict message` |
| AC-5 | WHEN bindings are mutated, THE SYSTEM SHALL require the BINDINGS guard class (project admin / company-or-domain admin-owner); denial = 403 + audit | Role Guard suite (TASK-011); route registration asserted here |
| AC-6 | WHEN an agent context is assembled for a project with bindings, THE SYSTEM SHALL expose the bindings (system + refs) in the run context so agents target the bound spaces — delivery/ingestion itself stays Platform-owned | `should expose bindings in run context` |

## Implementation

### Pseudocode

```
GET/PUT/DELETE /api/projects/{id}/bindings (guard: BINDINGS):
    PUT: instances = connector_client.list_instances(tenant)         # AC-2
         if body.connector_ref not in instances: raise 422 UnknownInstance(available=[...])
         repo.bindings.put(project, system, connector_ref, space_ref)  # unique -> 409 (AC-4)
    GET: rows = repo.bindings.get_all(project)
         for row: row.health = connector_client.health(row.connector_ref)
                  on error -> row.health = "unavailable"              # AC-3, per-row isolation

run-context assembly (orchestrator, one addition):
    ctx.external_bindings = repo.bindings.get_all(project)            # AC-6, refs only

UI (settings integrations tab — replaces TASK-015 placeholders):
    per system: bound -> BindingCard(space_ref, HealthBadge) | unbound -> BindDialog
    BindDialog: instance select (from registry read) -> space/board/project key input
    HealthBadge states: ok | degraded | error | unavailable (text + colour, never colour alone)
```

### API Contracts

`GET/PUT /api/projects/{id}/bindings` p95 ≤ 400 ms (health reads are per-row and
best-effort — a slow connector degrades one badge, not the request; v1-delta §3). Errors:
403, 404, 409 (duplicate), 422 (unknown instance), 500. Consumes PLAT-CONNECTOR-1: instance
registry read + health-status read API. **Build calls no space-level external API** —
validation of `space_ref` existence is connector-side (delivery interface), not Build's.

### Diagram References

| Diagram | File | Section | Summary |
|---|---|---|---|
| Architecture delta | `../../tech-spec/v1-delta.md` | §2 External bindings bullet | Instance-handle model + health surface |
| Contract | `../../../../contracts.md` | §PLAT-CONNECTOR-1 | Instance-scoped handles; health dimensions incl. skipped-count; Atlassian/ServiceNow write-back allowlist |
| Data model | `../../tech-spec/v1-delta.md` | §4 `external_bindings` | Table + uniqueness |

### Design Decisions

| Decision | Reference | Impact |
|---|---|---|
| Bind by instance handle, not connector type | PLAT-CONNECTOR-1 (ADR-015/017 upstream) | Two Jira sites in one tenant bind unambiguously |
| Health is read-through, never stored | AC-3 | Build shows the connector's truth or "unavailable"; no stale cached green |
| `space_ref` validity is connector-side | API contract note | Build stays credential-free; a bad key surfaces as connector health/delivery errors, honestly |
| Bindings exposed to run context as refs only | AC-6 / B5 partition | Agents know *where*; Platform's delivery interface does the *how* |

## Design Requirements

Cited against `docs/standards/design/*` (rubric), `docs/design/visual-direction.md` (V4-hybrid
recipe), `docs/design/v1-design-requirements.md` (R-bundles), `docs/design/jtbd.md`, and
TASK-015's own Design Requirements section (the settings-tab surface this task extends). Every
line cites its source; anything that could not be traced to a cited source is marked
**Advisory** and is not a pass/fail acceptance criterion.

### Page scaffolding + components

- This surface is the **integrations tab** inside TASK-015's `SettingsTabs` — reuse that tab's
  `role="tablist"`/`role="tab"`/`aria-selected` shell (`components.md` §Navigation & tabs); this
  task adds no new route or page scaffolding of its own.
- Per-system row (Confluence / Jira / ServiceNow): when bound, render a **`BindingCard`**
  using the Card/container pattern (`components.md` §Card/container — `--color-surface`,
  `--color-border`, `--radius-base`, `--space-5` padding); when unbound, render the entry point
  to `BindDialog` in place of the card. This directly extends TASK-015 AC-7's three disabled
  `BindingSlot` cards — same three systems, same slot positions, now interactive per binding
  state instead of uniformly disabled.
- **`BindDialog`** (add/edit a binding) is the **Modal/dialog** pattern
  (`components.md` §Modal/dialog): glass surface, `--z-modal`, `--radius-lg`, `--space-6`
  padding, focus trap on open, focus restored to the trigger on close, closes on `Escape`.
  Fields: connector-instance select and space/board/project-key input use the **Input, textarea,
  select** pattern (`components.md` §Input, textarea, select) with visible `<label>`s and the
  full state table (default/hover/focus-visible/disabled/error).
- **Remove/unbind affordance** uses the Button `danger` variant, "confirm-destructive only"
  (`components.md` §Button: `--color-danger` soft bg, `--color-danger` text/border) — a
  destructive action needs a confirm step, not a bare delete icon; the confirm step itself reuses
  the same **Modal/dialog** pattern (`components.md` §Modal/dialog) as `BindDialog`, not a
  bespoke inline confirm.
- **`HealthBadge`** (AC-3) is a status **Badge/chip** (`components.md` §Badge/chip): "A status
  badge uses the semantic soft-bg pairs from `color.md` … and is always icon + text, never colour
  alone." Map the four states to the semantic status table (`color.md` §Semantic status colours):
  `ok` → `--color-success`, `degraded` → `--color-warn`, `error` → `--color-danger`,
  `unavailable` → `--color-info` (the table's "info, neutral notice" role — an honest absence of
  data is a neutral notice, not a failure; **Advisory**: `color.md` does not name an
  `unavailable`-specific token, this is the nearest cited semantic fit and should be confirmed at
  QA against whatever mapping ships).
- The skipped-count health dimension (Implementation Hints: "surface it on the badge detail, not
  just status colour") is exposed via the **Popover/tooltip** pattern
  (`components.md` §Popover/tooltip — opens on hover **and** focus, `aria-describedby`-linked),
  attached to the `HealthBadge`, not folded into the badge's always-visible text.
- IDs shown on this surface (`connector_ref` instance handle, `space_ref`) use `--font-mono` per
  `typography.md` §Mono usage ("IDs & IRIs"); pair with a friendly label per the `EntityRef`
  pattern (`v1-design-requirements.md` R1: "friendly label + mono ID chip").
- **Consistency requirement:** the three system rows use the **exact same labels** TASK-015 AC-7
  established for the disabled placeholder slots ("Confluence", "Jira", "ServiceNow") — this task
  flips those named slots live, it does not relabel or reorder them.

### Tokens/type-scale bindings

- Colour, spacing, radius, shadow, and motion are `var(--token)` only — zero literal hex/px/ms
  anywhere on this tab (`tokens.md` §Conformance: "Zero literal hex/px in catalogue application
  components"; `ui_verify` / `CE-BRAND-1` gate).
- Type: row/card titles (system name) `--text-h4`; `space_ref`/board-key values `--font-mono`
  `--text-body`; health status text and last-sync timestamps `--text-caption`/`--text-body-sm`
  (`typography.md` type-scale table, same bindings TASK-015 used for its settings surfaces).
- Spacing: `BindingCard` padding `--space-4`, gap between the three system rows `--space-5`
  (`tokens.md` §space; `layout-grid.md` §Spacing system — matches TASK-015's card-grid spacing on
  the same settings surface).
- Radius: cards/inputs `--radius-base`/`--radius-sm`; `BindDialog` modal `--radius-lg`
  (`tokens.md` §radius).
- Motion: hover/press on card and buttons `--duration-fast`/`--duration-instant` +
  `--ease-standard`; `BindDialog` reveal `--duration-slow` `--ease-out`; loading skeleton uses the
  `shimmer` keyframe at `--duration-shimmer` `--ease-linear` (`tokens.md` §motion,
  `motion.md` §Keyframes). Every animated pattern ships a `prefers-reduced-motion` fallback
  (`motion.md` §prefers-reduced-motion — shimmer → static block; modal reveal → opacity-only).
- Focus: every focusable element (card, dialog trigger, select, input, remove button, badge's
  tooltip trigger) renders `--ring-focus` on `:focus-visible` (`tokens.md` §shadow;
  `components.md` §Shared interaction rules).

### Required states

- **Loading (bindings + per-row health):** the tab renders skeleton tiles holding final layout
  span while `GET /api/projects/{id}/bindings` resolves, using the `shimmer` keyframe over
  `--color-raised` (`components.md` §Data-widget states; `motion.md` §Keyframes #4). Per AC-3's
  "per-row isolation" (health reads are parallel with a short per-read timeout), **each
  `HealthBadge` carries its own loading skeleton independent of the other two rows** — a slow
  connector must visibly degrade one badge, not hold the whole tab in a loading state
  (Implementation Hints: "one slow connector must not drag the tab"). Reduced motion → static
  `--color-raised` block, no sweep.
- **Empty (no bindings yet, connectors live but no instance configured for a system):** per
  Implementation Hints — "absence of instances is a normal state, not an error" — the unbound
  slot shows the `BindDialog` entry point, not an error or blank card. If the connector-instance
  select inside `BindDialog` has zero available instances (tenant has not configured that
  system in Platform yet), render the Select's empty-options state with a named reason ("no
  {system} instance configured") rather than a blank dropdown — **Advisory**: no
  design-system standard names a combobox zero-options state explicitly; this is the nearest
  cited analogue to the `components.md` §Input, textarea, select pattern's `default`/`disabled`
  rows, flagged for confirmation at QA.
- **Save success:** binding created/updated — a toast confirmation
  (`components.md` §Toast/notification: `--color-raised`, `--shadow-overlay`, `aria-live="polite"`).
- **Validation error — unknown instance (AC-2, 422):** `BindDialog`'s instance select renders the
  Input error/invalid state (`components.md` §Input: `--color-danger` border, `aria-invalid` +
  `aria-describedby`) naming the rejection and listing available instances per the AC's own
  wording ("named error listing available instances").
- **Validation error — duplicate binding (AC-4, 409):** the same Input error/invalid state on the
  `space_ref` field, with the "friendly conflict message" the AC requires rendered as the
  `aria-describedby` text in `--color-danger` (`components.md` §Input error/invalid row).
- **Backend/health unavailable (AC-3):** `HealthBadge` renders its `unavailable` state (text +
  `--color-info` soft bg, never colour alone) rather than a fake green — this is a defined badge
  state, not an error banner, because the AC frames it as an honest status, not a failure
  (`components.md` §Badge/chip). A genuine **write failure** (PUT/DELETE 500) uses the
  `AlertBanner`-style row from `components.md` §Data-widget states (`--color-danger` soft bg +
  icon + retry, `role="alert"` per `accessibility.md` §ARIA conventions "errors blocking an
  action → `role=\"alert\"`") — same pattern TASK-015 cites for its settings-write failure state;
  the write must remain retryable, no partial state persists.
- **Admin-only / read-only (AC-5):** mirrors TASK-015's read-only/permission state pattern for
  the same settings surface (`TASK-015.md` §Design Requirements §Required states — "Read-only /
  permission state"): a non-admin viewer sees `BindingCard`/`HealthBadge` content but the
  `BindDialog` trigger, edit, and remove affordances are **hidden**, not merely disabled — the
  403 from the BINDINGS guard class (AC-5) remains the real boundary; the UI mirrors it, never
  replaces it.

### Accessibility (beyond the global gate)

- Every card, dialog trigger, select, input, and remove button is keyboard-reachable in logical
  order; no positive `tabIndex` (`accessibility.md` §Keyboard navigation §General rules).
- `BindDialog` traps focus on open, restores focus to its trigger on close, closes on `Escape`
  (`accessibility.md` §General rules; `components.md` §Modal/dialog).
- The remove/unbind button and any icon-only control carry `aria-label`
  (`accessibility.md` §ARIA conventions "Names").
- Form validation errors (AC-2, AC-4) use `aria-invalid` + `aria-describedby`; write-blocking
  errors use `role="alert"` (`accessibility.md` §ARIA conventions "State", "Live regions").
- Save-success toast and health-badge updates that are non-blocking announce via
  `aria-live="polite"` (`accessibility.md` §ARIA conventions "Live regions";
  `components.md` §Toast/notification).
- `HealthBadge` status is never colour-alone: icon + text pairing per `components.md` §Badge/chip
  (satisfies WCAG 1.4.1, cross-ref `accessibility.md`).
- Contrast: text ≥ 4.5:1, large text/UI ≥ 3:1 — met by construction when tokens are used as
  specified (`color.md` computed ratios; `accessibility.md` §Conformance target). No literal
  colour values.
- `@axe-core/playwright` zero violations (`serious`/`critical`/`moderate`) on the integrations tab
  (`accessibility.md` §CI gate).

### Responsive behaviour

- Usable at 320 CSS px with no horizontal scroll, and at 200% zoom without loss of function
  (`accessibility.md` §Conformance target "Reflow"/"Zoom"; `layout-grid.md` §Breakpoints &
  responsive behaviour).
- The integrations tab inherits TASK-015's settings-tab collapse behaviour: sub-nav-style collapse
  below `--bp-md` (`layout-grid.md` §Breakpoints: "Sub-nav collapses to a compact form" at
  `--bp-md`). The three system rows stack single-column below `--bp-md`; `BindDialog` fields
  reflow to single-column at the same breakpoint rather than a fixed two-column form
  (`layout-grid.md` §Breakpoints & responsive behaviour, same collapsing discipline TASK-015
  applies to its own forms).
- Density: honours the `[data-density]` comfortable/compact remap (`layout-grid.md` §Density
  modes) without a second spacing token set; interactive target sizes stay ≥24×24 CSS px in both
  densities (`accessibility.md` §Conformance target "Target size").

### JTBD success criteria

No `jtbd.md` entry exists for "Build → Project Settings → Integrations" specifically (same gap
TASK-015 flagged for the Registry/Settings surface generally). The closest entry is company-level
**Settings**, whose success criteria list "Integrations (v1 pill)" as one of the predictable
places a workspace admin governs (`jtbd.md` §Settings) — but that entry is tenant/company-scoped,
not this task's project-scoped binding UI, so it is offered as an **advisory** analogue only, not
a citable acceptance line: the shared intent — "govern without a runbook," predictable, in one
place — applies to project admins binding external spaces just as it does to company Settings.

## GAPS

- **No `jtbd.md` entry** for the Build project-settings integrations surface (or for Build's
  Registry/Settings surfaces generally — TASK-015 flagged the same gap). Recommend a follow-up
  `jtbd.md` addition scoped to Build's project-admin persona, covering both the settings shell and
  this bindings sub-surface.
- **No R-bundle in `v1-design-requirements.md`** (R1–R13) covers the Build engine's settings
  surfaces, including this integrations tab — same gap TASK-015 recorded. The citations above lean
  on the generic R1/R13 shell primitives and TASK-015's own (design-agent-authored) Design
  Requirements section as the nearest approved precedent for this exact surface. Recommend the
  follow-up Build-engine v1 R-bundle TASK-015 already asked for explicitly include the bindings
  sub-surface.
- **`HealthBadge` "unavailable" → `--color-info` mapping is an inference**, not a pinned mapping —
  `color.md`'s semantic status table has no dedicated "unavailable" entry; `--color-info` ("info,
  neutral notice") is the closest fit to an honest absence-of-data state as distinct from
  `--color-danger` (a real error). Flagged for confirmation at QA against whatever mapping ships,
  not asserted as a hard citation.
- **No design-system standard names a combobox/select zero-options state** (the `BindDialog`
  instance-select when a tenant has configured zero instances for a system). Not asserted as a
  requirement; flagged so the engineer does not invent an uncited pattern without QA awareness of
  the gap.
- **Process risk, not a design gap — flagged for the architect's sign-off gate:** this Design
  Requirements section was appended via a full-file rewrite because this agent has no Edit tool.
  One earlier `Read` of the Acceptance Criteria table (before this final version) returned a
  stale-content/compression notice instead of literal text for AC-1/AC-2/AC-3/AC-6, which were
  reconstructed from surrounding context (pseudocode, AC-to-Test mapping, Design Decisions) before
  being independently confirmed correct by a subsequent full clean re-read of the file (the version
  this rewrite is based on). No drift is believed to exist, but it has not been git-diffed against
  the pre-agent commit. **Recommend the architect run `git diff` on this file against its
  pre-agent-edit revision before Approve/Amend/Reject**, to positively confirm zero drift in the
  Story/Acceptance Criteria/Implementation/Test Requirements/Dependencies/Cost
  Estimate/Checklists/Implementation Hints sections this agent did not intend to change.

## Test Requirements

### Unit Tests (minimum 3)

- `should reject binding to unknown connector instance`
- `should reject duplicate binding with conflict message`
- `should show health unavailable when connector health read fails` (component, per-row)

### Integration Tests (minimum 3)

- `should store binding as instance handle reference only` (row content asserted; no secret
  columns — Law B)
- `should expose bindings in run context` (orchestrator context assembly with seeded bindings)
- `should isolate slow health read to one badge` (one stub delayed; request within p95)

### E2E Tests (Playwright, minimum 1)

- `should bind jira board and see health badge end to end` (connector stub registry +
  health; `external_bindings` row asserted server-side)

### AC-to-Test Mapping

| AC | Type | Test |
|---|---|---|
| AC-1 | Integration | `should store binding as instance handle reference only` |
| AC-2 | Unit | `should reject binding to unknown connector instance` |
| AC-3 | Unit + Integration | health-unavailable component / slow-read isolation |
| AC-4 | Unit | `should reject duplicate binding with conflict message` |
| AC-5 | Integration | Role Guard suite; route registration check |
| AC-6 | Integration | `should expose bindings in run context` |

## Dependencies

- **blocked_by:** [TASK-010, TASK-015] (table; the settings tab whose placeholders this
  replaces)
- **unlocks:** []
- **External prerequisites:** **PLAT-CONNECTOR-1 instance registry + health-read API live
  (Platform v1 delivery)** — cross-engine DAG dependency; coordinator tracks the Platform
  task IDs. Tests run against the connector stub regardless (Law F), so implementation can
  precede Platform go-live behind the existing placeholder.

## Cost Estimate

- **Complexity:** M
- **Estimated tokens:** ~14k input, ~7k output
- **Estimated cost:** ~$0.50 (claude-sonnet-5 implementation tier)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined
- [x] Diagram references included
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined (incl. cross-engine prerequisite)
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing (connector stub, Law F)
- [ ] Coverage ≥ 80% changed code; delta mutation ≥ 70%
- [ ] No token/secret column in the bindings migration (invariants.md verify-by)
- [ ] Lighthouse: Performance ≥ 90, Accessibility ≥ 95, Best-practices ≥ 90 on the settings
      route with the integrations tab live (v1-delta §6)
- [ ] `ui_verify` passes; design tokens only; health badge never colour-alone
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] Docstrings/JSDoc on public APIs/components
- [ ] Conventional commit(s); PR references this task and EPIC-002

## Implementation Hints

- The connector client is Platform's — import their client module/stub; do not hand-roll
  HTTP calls to connector endpoints in Build.
- Health reads on GET are parallel with a short per-read timeout (one slow connector must not
  drag the tab); "unavailable" is the timeout result, not an exception path.
- The skipped-count health dimension matters to agents (sustained skips = the bound space's
  data isn't landing in the graph) — surface it on the badge detail, not just status colour.
- When replacing TASK-015's placeholder cards, keep the "available when connectors ship"
  component for tenants whose connector instances aren't configured yet — absence of
  instances is a normal state, not an error.

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
*Design Requirements section appended by the Weave Design Agent (Hook 1, brief time) — pending
Approve/Amend/Reject sign-off through the same architect gate as every other section.*
