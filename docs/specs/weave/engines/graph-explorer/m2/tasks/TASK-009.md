---
type: Task Brief
title: "Task: TASK-009 — Closure Config Wiring + Drift Guard + Pinned Impact Overlay"
description: "Ships the ADR-005 oq09_predicate_closure config with boot-time drift guard
  against CE-READ-1 types; pinned impact overlay persisting traversal results through
  pan/zoom/filter with source-delete auto-clear."
tags: [graph-explorer, arch, task, m2]
status: Backlog
priority: Must Have
entity: graph-explorer
epic: EPIC-004
milestone: M2
created: 2026-07-08
blocked_by: [TASK-002]
unlocks: [TASK-011]
adr_refs: [ADR-001-render-engine, ADR-005-impact-traversal-predicate-closure]
timestamp: 2026-07-08T00:00:00Z
source: hand-authored
confirmed_by: none
owner: gazzwi86
coverage: n/a
---

# Task: TASK-009 — Closure Config + Drift Guard + Pinned Impact Overlay

## Story

**Epic:** [EPIC-004](../../../graph-explorer.md#epic-004--visual-overlays--m2) (E4-S3) +
ADR-005 productionisation
**Status:** Backlog · **Priority:** Must Have

**As an** enterprise architect running impact analysis
**I want** the traversal predicate closure shipped as validated config and my traced impact
result pinned on the canvas while I pan, zoom, and filter
**So that** impact analysis is trustworthy (closure matches the live ontology) and usable
(results don't vanish while I navigate).

Covers: FR-017 and the config/drift-guard obligations of
[ADR-005](../../decisions/ADR-005-impact-traversal-predicate-closure.md).
**Scope correction (2026-07-08 red-team):** M1 TASK-005 closed **without** its OQ-09-gated
AC-6/AC-7 — no traversal client exists in the shipped M1 code. This task therefore OWNS the
traversal client too: the property-path SELECT walk (M1 TASK-005 AC-6/AC-7, incl. their named
tests `test_impact_traversal_loads_predicate_closure_from_config`,
`test_impact_traversal_depth_cap_applied`, `test_traversal_highlights_on_canvas_nodes`,
`test_traversal_badges_beyond_cap`), the **config value + guard**, and the **M2 pinning
overlay** on top.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|----|------------------|--------------|
| AC-1 | WHEN the app builds, THE SYSTEM SHALL include the 13-entry `oq09_predicate_closure` default exactly per ADR-005 (9 forward, 4 inverse) in checked-in config; no predicate IRI SHALL appear as a literal in traversal code. | `test_closure_config_matches_adr_005`, grep gate per invariants.md |
| AC-2 | WHEN the canvas boots, THE SYSTEM SHALL resolve every closure predicate against CE-READ-1 `GET /api/ontology/types`; IF any entry is unresolvable THEN THE SYSTEM SHALL surface a config-drift error and disable traversal (trace buttons disabled with reason) — never a silent empty trace. | `test_closure_drift_guard_fails_loud` |
| AC-3 | WHEN a traversal result (impact or dependency) is pinned, THE SYSTEM SHALL persist the highlight through pan, zoom, filter, and overlay changes until unpinned. | `test_pinned_impact_survives_pan_zoom_filter` |
| AC-4 | WHEN the pinned trace's source node is deleted (TASK-005 delete or poll refresh reports it gone), THE SYSTEM SHALL auto-clear the pinned overlay with a notice. | `test_pin_autoclears_on_source_delete` |
| AC-5 | WHERE a pinned trace highlights nodes that a filter later hides, THE SYSTEM SHALL keep the hidden members in the pin's legend count ("N of M highlighted nodes hidden by filters") rather than silently shrinking the result. | `test_pin_legend_counts_filter_hidden_members` |
| AC-6 | WHEN dependency and impact walks run from the same node with the shared closure, THE SYSTEM SHALL produce mirror-consistent results (impact of A contains B ⟺ dependency of B contains A) — property-tested over a fixture graph. | `test_impact_dependency_mirror_consistency` |
| AC-7 | WHERE the pinned overlay renders, THE SYSTEM SHALL coexist with badge-channel overlays (completeness) and be blocked only by the exclusive colour group when diff is active (pin uses highlight channel). | `test_pin_channel_coexistence` |

## Implementation

### Pseudocode

```
# Config (AC-1) — checked-in default, shape per ADR-005
config.oq09_predicate_closure = [ { predicate, orientation } × 13 ]   # copy ADR-005 table

# Drift guard (AC-2) — runs in canvas boot sequence after palette fetch
async function validateClosure(types = await GET /api/ontology/types via proxy):  # CE-READ-1
  # (NOT the node-kinds palette projection — relationship types live on /api/ontology/types;
  #  contracts.md CE-READ-1 serves every closure predicate incl. hasField, so a conformant CE
  #  never trips this guard on the shipped 13-entry closure)
  known = Set(types.relationships.map(r => r.iri))
  bad = closure.filter(e => !known.has(e.predicate))
  if bad.nonEmpty():
    disableTraversal(reason = `Ontology drift: ${bad.map(p).join(", ")} not served by CE`)
    reportConfigError(bad)          # loud: banner + OTel event
  # note: EXTRA CE predicates are fine (additive ontology growth) — only missing ones fail

# Pinned impact overlay (AC-3..7) — TASK-002 engine, highlight channel
pinnedImpactOverlay(traceResult) = {
  id: "pinned-impact:" + traceResult.sourceIri, exclusiveGroup: null,   # highlight channel
  apply(adapter):
    adapter.setHighlight(traceResult.memberIris ∩ adapter.loadedIris, "impact")
    legend.show(pinLegend(traceResult))
    subscribe(filterStateChanges, () =>                                  # AC-3/AC-5
      hidden = traceResult.memberIris.filter(adapter.isHidden)
      legend.update(`${hidden.length} of ${traceResult.memberIris.length} hidden by filters`))
    subscribe(elementRemoved, iri =>
      if iri == traceResult.sourceIri: engine.deactivate(this); notice("Pinned trace source deleted"))  # AC-4
  remove(adapter): adapter.clearHighlight("impact"); unsubscribeAll()
}

# Walk composition (shared with M1 TASK-005 traversal client — one function, two directions)
dependencyPath(closure) = alternation(e => e.orientation == "forward" ? p(e) : inverse(p(e)))
impactPath(closure)     = alternation(e => e.orientation == "forward" ? inverse(p(e)) : p(e))
```

### API Contracts

No new endpoints. Traversal SELECT goes through the existing M1 sparql proxy (CE-READ-1,
property-path SELECT, depth cap per FR-010). Types resolution uses CE-READ-1
`GET /api/ontology/types` via the proxy (the authoritative kinds + relationship list — the
`/api/proxy/node-kinds` palette route is a GE-owned projection of it and omits relationship
types); one boot fetch, the guard reads its result. The contracts.md CE-READ-1 relationship
list includes `hasField`, so the shipped closure resolves clean against a conformant CE.

### Diagram References

| Diagram | File | Section | Summary |
|---------|------|---------|---------|
| Component delta | `../../tech-spec/m2-delta.md` | §6 | Overlay engine channel model; traversal client path |
| C4 L3 | `../../tech-spec/architecture.md` | Component — SPA Canvas Module | Impact-Traversal Client + Config Store this task wires |

### Design Decisions

| Decision | Reference | Impact |
|----------|-----------|--------|
| 13-entry directed closure; one list, two walk directions | ADR-005 | AC-1/AC-6 are direct enforcement; the mirror property-test is the cheap proof the two paths share one config |
| Drift guard fails loud, missing-only (extra CE predicates OK) | ADR-005 | Additive ontology growth must not brick traversal; only a closure entry CE no longer serves is drift |
| Static app config; per-tenant override deferred | ADR-005 (20Q Q8) | No PLAT-SETTINGS-1 read here — adding one is scope creep |
| Pin = highlight channel (not colour, not badge) | TASK-002 engine channels | Coexists with completeness badges + domain colour; diff blocks it via colour-group activation clearing highlights — test AC-7 |

## Test Requirements

### Unit (minimum 4)

- `should ship closure config identical to ADR-005 table (snapshot test)`
- `should disable traversal with named missing predicates when types response lacks one`
- `should keep pin highlight through filter change and update hidden-count legend`
- `should auto-clear pin when source node removal event fires`

### Integration (minimum 2)

- `should compose dependency and impact property paths as mirrored alternations from config`
- `should not fail drift guard when CE serves additional unknown predicates`

### Property/E2E (minimum 2)

- `test_impact_dependency_mirror_consistency` (property test over seeded fixture graph)
- `should pin an impact trace, pan/zoom/filter, and still see the highlight (Playwright)`

### AC-to-Test Mapping

| AC | Type | Test |
|----|------|------|
| AC-1 | Unit + grep gate | snapshot test + invariants.md grep |
| AC-2 | Unit + Integration | drift tests (missing fails, extra passes) |
| AC-3 | Unit + E2E | filter-persistence + Playwright pin test |
| AC-4 | Unit | auto-clear test |
| AC-5 | Unit | hidden-count legend test |
| AC-6 | Property | mirror-consistency test |
| AC-7 | Unit | channel-coexistence test |

## Dependencies

- **blocked_by:** [TASK-002 (overlay engine + channels)]
- **unlocks:** TASK-011; delivers the orphaned M1 TASK-005 AC-6/AC-7 (traversal client —
  see scope correction above; M1 TASK-005 is `done` in progress.json without them)
- **External:** fixture graph with known dependency chains (Policy→Process→DataAsset→Field).

## Cost Estimate

- **Complexity:** M (config + guard are small; pin subscription lifecycle is the real work)
- **Estimated tokens:** ~11k input, ~6k output (claude-sonnet-5)
- **Estimated cost:** ~$0.32

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (none new; reuse points named)
- [x] Diagram references included
- [x] Design decisions noted (ADR-005 enforcement points explicit)
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing (mirror property-test non-negotiable)
- [ ] Coverage ≥ 80%; mutation ≥ 60%
- [ ] Lint passes; complexity within thresholds
- [ ] invariants.md grep gates pass (no predicate literals; drift-guard test present)
- [ ] Conventional commit(s); PR references this task and EPIC-004
- [ ] No implementation beyond AC + pseudocode (no per-tenant closure, no closure editor UI)

## Implementation Hints

- The config snapshot test should literally embed the ADR-005 JSON — if someone edits the
  config, the failing test points at the ADR to amend first (spec-before-code).
- SPARQL property paths cannot depth-cap natively: the M1 traversal client owns the cap
  strategy (bounded path repetition or iterative expansion); this task only feeds it the
  alternation — do not duplicate cap logic.
- `inverse(p)` in SPARQL is `^` — impact path = swap each entry's effective direction, which is
  exactly `dependencyPath` with orientation flipped; implement as ONE composer with a
  `direction` argument (mirror consistency then holds by construction).
- Pin subscriptions must unsubscribe on deactivate — leak test cheap via engine
  activate/deactivate cycles in the unit suite.
- Highlight styling from `docs/standards/design/data-viz.md` trace tokens; the pin legend is
  the accessible surface (badge/aria pattern same as TASK-008).

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
