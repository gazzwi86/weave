---
type: Task Brief
title: "Task: TASK-013 — Refine widget by follow-up prompt + refinement history (E1-S3)"
description: "Delta prompts over an existing widget: refine re-runs the resolver with held
  context through the same SSE grammar, appends to the capped refinement history, restores any
  history step without a model call, and preserves prior state on failure."
tags: [weave-platform, arch, task]
timestamp: 2026-07-08T12:00:00Z
status: Backlog
priority: Must Have
entity: weave-platform
epic: EPIC-001
milestone: v1
created: 2026-07-08
blocked_by: [TASK-012]
unlocks: []
adr_refs: [ADR-012, ADR-014]
---

# Task: TASK-013 — Refine widget by follow-up prompt + refinement history (E1-S3)

**Spec:** [weave-platform.md](../../../weave-platform.md) · **Delta:** [m2-delta.md](../../tech-spec/m2-delta.md) · **Contracts:** [contracts.md](../../../../contracts.md)

## Story

**Epic:** EPIC-001 Dashboard
**Priority:** Must Have

**As a** workspace member
**I want** to adjust a widget I just generated with a follow-up prompt ("last 30 days instead",
"split by severity") and step back through my refinements
**So that** I converge on the view I need without starting over, and a failed refinement never
destroys what I had.

## Acceptance Criteria

