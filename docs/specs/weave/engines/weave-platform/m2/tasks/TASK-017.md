---
type: Task Brief
title: "Task: TASK-017 — 'What can Weave do for you?' role-home (E10-S1..S3)"
description: "Role-tailored landing route: capability list filtered by authority + engine
  availability, model-completeness map over the BPMO kinds (CE-METRICS-1 + coverage_gap),
  next-action recommendations, coming-soon states for non-GA engines, last-cached degradation."
tags: [weave-platform, arch, task]
timestamp: 2026-07-08T12:00:00Z
status: Backlog
priority: Must Have
entity: weave-platform
epic: EPIC-010
milestone: M2
created: 2026-07-08
blocked_by: [TASK-010, TASK-016]
unlocks: []
adr_refs: [ADR-013, ADR-014]
---

# Task: TASK-017 — "What can Weave do for you?" role-home (E10-S1..S3)

**Spec:** [weave-platform.md](../../../weave-platform.md) · **Delta:** [m2-delta.md](../../tech-spec/m2-delta.md) · **Contracts:** [contracts.md](../../../../contracts.md)

## Story

**Epic:** EPIC-010 Role-Home (legibility)
**Priority:** Must Have

**As a** workspace member of any role — especially a non-technical one
**I want** a landing page that tells me what Weave can do for *my* role, what's been modelled,
where the gaps are, and what to do next
**So that** I can see Weave's value for me without navigating the full IA (closes legibility
gap L1/D7).

## Acceptance Criteria

