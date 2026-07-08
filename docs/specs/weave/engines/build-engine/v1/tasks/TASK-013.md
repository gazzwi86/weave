---
type: Task
title: "Task: TASK-013 — Costs Endpoint + Budget-Cascade Breach Halt (ADR-008 read side, FR-008)"
description: "GET /api/projects/{id}/costs rollup (labelled estimated, stated forecast formula)
  and the FR-008 tighter-wins cascade breach check the orchestrator runs synchronously at each
  safe checkpoint, halting with a PLAT-NOTIFY-1 budget event."
tags: [build-engine, arch, task, v1]
status: Backlog
priority: Must Have
entity: build-engine
epic: EPIC-002
milestone: v1.0
created: 2026-07-08
blocked_by: [TASK-012]
unlocks: [TASK-019]
adr_refs: [ADR-008]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/build-engine/v1/tasks/TASK-013.md
---

# Task: TASK-013 — Costs Endpoint + Budget-Cascade Breach Halt (ADR-008 read side, FR-008)

## Story

**Epic:** [EPIC-002 — Project Registry & Settings](../../../build-engine.md#epic-002)
**Status:** Backlog · **Priority:** Must Have

**As a** delivery manager
**I want** a per-project cost rollup with a forecast I can trust, and runs that halt at the
next safe checkpoint when the binding budget cap is breached
**So that** a runaway run costs one checkpoint interval, not a surprise invoice

> **FRs covered:** FR-008 (budget-cap cascade + breach halt), ADR-008 decisions #4–#5.
> The E2 AC applies verbatim: partial work commits only if it passes the generation safety
> gates; breach fires a `PLAT-NOTIFY-1` budget event.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN `GET /api/projects/{id}/costs` is called, THE SYSTEM SHALL return `{total_estimate_usd, by_task[], burn_rate}` where every `by_task` row carries tokens, `cost_estimate_usd`, and the brief's `brief_estimate_tokens`, and the payload is labelled `estimated` | `should label all cost figures estimated` |
| AC-2 | WHEN the forecast is computed, THE SYSTEM SHALL use exactly the ADR-008 §4 formula — `forecast = mean_actual_cost_per_completed_task × remaining_count × calibration`, where `calibration = mean(brief_estimate_tokens of remaining) / mean(brief_estimate_tokens of completed)` (the brief-estimate correction; 1.0 when a brief estimate is missing on either side); WHEN zero tasks are completed, THE SYSTEM SHALL fall back to `Σ(brief_estimate_tokens of remaining × rate card)` with `basis: "brief_only"` — and SHALL expose all inputs (`mean_actual`, `completed_count`, `remaining_count`, `calibration`, `basis`) in the payload | `should compute forecast from stated formula inputs` |
| AC-3 | WHEN the binding cap is resolved, THE SYSTEM SHALL apply the Company→Domain→Project cascade tighter-wins via PLAT-SETTINGS-1 and report which level bound | `should resolve binding cap tighter-wins across cascade` |
| AC-4 | WHEN the local rollup meets or exceeds the binding cap at a safe checkpoint (task boundary / CODIFY), THE SYSTEM SHALL halt in-flight agent steps at that checkpoint and fire a `PLAT-NOTIFY-1` budget event | `should halt run at next checkpoint when cost rollup breaches binding cap` |
| AC-5 | WHEN a breach halt occurs and the PLAT-NOTIFY-1 emit fails, THE SYSTEM SHALL remain halted (notification failure never un-halts) | `should stay halted when budget notify emit fails` |
| AC-6 | WHEN the rollup query cannot be computed (DB error), THE SYSTEM SHALL return a named error state — never `0` (a zero total reads as "no spend", a false-health signal) | `should return error state not zero when rollup unavailable` |

## Implementation

### Pseudocode

```
# endpoint (PM Surface API, Lambda):
async def get_costs(project_id, ctx):
    rows = repo.cost_events.rollup(ctx.tenant_id, project_iri)        # TASK-010 aggregate
    briefs = repo.task_briefs.estimates(ctx.tenant_id, project_iri)   # brief_estimate_tokens
    done, todo = split_by_status(briefs)
    # AC-2 — ADR-008 §4 formula, verbatim (single source; do not restate elsewhere):
    if done:
        mean_actual = mean(actual cost of done tasks)                 # from rollup rows
        calibration = mean(brief_est of todo) / mean(brief_est of done)  # 1.0 if either missing
        forecast, basis = mean_actual * len(todo) * calibration, "calibrated"
    else:
        forecast, basis = sum(brief_est of todo × rate_card), "brief_only"   # no actuals yet
    return CostsPayload(label="estimated", total=..., by_task=join(rows, briefs),
                        burn_rate=..., forecast=forecast,
                        forecast_inputs={mean_actual, completed_count: len(done),
                                         remaining_count: len(todo), calibration, basis})

# checkpoint breach check (orchestrator, runs at task boundary + CODIFY):
async def check_budget(ctx):
    cap, level = settings.resolve_cascade("budget.cap", ctx)          # tighter-wins, AC-3
    spent = repo.cost_events.rollup_total(ctx.tenant_id, ctx.project_iri)   # sync read
    if spent >= cap:
        halt_run(reason=f"budget breach at {level}", checkpoint=current)    # AC-4
        try: notify.budget_event(ctx, spent, cap, level)
        except NotifyError: log.warning(...)                          # AC-5: stays halted
```

### API Contracts

`GET /api/projects/{id}/costs` — p95 ≤ 300 ms (v1-delta §3); 200 payload above; 5xx named
error envelope on rollup failure (AC-6). Consumes `PLAT-SETTINGS-1` cascade resolution
(effective value + binding level — the contract's settings-resolution read API) and
`PLAT-NOTIFY-1` budget events (registered notification type, M1).

### Diagram References

| Diagram | File | Section | Summary |
|---|---|---|---|
| Architecture delta | `../../tech-spec/v1-delta.md` | §2 diagram | Cost Reader → Aurora; orchestrator reads same rollup |
| Decision | `../../decisions/ADR-008.md` | Decisions #4–#5 | Endpoint shape + synchronous checkpoint read |
| Run lifecycle | `../../tech-spec/business-process.md` | run-lifecycle diagram | Where "safe checkpoint" sits in PDAC |

### Design Decisions

| Decision | Reference | Impact |
|---|---|---|
| Breach check reads the local rollup synchronously | [ADR-008](../../decisions/ADR-008.md) #5 | No async billing lag in the halt decision; one indexed aggregate per checkpoint |
| Forecast formula = ADR-008 §4, pinned once in AC-2 | [ADR-008](../../decisions/ADR-008.md) #4 | One formula in one place (AC-2 = pseudocode = tile); the Dashboard tile never shows an unexplained number (TASK-019 renders these inputs) |
| Halt ≥ cap (not >) | AC-4 | At-cap is a breach; the next dispatch would exceed — err on the halting side |
| Rollup failure ⇒ named error, never zero | AC-6 | Mirrors the CE-METRICS-1 honesty rule (a 0 reads as false health) |

## Test Requirements

### Unit Tests (minimum 5)

- `should compute forecast from stated formula inputs` (calibrated path; asserts the exact
  ADR-008 product and exposed inputs)
- `should fall back to brief-only forecast when no tasks completed` (basis `brief_only`)
- `should resolve binding cap tighter-wins across cascade` (settings stub with conflicting levels)
- `should label all cost figures estimated`
- `should return error state not zero when rollup unavailable`

### Integration Tests (minimum 3)

- `should halt run at next checkpoint when cost rollup breaches binding cap` (orchestrator
  loop, seeded cost events crossing cap mid-run; asserts run status halted + no further
  dispatch — Law B backend assertion)
- `should stay halted when budget notify emit fails` (notify stub raising)
- `should return costs payload within contract shape` (endpoint against seeded rollup)

### E2E Tests

Deferred to TASK-019 (Dashboard budget/forecast tiles render this payload; the tile E2E
asserts the labelled figures end-to-end).

### AC-to-Test Mapping

| AC | Type | Test |
|---|---|---|
| AC-1 | Unit | `should label all cost figures estimated` |
| AC-2 | Unit | `should compute forecast from stated formula inputs` |
| AC-3 | Unit | `should resolve binding cap tighter-wins across cascade` |
| AC-4 | Integration | `should halt run at next checkpoint when cost rollup breaches binding cap` |
| AC-5 | Integration | `should stay halted when budget notify emit fails` |
| AC-6 | Unit | `should return error state not zero when rollup unavailable` |

## Dependencies

- **blocked_by:** [TASK-012] (cost_events rows exist)
- **unlocks:** [TASK-019]
- **External prerequisites:** PLAT-SETTINGS-1 cascade-resolution API (live, M1);
  PLAT-NOTIFY-1 budget notification type (registered, M1); task-brief estimate field
  (FR-018, M1)

## Cost Estimate

- **Complexity:** L
- **Estimated tokens:** ~16k input, ~7k output
- **Estimated cost:** ~$0.55 (claude-sonnet-5 implementation tier)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined
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
- [ ] `estimated` greppable in the cost payload builder (invariants.md verify-by)
- [ ] p95 ≤ 300 ms on the costs endpoint against the seeded fixture
- [ ] Docstrings on public APIs
- [ ] Conventional commit(s); PR references this task and EPIC-002

## Implementation Hints

- "Safe checkpoint" already exists — it is the same boundary the M1 turn-cap check uses in the
  PDAC loop; add the budget check beside it, do not invent a second checkpoint concept.
- The cascade-resolution call returns the binding level — pass it through to both the halt
  reason and the notify payload; the Dashboard shows "capped at Domain" from it (three-level
  cascade Company→Domain→Project; workspace dropped).
- `by_task` join: rollup rows LEFT JOIN brief estimates — tasks with spend but no brief
  (pre-M1 rows) render with `brief_estimate_tokens: null`, not dropped.
- Burn rate = total over the trailing window (single SQL window over `recorded_at`); keep the
  window length a settings value with a default, not a constant.

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