| ID | EARS Criterion | Test Mapping |
|----|----------------|--------------|
| AC-1 | WHEN a user submits a refine prompt on a widget, THE SYSTEM SHALL apply the delta and re-render via `POST /api/dashboard/widgets/{id}/refine` using the SAME SSE grammar and pipeline as generate (budget gate, order invariant, metering, audit — all TASK-011 machinery, zero re-implementation) (FR-007). | integration: `test_refine_reuses_generate_pipeline` |
| AC-2 | WHEN a refine succeeds on a pinned widget, THE SYSTEM SHALL append `{seq, prompt, resulting_spec}` to `widget_refinements`, capped at 10 steps (tunable via `PLAT-SETTINGS-1`) with the oldest deleted on overflow (m2-delta §4). | integration: `test_refinement_history_capped_at_10` |
| AC-3 | IF a refine fails (any TASK-011 error state), THEN THE SYSTEM SHALL preserve the prior widget state — spec, `last_result`, and history unchanged; the error renders as a dismissible notice on the intact widget, never a blank or reverted tile (FR-007 failure AC). | integration: `test_refine_failure_preserves_prior_state` |
| AC-4 | WHEN a user selects a history step, THE SYSTEM SHALL restore that step's `resulting_spec` and re-fetch its data WITHOUT any model call (spec is stored; only the data binding runs) (E1-S3). | integration: `test_history_restore_no_model_call` |
| AC-5 | WHEN refine runs on an unpinned (just-streamed, unsaved) widget, THE SYSTEM SHALL hold refinement context client-side (no `widget_refinements` rows exist until pin); pinning after refinement persists the final spec (consistent with TASK-012's unpinned change-viz branch). | unit(TS): `test_unpinned_refine_client_held` |
| AC-6 | WHEN the refine prompt asks for something unsatisfiable against the current data source (e.g. a dimension the contract does not expose), THE SYSTEM SHALL decline with the named reason and preserve state (FR-004 applied to refine). | integration: `test_refine_unsatisfiable_declines` |

## Implementation

### Pseudocode

```text
# Refine endpoint (packages/backend/dashboard/refine.py)
POST /api/dashboard/widgets/{id}/refine  { prompt }  -> text/event-stream
  widget = load widget_instances[id]  (RLS scopes tenant; 403 if scope='user' and not owner;
                                       tenant_default is read-only-composed at M2 -> 403)
  # delegate to TASK-011's generate pipeline with held context:
  spec = model_router.dashboard_agent.resolve(prompt, context=widget.spec)   # TASK-012 resolver,
        # context makes it a delta: resolver receives current spec + delta prompt
  ... identical stream flow (budget gate FIRST, spec/data/done|error, meter, audit
      event_type="dashboard.widget.refined") ...
  on success (pinned):
    txn: update widget.spec, last_result, fetched_at
         insert widget_refinements(seq=next, prompt, resulting_spec=new_spec)
         if count > cap(10): delete lowest seq
  on ANY error: no writes occur (stream aborts before txn) -> AC-3 by construction

# History restore (packages/backend/dashboard/refine.py)
POST /api/dashboard/widgets/{id}/restore  { seq } -> 200 { spec, status }
  spec = widget_refinements[widget_id, seq].resulting_spec        # 404 unknown seq
  data = fetch_binding_data(spec)                                  # TASK-010 CE client; NO llm
  update widget.spec=spec, last_result=data, fetched_at=now()
  # ponytail: restore is not itself appended to history — replaying a step is not a new step

# Client (packages/frontend/src/dashboard/RefineBar.tsx + HistoryMenu.tsx)
refine input on widget focus; reuses useWidgetStream hook (TASK-011)
history menu lists steps (prompt text as label); select -> POST restore
unpinned branch: keep [spec] stack in component state; pin sends final spec only
```

### API Contracts

**Endpoint:** `POST /api/dashboard/widgets/{id}/refine` — `{ "prompt": "last 30 days instead" }` →
`200 text/event-stream`, grammar identical to generate (TASK-011). 403 non-owner/user-scope,
404 unknown id. p95 = generate targets (m2-delta §5).

**Endpoint:** `POST /api/dashboard/widgets/{id}/restore` — `{ "seq": 3 }` →
`200 { "spec": {…}, "status": "fresh", "fetched_at": "…" }` · 404 unknown seq. p95 ≤ 500 ms +
upstream (matches refresh — it IS a refresh with a different spec).

**Endpoint:** `GET /api/dashboard/widgets/{id}/history` → `200 { "steps": [{ "seq": 1, "prompt": "…", "created_at": "…" }] }` (specs omitted from the list — fetched on restore). p95 ≤ 200 ms.

### Diagram References

| Diagram | Notes |
|---------|-------|
| SSE grammar + pipeline | [`tech-spec/m2-delta.md`](../../tech-spec/m2-delta.md) §3 — refine reuses it verbatim |
| `widget_refinements` table | [`tech-spec/m2-delta.md`](../../tech-spec/m2-delta.md) §4 — cap semantics |
| Component delta | [`tech-spec/m2-delta.md`](../../tech-spec/m2-delta.md) §1 — refine rides the Generate Endpoint box |

### Design Decisions

| Decision | Source | Impact on This Task |
|----------|--------|---------------------|
| Refine = generate with held context; one pipeline | ADR-012; m2-delta §3 | The refine endpoint is a thin wrapper — budget/meter/audit/error states come free; duplicating any of it is a review Blocker |
| History rows only exist for pinned widgets | m2-delta §4 (FK to widget_instances) | Unpinned refinement is client state (AC-5); no orphan history rows possible |
| Restore never calls the model | E1-S3; cost discipline | Stored `resulting_spec` + data re-fetch only; restore is free of AI spend |
| Failure preserves prior state by transaction shape | FR-007 | Writes happen only after terminal `done`; error paths write nothing — tested, not hoped |
| Cap enforcement app-side, oldest-deleted | m2-delta §4 | Tunable via PLAT-SETTINGS-1; DB stays constraint-free on count |

## Test Requirements

### Unit Tests (minimum 3)

- `test_refine_context_passed_to_resolver` — resolver spy receives `context=current_spec` + delta prompt
- `test_history_cap_config` — cap resolves through PLAT-SETTINGS-1 with default 10
- `test_unpinned_refine_client_held` (Vitest) — refine an unsaved widget: no history API calls; pin sends final spec once
- `test_restore_not_appended_to_history` — restore leaves history count unchanged

### Integration Tests (minimum 4)

- `test_refine_reuses_generate_pipeline` — refine at budget cap ⟹ `error budget_cap`, model spy zero calls (proves the gate is in the path); happy refine ⟹ metered + audited as `dashboard.widget.refined`
- `test_refinement_history_capped_at_10` — 12 refines ⟹ 10 rows, seqs are the latest 10
- `test_refine_failure_preserves_prior_state` — provider_503 mid-refine ⟹ spec, last_result, history byte-identical to before
- `test_history_restore_no_model_call` — restore seq 2 ⟹ spec swapped, data re-fetched (CE client called), model router spy zero calls
- `test_refine_unsatisfiable_declines` — delta requesting an unexposed dimension ⟹ `unsatisfiable`, state intact
- `test_refine_forbidden_on_tenant_default` — 403 (read-only-composed at M2)

### E2E Tests (minimum 1)

- `test_refine_and_step_back` — Playwright: generate widget, refine ("split by severity"), widget updates; open history, restore step 1; original view returns; force a failing refine ⟹ widget intact with error notice (backend spec unchanged — Plugin Law B)

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|----|-----------|-----------|
| AC-1 | Integration | `test_refine_reuses_generate_pipeline` |
| AC-2 | Integration | `test_refinement_history_capped_at_10` |
| AC-3 | Integration | `test_refine_failure_preserves_prior_state` |
| AC-4 | Integration | `test_history_restore_no_model_call` |
| AC-5 | Unit(TS) | `test_unpinned_refine_client_held` |
| AC-6 | Integration | `test_refine_unsatisfiable_declines` |

## Dependencies

- **blocked_by:** TASK-012 (resolver with context; compatibility handling on refined specs)
- **unlocks:** none (leaf — publish/pin do not depend on refine)

## Cost Estimate

- **Complexity:** M
- **Estimated tokens:** ~40K input, ~18K output
- **Estimated cost:** ~$3

## Definition of Ready Checklist

- [x] User story clear
- [x] All ACs have mapped tests
- [x] Pseudocode provided (txn shape makes AC-3 structural)
- [x] History table + cap semantics pinned (m2-delta §4)
- [x] Unpinned-vs-pinned branch specified (AC-5) — no engineer guessing
- [x] Restore-is-not-a-step decision recorded

## Definition of Done Checklist

- [ ] All ACs met
- [ ] Refine path contains no duplicated budget/meter/audit code (imports TASK-011 modules)
- [ ] No write on any error path (verified by state-diff assertions)
- [ ] Restore path model-free (spy-verified)
- [ ] tenant_default refine returns 403
- [ ] Coverage ≥ 80%; mutation ≥ 60%
- [ ] Conventional commit: `feat: add widget refine with capped history and restore`

## Implementation Hints

- Implement refine as a parameter on the generate service function (`context: WidgetSpec | None`),
  not a second function — the endpoint difference is routing + the persistence branch.
- `resulting_spec` snapshots are small; store them whole rather than diffs — diff replay is
  complexity with no consumer.
- The history menu label is the prompt text truncated at ~60 chars with title attr for full text.
- Deleting oldest-on-overflow inside the same txn as the insert keeps the cap exact under
  concurrent refines (row lock on the widget row first).

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*
