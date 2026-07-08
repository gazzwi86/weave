---
type: Task Brief
title: "Task: TASK-012 — Declarative intent→component mapping + change visualisation (E1-S2)"
description: "The dashboard agent's intent resolution: the closed 9-component rule table,
  named-type override, unsatisfiable decline, and client-side change-visualisation without
  re-prompt or re-fetch. Includes the intent-mapping audit test (epic AC)."
tags: [weave-platform, arch, task]
timestamp: 2026-07-08T12:00:00Z
status: Backlog
priority: Must Have
entity: weave-platform
epic: EPIC-001
milestone: v1
created: 2026-07-08
blocked_by: [TASK-011]
unlocks: [TASK-013]
adr_refs: [ADR-012]
---

# Task: TASK-012 — Declarative intent→component mapping + change visualisation (E1-S2)

**Spec:** [weave-platform.md](../../../weave-platform.md) · **Delta:** [m2-delta.md](../../tech-spec/m2-delta.md) · **Contracts:** [contracts.md](../../../../contracts.md)

## Story

**Epic:** EPIC-001 Dashboard
**Priority:** Must Have

**As a** domain member
**I want** the AI to pick the best-fit visualisation for what I asked, let me override it by
naming a chart type, and let me switch visualisation afterwards without re-asking
**So that** results are design-consistent and predictable — never free-form code, never an
ill-fitting chart.

## Acceptance Criteria

| ID | EARS Criterion | Test Mapping |
|----|----------------|--------------|
| AC-1 | WHEN the agent resolves a prompt, THE SYSTEM SHALL map intent to exactly one of the 9 library components by the declarative rule table (m2-delta §2: count/status→kpi_card, trend→line_area_chart, comparison→bar_chart, ranked→ranked_list, log→activity_feed, ratio→pie_donut, two-dim matrix→heatmap, alert→alert_banner, rows→table) and SHALL NOT emit free-form code or any type outside the set (FR-005). | unit: `test_intent_mapping_audit` (parametrised) |
| AC-2 | WHERE a component type is named in the prompt and is compatible with the resolved data shape, THE SYSTEM SHALL honour the override; WHERE it is incompatible, THE SYSTEM SHALL use the rule-table choice and note the override was not applicable (E1-S2). | unit: `test_named_type_override` |
| AC-3 | IF no component matches the resolved data shape or no data source exists for the intent, THEN THE SYSTEM SHALL decline with the unsatisfiable-prompt message naming the reason (via TASK-011's `error {state: "unsatisfiable"}`) and SHALL NOT render an ill-fit chart (FR-004). A resolvable category whose engine is not GA is NOT unsatisfiable — it returns `SourceNotGA` so TASK-011 emits `source_not_ga` (distinct states, never conflated). | unit: `test_no_match_declines`, `test_non_ga_returns_source_not_ga_not_none` |
| AC-4 | WHEN the agent returns a spec, THE SYSTEM SHALL validate it against the WidgetSpec JSON schema BEFORE the `spec` event emits; a schema-invalid agent output is retried once with the validation error appended, then declined — never streamed (m2-delta §3). | integration: `test_invalid_agent_spec_never_streams` |
| AC-5 | WHEN the user selects "Change visualisation" on a rendered widget, THE SYSTEM SHALL re-render the held data in the new type with NO re-prompt and NO re-fetch (pure client re-render of `last_result`), and SHALL disable incompatible types with a reason (FR-006). | unit(TS) + e2e: `test_change_viz_no_refetch`, `test_change_viz_disables_incompatible` |
| AC-6 | WHEN compatibility is computed (for AC-2 and AC-5), THE SYSTEM SHALL use one shared shape-compatibility matrix (data shape × component) defined once and consumed by both the agent-side resolver and the client-side change-viz menu — no second implementation. | unit: `test_compatibility_matrix_single_source` |

## Implementation

### Pseudocode

```text
# Shape-compatibility matrix (packages/shared/widget-compat.json — single source, AC-6)
# data shapes: scalar | series | categorical | ranked | events | ratio | matrix | rows
COMPAT = {
  scalar:      [kpi_card, alert_banner],
  series:      [line_area_chart, bar_chart, table],
  categorical: [bar_chart, pie_donut, table, ranked_list],
  ranked:      [ranked_list, bar_chart, table],
  events:      [activity_feed, table],
  ratio:       [pie_donut, bar_chart, kpi_card],
  matrix:      [heatmap, table],
  rows:        [table, ranked_list],
}
PRIMARY = first element of each list  # the rule-table default

# Agent-side resolver (packages/backend/dashboard/intent.py — called by model_router.dashboard_agent)
def resolve(prompt) -> WidgetSpec | SourceNotGA | None:
  tool_result = llm.call(RESOLVE_TOOL, prompt)   # tool schema constrains output:
      # { data_shape: enum, category: enum, bindings: {contract, field}, named_type?: enum(9), title }
      # enum-constrained tool schema = the model CANNOT emit an out-of-library type
  # Two DISTINCT declines (TASK-011 AC-6; m2-delta §2):
  if not availability.is_ga(CATEGORIES[tool_result.category].source_engine):
      return SourceNotGA(source_engine)          # real category, dark engine -> source_not_ga
  if tool_result.bindings do not exist for any category: return None   # -> unsatisfiable
  shape = tool_result.data_shape
  component = tool_result.named_type if tool_result.named_type in COMPAT[shape] \
              else PRIMARY[shape]     # AC-2: honour compatible override, else rule default
  spec = WidgetSpec(component_type=component, ...)
  if not widget_spec_schema.validate(spec):
      retry once with validation error appended; else return None   # AC-4
  return spec

# Client change-viz (packages/frontend/src/dashboard/ChangeViz.tsx)
menu options = all 9; enabled = COMPAT[widget.data_shape] (same JSON import)
onSelect(type): setState(spec.component_type = type); re-render from widget.last_result
  # no network call anywhere in this handler (AC-5)
disabled options carry tooltip reason: "incompatible with <shape> data"
```

### API Contracts

No new endpoints. This task lives inside TASK-011's generate/refine pipeline (`resolve()` is
the `dashboard_agent` internals) and the SPA. Change-viz persists the type switch via the
existing `PATCH /api/dashboard/widgets/{id}` (`{ "spec": { "component_type": "table" } }` →
200) — pinned-widget spec update only, p95 ≤ 300 ms (m2-delta §5).

