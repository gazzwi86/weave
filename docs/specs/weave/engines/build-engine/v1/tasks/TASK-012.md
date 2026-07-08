---
type: Task
title: "Task: TASK-012 — cost_events Writer (ADR-008): Per-Dispatch Usage Attribution"
description: "Orchestrator persists one cost_events row per agent dispatch (tokens from the
  Agent SDK usage block, USD from the PLAT-SETTINGS-1 rate card) and tags PLAT-BILLING-1
  metering events with task_id/run_id. Rate-card resolution is a run-start preflight."
tags: [build-engine, arch, task, v1]
status: Backlog
priority: Must Have
entity: build-engine
epic: EPIC-002
milestone: v1.0
created: 2026-07-08
blocked_by: [TASK-010]
unlocks: [TASK-013, TASK-021]
adr_refs: [ADR-008]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/build-engine/v1/tasks/TASK-012.md
---

# Task: TASK-012 — cost_events Writer (ADR-008): Per-Dispatch Usage Attribution

## Story

**Epic:** [EPIC-002 — Project Registry & Settings](../../../build-engine.md#epic-002)
**Status:** Backlog · **Priority:** Must Have

**As a** delivery manager
**I want** every agent dispatch's token usage attributed to its project, task, run, role, and
model at the moment it happens
**So that** budgets, forecasts, and breach halts operate on per-task facts instead of a single
opaque project total

> **FRs covered:** ADR-008 decisions #1–#3 (write side; the read endpoint + breach check are
> TASK-013). Closes OQ-05.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN an agent dispatch returns a typed result, THE SYSTEM SHALL persist one `cost_events` row with `{tenant, project_iri, task_id, run_id, agent_role, model, tokens_in, tokens_out, cost_estimate_usd}` taken from the dispatch context + SDK usage block | `should persist one cost event per agent dispatch` |
| AC-2 | WHEN non-run work consumes tokens (spec drafting, replan), THE SYSTEM SHALL persist the row with `run_id` (and `task_id` where inapplicable) NULL | `should persist cost event with null run id for non-run work` |
| AC-3 | WHEN `cost_estimate_usd` is computed, THE SYSTEM SHALL resolve the per-model rate from PLAT-SETTINGS-1 (`build.cost.rate_card`) — never a hardcoded price | `should resolve rate card from settings` |
| AC-4 | WHEN rate-card resolution fails for a routable model at run start, THE SYSTEM SHALL halt the run with a named config error before any dispatch (fail-closed, same posture as model-routing halt) | `should halt run at start when rate card unresolvable` |
| AC-5 | WHEN a PLAT-BILLING-1 metering event is emitted for a dispatch, THE SYSTEM SHALL include `task_id` and `run_id` metadata; a metering-emit failure SHALL NOT fail the dispatch (never-dropped queue owns delivery) | `should tag billing events with task and run ids` |
| AC-6 | WHEN a `cost_events` insert fails, THE SYSTEM SHALL log a named warning and continue the dispatch — attribution loss is disclosed, never fatal and never silent | `should disclose and continue when cost event insert fails` |
| AC-7 | WHEN tenant-B reads cost events, THE SYSTEM SHALL return zero tenant-A rows | covered by TASK-010 `should return zero tenant-B rows for every new v1 table` (cost path re-asserted here) |

## Implementation

### Pseudocode

```
# run start (orchestrator, before step 0):
rate_card = settings.resolve_group("build.cost.rate_card")   # {model_id: usd_per_1k_in/out}
for model in ALLOWED_MODELS:
    if model not in rate_card: raise RateCardConfigError(model)   # AC-4, fail-closed

# per dispatch (wrap the existing typed-result return path in the PDAC loop):
def record_dispatch_cost(ctx, dispatch, result):
    usage = result.usage                        # Agent SDK usage block
    cost = usage.input_tokens/1000 * rate.in + usage.output_tokens/1000 * rate.out
    try:
        repo.cost_events.insert(tenant=ctx.tenant_id, project_iri=ctx.project_iri,
            task_id=dispatch.task_id, run_id=dispatch.run_id,      # both nullable
            agent_role=dispatch.role, model=dispatch.model,
            tokens_in=usage.input_tokens, tokens_out=usage.output_tokens,
            cost_estimate_usd=cost)
    except DBError as e:
        log.warning("cost_event_insert_failed", extra={...})       # AC-6
    emitter.billing(per_token_event | {"task_id": ..., "run_id": ...})   # AC-5, existing
```

