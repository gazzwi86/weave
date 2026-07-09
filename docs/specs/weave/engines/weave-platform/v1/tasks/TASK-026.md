---
type: Task Brief
title: "Task: TASK-026 — Storybook design-system foundation (atomic component library)"
description: "Extract reusable dumb presentational components from the V4-hybrid mock and the
  existing app into a Storybook workbench in packages/frontend, structured atoms -> molecules ->
  organisms -> templates -> pages; token-only styling, per-state/per-theme story coverage, and an
  import-boundary rule so app pages bind data into design-system templates rather than composing
  raw components. Foundation bundle -- precedes every other v1 design task (TASK-027..TASK-030)."
tags: [weave-platform, arch, task, v1, design-system, storybook]
timestamp: 2026-07-09T00:00:00Z
status: Backlog
priority: Must Have
entity: weave-platform
epic: EPIC-011
milestone: v1
created: 2026-07-09
blocked_by: []
unlocks: [TASK-027, TASK-028, TASK-029, TASK-030]
adr_refs: []
---

# Task: TASK-026 — Storybook design-system foundation (atomic component library)

**Spec:** [weave-platform.md](../../../weave-platform.md) ·
**Design system:** [tokens.md](../../../../../standards/design/tokens.md),
[components.md](../../../../../standards/design/components.md) ·
**Design inputs:** [visual-direction.md](../../../../../../design/visual-direction.md),
[v1-design-requirements.md](../../../../../../design/v1-design-requirements.md)

> **Scope traceability:** bundle R13 (`v1-design-requirements.md` R13, sourced from the user's
> 2026-07-09 ruling recorded in `visual-direction.md` §Delivery approach). No M1 or existing v1
> task owns "how the UI is actually assembled" — TASK-002 (M1) stood up Tailwind/shadcn and a
> four-component Storybook smoke test, but the design assessment (`design-assessment-2026-07-09.md`
> F-D07/F-D09) found the built app has no shared page-scaffolding or button-hierarchy layer: every
> page re-invents heading sizes and button treatments, which is exactly the failure mode a
> component library prevents. Fixing F-D01..F-D27 page-by-page would re-diagnose this same root
> cause five more times (once per surface); this task builds the shared layer once so TASK-027
> through TASK-030 consume it instead of owning bespoke CSS. It is the sequencing dependency the
> user's ruling names explicitly ("R13 components precede the page refits in R1-R11").

## Story

**Epic:** EPIC-011 Design System & App Shell v2
**Priority:** Must Have

**As a** frontend engineer refitting any Weave surface for v1
**I want** a Storybook-hosted library of dumb, token-only, state-complete components organised
atoms -> molecules -> organisms -> templates -> pages
**So that** I bind live data into an existing template rather than re-authoring page chrome, and a
design regression shows up in one component's story instead of five inconsistent pages.

## Acceptance Criteria