### Diagram References

| Diagram | Notes |
|---------|-------|
| Intent-mapping rule table | [`tech-spec/m2-delta.md`](../../tech-spec/m2-delta.md) §2 — normative mapping + closed component set |
| SSE grammar (spec validation point) | [`tech-spec/m2-delta.md`](../../tech-spec/m2-delta.md) §3 — validate-before-emit |
| Component delta | [`tech-spec/m2-delta.md`](../../tech-spec/m2-delta.md) §1 — Dashboard Agent placement in Model Router |

### Design Decisions

| Decision | Source | Impact on This Task |
|----------|--------|---------------------|
| Closed set of 9 components; adding one is a spec amendment | m2-delta §2 | Tool schema enum + WidgetSpec schema enum both pin the set; the invariant grep (m2-delta §10) checks the registry |
| Declarative mapping — the LLM classifies, the rule table decides | FR-005; PRD §2.5 | The model never freely picks a component: it emits `data_shape` (+ optional named type); code maps to component. Hallucination-proof by construction |
| One shared compatibility matrix (JSON, not code) | AC-6; Arch Law 6 | Lives in `packages/shared`; imported by backend resolver and frontend menu; drift impossible |
| Change-viz is pure client re-render | FR-006; ADR-013 | `last_result` already holds the data (SWR); switching type must not touch the network |
| Schema-invalid agent output: one retry then decline | m2-delta §3 | Bounded self-correction; never an unvalidated spec on the stream |

## Test Requirements

### Unit Tests (minimum 5)