### API Contracts

No new endpoint. Consumes: `PLAT-SETTINGS-1` (rate card group `build.cost.rate_card`, seeded
defaults for `claude-fable-5` / `claude-sonnet-5` only); `PLAT-BILLING-1` via the existing M1
Audit + Billing Emitter (additive metadata only — coordinator has relayed the tag note to
Platform; no contract shape change).

### Diagram References

| Diagram | File | Section | Summary |
|---|---|---|---|
| Architecture delta | `../../tech-spec/v1-delta.md` | §2 diagram | Orchestrator → cost_events writer → Aurora |
| Decision | `../../decisions/ADR-008.md` | whole file | Why local rollup; why Platform stays invoicing SoR |
| M1 component | `../../tech-spec/architecture.md` | §Level 3 | Audit + Billing Emitter (the component gaining tags) |

### Design Decisions

| Decision | Reference | Impact |
|---|---|---|
| Attribution at the dispatch site, from the SDK usage block | [ADR-008](../../decisions/ADR-008.md) #1 | No new instrumentation layer; retries and non-run work attribute correctly |
| Rate card in settings, validated at run start | [ADR-008](../../decisions/ADR-008.md) #2 + AC-4 | Price changes are a settings update; a broken card halts before spend, not per-row |
| Insert failure = disclosed warning, not dispatch failure | AC-6 | Metering must never kill a run; silent loss is equally banned (run log discloses) |
| Billing tags additive, Build never reconciles | [ADR-008](../../decisions/ADR-008.md) #3 | Invoicing truth stays with Platform; drift is labelled "estimated" downstream |

## Test Requirements

### Unit Tests (minimum 4)

- `should resolve rate card from settings`
- `should halt run at start when rate card unresolvable`
- `should compute cost from usage block and per-model rates`
- `should disclose and continue when cost event insert fails`

### Integration Tests (minimum 3)

- `should persist one cost event per agent dispatch` (orchestrator loop with stub agent
  runtime; asserts row content — Law B backend assertion)
- `should persist cost event with null run id for non-run work` (spec-drafting path)
- `should tag billing events with task and run ids` (emitter stub captures payload)

### E2E Tests

N/A — orchestrator-internal; surfaced to users via TASK-013/TASK-019.

### AC-to-Test Mapping

| AC | Type | Test |
|---|---|---|
| AC-1 | Integration | `should persist one cost event per agent dispatch` |
| AC-2 | Integration | `should persist cost event with null run id for non-run work` |
| AC-3 | Unit | `should resolve rate card from settings` |
| AC-4 | Unit | `should halt run at start when rate card unresolvable` |
| AC-5 | Integration | `should tag billing events with task and run ids` |
| AC-6 | Unit | `should disclose and continue when cost event insert fails` |
| AC-7 | Integration | TASK-010 two-tenant test, cost path |

## Dependencies

- **blocked_by:** [TASK-010] (cost_events table + repo)
- **unlocks:** [TASK-013, TASK-021]
- **External prerequisites:** M1 Audit + Billing Emitter (live); PLAT-SETTINGS-1 resolution
  client (live); agent runtime stubbed in tests (Law F)

## Cost Estimate

- **Complexity:** M
- **Estimated tokens:** ~14k input, ~6k output
- **Estimated cost:** ~$0.45 (claude-sonnet-5 implementation tier)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (internal; consumed contracts cited)
- [x] Diagram references included
- [x] Design decisions noted (ADR-008)
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing
- [ ] Coverage ≥ 80% changed code; delta mutation ≥ 70%
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] No literal USD rate in code (invariants.md verify-by: settings resolution only)
- [ ] Docstrings on public APIs
- [ ] Conventional commit(s); PR references this task and EPIC-002

## Implementation Hints

- The typed-result return path in `build/orchestrator.py` is the single wrap point — every
  dispatch (PLAN/DELEGATE/ASSESS/CODIFY, investigator, drafting) flows through it; do not
  instrument agents individually.
- Keep the writer off the critical path the same way the recent best-effort metric-emit change
  did (see `perf(ce)` commits on main) — but the *insert* is synchronous-cheap (one row); only
  the billing emit rides the queue.
- Rate card keys are exactly the confirmed model IDs; do not add speculative entries for
  models the router can't select (`ALLOWED_MODELS` is the validation universe).
- `RateCardConfigError` should surface through the existing run-halt HITL path (same UX as
  `ModelRoutingError`), not a new error channel.

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