| ID | EARS Criterion | Test Mapping |
|----|----------------|--------------|
| AC-1 | WHEN a developer runs the Storybook dev command in `packages/frontend`, THE SYSTEM SHALL serve a workbench listing every component in the starting set (`NavRail`, `SecondarySidebar`, `AppHeader`, `CommandBar`, `PageHeader`, `EntityRef`, `KindChip`, `KpiTile`, `DataTable`, `InspectorPanel`, `GlassPanel`, `AskBar`, `CanvasLegend`, `CanvasToolbar`, `Bell panel`, `EmptyState`), each tagged with its atomic layer. | unit: `test_storybook_lists_starting_set_by_layer` |
| AC-2 | WHEN a component's stylesheet or inline style resolves a colour, spacing, radius, shadow, duration, or type value, THE SYSTEM SHALL express it exclusively as `var(--token-name)`; a literal hex/px/ms value anywhere under `packages/frontend/components/**` SHALL fail the token-conformance lint rule with `{"error": "raw_token_value", "file": "<path>", "matches": ["<literal>"]}`. | unit: `test_token_lint_rejects_raw_literal`, unit: `test_token_lint_passes_on_var_token` |
| AC-3 | WHEN a component under `packages/frontend/components/{atoms,molecules,organisms}/**` is authored, THE SYSTEM SHALL accept only props (no data fetching, no store/context subscription, no `fetch`/API-client import); the import-boundary lint rule SHALL fail any such file that imports a data-fetching hook or API client with `{"error": "component_not_dumb", "file": "<path>", "import": "<module>"}`. | unit: `test_dumb_component_lint_rejects_data_fetch_import` |
| AC-4 | WHEN a component supports a state from the closed set {default, hover, selected, loading, empty, error} (per `components.md` Shared interaction rules), THE SYSTEM SHALL ship one Storybook story per applicable state, plus a light-theme and a dark-theme variant of each (per `tokens.md` dark-first/light theming) — a state applicable to the component but missing a story SHALL fail `test_story_state_coverage`. | unit: `test_story_state_coverage` |
| AC-5 | WHEN a template (`canvas-page`, `table-page`, `form-drawer-page`, `dashboard-grid`) is composed, THE SYSTEM SHALL accept only data props (rows, entities, config, callbacks) and SHALL NOT contain page-specific business logic, routing, or fetch calls — verified by the same import-boundary rule as AC-3 applied to `components/templates/**`. | unit: `test_template_has_no_business_logic_imports` |
| AC-6 | WHEN a file under `packages/frontend/app/**` (the app/container layer) is authored, THE SYSTEM SHALL import UI only from `components/templates/**` or `components/pages/**` — an import of `components/{atoms,molecules,organisms}/**` directly from `app/**` SHALL fail the import-boundary rule with `{"error": "raw_component_import_from_app", "file": "<path>", "import": "<module>"}`. | integration: `test_app_layer_imports_only_templates_or_pages` |
| AC-7 | WHEN the production Next.js build runs (`next build`), THE SYSTEM SHALL exclude Storybook and its stories from the output bundle (dev dependency only), and THE SYSTEM SHALL leave `ui_verify`, Lighthouse-100, and the existing token-conformance gate (`components.md` CE-BRAND-1 pattern) running unchanged against built app pages. | integration: `test_storybook_excluded_from_prod_bundle` |

## Implementation

### Pseudocode

The only non-trivial logic in this task is the two lint rules that make the atomic/token
discipline enforceable rather than aspirational — everything else is component extraction and
story authoring (no branching logic to pseudocode).

```text
# packages/frontend/components/tooling/lint-tokens.ts
# ESLint custom rule, run over packages/frontend/components/**/*.{css,tsx,ts}

RAW_VALUE_PATTERN = /#[0-9a-fA-F]{3,8}\b|\b\d+px\b|\b\d+ms\b/  # hex colour, px, ms literal

function checkTokenConformance(filePath, fileContents):
  if not filePath.startsWith("packages/frontend/components/"):
    return SKIP  # this rule only governs the design system, not the whole repo
  matches = []
  for each line in fileContents.split("\n"):
    if line.includes("var(--"):
      continue  # a token reference on the line is fine even if the token's own definition file
                # (tokens.css) legitimately contains the literal
    if filePath.endsWith("tokens.css") or filePath.endsWith("tokens.ts"):
      continue  # the token definition layer is the one place literals are the source of truth
    found = RAW_VALUE_PATTERN.findAll(line)
    if found: matches.push(...found)
  if matches.length > 0:
    return FAIL with {"error": "raw_token_value", "file": filePath, "matches": matches}
  return PASS

# packages/frontend/components/tooling/lint-import-boundary.ts
# ESLint custom rule, run over packages/frontend/{components,app}/**/*.tsx

DATA_FETCH_MODULES = ["swr", "@tanstack/react-query", "packages/frontend/api-client", "fetch"]

function checkDumbComponent(filePath, imports):
  if not filePath.match(/components\/(atoms|molecules|organisms|templates)\//):
    return SKIP
  disallowed = imports.filter(i => DATA_FETCH_MODULES.some(m => i.startsWith(m)))
  if disallowed.length > 0:
    return FAIL with {"error": "component_not_dumb", "file": filePath, "import": disallowed[0]}
  return PASS

function checkAppLayerBoundary(filePath, imports):
  if not filePath.startsWith("packages/frontend/app/"):
    return SKIP
  disallowed = imports.filter(i =>
    i.match(/components\/(atoms|molecules|organisms)\//) and
    not i.match(/components\/(templates|pages)\//)
  )
  if disallowed.length > 0:
    return FAIL with {"error": "raw_component_import_from_app", "file": filePath, "import": disallowed[0]}
  return PASS
```

