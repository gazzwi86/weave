---
type: Task Brief
title: "Task: TASK-027 — Model-Completeness Map (coverage_gap overlay)"
description: "Completeness overlay consuming CE-READ-1 coverage_gap: gap badges on entities
  missing required links, side-panel missing-link drill with edit shortcut."
tags: [graph-explorer, arch, task, v1]
status: Backlog
priority: Must Have
entity: constitution-engine
epic: EPIC-022
milestone: v1
created: 2026-07-08
blocked_by: [TASK-021]
unlocks: [TASK-030]
adr_refs: [ADR-014-render-engine, ADR-018-impact-traversal-predicate-closure]
timestamp: 2026-07-08T00:00:00Z
source: hand-authored
confirmed_by: none
owner: gazzwi86
coverage: n/a
---

# Task: TASK-027 — Model-Completeness Map

## Story

**Epic:** [EPIC-022](../../../constitution-engine.md#epic-022--model-completeness-map--m2-new)
**Status:** Backlog · **Priority:** Must Have

**As a** BA or ontologist building out the model
**I want** an overlay showing which entities lack required links, with a per-entity list of
what's missing
**So that** I can see and close the model's gaps instead of discovering them when queries
return nothing (cold-start ramp, ledger L2).

Covers: FR-035, FR-036 ([constitution-engine.md §6.1](../../../constitution-engine.md#61-functional-requirements)).
Consumes the CE-READ-1 `coverage_gap(process)` pattern
([contracts.md §CE-READ-1](../../../../contracts.md)) → `{entity_iri, missing_link}` rows.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|----|------------------|--------------|
| AC-1 | WHERE a BA/ontologist enables the completeness overlay, THE SYSTEM SHALL run the `coverage_gap` query via the existing CE-READ-1 sparql proxy and overlay a gap **badge** on each returned `entity_iri` present on canvas, leaving entities with no gaps visually neutral. | `test_gap_badges_on_returned_entities_only` |
| AC-2 | WHEN `coverage_gap` returns zero rows, THE SYSTEM SHALL show a "No coverage gaps found" confirmation (overlay stays enabled, no badges). | `test_no_gaps_confirmation` |
| AC-3 | IF the CE-READ-1 call errors or times out, THEN THE SYSTEM SHALL leave the canvas in its non-overlay state and show an error notice with retry. | `test_gap_query_error_leaves_canvas_unchanged` |
| AC-4 | WHEN a gap-flagged node is clicked, THE SYSTEM SHALL spotlight it (M1 behaviour) and show the missing-link list in the side panel as human-readable relationship names (e.g. "Missing: performed by", never a raw predicate IRI). | `test_gap_drill_shows_humanised_missing_links` |
| AC-5 | WHERE the missing-link list renders and visual editing (TASK-023/024) is available, THE SYSTEM SHALL offer an inline shortcut per missing link (e.g. "Add performed by…" → edge-draw mode pre-set to that predicate); otherwise it SHALL link to the CE editing surface. | `test_inline_shortcut_when_editing_available_else_ce_link` |
| AC-6 | WHERE gap rows reference entities not currently loaded (filtered out or beyond the loaded page set), THE SYSTEM SHALL show a "N gaps on entities not shown" legend count rather than silently dropping them. | `test_offcanvas_gap_rows_counted_in_legend` |
| AC-7 | WHEN the overlay is active with badges at up to 10k nodes, THE SYSTEM SHALL apply within 300 ms p95 (badges are non-exclusive: completeness may coexist with domain colouring but not with diff — badge channel, not colour channel). | `test_completeness_apply_300ms_and_nonexclusive` |

## Implementation

### Pseudocode

```
# Registered as a TASK-021 overlay — but in the BADGE channel, not exclusiveGroup "colour".
completenessOverlay = {
  id: "completeness", exclusiveGroup: null,      # badge channel; engine handles legend only

  async apply(adapter, ctx):
    rows = await proxySparql(jwt, coverageGapQuery(config), timeout)   # AC-3 on error: throw →
    #                                    engine aborts activation, canvas untouched
    if rows.isEmpty(): legend.show("No coverage gaps found"); return   # AC-2
    byIri = groupBy(rows, r => r.entity_iri)     # rows: { entity_iri, missing_link }
    onCanvas, offCanvas = partition(byIri.keys, adapter.hasNode)
    adapter.batch(() => onCanvas.forEach(iri =>
      adapter.setBadge(iri, { kind: "gap", count: byIri[iri].length })))   # AC-1
    legend.show(`${onCanvas.length} entities with gaps` +
                (offCanvas.length ? `; ${offCanvas.length} not shown` : ""))  # AC-6
    ctx.gapIndex = byIri                          # side-panel drill reads this

  remove(adapter): adapter.clearBadges("gap"); legend.clear("completeness")
}

# Side-panel drill (AC-4/5) — extends M1 spotlight panel
onSpotlight(node):
  gaps = ctx.gapIndex?.[node.iri]
  if !gaps: return
  panel.section("Missing links", gaps.map(g => ({
    label: humaniseRelName(g.missing_link),      # from CE-READ-1 types labels, config-loaded
    action: canEdit(ctx)
      ? () => editController.startEdgeDraw(node, presetPredicate = g.missing_link)  # AC-5
      : linkTo(ceEditingSurface(node.iri))
  })))
```

### API Contracts

No new endpoints. `coverage_gap` runs through the existing `GET /api/proxy/sparql` (CE-READ-1,
paginated SELECT — the named pattern is CE-served; GE composes the call per the contract, does
not invent SPARQL beyond the documented pattern). Response rows: `{entity_iri, missing_link}`.
Errors: M1 proxy semantics (401/503/timeout).

### Diagram References

| Diagram | File | Section | Summary |
|---------|------|---------|---------|
| Component delta | `../../tech-spec/m2-delta-explorer.md` | §6 | Completeness Overlay → CE-Read proxy path |
| C4 L3 | `../../tech-spec/architecture-explorer.md` | Component — SPA Canvas Module | Spotlight/side-panel components the drill extends |

### Design Decisions

| Decision | Reference | Impact |
|----------|-----------|--------|
| Gap indicator = badge, not colour | m2-delta-explorer.md §1 (OQ-08 deferred) | Coexists with domain colouring; only diff blocks it (diff owns ghost elements) |
| `coverage_gap` is CE's fail-closed grounding query | contracts.md CE-READ-1 | GE renders rows; it never re-derives "required links" client-side — CE owns the rule |
| Missing-link names humanised from CE types labels | M1 IRI-hiding rule | `humaniseRelName` uses the boot-time types palette; no literal predicate strings (invariants-explorer.md grep) |
| Inline shortcut reuses TASK-023 edge-draw with preset predicate | FR-036 | Soft dependency: feature-detect the edit controller; CE-surface link is the fallback, so TASK-023 absence never blocks this task |

## Test Requirements

### Unit (minimum 4)

- `should badge only returned entity_iris and leave others neutral`
- `should count off-canvas gap rows in legend instead of dropping`
- `should humanise missing_link via types labels with no raw IRI`
- `should abort activation leaving canvas unchanged when query errors`

### Integration (minimum 2)

- `should render gap badges from CE stub returning known gaps and show no-gaps confirmation on empty`
- `should preset edge-draw predicate from missing-link shortcut when edit controller present`

### E2E (minimum 2, Playwright)

- `should enable completeness overlay, click a flagged Process, and read its missing links`
- `should close a gap via inline shortcut and see the badge clear on overlay refresh (stub state)`

### AC-to-Test Mapping

| AC | Type | Test |
|----|------|------|
| AC-1 | Unit + Integration | badge tests |
| AC-2 | Integration | no-gaps test |
| AC-3 | Unit | error-abort test |
| AC-4 | Unit + E2E | humanise + drill E2E |
| AC-5 | Integration + E2E | preset-shortcut + close-gap E2E |
| AC-6 | Unit | off-canvas count test |
| AC-7 | Perf trace | 300 ms badge apply @ 10k |

## Dependencies

- **blocked_by:** [TASK-021 (overlay engine + legend + badge channel)]
- **unlocks:** TASK-030
- **Soft:** TASK-023/024 for the inline edit shortcut (feature-detected; CE-surface link
  fallback keeps this task independently shippable)
- **External:** CE-READ-1 stub with `coverage_gap` fixtures (incl. gaps on filtered-out
  entities for AC-6).

## Cost Estimate

- **Complexity:** M (one overlay + panel section; query is CE-defined)
- **Estimated tokens:** ~11k input, ~6k output (claude-sonnet-5)
- **Estimated cost:** ~$0.32

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (proxy reuse; row shape; error semantics)
- [x] Diagram references included
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined (incl. soft dependency semantics)
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing
- [ ] Coverage ≥ 80%; mutation ≥ 60%
- [ ] Lint passes; complexity within thresholds
- [ ] Zero axe-core violations (badges have text equivalents in legend + panel)
- [ ] Conventional commit(s); PR references this task and EPIC-022
- [ ] No implementation beyond AC + pseudocode (no gap-fix wizard, no bulk-fix — YAGNI)

## Implementation Hints

- The badge is an adapter capability — if `setBadge`/`clearBadges` don't exist yet, extend the
  adapter interface (ADR-014 route), never decorate Cytoscape elements directly from the
  overlay.
- `coverage_gap` currently covers Process-required links (M1-credible query per contracts.md);
  render whatever entity kinds the rows return — do not hard-code "Process" in the overlay.
- Badge + screen reader: the side-panel missing-link list is the accessible surface; the badge
  itself gets `aria-hidden` with the node's accessible name gaining "— has coverage gaps".
- Overlay refresh after an inline fix: re-run `apply()` (one query) rather than locally
  decrementing counts — CE is the truth about whether the gap closed.

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
