---
type: Task Brief
title: "Task: TASK-020 — Filters & Layers Panel (entity, relationship, property, governed-content)"
description: "Sidebar Filters & Layers panel: entity-type and relationship-type toggles,
  client-side property filter builder, governed-content layer toggles; shared panel + legend
  infrastructure for all M2 overlays."
tags: [graph-explorer, arch, task, v1]
status: Backlog
priority: Must Have
entity: constitution-engine
epic: EPIC-015
milestone: v1
created: 2026-07-08
blocked_by: []
unlocks: [TASK-021, TASK-026]
adr_refs: [ADR-014-render-engine]
timestamp: 2026-07-08T00:00:00Z
source: hand-authored
confirmed_by: none
owner: gazzwi86
coverage: n/a
---

# Task: TASK-020 — Filters & Layers Panel

## Story

**Epic:** [EPIC-015](../../../constitution-engine.md#epic-015--filters--layers--m2)
**Status:** Backlog · **Priority:** Must Have

**As a** viewer or analyst exploring the company graph
**I want** to toggle entity types, relationship types, governed-content layers, and build
property filters
**So that** I can reduce the whole-company canvas to exactly the slice I care about without
writing any query.

Covers: FR-011, FR-012, FR-013, FR-014 ([constitution-engine.md §6.1](../../../constitution-engine.md#61-functional-requirements)).
Also delivers the **shared sidebar-panel shell and legend components** every later M2 panel
(overlays, versions, views, comments, completeness) mounts into.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|----|------------------|--------------|
| AC-1 | WHEN a viewer toggles an entity type off, THE SYSTEM SHALL hide that type's nodes and their incident edges and re-flow the layout; WHEN the type is toggled back on THE SYSTEM SHALL restore them. | `test_entity_toggle_hides_nodes_and_incident_edges` |
| AC-2 | WHEN all entity types are toggled off, THE SYSTEM SHALL show an empty-state component (never a blank canvas). | `test_all_types_off_shows_empty_state` |
| AC-3 | WHEN a relationship type is toggled off, THE SYSTEM SHALL hide its edges and de-emphasise (dim, not remove) nodes orphaned by the hide. | `test_rel_toggle_dims_orphaned_nodes` |
| AC-4 | WHEN a property filter (type + path + operator + value, AND logic, chip display) is applied, THE SYSTEM SHALL highlight matching nodes and dim non-matching nodes, evaluating **client-side over loaded nodes only** — THE SYSTEM SHALL NOT issue any CE query for filtering. | `test_property_filter_client_side_only`, `test_property_filter_and_logic` |
| AC-5 | IF a filter's property path is present on no loaded node, THEN THE SYSTEM SHALL treat all nodes as non-matching and show the standard filter empty-state (no error). | `test_missing_property_path_all_non_matching` |
| AC-6 | WHEN a governed-content layer (Glossary / Brand / Governance) is toggled on, THE SYSTEM SHALL load and overlay the relevant content nodes via CE-READ-1; IF the layer is empty THEN THE SYSTEM SHALL disable its toggle with an explanatory tooltip. | `test_governed_layer_loads_via_ce_read`, `test_empty_layer_disables_toggle` |
| AC-7 | WHEN any toggle or filter changes, THE SYSTEM SHALL complete the visual re-flow within 300 ms (p95, tunable) at up to 10k loaded nodes. | `test_filter_apply_under_300ms_at_10k` |
| AC-8 | WHERE the panel UI renders, THE SYSTEM SHALL produce zero axe-core violations and be fully keyboard-operable (toggles, filter builder, chips). | `test_panel_axe_clean_and_keyboard_operable` |

## Implementation

### Pseudocode

```
# All canvas mutations go through the renderer adapter (ADR-014) — never cytoscape directly.

FilterState = {
  entityTypesOff: Set<kindIri>,
  relTypesOff: Set<predicateIri>,
  propertyFilters: [{ typeIri?, path, op: "eq"|"neq"|"contains"|"gt"|"lt", value }],  # AND
  layersOn: Set<"glossary"|"brand"|"governance">,
}

function applyFilterState(adapter, state, config):
  visible = adapter.allNodes().filter(n => !state.entityTypesOff.has(n.kind))
  hiddenEdges = adapter.allEdges().filter(e =>
      state.relTypesOff.has(e.predicate)
      OR !visible.includes(e.source) OR !visible.includes(e.target))
  orphaned = nodes whose every incident edge is in hiddenEdges (rel-toggle case only)

  adapter.setHidden(nodesOf(state.entityTypesOff) ∪ incidentEdges)   # AC-1: hide
  adapter.setDimmed(orphaned, config.spotlight_dim_opacity)          # AC-3: dim, not remove

  if visible.isEmpty(): showEmptyState("all-types-off"); return      # AC-2

  if state.propertyFilters.nonEmpty():                               # AC-4/5 client-side
    matching = visible.filter(n => state.propertyFilters.every(f => evalFilter(n, f)))
    adapter.setDimmed(visible − matching); adapter.setHighlighted(matching)
    if matching.isEmpty(): showEmptyState("no-filter-match")

function evalFilter(node, f):
  v = node.data.key_properties[f.path]         # loaded element data only — no fetch
  if v == undefined: return false              # AC-5
  return compare(v, f.op, f.value)

function toggleGovernedLayer(layer, on, jwt, config):                # AC-6
  if !on: adapter.removeLayer(layer); return
  rows = await proxySparql(jwt, layerQuery(layer), config)           # existing M1 read proxy
  if rows.isEmpty(): disableToggle(layer, tooltip="No " + layer + " content"); return
  adapter.addLayerNodes(layer, rows)
```

### API Contracts

No new Explorer endpoints. Governed-content layers use the existing M1 read proxy
(`GET /api/proxy/sparql`, CE-READ-1 — paginated SELECT). Entity/relationship/property filtering
is entirely client-side (PRD design decision). Error handling for the layer fetch follows the
M1 pattern: CE error ⇒ toggle reverts + error notice; no partial layer.

### Diagram References

| Diagram | File | Section | Summary |
|---------|------|---------|---------|
| Component delta | `../../tech-spec/m2-delta-explorer.md` | §6 | Filter Panel position and its adapter/proxy edges |
| C4 L3 | `../../tech-spec/architecture-explorer.md` | Component — SPA Canvas Module | Adapter boundary the panel must drive |

### Design Decisions

| Decision | Reference | Impact |
|----------|-----------|--------|
| Property filter = client-side visual filtering only, never a CE query | constitution-engine.md §6.5 | `evalFilter` reads loaded element data; adding a fetch is a defect |
| Renderer adapter is the only canvas access path | ADR-014-render-engine | All hide/dim/highlight ops are adapter methods; extend the adapter if a needed op is missing (adapter change, not a direct call) |
| Shared panel shell built here | m2-delta-explorer.md §6 | TASK-021/022/026/027 mount into this shell; keep it presentation-only (no filter logic inside the shell) |
| Filter/overlay apply ≤ 300 ms @ 10k | m2-delta-explorer.md §4 | Batch adapter style updates (single `adapter.batch()` call), never per-node loops of individual style writes |

## Test Requirements

### Unit (minimum 5)

- `should hide nodes and incident edges when entity type toggled off`
- `should dim (not remove) orphaned nodes when relationship type toggled off`
- `should AND-combine property filters and treat missing path as non-matching`
- `should not issue any network call when applying property filters`
- `should show empty-state when all entity types are off`

### Integration (minimum 2)

- `should load governed-content layer nodes via CE-READ-1 stub when layer toggled on`
- `should disable layer toggle with tooltip when CE-READ-1 stub returns empty layer`

### E2E (minimum 2, Playwright)

- `should filter canvas to selected types and restore on re-toggle (asserts canvas element counts)`
- `should build a property filter via keyboard only and see matching nodes highlighted`

### AC-to-Test Mapping

| AC | Type | Test |
|----|------|------|
| AC-1 | Unit + E2E | hide/restore tests above |
| AC-2 | Unit | `should show empty-state when all entity types are off` |
| AC-3 | Unit | orphan-dim test |
| AC-4 | Unit | AND-combine + no-network tests |
| AC-5 | Unit | missing-path test |
| AC-6 | Integration | both layer tests |
| AC-7 | Perf trace in CI | `test_filter_apply_under_300ms_at_10k` (10k fixture) |
| AC-8 | CI axe + E2E | keyboard E2E + axe job |

## Dependencies

- **blocked_by:** none within M2 (first M2 task; consumes the M1 canvas + adapter as-is)
- **unlocks:** TASK-021 (overlay engine mounts in this panel shell and interacts with filter
  state), TASK-026 (views panel reuses the shell; saved views serialise this FilterState)
- **External:** M1 gate passed (M2 entry criterion); CE-READ-1 stub with governed-content
  fixtures; 10k-node perf fixture from the M1 OQ-01 harness.

## Cost Estimate

- **Complexity:** M (state model + adapter batching + a11y; no server work)
- **Estimated tokens:** ~12k input, ~7k output (claude-sonnet-5)
- **Estimated cost:** ~$0.35

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (no new endpoints; proxy reuse documented)
- [x] Diagram references included
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined (blocked_by and unlocks)
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing
- [ ] Coverage ≥ 80% for changed code; mutation ≥ 60%
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] Zero axe-core violations on the panel (CI)
- [ ] FilterState is serialisable to JSON unchanged (TASK-026 saved-view dependency)
- [ ] Conventional commit(s); PR references this task and EPIC-015
- [ ] No implementation beyond AC + pseudocode (YAGNI)

## Implementation Hints

- Design tokens: panel chrome, toggle, and chip styling come from `docs/standards/design/`
  (`tokens.md`) — no ad-hoc hex/px; the `ui_verify` gate checks this.
- Batch all style mutations inside one adapter transaction per state change; Cytoscape style
  writes per-element at 10k nodes will blow the 300 ms budget (AC-7).
- `FilterState` must be a plain serialisable object — TASK-026 stores it verbatim in
  `explorer_saved_views.definition`. Do not close over adapter references in state.
- The empty-state component already exists from M1 (CE-error empty-state); reuse it with a
  different message variant rather than writing a second one.
- Governed-layer queries: cite CE-READ-1 via the existing proxy only; layer SPARQL lives beside
  the M1 query builders, predicates from config (never literal in component code — invariants-explorer.md).
- Layer membership definitions (pinned — do not re-derive): **Glossary** = nodes of kind
  `Concept` (SKOS glossary terms); **Governance** = nodes of kind `Policy` (+ their
  `governedBy` edges to loaded nodes); **Brand** = the brand-standard individuals CE serves
  (CE-BRAND-1 world — kind IRIs from `/api/ontology/types`, config-loaded). If a tenant has no
  brand individuals the Brand toggle disables per AC-6.

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*

## Design Requirements

*Appended by the Weave design agent (Hook 1). Source bundle: R4 — Explorer canvas,
`docs/design/v1-design-requirements.md`. Every line below cites a token, JTBD entry, finding
(F-D-NNN), or requirement bundle (R-NN); uncited items are marked Advisory.*

| # | Requirement | Citation |
|---|---|---|
| D-1 | Canvas legend SHALL be collapsible and docked bottom-left — corner-docked chrome, never floating mid-canvas. This task builds the shared legend shell named in its own Story ("shared panel + legend infrastructure"); TASK-021's overlay legend mounts into the same shell rather than owning a second one. | R4 (`docs/design/v1-design-requirements.md`); F-D15 (Blocker — "no kind legend"); `docs/design/research/graph-canvas-ux-patterns.md` pattern 2 (corner-docked, non-floating canvas chrome) |
| D-2 | Legend entries SHALL pair each kind's colour swatch with its shape glyph and text label — colour is never the sole carrier of meaning. | `docs/standards/design/color.md` §14 BPMO kind colours (`--color-kind-*`); `docs/standards/design/iconography.md` §`--shape-kind-*` tokens; `docs/standards/design/components.md` Badge/chip rule (satisfies WCAG SC 1.4.1) |
| D-3 | A search field SHALL live in the canvas toolbar (corner-docked, alongside legend/zoom/fit chrome), not floating mid-canvas as the current PoC renders it. This is additional to, not a replacement for, the Cmd+K overlay already built at M1 (constitution-engine/m1/tasks/TASK-011.md). | R4; F-D17 (Major — "Search box floats mid-canvas rather than in a toolbar"); `docs/standards/design/components.md` command-palette note ("the sidebar search field is the always-available fallback entry") |
| D-4 | The legend's collapsed state SHALL still show a visible toggle affordance — never fully hidden with no re-open path ("kind legend always visible"). | `docs/design/jtbd.md` — Constitution → Explore success criteria |
| D-5 | Legend/toolbar chrome uses the canvas-overlay stacking layer and the glass surface treatment (translucent fill + blur), consistent with the rest of the canvas chrome. | `docs/standards/design/tokens.md` zIndex table (`--z-canvas-overlay` — "graph mini-map, legend, canvas toolbar"); `docs/design/visual-direction.md` ("floating glass panels for nav-in-context, legend, KPI strip, and the node inspector"); `docs/standards/design/components.md` glass-vs-flat rule (glass permitted on "graph-canvas overlays") |
| D-6 | Legend/toolbar states (loading while the kind palette fetches, keyboard-operable, zero axe violations) reuse this task's own AC-8 bar — no separate a11y requirement needed. | This brief's AC-8 |

### Gaps

- The relationship between the new toolbar search field (D-3) and the existing Cmd+K search
  overlay (M1 TASK-011) is not specified in R4 or in either task brief — whether the toolbar
  field is the same query surface rendered inline, or a second implementation sharing the
  client-side match logic. **RESOLVED (architect, 2026-07-09):** the toolbar field is the same
  M1 spotlight search surfaced inline — it SHALL reuse the TASK-011 match/highlight
  implementation and result behaviour verbatim; no second search implementation. Cmd+K remains
  the keyboard entry to the identical surface.