### API Contracts

N/A — internal dev tooling; no API surface. The "contract" this task ships is the component prop
interface, not a network endpoint:

- Every atom/molecule/organism exports a typed props interface (TypeScript) with no optional prop
  left undocumented (JSDoc comment per prop).
- Every template exports a props interface whose shape is data-only (arrays/objects/callbacks) —
  no `children` that assumes app-specific markup beyond named slot props.

### Diagram References

| Diagram | File | Relevant Section | Summary |
|---------|------|-------------------|---------|
| Sequence | N/A | N/A | No sequence — this task has no runtime interaction to diagram. |
| State | N/A | N/A | Component states are the closed set in AC-4, not a state machine. |
| Data Model | N/A | N/A | No data model — components are presentational only. |

### Design Decisions

| Decision | Reference | Impact on This Task |
|----------|-----------|----------------------|
| Storybook is a dev-time workbench, never shipped runtime | [visual-direction.md](../../../../../../design/visual-direction.md) §Delivery approach | AC-7's build-exclusion check; existing `ui_verify`/Lighthouse/token gates are untouched, this task adds a workbench in front of them, not a replacement |
| Atomic layering atoms -> molecules -> organisms -> templates -> pages, app binds data only | [visual-direction.md](../../../../../../design/visual-direction.md) "Atomic design structure" ruling 2026-07-09 | Defines the AC-3/AC-5/AC-6 import-boundary rule and the four-layer directory structure under `components/` |
| Token-only styling (`var(--token)` mandatory, no raw hex/px/ms) | [tokens.md](../../../../../standards/design/tokens.md), [components.md](../../../../../standards/design/components.md) CE-BRAND-1 gate | Defines AC-2 and the token-lint pseudocode; this task's lint rule is the design-system-local instance of the repo-wide CE-BRAND-1 gate |
| Glass elevation reserved for modal/dialog/popover/command-palette/canvas-overlay only | [components.md](../../../../../standards/design/components.md) "Glass vs flat" | `GlassPanel` organism ships one variant, not a general-purpose card; other organisms (`DataTable`, `KpiTile`) stay flat per the shared rule |

### Design requirements

- `var(--text-h1)` (36px/700, per `typography.md`) is the only token `PageHeader`'s title slot may
  resolve to — cited because F-D07 found the built app rendering page titles at 28px/600 instead.
- `GlassPanel` uses `--shadow-overlay` and `backdrop-filter` blur only, per `components.md` "Glass
  vs flat" (glass permitted solely on modal/dialog/popover/command-palette/canvas-overlay surfaces)
  — `KpiTile` and `DataTable` stay flat (`--color-surface` family, no blur).
- `CommandBar` reserves `--z-command` (500, above modals) per `tokens.md` zIndex table — cited
  because F-D01 found Cmd+K a no-op with no dedicated layer to render into.
- `EntityRef` renders a friendly label plus a `--font-mono` secondary ID chip, never a bare IRI —
  cited from F-D08 (raw machine identity leaking onto surfaces) and the JTBD "Instances / Data"
  success criterion (`jtbd.md`) that entity references show label-first.
- `KindChip` uses the 14 BPMO kind colours from `color.md` paired with a shape (not colour alone),
  per `color.md` "Why colour alone is never enough" — this is an accessibility requirement, not a
  style preference.
- Advisory: `DataTable` row height and `--space-3`/`--space-4` padding are a starting guess; the
  actual density used by TASK-029's logs table (7-dimension filter bar, `PLAT-AUDIT-1`) may need a
  denser variant — no F-D/R citation pins an exact row height, flag for design review at TASK-029.

## Test Requirements

### Unit Tests (minimum 5)

- `should list every starting-set component tagged with its atomic layer in Storybook`
- `should fail the token lint rule when a components/ file contains a raw hex/px/ms literal`
- `should pass the token lint rule when the same file uses var(--token) exclusively`
- `should fail the dumb-component lint rule when an atom/molecule/organism/template imports a data-fetching module`
- `should fail story-state-coverage when an applicable state (default/hover/selected/loading/empty/error) has no story`

### Integration Tests (minimum 2)

- `should fail the import-boundary rule when an app/** file imports components/organisms directly`
- `should exclude Storybook and .stories files from the next build production bundle output`

