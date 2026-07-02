---
type: Task
title: "Task: TASK-005 — Spec Lifecycle & Run Modes (E6-S1 to E6-S4)"
description: "Implement the spec lifecycle state machine, run modes, typed-result + four-class retry contract, and HITL gate mechanics that govern every dark-factory run."
tags: [build-engine, arch, task, m1]
status: Backlog
priority: Must Have
entity: build-engine
epic: EPIC-006
milestone: M1
created: 2026-07-01
blocked_by: []
unlocks: [TASK-006, TASK-007]
adr_refs: [ADR-002]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: 61dfc1553b18b5762902e1d2b3681c82f4ebb26c
expires_on: 2026-12-28
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-01T00:00:00Z
resource: docs/specs/weave/engines/build-engine/m1/tasks/TASK-005.md
---

# Task: TASK-005 — Spec Lifecycle & Run Modes (E6-S1 to E6-S4)

## Story

**Epic:** [EPIC-006 — Spec Lifecycle & Run Modes](../../../build-engine.md#epic-006--spec-lifecycle--run-modes)
**Status:** Backlog
**Priority:** Must Have

**As a** dark-factory orchestrator
**I want** a typed spec lifecycle state machine, configurable run modes, a typed-result + retry
contract, and fail-closed HITL gate mechanics with no-self-approval enforcement
**So that** every autonomous run is governed, classifiable on failure, and auditable without
any agent being able to approve its own work

> **FRs covered:** FR-021 (spec lifecycle state machine), FR-022 (run modes), FR-023 (typed-result
> contract), FR-024 (four-class retry taxonomy + per-class ceiling), FR-025 (HITL gate via
> `PLAT-NOTIFY-1`), FR-026 (no-self-approval via `PLAT-IDENTITY-1`).

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN a spec transitions between states, THE SYSTEM SHALL enforce the valid FSM edges (`Draft→Spec Review→Approved→In Progress→Complete`, `In Progress↔Blocked`); any invalid transition MUST return `409 {"error": "invalid_transition", "current": "<state>", "requested": "<state>"}` | `test_invalid_lifecycle_transition_returns_409` |
| AC-2 | WHEN an agent emits a `TypedResult` with `status: "FAIL"`, THE SYSTEM SHALL classify the failure into exactly one of `logic \| syntax \| dependency \| spec_ambiguity`, record it with `evidence` and `retry_recommended`, and apply the per-class retry ceiling from the project settings | `test_typed_result_fail_classified_into_four_classes` |
| AC-3 | WHEN the per-class retry ceiling is reached for a task, THE SYSTEM SHALL route the task to a HITL gate via `PLAT-NOTIFY-1` and NOT attempt another retry | `test_ceiling_hit_routes_to_hitl_not_retry` |
| AC-4 | WHEN a HITL gate event is received from `PLAT-NOTIFY-1` with `action: "approve"`, THE SYSTEM SHALL resume the task from its current state; WHEN `action: "reject"`, THE SYSTEM SHALL halt the run and mark it `Blocked`; WHEN `action: "amend"`, THE SYSTEM SHALL transition to `Draft` for replan | `test_hitl_gate_approve_resume_reject_halt` |
| AC-5 | WHEN the audit service (`PLAT-AUDIT-1`) is unreachable at HITL gate evaluation time, THE SYSTEM SHALL keep the gate CLOSED (fail-closed) — it MUST NOT auto-approve and MUST fire a `PLAT-NOTIFY-1` `audit_outage` alert | `test_hitl_gate_fail_closed_on_audit_outage` |
| AC-6 | WHEN a HITL approval is submitted, THE SYSTEM SHALL verify via `PLAT-IDENTITY-1` that the approving principal IRI differs from the principal IRI of the agent that produced the output being approved; WHEN they match, THE SYSTEM SHALL return `403 {"error": "self_approval_not_permitted"}` | `test_no_self_approval_enforced_via_plat_identity` |
| AC-7 | WHEN a run operates in `spike` mode and completes, THE SYSTEM SHALL block any call to `POST /api/operations/apply` (CE-WRITE-1) and any merge to a protected branch originating from that run; violation attempts MUST return `403 {"error": "spike_write_back_forbidden"}` | `test_spike_mode_blocks_write_back` |
| AC-8 | WHEN a `TypedResult` is emitted, THE SYSTEM SHALL persist it to `PLAT-AUDIT-1` with `{actor_principal_iri, engine: "build", event_type: "agent_result", target_iri: task_iri, diff_summary: {status, failure_class, evidence}}` | `test_typed_result_persisted_to_audit` |

## Implementation

### Pseudocode

**Lifecycle state machine:**

```python
VALID_TRANSITIONS = {
  "Draft":       {"Spec Review"},
  "Spec Review": {"Approved", "Draft"},         # Draft = returned for revision
  "Approved":    {"In Progress"},
  "In Progress": {"Complete", "Blocked"},
  "Blocked":     {"In Progress", "Draft"},       # Draft = replan
  "Complete":    set(),                          # terminal
}

function transition_spec(jwt, spec_id, requested_state):
  claims = cognito.verify(jwt)             # → 401
  spec = aurora.get_spec(spec_id, tenant=claims.tenant_id)
  if not spec: return 404 with {"error": "not_found"}

  if requested_state not in VALID_TRANSITIONS[spec.status]:
    return 409 with {"error": "invalid_transition", "current": spec.status,
                     "requested": requested_state}

  aurora.update_spec(spec_id, status=requested_state, updated_at=now())
  emit_audit("spec_transition", actor=claims.sub, target=spec_id,
             diff_summary={"from": spec.status, "to": requested_state})
  return 200 with {"spec_id": spec_id, "status": requested_state}
```

**TypedResult + retry contract:**

```python
class TypedResult(BaseModel):
  status: Literal["PASS", "FAIL"]
  failure_class: Literal["logic", "syntax", "dependency", "spec_ambiguity"] | None
  evidence: str | None
  retry_recommended: bool

function handle_agent_result(jwt, task_id, result: TypedResult):
  claims = cognito.verify(jwt)
  task = aurora.get_task(task_id, tenant=claims.tenant_id)

  emit_audit("agent_result", actor=claims.sub, target=task.iri,
             diff_summary=result.model_dump())   # PLAT-AUDIT-1 — AC-8

  if result.status == "FAIL":
    ceiling = get_retry_ceiling(task.project_iri, result.failure_class)  # PLAT-SETTINGS-1
    retry_count = aurora.increment_retry(task_id, result.failure_class)

    if retry_count > ceiling:
      fire_hitl_gate(task_id, claims.sub, result)   # PLAT-NOTIFY-1; ceiling-hit → HITL
      aurora.update_task(task_id, status="Blocked", blocked_reason="ceiling_hit")
      return {"action": "hitl_gate"}

    return {"action": "retry", "retry_count": retry_count}

  aurora.update_task(task_id, status="ASSESS_PASSED")
  return {"action": "proceed"}


function fire_hitl_gate(task_id, submitting_principal, result):
  # Check audit availability (fail-closed)
  try:
    plat_audit_client.health_check()             # lightweight GET
  except ConnectionError:
    plat_notify_client.fire("audit_outage", task_id=task_id)
    raise HitlGateClosedError("audit service unreachable")

  plat_notify_client.fire("hitl_gate",
                           task_id=task_id,
                           submitting_principal=submitting_principal,
                           evidence=result.evidence)


function handle_hitl_response(jwt, task_id, action, amendment=None):
  claims = cognito.verify(jwt)
  task = aurora.get_task(task_id, tenant=claims.tenant_id)

  # No-self-approval (FR-026, AC-6)
  submitting_principal = task.last_agent_principal_iri
  approving_principal = plat_identity_client.resolve(claims.sub)  # PLAT-IDENTITY-1
  if approving_principal.iri == submitting_principal:
    return 403 with {"error": "self_approval_not_permitted"}

  if action == "approve":
    aurora.update_task(task_id, status="In Progress")
    return 200 with {"action": "resumed"}
  elif action == "reject":
    aurora.update_task(task_id, status="Blocked", blocked_reason="hitl_rejected")
    return 200 with {"action": "halted"}
  elif action == "amend":
    aurora.update_task(task_id, status="Draft")
    return 200 with {"action": "replan"}
```

**Spike-mode write-back guard (middleware):**

```python
def spike_write_back_guard(request, task):
  if task.run_mode == "spike" and request.path.startswith("/api/operations/apply"):
    return 403 with {"error": "spike_write_back_forbidden"}
```

### API Contracts

**`POST /api/specs/{spec_id}/transition`**

Request body:

```json
{
  "requested_state": "string — one of: Draft | Spec Review | Approved | In Progress | Complete | Blocked (required)"
}
```

Response `200`:

```json
{ "spec_id": "string", "status": "string — new state" }
```

Error responses:

| Status | Condition | Body |
|---|---|---|
| 401 | Missing or invalid JWT | `{"error": "unauthorised"}` + `Www-Authenticate: Bearer` |
| 404 | Spec not found or belongs to another tenant | `{"error": "not_found"}` |
| 409 | Requested transition not valid from current state | `{"error": "invalid_transition", "current": "<state>", "requested": "<state>"}` |

**`POST /api/tasks/{task_id}/result`**

Request body:

```json
{
  "status": "string — PASS | FAIL (required)",
  "failure_class": "string | null — logic | syntax | dependency | spec_ambiguity",
  "evidence": "string | null — human-readable evidence string",
  "retry_recommended": "boolean (required)"
}
```

Response `200`:

```json
{
  "action": "string — proceed | retry | hitl_gate",
  "retry_count": "integer | null — present when action is retry"
}
```

**`POST /api/tasks/{task_id}/hitl`**

Request body:

```json
{
  "action": "string — approve | reject | amend (required)",
  "amendment": "string | null — required when action is amend"
}
```

Response `200`:

```json
{ "action": "string — resumed | halted | replan" }
```

Error responses:

| Status | Condition | Body |
|---|---|---|
| 403 | Approving principal matches submitting principal | `{"error": "self_approval_not_permitted"}` |
| 422 | `action` not in allowed set | `{"error": "validation_error", "field": "action"}` |

### Diagram References

| Diagram | File | Relevant Section | Summary |
|---|---|---|---|
| State | `../tech-spec/business-process.md` | `#spec-lifecycle-fsm` | Pending — to be added to tech-spec before implementation starts (DoR blocker) |
| Sequence | `../tech-spec/business-process.md` | `#hitl-gate-sequence` | Pending — HITL gate notify→respond flow (DoR blocker) |
| Data Model | `../tech-spec/data-model.md` | `#specs-tasks-tables` | Pending — to be added to tech-spec before implementation starts (DoR blocker) |

### Design Decisions

| Decision | Reference | Impact on This Task |
|---|---|---|
| HITL fail-closed — audit outage keeps gate closed | [build-engine.md decision B4](../../../build-engine.md#key-decisions) | `plat_audit_client.health_check()` before any HITL evaluation; `ConnectionError` → gate stays closed + notify |
| No-self-approval via PLAT-IDENTITY-1 | [build-engine.md decision B4](../../../build-engine.md#key-decisions) + [contracts.md `PLAT-IDENTITY-1`](../../../../contracts.md#plat-identity-1) | Approving principal IRI compared to `task.last_agent_principal_iri`; principal IRI from `PLAT-IDENTITY-1` lookup |
| Four-class retry taxonomy: logic/syntax/dependency/spec_ambiguity | [build-engine.md FR-024](../../../build-engine.md#21-functional-requirements) | `TypedResult.failure_class` is a Pydantic `Literal` — rejects any other string at validation time |
| Spike mode: no write-back, no prod merge | [build-engine.md EPIC-006 AC](../../../build-engine.md#epic-006--spec-lifecycle--run-modes) | `spike_write_back_guard` middleware intercepts CE-WRITE-1 calls from spike runs; enforced at API layer |
| Per-class retry ceilings from PLAT-SETTINGS-1 | [contracts.md `PLAT-SETTINGS-1`](../../../../contracts.md#plat-settings-1) | Ceiling read once at pipeline start, cached per-run; ceiling hit → HITL, never an infinite loop |

## Test Requirements

### Unit Tests (minimum 5)

- `should return 409 when transition from Complete to any state is requested`
- `should return 409 when transition Draft→In Progress is requested (skipping Approved)`
- `should classify FAIL result and increment retry counter per failure class`
- `should route to HITL when retry ceiling is reached for a failure class`
- `should return 403 when approving principal IRI matches submitting principal IRI`
- `should keep HITL gate closed when PLAT-AUDIT-1 health check fails`
- `should return 403 when spike-mode task attempts write-back`

### Integration Tests (minimum 3)

- `should persist TypedResult to PLAT-AUDIT-1 on FAIL result`
- `should fire PLAT-NOTIFY-1 hitl_gate event when ceiling is hit`
- `should resume task to In Progress on approve HITL response`

### E2E Tests

N/A — no UI surface in M1; covered by integration tests.

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|---|---|---|
| AC-1 | Unit | `should return 409 when transition from Complete to any state is requested` |
| AC-2 | Unit | `should classify FAIL result and increment retry counter per failure class` |
| AC-3 | Unit | `should route to HITL when retry ceiling is reached for a failure class` |
| AC-4 | Integration | `should resume task to In Progress on approve HITL response` |
| AC-5 | Unit | `should keep HITL gate closed when PLAT-AUDIT-1 health check fails` |
| AC-6 | Unit | `should return 403 when approving principal IRI matches submitting principal IRI` |
| AC-7 | Unit | `should return 403 when spike-mode task attempts write-back` |
| AC-8 | Integration | `should persist TypedResult to PLAT-AUDIT-1 on FAIL result` |

## Dependencies

- **blocked_by:** []
- **unlocks:** [TASK-006, TASK-007]
- **External prerequisites:** `"PLAT-NOTIFY-1 event webhook endpoint available"`, `"PLAT-AUDIT-1 emit and health-check endpoints available"`, `"PLAT-IDENTITY-1 principal resolution endpoint available"`, `"PLAT-SETTINGS-1 per-class ceiling read available"`

## Cost Estimate

- **Complexity:** L
- **Estimated tokens:** ~13k input, ~6k output
- **Estimated cost:** ~$0.80 (claude-fable-5 pricing at time of writing; verify in MEMORY.md)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined
- [x] Diagram references included (3 pending — DoR blockers for tech-spec pass)
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined
- [x] Cost estimate provided
- [ ] Tech-spec diagrams created (DoR blocker)

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing
- [ ] Coverage >= 80% for changed code
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] Docstrings on public APIs
- [ ] Conventional commit(s) created
- [ ] No implementation beyond the task brief's AC and pseudocode (YAGNI)
- [ ] PR references this task and EPIC-006

## Implementation Hints

- The FSM VALID_TRANSITIONS dict is the single source of truth; keep it at module level so
  both the API handler and any CLI tool use the same definition.
- `plat_audit_client.health_check()` should be a lightweight `GET /api/audit/health` with a
  200 ms timeout (not the default request timeout); on `asyncio.TimeoutError` treat as
  `ConnectionError` for fail-closed purposes.
- Store `task.last_agent_principal_iri` at the moment the agent emits a TypedResult (not at
  task start) — the same task may be retried by different agents and the no-self-approval check
  must target the most recent submitter.
- Per-class retry ceilings should have sensible defaults (e.g. `logic: 3`, `syntax: 2`,
  `dependency: 1`, `spec_ambiguity: 1`) defined as constants, overridable by PLAT-SETTINGS-1.
- The `spike_write_back_guard` middleware should check `task.run_mode` from the DB before every
  outbound call to `POST /api/operations/apply` — do not rely on the caller correctly tagging
  the request.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*