- `test_intent_mapping_audit` — parametrised over the full prompt-fixture corpus (≥ 2 fixtures per data shape, 16+): every fixture resolves to exactly one of the 9 components or declines; assert no other outcome is reachable (epic AC: "single intent-mapping audit")
- `test_named_type_override` — "as a table" on categorical data ⟹ table; "as a heatmap" on scalar data ⟹ kpi_card + override-not-applicable note
- `test_no_match_declines` — fixture with no existing binding ⟹ None ⟹ unsatisfiable path
- `test_non_ga_returns_source_not_ga_not_none` — fixture classifying to a Build category ⟹ `SourceNotGA("build")`, never None (states stay distinct)
- `test_compatibility_matrix_single_source` — backend resolver and the shipped frontend JSON are byte-identical (read both, compare); every shape lists ≥ 1 component; every component appears in ≥ 1 shape
- `test_change_viz_no_refetch` (Vitest) — select new type; assert fetch/EventSource spies never called; component re-renders from held data
- `test_change_viz_disables_incompatible` (Vitest) — scalar-shape widget ⟹ heatmap option disabled with reason tooltip

### Integration Tests (minimum 1)

- `test_invalid_agent_spec_never_streams` — fake router returns out-of-schema spec twice ⟹ stream carries only `error unsatisfiable`; returns invalid-then-valid ⟹ valid spec streams (retry path)

### E2E Tests (minimum 1)

- `test_change_visualisation_flow` — Playwright: generate bar-chart widget, open Change visualisation, incompatible types visibly disabled, switch to table, data identical (no network request on switch — assert via request interception), persisted type survives reload (PATCH fired once)

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|----|-----------|-----------|
| AC-1 | Unit | `test_intent_mapping_audit` |
| AC-2 | Unit | `test_named_type_override` |
| AC-3 | Unit | `test_no_match_declines`, `test_non_ga_returns_source_not_ga_not_none` |
| AC-4 | Integration | `test_invalid_agent_spec_never_streams` |
| AC-5 | Unit(TS) + E2E | `test_change_viz_no_refetch`, `test_change_visualisation_flow` |
| AC-6 | Unit | `test_compatibility_matrix_single_source` |

## Dependencies

- **blocked_by:** TASK-011 (the resolver is called from its pipeline; error states ride its stream)
- **unlocks:** TASK-013 (refine re-runs the resolver with held context)

## Cost Estimate

- **Complexity:** M
- **Estimated tokens:** ~45K input, ~20K output
- **Estimated cost:** ~$3

## Definition of Ready Checklist

- [x] User story clear
- [x] All ACs have mapped tests
- [x] Pseudocode provided (incl. tool-schema enum trick that makes out-of-library output impossible)
- [x] Compatibility matrix fully enumerated (8 shapes × components) — no engineer guessing
- [x] Rule table + closed component set pinned in m2-delta §2
- [x] Change-viz persistence path named (existing PATCH endpoint)

## Definition of Done Checklist

- [ ] All ACs met
- [ ] Intent-mapping audit covers every data shape with ≥ 2 fixtures and passes
- [ ] Tool schema and WidgetSpec schema both enum-pin the 9 components (grep-verifiable)
- [ ] Change-viz handler contains zero network calls (spy-verified)
- [ ] Compatibility matrix exists exactly once in the repo (`packages/shared`)
- [ ] Coverage ≥ 80%; mutation ≥ 60%
- [ ] Conventional commit: `feat: add declarative intent mapping and change visualisation`

## Implementation Hints

- Constrain the LLM with a tool/JSON schema whose `data_shape` and `named_type` fields are
  enums — rejection happens at the SDK boundary, so the "never free-form" guarantee is
  structural, not prompt-engineered.
- Keep prompt fixtures as recorded tool-call outputs (JSON), not live model calls — the audit
  test must be deterministic (Plugin Law F; testing-strategy delta m2-delta §9).
- The compatibility JSON is the single source: backend loads it at import, frontend bundles it;
  the byte-identity test keeps them honest without a build step.
- Disabled-option tooltips come from one `reasonFor(shape, component)` helper — don't scatter
  reason strings.
- When change-viz runs on an unpinned (just-streamed) widget there is no PATCH — persistence
  only applies to pinned rows; branch on `widget_id` presence.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*