### E2E Tests

N/A — no user-facing page ships from this task (Storybook is dev-time only); the app-layer
consumption of these components is exercised by TASK-027 through TASK-030's own E2E tests.

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|----|-----------|-----------|
| AC-1 | Unit | `test_storybook_lists_starting_set_by_layer` |
| AC-2 | Unit | `test_token_lint_rejects_raw_literal`, `test_token_lint_passes_on_var_token` |
| AC-3 | Unit | `test_dumb_component_lint_rejects_data_fetch_import` |
| AC-4 | Unit | `test_story_state_coverage` |
| AC-5 | Unit | `test_template_has_no_business_logic_imports` |
| AC-6 | Integration | `test_app_layer_imports_only_templates_or_pages` |
| AC-7 | Integration | `test_storybook_excluded_from_prod_bundle` |

## Dependencies

- **blocked_by:** [] — this task only touches `packages/frontend/components/**` (adding the new
  `{atoms,molecules,organisms,templates,pages}` subdirectories alongside the existing `{ui,shell,
  explorer,dashboard,marketing}` ones) and the two new lint rules; it does not depend on any v1
  backend contract.
- **unlocks:** [TASK-027, TASK-028, TASK-029, TASK-030] — every other v1 design task refits a
  surface onto this library rather than owning bespoke CSS (per the R13 sequencing ruling).

## Cost Estimate

- **Complexity:** L
- **Estimated tokens:** ~48K input, ~22K output
- **Estimated cost:** ~$3.00 (claude-fable-5 pricing at time of writing per `CLAUDE.md` §Stack)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided (the two lint rules — the only branching logic in this task)
- [x] API contracts defined (N/A — internal tooling, prop-interface contract stated instead)
- [x] Diagram references included (N/A rows, reasoned)
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined (blocked_by and unlocks)
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing
- [ ] Coverage >= 80% for changed code
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic <= 10, cognitive <= 15, fn <= 50 lines)
- [ ] JSDoc / prop docs on every exported component
- [ ] Conventional commit(s) created
- [ ] No implementation beyond the task brief's AC and pseudocode (YAGNI)
- [ ] PR references this task and parent epic

## Implementation Hints

- Start from `docs/design/mocks/mock-v4-hybrid.html` — it already renders every starting-set
  component once; extract markup/structure from it rather than designing from scratch.
- TASK-002 (M1) already wired a Storybook instance (`.storybook/main.ts` + `preview.tsx`) with
  `packages/frontend/components/ui/{button,input,badge,card,toast}.tsx` + matching
  `.stories.tsx` files — extend that instance and fold these five in as the starting **atoms**
  layer (add layer tags/state coverage where AC-4 finds a gap); do not stand up a second Storybook.
- The starting-set **organisms** already have broken first-draft implementations the design
  assessment found regressed (F-D01/03) — `components/shell/{nav,section-rail,command-palette,
  notification-center,app-shell,workspace-switcher}.tsx`. This task's job is to extract each one's
  *dumb* presentational markup into `components/organisms/{NavRail,SecondarySidebar,CommandBar,
  BellPanel,AppHeader}.tsx`; the stateful/data-fetching remainder stays in `components/shell/**` and
  is refit onto the new organisms by TASK-027 (that task owns making the chrome actually work again;
  this task only owns the presentational component + its stories).
- New atomic subdirectories land alongside the existing tree: `components/{atoms,molecules,
  organisms,templates,pages}/` sit next to today's `components/{ui,shell,explorer,dashboard,
  marketing}/` — this task does not rename or relocate the existing directories, only adds the
  atomic ones and extracts into them.
- The token-lint and import-boundary rules are ESLint custom rules, not a separate CLI — wire them
  into the existing `packages/frontend` ESLint config so they run in the same `lint` script CI
  already calls; no new pipeline step.
- `docs/standards/design/components.md` "Data-widget states" section defines states behaviourally
  for the finite generative-ui catalogue (`KpiCard`, `BarChart`, etc.) — this task's shell/
  interaction primitives (NavRail, PageHeader, etc.) are the *other* vocabulary that file owns;
  don't conflate the two component sets.
- `# ponytail: starting set is exactly the components R1-R11 name today — add a component when a
  page refit needs one, don't pre-build the full eventual catalogue speculatively.`

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*