| ID | EARS Criterion | Test Mapping |
|----|----------------|--------------|
| AC-1 | WHEN a user navigates to role-home, THE SYSTEM SHALL render a role-tailored view per the content table below: available capabilities, modelled summary (from `CE-METRICS-1`), recommended next action, and links to relevant engine areas (E10-S1). | integration: `test_role_home_content_by_role` |
| AC-2 | WHERE an engine is not GA, its capabilities SHALL render in the defined "coming soon" state with a one-line description of what it will enable — never hidden, never implied available — using the SAME availability registry as FR-015; one shared test fixture verifies role-home and widget-category gating consistently (epic AC). | integration: `test_coming_soon_consistency_with_fr015` |
| AC-3 | WHEN the completeness map renders, THE SYSTEM SHALL show per-kind coverage over the BPMO kinds served by `GET /api/ontology/types` (CE-READ-1 — never a hand-copied kind list), combining `entity_count_by_kind` (CE-METRICS-1) with `coverage_gap(kind, required_links[])` rows (CE-READ-1 — **exact contract signature**, rows `{ entity_iri, missing_link }`; invocations are TASK-016 S2's explicit pairs: `coverage_gap(Process, [performedBy, governedBy])` default + `coverage_gap(BusinessCapability, [ownedBy])`; no per-kind derivation logic platform-side) via TASK-016's bindings (E10-S2). | integration: `test_completeness_map_kinds_from_types_endpoint` |
| AC-4 | WHEN a user's role lacks a capability's required authority, THE SYSTEM SHALL NOT show it (Viewer sees no author-or-above capabilities) — verified by role-matrix test across read/author/publish/admin (epic AC role-matrix across Viewer, Business Analyst, Engineer maps to these levels). | integration: `test_role_matrix_capability_filtering` |
| AC-5 | IF `CE-METRICS-1` or `CE-READ-1` is unavailable, THEN THE SYSTEM SHALL degrade to the last-cached snapshot with a staleness indicator (m2-delta §6 `stale` state — role-home tiles are `scope='role_home'` widget instances riding TASK-010's SWR path), never a blank or zeroed view (E10-S1/S2 failure ACs). | integration: `test_role_home_degrades_to_cached_snapshot` |
| AC-6 | WHEN role-home loads, `GET /api/role-home` SHALL respond ≤ 500 ms cold / ≤ 200 ms warm p95 and the page SHALL meet the ≤ 2 s p95 CE-sourced load target (epic AC; m2-delta §5), passing the Lighthouse-100/axe-0 gate (m2-delta §8). | perf assertion in integration + Lighthouse CI gate |
| AC-7 | WHEN the recommended next action renders, THE SYSTEM SHALL derive it from live data by the priority rule below — never a static string (E10-S1 examples: "N SHACL errors to resolve", "publish your draft version"). | unit: `test_next_action_priority_rule` |

### Role→content table (normative — keyed on M1 authority level, consistent with TASK-010 starters)

| Authority | Capabilities section | Modelled summary | Next-action pool |
|---|---|---|---|
| read (Viewer) | Explore dashboards, view model, view compliance | kinds + instance counts | "explore the model", "view compliance status" |
| author (Analyst/SME) | + edit via NL/forms, pin/publish widgets | + draft-vs-published delta | + "resolve N SHACL errors", "fill coverage gaps (M missing links)" |
| publish (Architect) | + publish versions, author shapes | + SHACL errors by severity, coverage_gap count | + "publish draft version (K changes)" |
| admin | + settings, members, budgets | same as publish | + "assign N unassigned users a role" (PLAT-SETTINGS-1/IDENTITY-1 via TASK-016 S14 binding) |

Engine-gated rows (all "coming soon" at M2): Build → "generate an app from your model";
Events → "automate a process"; Explorer realtime → "collaborate live on the canvas".

### Next-action priority rule (normative)

`SHACL violations > 0` → resolve errors ▸ else `coverage_gap count > 0` → fill gaps ▸ else
`draft_published_delta > 0` → publish version ▸ else (admin only) `unassigned users > 0` →
assign roles ▸ else → explore/deep-link. First match wins; one rule, unit-tested.

## Implementation

### Pseudocode

```text
# Role-home endpoint (packages/backend/dashboard/role_home.py)
GET /api/role-home
  level = rbac.authority_level(jwt.principal_iri, tenant)         # M1 middleware (tenant-scoped; workspace ≡ tenant)
  tiles = widget_instances where scope='role_home' and owner=caller
  if empty: lazy-create from ROLE_HOME_TILES[level] (same idempotent pattern as
            TASK-010 starters; specs reuse TASK-016 bindings: completeness map,
            SHACL severity, coverage gaps)
  metrics = swr_read(tiles)                                        # TASK-010 path — cached, fast
  return {
    capabilities: CAPABILITIES[level] + engine_gated_rows(availability),  # table above
    summary: project(metrics, level),                              # per content table
    next_action: next_action_rule(metrics, level),                 # priority rule above
    tiles: metrics,
  }

# Frontend (packages/frontend/app/role-home/page.tsx)
route in primary nav + "?" launcher link (not a modal — PRD technical note)
sections: capabilities (cards; coming-soon variant for gated), completeness map
  (heatmap/bar over kinds — reuse TASK-016 completeness components), next-action banner,
  summary tiles (grid components from TASK-010, read-only)
stale rendering: staleness indicator from tile status — same badge component as dashboard
```

### API Contracts

**Endpoint:** `GET /api/role-home` →

```json
{
  "capabilities": [
    { "id": "edit-nl", "label": "Edit the model in plain language", "href": "/constitution", "available": true },
    { "id": "build-generate", "label": "Generate an app from your model", "available": false,
      "coming_soon": "Available when the Build Engine ships" }
  ],
  "summary": { "kinds": 13, "instances": 412, "shacl_errors": { "violation": 3 }, "draft_delta": 7 },
  "next_action": { "label": "Resolve 3 SHACL violations", "href": "/compliance" },
  "tiles": [ { "spec": {…}, "last_result": {…}, "status": "fresh", "fetched_at": "…" } ]
}
```

401 without JWT; p95 ≤ 500 ms cold / ≤ 200 ms warm (m2-delta §5).

### Diagram References

| Diagram | Notes |
|---------|-------|
| Role-home delta | [`tech-spec/m2-delta.md`](../../tech-spec/m2-delta.md) §7 — reuse rules (no parallel rendering path) |
| Honest-state matrix | [`tech-spec/m2-delta.md`](../../tech-spec/m2-delta.md) §6 — stale/pending on role-home tiles |
| Component delta | [`tech-spec/m2-delta.md`](../../tech-spec/m2-delta.md) §1 — Role-Home Route + availability registry |

### Design Decisions

| Decision | Source | Impact on This Task |
|----------|--------|---------------------|
| Role-home tiles are `scope='role_home'` widget instances on the SWR path | m2-delta §7; ADR-013/014 | Degradation (AC-5) comes free from TASK-010; no second cache or renderer |
| Content keyed on authority level, not the 10 personas | TASK-010 precedent (approved batch 1) | Authority is the only per-binding role signal in the M1 schema; persona names map onto levels in the table above |
| One availability registry for role-home + FR-015 | epic AC; m2-delta §1 | Shared fixture test (AC-2); divergence impossible by construction |
| Next-action is a deterministic priority rule, not LLM | E10-S1; cost + testability | Unit-testable, zero AI spend on every home load |
| Kind list always from `GET /api/ontology/types` | CE-READ-1; ontology-standards rule | Client extensions appear automatically; hand-copied kind lists are a review Blocker |

## Test Requirements

### Unit Tests (minimum 3)

- `test_next_action_priority_rule` — parametrised over metric fixtures: each rule stage wins in order; empty model ⟹ explore
- `test_capabilities_table_by_level` — read/author/publish/admin ⟹ exact capability id sets from the table
- `test_engine_gated_rows_coming_soon` — availability fixture (only CE GA) ⟹ Build/Events/Explorer rows `available: false` with `coming_soon` text

### Integration Tests (minimum 4)

- `test_role_home_content_by_role` — three principals (read/author/publish) ⟹ summary + capabilities per content table
- `test_role_matrix_capability_filtering` — Viewer response contains zero author-or-above capability ids
- `test_coming_soon_consistency_with_fr015` — SAME registry fixture drives a widget-category request (TASK-016) and role-home: both report identical availability per engine
- `test_completeness_map_kinds_from_types_endpoint` — CE fixture registers a client-extension kind ⟹ it appears in the map (proves no hand-copied list)
- `test_role_home_degrades_to_cached_snapshot` — seed last_result, kill CE fixture ⟹ 200 with stale tiles + staleness indicators, summary from cache, never zeros
- `test_role_home_p95` — warm ≤ 200 ms against seeded fixture (perf assertion)

### E2E Tests (minimum 1)

- `test_role_home_viewer_vs_architect` — Playwright, two roles: Viewer sees read capabilities + coming-soon cards, no author actions; publish-level user sees SHACL next-action banner deep-linking to compliance; axe 0 violations (Plugin Law B: response reflects backend RBAC rows)

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|----|-----------|-----------|
| AC-1 | Integration | `test_role_home_content_by_role` |
| AC-2 | Integration | `test_coming_soon_consistency_with_fr015` |
| AC-3 | Integration | `test_completeness_map_kinds_from_types_endpoint` |
| AC-4 | Integration + E2E | `test_role_matrix_capability_filtering`, `test_role_home_viewer_vs_architect` |
| AC-5 | Integration | `test_role_home_degrades_to_cached_snapshot` |
| AC-6 | Integration + CI gate | `test_role_home_p95`, Lighthouse gate |
| AC-7 | Unit | `test_next_action_priority_rule` |

## Dependencies

- **blocked_by:** TASK-010 (SWR path, tiles, lazy-create pattern), TASK-016 (completeness/coverage/SHACL/RBAC bindings this page composes)
- **unlocks:** none (leaf — final M2 task)

## Cost Estimate

- **Complexity:** M
- **Estimated tokens:** ~45K input, ~20K output
- **Estimated cost:** ~$3

## Definition of Ready Checklist

- [x] User story clear
- [x] All ACs have mapped tests
- [x] Pseudocode provided
- [x] Role→content table fully enumerated (no engineer guessing per-role copy)
- [x] Next-action rule pinned as a deterministic priority order
- [x] Reuse constraints explicit (SWR tiles, availability registry, TASK-016 bindings)

## Definition of Done Checklist

- [ ] All ACs met
- [ ] No hand-copied BPMO kind list anywhere (grep + extension-kind test)
- [ ] Coming-soon consistency test shares its fixture with FR-015 gating
- [ ] Viewer never sees author-or-above capabilities (matrix test)
- [ ] Degraded view shows cached data + staleness, never zeros
- [ ] Lighthouse 100 / axe 0 on the role-home page
- [ ] Coverage ≥ 80%; mutation ≥ 60%
- [ ] Conventional commit: `feat: add role-home landing with capability and completeness views`

## Implementation Hints

- The whole endpoint is composition — bindings from TASK-016, SWR from TASK-010, RBAC from M1.
  If this task grows new data-fetching code, stop and reuse instead.
- E10-S3's Build "Start" deep-links: ship the card in coming-soon state now; the deep-link
  activates by flipping the availability registry when Build GAs — no new code then.
- Persona names in tests (Viewer/Analyst/Engineer) are labels over authority levels — bind test
  fixtures to levels so the tests don't break when persona naming shifts.
- The completeness map component belongs to TASK-016 (it's the E2-S2 widget); role-home renders
  it with a `compact` prop, not a fork.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*
