---
type: Task
title: "Task: TASK-012 — Direct Project Prompt (FR-065): Role-Gated Prompt → Dark-Factory Run"
description: "Prompt box on the Dashboard: editors/admins instruct the agent to change the
  project; the prompt enqueues a standard dark-factory run (trigger=prompt) whose PLAN stage
  synthesises a typed FR-018 brief from the prompt (Architect agent) before the FR-046 DoR
  gate; produces PRs/amendments to code, specs, and backlog on the external repo; readers get
  403 + audit."
tags: [build-engine, arch, task, v1, ui]
status: Backlog
priority: Should Have
entity: build-engine
epic: EPIC-003
milestone: v1.0
created: 2026-07-08
blocked_by: [TASK-003, TASK-010]
unlocks: []
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

# Task: TASK-012 — Direct Project Prompt (FR-065): Role-Gated Prompt → Dark-Factory Run

## Story

**Epic:** [EPIC-003 — Project Dashboard](../../../build-engine.md#epic-003)
**Status:** Backlog · **Priority:** Should Have

**As a** project editor
**I want** to type "change what this API returns" on the project and watch the agent run
**So that** small directed changes don't need the full Request Studio intake ceremony

> **FRs covered:** FR-065 (+ FR-060 gating). The run **reuses the M1 dark-factory lifecycle
> verbatim** — turn caps, retry taxonomy, safety gates, HITL gates, budget checks (TASK-004),
> cost attribution (TASK-003), external-repo targets (FR-061). This task adds an entry point
> plus **one piece of real new PLAN behaviour: prompt→brief synthesis (AC-7/AC-8)**. A raw
> prompt carries none of what the FR-046 DoR gate requires (EARS ACs, AC-to-test map, dep
> chain, cost estimate) — so PLAN must have the Architect agent synthesise a typed
> FR-018-conformant brief from the prompt before anything is dispatched. This is a synthesis
> step, not a mere context-source branch.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN a project editor/admin (or company/domain admin-owner) submits a prompt, THE SYSTEM SHALL persist a `project_prompts` row, enqueue a dark-factory run with `trigger = 'prompt'` through the existing lifecycle enqueue path, and return 202 with the run handle | `should enqueue dark-factory run with trigger prompt when editor submits prompt` |
| AC-2 | WHEN a reader (no edit role) submits a prompt, THE SYSTEM SHALL return 403 and record the denial to PLAT-AUDIT-1 | `should return 403 and audit entry when reader submits prompt` |
| AC-3 | WHEN the prompt run executes, THE SYSTEM SHALL scope it to the project (pinned CE version, project repo) and produce PRs/amendments to the project's **code, specs, and/or backlog** as the change requires, opened against the external repo (FR-061) | `should open prs against external repo from prompt run` |
| AC-4 | WHEN the run is in flight, THE SYSTEM SHALL show visible run status on the Dashboard (queued → running → gates → done/halted) via the existing run-status channel | `should show visible run status for prompt run` |
| AC-5 | WHEN the prompt run hits any existing cap or gate (turn cap, budget breach, retry ceiling, HITL), THE SYSTEM SHALL behave exactly as a request-triggered run — no prompt-specific bypass exists | `should apply caps and gates identically to prompt runs` |
| AC-6 | WHEN the prompt text is empty or exceeds the length limit, THE SYSTEM SHALL reject with 422 before any run is enqueued | `should reject empty or oversized prompt` |
| AC-7 | WHEN a prompt run reaches PLAN, THE SYSTEM SHALL have the Architect agent (FR-045 routing — architect role, `claude-fable-5` tier) synthesise one or more typed FR-018-conformant task briefs from the prompt text + project spec/backlog state + anatomy index — EARS ACs, AC-to-test map, DoR/DoD checklists, dep chain, token cost estimate — and SHALL run the FR-046 DoR gate on the synthesised brief before DELEGATE | `should synthesise typed brief from prompt before delegate` |
| AC-8 | WHEN the synthesised brief fails the DoR gate (e.g. the prompt is too vague to yield testable ACs), THE SYSTEM SHALL hold the task in Ready with "brief incomplete" and route to replan/HITL — the raw prompt is never dispatched to the Engineer (E5 AC applies verbatim) | `should hold prompt run when synthesised brief fails DoR` |

## Implementation

### Pseudocode

```
POST /api/projects/{id}/prompts (Depends(require_project_role(PROMPT))):   # AC-2 via guard
    validate 1 <= len(text) <= PROMPT_MAX (settings default)               # AC-6
    prompt = repo.prompts.insert(project, principal, text)
    run = lifecycle.enqueue_run(project_iri, trigger="prompt",             # AC-1: existing
                                context={prompt_id, prompt_text})          #   enqueue path
    repo.prompts.set_run_id(prompt.id, run.id)
    return 202 {run_id, prompt_id}

orchestrator (existing loop — one real PLAN addition):
    trigger == "prompt" -> PLAN runs BRIEF SYNTHESIS first (AC-7):
        briefs = architect_agent.synthesise_briefs(       # FR-018 schema; FR-045 routing
            prompt_text, project.spec_state, project.backlog_state, anatomy_index)
        for brief in briefs:
            dor = run_dor_gate(brief)                     # FR-046 — same gate, no bypass
            if dor.failed:
                hold(task, reason="brief incomplete"); route_to_replan()      # AC-8
    everything downstream identical (AC-5): DELEGATE on the synthesised brief,
    DoD, safety gates, budget checkpoint, HITL, ScmDriver PR to external repo

UI (Dashboard, below the tiles):
    <PromptBox/> visible to all, disabled+tooltip for readers (UX mirror; 403 is the boundary)
    submit -> optimistic status chip subscribing to run-status SSE           # AC-4
```

### API Contracts

`POST /api/projects/{id}/prompts` p95 ≤ 500 ms, 202 `{run_id, prompt_id}` (v1-delta §3).
Errors: 403 (+audit), 404, 422 (validation), 500. Run status rides the existing run channel —
no new status endpoint. Consumes: lifecycle enqueue (M1), Role Guard (TASK-002),
`project_prompts` (TASK-001), cost attribution rides TASK-003 (prompt-run dispatches carry
`run_id`; drafting-side tokens attribute with `task_id` NULL per ADR-008 AC-2).

### Diagram References

| Diagram | File | Section | Summary |
|---|---|---|---|
| Architecture delta | `../../tech-spec/v1-delta.md` | §2 diagram | Prompt Dispatcher → orchestrator (single entry point preserved) |
| Run lifecycle | `../../tech-spec/business-process.md` | run-lifecycle diagram | The unchanged loop the prompt run rides |
| Epic AC | `../../../build-engine.md` | §EPIC-003 E3-S3 | Canonical FR-065 behaviour incl. examples |

### Design Decisions

| Decision | Reference | Impact |
|---|---|---|
| Prompt = new trigger on the existing lifecycle, zero new run machinery | `v1-delta.md` §2 / invariant | One orchestrator entry point stays true (invariants.md verify-by); all governance inherited by construction |
| Prompt→brief synthesis is a PLAN step, not a DoR bypass | AC-7/AC-8, FR-018 × FR-046 | The DoR gate is untouched; the synthesis feeds it a real brief — a vague prompt fails honestly instead of dispatching blind |
| PROMPT is its own guard action class (editors have it) | FR-065/FR-060 | Readers structurally excluded; future per-project prompt lockdown is a one-line action-set change |
| Prompt box visible-but-disabled for readers | UX mirror rule (TASK-006 AC-4 posture) | Discoverability without implying permission; server 403 remains the boundary |
| Prompt length limit is a settings value | AC-6 | Abuse control tunable per company/domain; no magic constant |

## Test Requirements

### Unit Tests (minimum 3)

- `should reject empty or oversized prompt`
- `should persist prompt row linked to run id`
- `should disable prompt box for readers with explanatory tooltip` (component)

### Integration Tests (minimum 5)

- `should synthesise typed brief from prompt before delegate` (stub Architect agent returns a
  valid FR-018 brief; asserts DoR gate ran on it and DELEGATE received the brief, not the
  prompt)
- `should hold prompt run when synthesised brief fails DoR` (stub brief missing AC-to-test
  map; asserts Ready hold with "brief incomplete")

- `should enqueue dark-factory run with trigger prompt when editor submits prompt` (asserts
  run row `trigger='prompt'` + prompt row linkage — Law B)
- `should return 403 and audit entry when reader submits prompt` (audit stub payload asserted)
- `should apply caps and gates identically to prompt runs` (prompt run against a seeded
  breach fixture halts at checkpoint — reuses TASK-004's fixture)

### E2E Tests (Playwright, minimum 1)

- `should submit prompt and watch run status end to end` (editor session: prompt → 202 →
  status chip transitions via SSE against the stub runtime; `project_prompts` row asserted
  server-side; SCM stub received the PR call — Law B full loop)

### AC-to-Test Mapping

| AC | Type | Test |
|---|---|---|
| AC-1 | Integration | `should enqueue dark-factory run with trigger prompt when editor submits prompt` |
| AC-2 | Integration | `should return 403 and audit entry when reader submits prompt` |
| AC-3 | E2E | `should submit prompt and watch run status end to end` (SCM stub PR assertion) |
| AC-4 | E2E | same E2E, status chip transitions |
| AC-5 | Integration | `should apply caps and gates identically to prompt runs` |
| AC-6 | Unit | `should reject empty or oversized prompt` |
| AC-7 | Integration | `should synthesise typed brief from prompt before delegate` |
| AC-8 | Integration | `should hold prompt run when synthesised brief fails DoR` |

## Dependencies

- **blocked_by:** [TASK-003, TASK-010] (cost attribution live for prompt runs; the Dashboard
  page this box mounts on)
- **unlocks:** []
- **External prerequisites:** M1 lifecycle enqueue + orchestrator + ScmDriver (live); agent
  runtime + SCM stubbed in tests (Law F)

## Cost Estimate

- **Complexity:** L
- **Estimated tokens:** ~22k input, ~11k output (brief-synthesis PLAN step on top of the
  entry point + UI)
- **Estimated cost:** ~$0.80 (claude-sonnet-5 implementation tier)

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
- [ ] All specified tests passing (incl. the full-loop E2E)
- [ ] Coverage ≥ 80% changed code; delta mutation ≥ 70%
- [ ] Lighthouse: Performance ≥ 90, Accessibility ≥ 95, Best-practices ≥ 90 on the dashboard
      route with the prompt box mounted (v1-delta §6)
- [ ] `trigger` greppable with no second orchestrator entry point (invariants.md verify-by)
- [ ] Brief-synthesis test greppable (invariants.md verify-by: `should synthesise typed brief
      from prompt`)
- [ ] Reader-403 test greppable (invariants.md verify-by)
- [ ] `ui_verify` passes on the prompt box; design tokens only
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] Docstrings/JSDoc on public APIs/components
- [ ] Conventional commit(s); PR references this task and EPIC-003

## Implementation Hints

- The brief-synthesis step (AC-7) is the only orchestrator change — reuse the M1 Architect
  brief-generation path (FR-018, E5-S1) with the prompt + project state as its input; do NOT
  build a parallel PLAN variant, and do NOT shortcut it to a context-source branch — the DoR
  gate needs a real brief to evaluate.
- Spike-mode rules do NOT apply here: a prompt run is a normal governed run (write-back and
  PR both allowed, gated). Do not route prompts through spike mode as a shortcut — spike
  forbids prod merge, which defeats FR-065.
- The examples in the FR ("fix this inaccuracy", "change what this API returns / the error
  message it throws") are the E2E prompt fixtures — use one verbatim.
- Backlog amendments (AC-3) mean spec/task file changes in the external repo's spec tree —
  the same ScmDriver PR path as code; no Weave-internal backlog mutation.

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
