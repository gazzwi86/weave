---
type: Task
title: "Task: TASK-007 — Quality Gates: DoR, DoD & Pre-Scaffold Spec-Review (E12-S1/S2/S6)"
description: "Implement the M1 quality gates: DoR gate (brief completeness before PLAN), DoD gate (QA agent self-runs commands), and pre-scaffold spec-review cascade gate."
tags: [build-engine, arch, task, m1]
status: Backlog
priority: Must Have
entity: build-engine
epic: EPIC-012
milestone: M1
created: 2026-07-01
blocked_by: [TASK-002, TASK-005, TASK-006]
unlocks: [TASK-009]
adr_refs: []
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: 61dfc1553b18b5762902e1d2b3681c82f4ebb26c
expires_on: 2026-12-28
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-01T00:00:00Z
resource: docs/specs/weave/engines/build-engine/m1/tasks/TASK-007.md
---

# Task: TASK-007 — Quality Gates: DoR, DoD & Pre-Scaffold Spec-Review (E12-S1/S2/S6)

## Story

**Epic:** [EPIC-012 — Quality Gates & Spec-Coverage](../../../build-engine.md#epic-012--quality-gates--spec-coverage)
**Status:** Backlog
**Priority:** Must Have

**As a** dark-factory loop
**I want** automated DoR and DoD gate checks plus a pre-scaffold spec-review gate
**So that** tasks are never started with an incomplete brief and never marked done without all
commands passing — silent passes are defects, not acceptable shortcuts

> **FRs covered:** FR-046 (DoR gate in PLAN before DELEGATE), FR-047 (DoD gate — QA agent
> self-runs commands), FR-055 (pre-scaffold spec-review gate — **M1 pass-through stub**: runs the
> brief→PRD→roadmap→tech-spec→impl-ready cascade, records findings, but **never halts**; M2 activates
> cascade-blocking). M2 gates (full QA suite, phase-gate ceremony, coverage audit) are explicitly out
> of scope.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN a task transitions into PLAN, THE SYSTEM SHALL run the DoR gate against the stored `TaskBrief` (TASK-002); WHEN any of the following is absent — EARS ACs, AC-to-test map, design decisions, dep chain, cost estimate — THE SYSTEM SHALL record the gate as `NOT READY`, hold the task in `Ready`, and NOT dispatch to DELEGATE | `test_dor_gate_holds_task_when_brief_missing_ears_acs` |
| AC-2 | WHEN the DoR gate passes all checks, THE SYSTEM SHALL record `gate: "DoR", result: "READY"` in `PLAT-AUDIT-1` and allow the orchestrator to dispatch to DELEGATE | `test_dor_gate_pass_logged_to_audit` |
| AC-3 | WHEN the DoD gate runs after ASSESS, THE SYSTEM SHALL have the QA agent execute each command itself (lint, type-check, coverage, mutation, SAST); WHEN any command returns a non-zero exit code or cannot be invoked, THE SYSTEM SHALL record that command as `NOT VERIFIED` and the overall DoD gate as `FAIL` — a command that cannot run is not skipped | `test_dod_gate_marks_not_verified_for_unrunnable_command` |
| AC-4 | WHEN all DoD gate commands pass (exit code 0), THE SYSTEM SHALL record `gate: "DoD", result: "PASS"` in `PLAT-AUDIT-1` and allow the orchestrator to advance to CODIFY | `test_dod_gate_pass_logged_to_audit` |
| AC-5 | WHEN the pre-scaffold gate runs before a first build, THE SYSTEM SHALL check the cascade (brief present → PRD present → roadmap present → tech-spec present → impl-ready flag set) and RECORD every failing step in `{gate: "pre_scaffold", result: "PROCEED", findings: [{step, reason}]}`; in M1 the gate is a **pass-through stub** that **always PROCEEDS** — it never halts scaffolding (M2 activates blocking — FR-055) | `test_pre_scaffold_gate_records_findings_and_proceeds_on_missing_prd` |
| AC-6 | WHEN a critical gap is detected in the pre-scaffold gate (e.g. tech-spec absent), THE SYSTEM SHALL fire a `PLAT-NOTIFY-1` `spec_gap_critical` event as a **warning** and, in M1, still PROCEED to scaffolding — the finding is recorded but non-blocking (M2 activates blocking — FR-055) | `test_pre_scaffold_critical_gap_fires_notify_and_proceeds` |
| AC-7 | WHEN the DoR gate result is `NOT READY`, THE SYSTEM SHALL include the list of failing checks in `{failing_checks: ["<field>", ...]}` so the replan agent can address specific gaps — a generic error message is not acceptable | `test_dor_gate_not_ready_includes_failing_checks` |

## Implementation

### Pseudocode

```
function run_dor_gate(jwt, task_id):
  claims = cognito.verify(jwt)             # → 401
  brief = aurora.get_brief(task_id, tenant=claims.tenant_id)
  if not brief: return 404 with {"error": "not_found"}

  REQUIRED_FIELDS = [
    ("acceptance_criteria", lambda b: b.acceptance_criteria and
                                       all(ac.criterion.startswith("WHEN ") for ac in b.acceptance_criteria)),
    ("ac_to_test_map",      lambda b: b.ac_to_test_map and
                                       len(b.ac_to_test_map) == len(b.acceptance_criteria)),
    ("dep_chain",           lambda b: b.dep_chain is not None),
    ("cost_estimate",       lambda b: b.cost_estimate is not None),
    ("design_decisions",    lambda b: hasattr(b, "design_decisions") and b.design_decisions),
  ]

  failing = [field for field, check in REQUIRED_FIELDS if not check(brief.content)]

  if failing:
    aurora.update_task(task_id, status="Ready", dor_result="NOT_READY",
                       failing_checks=failing)
    emit_audit("dor_gate", actor=claims.sub, target=task_id,
               diff_summary={"result": "NOT_READY", "failing_checks": failing})
    return 200 with {"gate": "DoR", "result": "NOT_READY", "failing_checks": failing}

  emit_audit("dor_gate", actor=claims.sub, target=task_id,
             diff_summary={"result": "READY"})
  return 200 with {"gate": "DoR", "result": "READY"}


function run_dod_gate(jwt, task_id):
  claims = cognito.verify(jwt)
  task = aurora.get_task(task_id, tenant=claims.tenant_id)

  DOD_COMMANDS = [
    {"name": "lint",        "cmd": "ruff check . --exit-zero-on-no-files"},
    {"name": "type_check",  "cmd": "mypy . --strict"},
    {"name": "coverage",    "cmd": "pytest --cov --cov-fail-under=80"},
    {"name": "mutation",    "cmd": "mutmut run --use-coverage"},
    {"name": "sast",        "cmd": "bandit -r . -ll"},
  ]

  results = []
  overall = "PASS"
  for cmd_spec in DOD_COMMANDS:
    try:
      exit_code = qa_agent.run_command(cmd_spec["cmd"])  # agent actually runs; no simulation
      status = "PASS" if exit_code == 0 else "FAIL"
    except CommandNotFound:
      status = "NOT_VERIFIED"   # cannot run = fail, not skip
    results.append({"name": cmd_spec["name"], "status": status})
    if status != "PASS": overall = "FAIL"

  emit_audit("dod_gate", actor=claims.sub, target=task_id,
             diff_summary={"result": overall, "commands": results})

  if overall == "PASS":
    return 200 with {"gate": "DoD", "result": "PASS", "commands": results}
  return 200 with {"gate": "DoD", "result": "FAIL", "commands": results}


function run_pre_scaffold_gate(jwt, project_iri):
  claims = cognito.verify(jwt)
  spec = aurora.get_project_spec(project_iri, tenant=claims.tenant_id)

  CASCADE_STEPS = [
    ("brief",       lambda s: s.brief_present),
    ("prd",         lambda s: s.prd_present),
    ("roadmap",     lambda s: s.roadmap_present),
    ("tech_spec",   lambda s: s.tech_spec_present),
    ("impl_ready",  lambda s: s.impl_ready_flag),
  ]

  # M1 stub: record every finding, fire warnings, but NEVER halt. M2 activates cascade-blocking (FR-055).
  findings = []
  for step_name, check in CASCADE_STEPS:
    if not check(spec):
      findings.append({"step": step_name, "reason": f"{step_name} not present or not ready"})
      plat_notify_client.fire("spec_gap_critical",
                              project_iri=project_iri, failing_step=step_name)  # warning only

  # M1 always PROCEEDs regardless of findings
  return 200 with {"gate": "pre_scaffold", "result": "PROCEED", "findings": findings}
```

### API Contracts

**`POST /api/tasks/{task_id}/gates/dor`**

Response `200` (always 200 — result in body):

```json
{
  "gate": "string — \"DoR\"",
  "result": "string — READY | NOT_READY",
  "failing_checks": ["string — field name that failed (present only when NOT_READY)"]
}
```

Error responses:

| Status | Condition | Body |
|---|---|---|
| 401 | Missing or invalid JWT | `{"error": "unauthorised"}` + `Www-Authenticate: Bearer` |
| 404 | Task or brief not found | `{"error": "not_found"}` |

**`POST /api/tasks/{task_id}/gates/dod`**

Response `200`:

```json
{
  "gate": "string — \"DoD\"",
  "result": "string — PASS | FAIL",
  "commands": [
    {
      "name": "string — lint | type_check | coverage | mutation | sast",
      "status": "string — PASS | FAIL | NOT_VERIFIED"
    }
  ]
}
```

**`POST /api/projects/{project_iri}/gates/pre-scaffold`**

Response `200`:

```json
{
  "gate": "string — \"pre_scaffold\"",
  "result": "string — always PROCEED in M1 (pass-through stub; M2 adds BLOCKED — FR-055)",
  "findings": [
    { "step": "string — failing cascade step", "reason": "string" }
  ]
}
```

### Diagram References

| Diagram | File | Relevant Section | Summary |
|---|---|---|---|
| Sequence | `../tech-spec/business-process.md` | `#gate-flow-dor-dod` | Gate-flow diagram (E12-S1/S2 in run lifecycle) — see also build-engine.md §4 Gate-Flow Diagram |
| State | N/A | N/A | N/A — gates are checks, not state machines; state transitions are in TASK-005 |
| Data Model | `../tech-spec/data-model.md` | `#gate-results-table` | `gate_results` table: `(task_id, gate, result, failing_checks, commands, recorded_at)` |

Sequence and data model are pending tech-spec additions (DoR blockers).

### Design Decisions

| Decision | Reference | Impact on This Task |
|---|---|---|
| DoD gate: QA agent runs commands itself — no simulation | [build-engine.md FR-047](../../../build-engine.md#21-functional-requirements) | `qa_agent.run_command()` shells out; `CommandNotFound` → `NOT_VERIFIED` (fail); never mock the command result |
| Unrunnable command = `NOT_VERIFIED` = FAIL | [build-engine.md FR-047](../../../build-engine.md#21-functional-requirements) | Prevents silent passes when a tool is missing from the environment; the DoD gate is only as strong as the weakest runnable command |
| Pre-scaffold cascade is an M1 pass-through stub (records findings, always PROCEEDs) | [build-engine.md FR-055](../../../build-engine.md#21-functional-requirements) | M1 collects **all** cascade findings and fires `spec_gap_critical` warnings but **never halts** scaffolding; M2 activates cascade-blocking (short-circuit + BLOCKED on first gap) — FR-055 |
| Gate results persisted to PLAT-AUDIT-1 (not just returned) | [contracts.md `PLAT-AUDIT-1`](../../../../contracts.md#plat-audit-1) | Immutable record of every gate evaluation; audit record must be written before the gate result is returned to the caller |
| M2 gates (full QA, phase-gate ceremony, coverage audit) explicitly out of scope | [build-engine.md §4 Milestone Table](../../../build-engine.md#milestone-table) | Do NOT implement FR-052, FR-053, FR-054 in this task — they land in M2 |

## Test Requirements

### Unit Tests (minimum 5)

- `should return NOT_READY with failing_checks when brief has no acceptance_criteria`
- `should return NOT_READY when AC criterion does not start with WHEN`
- `should return NOT_READY when ac_to_test_map count differs from acceptance_criteria count`
- `should mark command NOT_VERIFIED when command binary not found`
- `should mark overall DoD FAIL when any command returns non-zero exit code`
- `should record findings and PROCEED on pre-scaffold when PRD is absent`
- `should fire PLAT-NOTIFY-1 spec_gap_critical and still PROCEED when pre-scaffold finds critical gap`

### Integration Tests (minimum 3)

- `should record DoR gate result to PLAT-AUDIT-1 on READY result`
- `should record DoD gate result to PLAT-AUDIT-1 on FAIL with command details`
- `should hold task in Ready when DoR gate returns NOT_READY`

### E2E Tests

N/A — gates are backend-only API endpoints in M1; covered by integration tests.

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|---|---|---|
| AC-1 | Unit | `should return NOT_READY with failing_checks when brief has no acceptance_criteria` |
| AC-2 | Integration | `should record DoR gate result to PLAT-AUDIT-1 on READY result` |
| AC-3 | Unit | `should mark command NOT_VERIFIED when command binary not found` |
| AC-4 | Integration | `should record DoD gate result to PLAT-AUDIT-1 on FAIL with command details` |
| AC-5 | Unit | `should record findings and PROCEED on pre-scaffold when PRD is absent` |
| AC-6 | Unit | `should fire PLAT-NOTIFY-1 spec_gap_critical and still PROCEED when pre-scaffold finds critical gap` |
| AC-7 | Unit | `should return NOT_READY with failing_checks when brief has no acceptance_criteria` |

## Dependencies

- **blocked_by:** [TASK-002, TASK-005, TASK-006]
- **unlocks:** [TASK-009]
- **External prerequisites:** `"PLAT-AUDIT-1 emit endpoint available"`, `"PLAT-NOTIFY-1 fire endpoint available"`, `"DoD tooling (ruff, mypy, pytest, mutmut, bandit) installed in agent execution environment"`

## Cost Estimate

- **Complexity:** M
- **Estimated tokens:** ~10k input, ~5k output
- **Estimated cost:** ~$0.55 (claude-fable-5 pricing at time of writing; verify in MEMORY.md)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined
- [x] Diagram references included (1 sequence pending — DoR blocker for tech-spec pass)
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined
- [x] Cost estimate provided
- [ ] Tech-spec gate-flow sequence diagram and gate-results data model created (DoR blockers)

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing
- [ ] Coverage >= 80% for changed code
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] Docstrings on public APIs
- [ ] Conventional commit(s) created
- [ ] No implementation beyond the task brief's AC and pseudocode (YAGNI)
- [ ] PR references this task and EPIC-012

## Implementation Hints

- The DoD gate's `qa_agent.run_command()` must use `subprocess.run` (not `subprocess.call`)
  with `capture_output=True` so exit codes and stderr are captured for the audit record —
  the command name and stderr excerpt (truncated to 500 chars) belong in the `evidence` field.
- `mutmut run --use-coverage` only runs mutations on code covered by pytest; this is the
  delta-scoped variant (FR-029) — not full-codebase mutation. Confirm `mutmut` is in the
  `pyproject.toml` dev dependencies.
- The pre-scaffold gate `impl_ready_flag` should be set by the tech-spec author explicitly
  (not auto-computed) — a YAML field in the project spec record. This prevents
  "ready by default" surprises.
- The PLAT-AUDIT-1 emit for gate results must use a consistent `event_type`:
  `"gate_result_dor"`, `"gate_result_dod"`, `"gate_result_pre_scaffold"` — greppable in the
  decision log without needing the full event body.
- Keep each gate as a separate callable function (not a class method) — the orchestrator
  (TASK-006) calls them at specific loop positions, and simpler callables are easier to mock
  in unit tests.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*
