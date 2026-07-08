---
type: Task Brief
title: "Task: TASK-002 — Overlay Engine + Heatmap + Domain Colouring"
description: "Mutually-exclusive overlay engine with legend; heatmap overlay using prototype
  value→colour mappings; domain-colouring layer with palette cycling."
tags: [graph-explorer, arch, task, m2]
status: Backlog
priority: Must Have
entity: graph-explorer
epic: EPIC-004
milestone: M2
created: 2026-07-08
blocked_by: [TASK-001]
unlocks: [TASK-003, TASK-008, TASK-009]
adr_refs: [ADR-001-render-engine]
timestamp: 2026-07-08T00:00:00Z
source: hand-authored
confirmed_by: none
owner: gazzwi86
coverage: n/a
---

# Task: TASK-002 — Overlay Engine + Heatmap + Domain Colouring

## Story

**Epic:** [EPIC-004](../../../graph-explorer.md#epic-004--visual-overlays--m2)
**Status:** Backlog · **Priority:** Must Have

**As an** analyst or leadership viewer
**I want** heatmap and domain-colouring overlays with a clear legend, where conflicting
overlays cannot stack
**So that** I can read maturity/investment/strategy/lifecycle signals and domain membership at
a glance without misreading combined colour meanings.

Covers: FR-015, FR-018 ([graph-explorer.md §2.1](../../../graph-explorer.md#21-functional-requirements)).
Delivers the **Overlay Engine** (registration, mutual exclusion, legend) that TASK-003 (diff),
TASK-008 (completeness), and TASK-009 (pinned impact) plug into.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|----|------------------|--------------|
| AC-1 | WHEN the heatmap overlay is enabled for a dimension (maturity / investment / strategy / lifecycle), THE SYSTEM SHALL colour nodes by the **prototype value→colour mapping** for that dimension and render nodes with unmatched/absent values grey with an "unmatched: N" count in the legend. | `test_heatmap_prototype_mapping_and_unmatched_grey` |
| AC-2 | WHERE overlays are registered as mutually exclusive, WHEN one exclusive overlay activates THE SYSTEM SHALL deactivate and disable the others (heatmap ⟷ diff at minimum), re-enabling them when it deactivates. | `test_overlay_mutual_exclusion` |
| AC-3 | WHEN the domain-colouring layer is enabled, THE SYSTEM SHALL colour nodes by domain membership (replacing type colouring — mutually exclusive with it in v1), cycle the palette on overflow, and show the domain→colour mapping in the legend. | `test_domain_colouring_palette_cycles_on_overflow` |
| AC-4 | WHEN any overlay deactivates, THE SYSTEM SHALL restore the previous colouring exactly (BPMO kind palette or domain colouring, whichever was active). | `test_overlay_deactivation_restores_prior_colouring` |
| AC-5 | WHEN overlay application runs at up to 10k loaded nodes, THE SYSTEM SHALL complete within 300 ms (p95, tunable). | `test_overlay_apply_under_300ms_at_10k` |
| AC-6 | IF a heatmap dimension property is present on zero loaded nodes, THEN THE SYSTEM SHALL show the overlay with all nodes grey and a legend notice (no error, no blank canvas). | `test_heatmap_all_unmatched_notice` |
| AC-7 | WHERE the overlay panel and legend render, THE SYSTEM SHALL produce zero axe-core violations; colour information SHALL always be paired with a text legend (never colour-only meaning). | `test_overlay_legend_axe_clean` |

## Implementation

### Pseudocode

```
# Overlay Engine — single owner of node/edge colour + badge state (via adapter, ADR-001)

Overlay = { id, exclusiveGroup?: "colour", apply(adapter, ctx), remove(adapter), legend(): LegendModel }

class OverlayEngine:
  active: Map<id, Overlay>

  function activate(overlay, adapter, ctx):
    if overlay.exclusiveGroup:
      for other in active where other.exclusiveGroup == overlay.exclusiveGroup:
        deactivate(other, adapter)                       # AC-2
        panel.disable(other.id, reason=overlay.id)
    snapshotColouring(adapter)                           # AC-4: capture current palette state
    overlay.apply(adapter, ctx)                          # one batched adapter transaction (AC-5)
    legendPanel.render(overlay.legend())
    active.add(overlay)

  function deactivate(overlay, adapter):
    overlay.remove(adapter)
    restoreColouring(adapter)                            # AC-4
    panel.enableAll(); legendPanel.clear(overlay.id)

# Heatmap overlay (FR-015)
function heatmapApply(adapter, { dimension, config }):
  mapping = config.heatmap_mappings[dimension]           # prototype value→colour, config-loaded
  unmatched = 0
  adapter.batch(() =>
    for n in adapter.allNodes():
      v = n.data.key_properties[mapping.path]            # free-text field per PRD
      colour = mapping.values[normalise(v)] ?? (unmatched++, config.grey)  # #9CA3AF
      adapter.setColour(n, colour))
  legend = mapping.values + { grey: "unmatched: " + unmatched }            # AC-1/AC-6

# Domain colouring (FR-018)
function domainColouringApply(adapter, { config }):
  domains = distinct domain membership of loaded nodes    # from element data (M1 load includes it)
  palette = config.domain_palette                          # design-token palette
  assign colour_i = palette[i mod palette.length]          # AC-3 cycle on overflow
  adapter.batch(apply per-node domain colour); legend shows domain→colour incl. cycle note
```

### API Contracts

No new endpoints. Heatmap and domain colouring read already-loaded element data; the value→
colour mappings and palettes are config (`heatmap_mappings`, `domain_palette`) sourced from the
prototype's mappings and `docs/standards/design/data-viz.md` tokens.

### Diagram References

| Diagram | File | Section | Summary |
|---------|------|---------|---------|
| Component delta | `../../tech-spec/m2-delta.md` | §6 | Overlay Engine position; consumers (diff, completeness, pinned impact) |
| C4 L3 | `../../tech-spec/architecture.md` | Component — SPA Canvas Module | Adapter boundary all colour ops go through |

### Design Decisions

| Decision | Reference | Impact |
|----------|-----------|--------|
| Heatmap uses prototype value→colour mappings, free-text fields | FR-015, graph-explorer.md §2.5 | Mappings are config, ported from the prototype — do not invent new value vocabularies |
| Overlays mutually exclusive (heatmap ⟷ diff); domain colouring exclusive with type colouring | FR-015/FR-018 | The `exclusiveGroup: "colour"` mechanism is the enforcement point — a second enforcement path is a defect |
| Overlay Engine is the ONLY writer of colour state | m2-delta.md §6 | TASK-003/008/009 register overlays; they never call `adapter.setColour` outside their `apply()` |
| Adapter-only canvas access | ADR-001-render-engine | Same as TASK-001 |

## Test Requirements

### Unit (minimum 5)

- `should colour nodes per prototype mapping and count unmatched as grey`
- `should deactivate and disable other exclusive overlays when one activates`
- `should restore prior colouring exactly on overlay deactivation`
- `should cycle domain palette when domains exceed palette length`
- `should render all nodes grey with legend notice when dimension property absent everywhere`

### Integration (minimum 1)

- `should re-enable disabled overlay toggles when the exclusive overlay deactivates`

### E2E (minimum 2, Playwright)

- `should enable heatmap, see legend with unmatched count, and find diff toggle disabled`
- `should enable domain colouring and see legend mapping (keyboard-operated)`

### AC-to-Test Mapping

| AC | Type | Test |
|----|------|------|
| AC-1 | Unit | prototype-mapping test |
| AC-2 | Unit + E2E | mutual-exclusion + disabled-toggle tests |
| AC-3 | Unit + E2E | palette-cycle + legend tests |
| AC-4 | Unit | restore-colouring test |
| AC-5 | Perf trace in CI | `test_overlay_apply_under_300ms_at_10k` |
| AC-6 | Unit | all-unmatched test |
| AC-7 | CI axe + E2E | legend axe + keyboard E2E |

## Dependencies

- **blocked_by:** [TASK-001 (panel shell + legend mount point; filter-state interplay)]
- **unlocks:** TASK-003 (diff overlay registers here), TASK-008 (completeness overlay),
  TASK-009 (pinned impact overlay)
- **External:** prototype heatmap mappings (`prototype-findings.md` values) transcribed into
  config; design-token palette from `docs/standards/design/data-viz.md`; 10k perf fixture.

## Cost Estimate

- **Complexity:** M (engine state machine + two overlay implementations; no server work)
- **Estimated tokens:** ~12k input, ~7k output (claude-sonnet-5)
- **Estimated cost:** ~$0.35

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (none new; config sources named)
- [x] Diagram references included
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing
- [ ] Coverage ≥ 80%; mutation ≥ 60%
- [ ] Lint passes; complexity within thresholds
- [ ] Zero axe-core violations (legend text pairing verified)
- [ ] Overlay registration API documented for TASK-003/008/009 (docstring level)
- [ ] Conventional commit(s); PR references this task and EPIC-004
- [ ] No implementation beyond AC + pseudocode (YAGNI)

## Implementation Hints

- Snapshot/restore of colouring (AC-4): snapshot the *style inputs* (kind→colour or domain→
  colour assignment), not per-element computed styles — restoring 10k computed styles
  element-by-element breaks the 300 ms budget.
- `normalise(v)` for heatmap values: trim + lowercase; the PRD says free-text fields, so
  "Growing"/"growing " must hit the same bucket. Unit-test this explicitly.
- Legend counts must come from the same pass that colours nodes — a second counting pass at
  10k nodes is wasted budget.
- Colour-blind safety: the legend text pairing (AC-7) is the accessibility mechanism; do not
  add pattern-fills or shape changes (OQ-08 kind→shape is deferred — out of scope).
- Domain membership data comes from the M1 graph load (element data); if a node has multiple
  domains, first-listed wins and the legend notes it — do not fetch additional membership data.

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
