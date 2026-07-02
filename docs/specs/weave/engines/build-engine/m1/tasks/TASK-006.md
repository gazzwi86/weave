---
type: Task
title: "Task: TASK-006 — Dark-Factory Execution Engine (E11-S1 to E11-S5)"
description: "Implement the bounded PLAN→DELEGATE→ASSESS→CODIFY loop: hard orchestrator turn cap, resumable CODIFY checkpoints, dep-summary handoff, RLS state spine, and model routing."
tags: [build-engine, arch, task, m1]
status: Backlog
priority: Must Have
entity: build-engine
epic: EPIC-011
milestone: M1
created: 2026-07-01
blocked_by: [TASK-001, TASK-002, TASK-004, TASK-005, TASK-010]
unlocks: [TASK-007, TASK-008]
adr_refs: [ADR-001]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: 61dfc1553b18b5762902e1d2b3681c82f4ebb26c
expires_on: 2026-12-28
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-01T00:00:00Z
resource: docs/specs/weave/engines/build-engine/m1/tasks/TASK-006.md
---

# Task: TASK-006 — Dark-Factory Execution Engine (E11-S1 to E11-S5)

## Story

**Epic:** [EPIC-011 — Dark-Factory Execution Engine](../../../build-engine.md#epic-011--dark-factory-execution-engine)
**Status:** Backlog
**Priority:** Must Have

**As a** dark-factory orchestrator
**I want** a bounded PLAN→DELEGATE→ASSESS→CODIFY loop with a hard orchestrator turn cap,
resumable CODIFY checkpoints, dependency-summary handoff, RLS-isolated state spine, and
configurable model routing
**So that** multi-task runs are deterministic, resumable after interruption, cost-controlled,
and never route to an unapproved model

> **FRs covered:** FR-041 (orchestrator turn cap, distinct from per-agent caps), FR-042
> (resume from last CODIFY checkpoint), FR-043 (dep-summary handoff), FR-044 (state spine),
> FR-045 (model routing). E11-S2 (PDAC lifecycle) is the backbone; it has no single FR number
> but is exercised by all five FRs.
>
> **Run step 0 — repo bootstrap (FR-061 / E11-S7, owned by TASK-010):** the orchestrator's FIRST
> action on run start (before the first PLAN) is to ensure the project's NEW external repo exists
> on the configured provider (GitHub/GitLab) and its boilerplate is written — via the repo-bootstrap
> capability (TASK-010). All generated output is pushed to that repo (TASK-008), never inside Weave.
> If the source-control provider is unconfigured / the token is invalid, the run halts before PLAN
> (fail-closed). Source control is NOT a `PLAT-CONNECTOR-1` connector and is available at M1.
>
> **SS-BE-5 ceiling (FR-041):** The orchestrator cap is 60 dispatch cycles. Each cycle may invoke
> an agent whose internal cap is ~100 LLM calls. The effective worst-case ceiling is
> **orchestrator 60 × per-agent ~100 = ~6,000 LLM calls** per run. Both caps are independent;
> either cap halting to HITL does not reset the other. This ceiling is an operational risk
> monitored via `PLAT-BILLING-1`.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN an autonomous run is dispatched, THE SYSTEM SHALL enforce an orchestrator turn cap (default 60 dispatch cycles, configurable via `PLAT-SETTINGS-1`); the cap is DISTINCT from per-agent internal caps (~100 LLM calls each, controlled by the agent itself) | `test_orchestrator_halts_at_turn_cap_60` |
| AC-2 | WHEN either the orchestrator turn cap OR the cascading cost cap (FR-004/FR-008) is reached, THE SYSTEM SHALL halt to a HITL gate (via TASK-005 `fire_hitl_gate`) with full state preserved; the per-agent cap halt also routes to HITL via `TypedResult {status: FAIL, failure_class: "logic"}` | `test_either_cap_halt_routes_to_hitl_with_state_preserved` |
| AC-3 | WHEN a cap-halt or crash occurs mid-task, THE SYSTEM SHALL resume from the last committed CODIFY checkpoint on the next dispatch; a task restarted from scratch when a CODIFY checkpoint exists is a defect | `test_resume_from_codify_checkpoint_after_crash` |
| AC-4 | WHEN a task reaches CODIFY, THE SYSTEM SHALL write its dependency summary `{task_id, decisions: [...], edge_cases: [...], outputs: [...]}` to the tenant-scoped store (Aurora, RLS-isolated by `project_iri + task_id`) before the task is marked Done; CODIFY is non-skippable | `test_codify_writes_dep_summary_before_task_done` |
| AC-5 | WHEN a task enters PLAN, THE SYSTEM SHALL load every available predecessor dependency summary from the tenant-scoped store on a **best-effort** basis; WHEN any predecessor summary is missing, THE SYSTEM SHALL log a `missing_handoff` warning and dispatch the task anyway — in M1 a missing handoff **NEVER holds** the task (M2 activates the hold gate — FR-043) | `test_plan_warns_and_proceeds_when_predecessor_summary_missing` |
| AC-6 | WHEN the configured model provider for a role (PLAN/DELEGATE/ASSESS/CODIFY) is unreachable, THE SYSTEM SHALL fall back per the fallback policy or halt the task and emit a routing error; it MUST NEVER silently invoke an unapproved or fallback model not in the confirmed set | `test_model_routing_miss_halts_task_not_silent_invoke` |
| AC-7 | WHEN a tenant-B principal queries the state spine (`GET /api/state/{project_iri}`), THE SYSTEM SHALL return zero rows belonging to tenant-A (`404` or empty result); cross-tenant reads are a security defect | `test_state_spine_rls_tenant_b_sees_no_tenant_a_rows` |
| AC-8 | WHEN the state spine is committed after a task, THE SYSTEM SHALL complete the commit within 500 ms p99; a commit timeout MUST block the task from being marked Done rather than silently skip | `test_state_spine_commit_blocks_on_timeout` |

> **Cost-cap scope (M1, AC-2):** the M1 cost gate is **raw `PLAT-BILLING-1` metering + the
> pre-generation estimate (FR-004)** — a coarse budget check read against the pre-gen estimate before
> dispatch (`budget_cap_exceeded`). The **cascading run-time cost cap (FR-008)** referenced in AC-2 is
> **v1.0**, not M1; M1 does not enforce a cascading run-time cap.

## Implementation

> **Note on pseudocode depth:** The PDAC loop is implemented by a Sonnet + Fable advisor pair at
> implementation time. The pseudocode below is intentionally light — it describes the orchestrator
> loop contract, not the agent internals. The implementer must derive agent-side logic from the
> state spine schema, dep-summary format, and AC set.

### Pseudocode

**Orchestrator loop (light — implementer expands):**

```
function run_dark_factory(project_iri, tenant_id, turn_cap=60):
  # Run step 0 — repo bootstrap (FR-061 / E11-S7, TASK-010). Idempotent: creates the project's
  # external repo + boilerplate on first run; halts the run fail-closed if provider unconfigured /
  # token invalid. Generated output (TASK-008) is pushed here, never inside Weave.
  ensure_project_repo(project_iri, tenant_id)   # → RepoBootstrapError halts run before PLAN

  state = aurora.load_state_spine(project_iri, tenant_id)  # RLS-isolated
  dispatch_count = state.dispatch_count  # resume from checkpoint

  while dispatch_count < turn_cap:
    task = state.next_ready_task()       # ready = DoR passed, deps resolved
    if not task: break                   # all tasks done or blocked

    # Check predecessor dep summaries (M1: best-effort — log warning, never hold; M2 gates on it — FR-043)
    missing = [t for t in task.blocked_by
               if not aurora.dep_summary_exists(project_iri, t, tenant_id)]
    if missing:
      log.warning("missing_handoff", task_id=task.id, missing_summaries=missing)
      # M1 stub: do NOT hold — dispatch anyway. M2 activates the hold gate (FR-043).

    # Check budget cap before dispatch
    if budget_cap_exceeded(project_iri, tenant_id):  # PLAT-BILLING-1
      fire_hitl_gate(task.id, BUILD_PRINCIPAL, reason="cost_cap")
      break

    # Dispatch via PDAC
    result = dispatch_pdac(task, state, tenant_id)  # → TypedResult

    if result.status == "FAIL":
      handle_agent_result(task.id, result)           # TASK-005 retry/HITL logic
      dispatch_count += 1
      aurora.commit_state_spine(project_iri, state, dispatch_count)
      continue

    # CODIFY: write dep summary before marking Done
    aurora.write_dep_summary(project_iri, task.id, tenant_id,
                             result.dep_summary)       # must complete < 500ms p99
    aurora.update_task(task.id, status="Done")
    dispatch_count += 1
    aurora.commit_state_spine(project_iri, state, dispatch_count)

  if dispatch_count >= turn_cap:
    fire_hitl_gate(None, BUILD_PRINCIPAL, reason="turn_cap_reached")

  return {"dispatch_count": dispatch_count, "status": state.summary()}


function dispatch_pdac(task, state, tenant_id):
  # PLAN: load brief + dep summaries → agent context
  brief = aurora.get_brief(task.id, tenant_id)         # from TASK-002
  dep_summaries = [aurora.get_dep_summary(project_iri, t, tenant_id)
                   for t in task.blocked_by]
  # DELEGATE: Engineer agent (claude-sonnet-5)
  # ASSESS: QA agent (claude-sonnet-5)
  # CODIFY: write dep_summary to result
  # (agent internals: Sonnet + Fable advisor implement)
  ...
  return TypedResult(status=..., failure_class=..., evidence=...,
                     retry_recommended=..., dep_summary={...})
```

**State spine schema:**

```python
class TaskState(BaseModel):
  id: str
  status: str   # Backlog | Ready | In Progress | Blocked | Done
  blocked_by: list[str]
  codify_checkpoint: dict | None   # last committed checkpoint; resume from here

class StateSpine(BaseModel):
  project_iri: str
  tenant_id: str
  phase: str
  dispatch_count: int
  tasks: list[TaskState]

# State spine persisted as JSON in Aurora `state_spines` table (RLS by tenant_id)
```

**Model routing table (constants, never runtime variables):**

```python
MODEL_ROUTING = {
  "plan":     {"provider": "anthropic", "model": "claude-fable-5"},
  "delegate": {"provider": "anthropic", "model": "claude-sonnet-5"},
  "assess":   {"provider": "anthropic", "model": "claude-sonnet-5"},
  "codify":   {"provider": "anthropic", "model": "claude-sonnet-5"},
}
ALLOWED_MODELS = {"claude-fable-5", "claude-sonnet-5"}

def resolve_model(role: str) -> dict:
  routing = MODEL_ROUTING.get(role)
  if not routing or routing["model"] not in ALLOWED_MODELS:
    raise ModelRoutingError(f"No valid model for role {role}")  # halts task
  return routing
```

### API Contracts

**`POST /api/projects/{project_iri}/runs`** — start a dark-factory run

Request body:

```json
{
  "run_mode": "string — draft_spec_only | spec_to_build | spike (required)",
  "turn_cap_override": "integer | null — override default 60 (optional, capped by PLAT-SETTINGS-1)"
}
```

Response `202`:

```json
{
  "run_id": "string — UUID",
  "project_iri": "string",
  "status": "string — running",
  "turn_cap": "integer — effective cap after cascade resolution"
}
```

Error responses:

| Status | Condition | Body |
|---|---|---|
| 401 | Missing or invalid JWT | `{"error": "unauthorised"}` + `Www-Authenticate: Bearer` |
| 404 | Project not found or belongs to another tenant | `{"error": "not_found"}` |
| 409 | A run is already in-flight for this project | `{"error": "run_already_active", "run_id": "<id>"}` |

**`GET /api/state/{project_iri}`** — state spine read (RLS-enforced)

Response `200`:

```json
{
  "project_iri": "string",
  "phase": "string",
  "dispatch_count": "integer",
  "tasks": [
    {
      "id": "string",
      "status": "string",
      "blocked_by": ["string"],
      "codify_checkpoint": "object | null"
    }
  ]
}
```

Error responses:

| Status | Condition | Body |
|---|---|---|
| 401 | Missing or invalid JWT | `{"error": "unauthorised"}` |
| 404 | Project not found or belongs to another tenant (RLS) | `{"error": "not_found"}` |

### Diagram References

| Diagram | File | Relevant Section | Summary |
|---|---|---|---|
| Sequence | `../tech-spec/business-process.md` | `#dark-factory-pdac-sequence` | PLAN→DELEGATE→ASSESS→CODIFY per-task sequence showing agent handoffs and HITL branches |
| State | `../tech-spec/business-process.md` | `#task-state-machine` | Task state transitions (Backlog→Ready→In Progress→Blocked→Done) and checkpoint positions |
| Data Model | `../tech-spec/data-model.md` | `#state-spine-and-dep-summaries-tables` | `state_spines`, `dep_summaries`, `task_retries` tables |

All three are pending — to be added to tech-spec before implementation starts (DoR blockers).

### Design Decisions

| Decision | Reference | Impact on This Task |
|---|---|---|
| CODIFY is non-skippable; dep summary written before Done | [build-engine.md decision B3](../../../build-engine.md#key-decisions) | `dispatch_pdac` must return `dep_summary` in `TypedResult`; orchestrator writes it before updating task status |
| Orchestrator turn cap is DISTINCT from per-agent internal caps | [build-engine.md FR-041](../../../build-engine.md#21-functional-requirements) | Orchestrator counts dispatch cycles (not LLM calls); per-agent internal caps are the agent's own concern; routing miss from per-agent halt arrives as `TypedResult {FAIL}` |
| Confirmed Claude model IDs only: `claude-fable-5`, `claude-sonnet-5` | [CLAUDE.md](../../../../../../../CLAUDE.md#stack-confirmed) | `MODEL_ROUTING` constants + `ALLOWED_MODELS` set; `ModelRoutingError` halts the task — never silent invocation |
| State spine committed after every task (blocking) | [build-engine.md FR-044](../../../build-engine.md#21-functional-requirements) | `aurora.commit_state_spine` is synchronous and blocking; 500 ms p99 target; timeout → task NOT marked Done |
| RLS isolation for state spine and dep summaries | [build-engine.md §2.2 Reliability](../../../build-engine.md#22-non-functional-requirements) | Aurora RLS policy on `state_spines` and `dep_summaries` by `tenant_id`; OQ-06 defers mechanism selection to tech spec |
| SS-BE-5 operational ceiling: 60 × ~100 = ~6,000 LLM calls | [build-engine.md FR-041](../../../build-engine.md#21-functional-requirements) | Ceiling is stated and monitored; not enforced as a hard ceiling (per-agent cap is agent-internal); PLAT-BILLING-1 alerts before ceiling |

## Test Requirements

### Unit Tests (minimum 5)

- `should halt orchestrator loop and fire HITL when dispatch_count reaches turn_cap`
- `should resume from existing codify_checkpoint after simulated crash`
- `should log missing_handoff warning and dispatch task when predecessor dep summary absent`
- `should raise ModelRoutingError when role maps to a model not in ALLOWED_MODELS`
- `should block task Done transition when state spine commit times out`
- `should write dep_summary to tenant-scoped store before task status becomes Done`

### Integration Tests (minimum 3)

- `should return 0 tasks for tenant-B querying tenant-A state spine (RLS)`
- `should complete one PDAC cycle and commit state spine with dispatch_count 1`
- `should return 409 when a run is already active for the project`

### E2E Tests

N/A — dark-factory loop is backend-only in M1; covered by integration tests.

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|---|---|---|
| AC-1 | Unit | `should halt orchestrator loop and fire HITL when dispatch_count reaches turn_cap` |
| AC-2 | Unit | `should halt orchestrator loop and fire HITL when dispatch_count reaches turn_cap` |
| AC-3 | Unit | `should resume from existing codify_checkpoint after simulated crash` |
| AC-4 | Unit | `should write dep_summary to tenant-scoped store before task status becomes Done` |
| AC-5 | Unit | `should log missing_handoff warning and dispatch task when predecessor dep summary absent` |
| AC-6 | Unit | `should raise ModelRoutingError when role maps to a model not in ALLOWED_MODELS` |
| AC-7 | Integration | `should return 0 tasks for tenant-B querying tenant-A state spine (RLS)` |
| AC-8 | Unit | `should block task Done transition when state spine commit times out` |

## Dependencies

- **blocked_by:** [TASK-001, TASK-002, TASK-004, TASK-005, TASK-010]
- **unlocks:** [TASK-007, TASK-008]
- **External prerequisites:** `"PLAT-BILLING-1 metering endpoint available"`, `"Anthropic Agent SDK available in uv lockfile"`, `"Aurora state_spines and dep_summaries table migrations run"`, `"TASK-010 repo-bootstrap capability available (ensure_project_repo)"`

## Cost Estimate

- **Complexity:** XL
- **Estimated tokens:** ~20k input, ~10k output
- **Estimated cost:** ~$1.50 (claude-fable-5 pricing at time of writing; verify in MEMORY.md)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided (light — PDAC implementer expands from AC set)
- [x] API contracts defined
- [x] Diagram references included (3 pending — DoR blockers for tech-spec pass)
- [x] Design decisions noted
- [x] Dependencies defined
- [x] Cost estimate provided
- [ ] Tech-spec diagrams created (DoR blocker)
- [ ] OQ-06 (RLS mechanism) resolved in tech spec before implementation of state spine

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing
- [ ] Coverage >= 80% for changed code
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] Docstrings on public APIs
- [ ] Conventional commit(s) created
- [ ] No implementation beyond the task brief's AC and pseudocode (YAGNI)
- [ ] PR references this task and EPIC-011

## Implementation Hints

- The orchestrator loop runs as an ECS Fargate task (not Lambda) because it may run for minutes;
  use a heartbeat mechanism to detect crashes and resume from the last CODIFY checkpoint on
  next dispatch.
- The dep-summary store key must be `(project_iri, task_id, tenant_id)` — using only `task_id`
  is insufficient because task IDs may collide across tenants if the ID scheme is not
  tenant-scoped.
- `ModelRoutingError` should be a custom exception that the orchestrator catches at the dispatch
  level and converts into a `TypedResult {status: FAIL, failure_class: "dependency"}` for the
  TASK-005 retry/HITL machinery — the loop does not short-circuit past the retry logic.
- Use `asyncio.wait_for(aurora.commit_state_spine(...), timeout=0.5)` for the 500 ms state-spine
  commit target; on `asyncio.TimeoutError` log `PLAT-AUDIT-1` event `"state_spine_commit_timeout"`
  and leave the task in `In Progress` (not Done).
- The turn cap should be read from `PLAT-SETTINGS-1` at run start (not per dispatch cycle) and
  stored in the run record — so a settings change mid-run does not retroactively change the cap
  for an active run.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*
