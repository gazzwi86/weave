---
id: EPIC-011
type: epic
entity: build-engine
title: Dark-Factory Execution Engine
status: backlog
phase: 1
priority: must
mvp: true
depends_on: [EPIC-002, EPIC-005, PLAT-SETTINGS-1, PLAT-BILLING-1, PLAT-NOTIFY-1]
blocks: [EPIC-006, EPIC-007, EPIC-012]
provides: []
consumes: [PLAT-SETTINGS-1, PLAT-BILLING-1, PLAT-NOTIFY-1]
prd_ref: ../prd.md#epic-11-dark-factory-execution-engine
owner: gazzwi86
source: hand-authored
confirmed_by: none
confirmed_on: null
expires_on: 2026-12-30
coverage: n/a
---

# Epic: EPIC-011 - Dark-Factory Execution Engine

## Overview

**Phase:** Phase 1 (MVP — S1–S5) · Phase 2 (S6 preflight/scaffold/self-verify/investigator) · Phase 3 (S6 durable memory)
**PRD Reference:** [prd.md](../prd.md#epic-11-dark-factory-execution-engine)
**Status:** Backlog
**Priority:** Must Have (S1–S5) / Should Have (S6 P1 parts) / Could Have (S6 durable memory)

## Description

Epic 11 owns the loop mechanics that wrap Epic 6's run-mode and governance contracts: the bounded
autonomous loop with a hard turn cap, the per-task PLAN→DELEGATE→ASSESS→CODIFY lifecycle, the
dependency-summary handoff, the tenant-scoped RLS state spine, configurable model routing, and the
orchestrator-side preflight / context-hygiene / scaffolding controls. It is the deterministic,
resumable runtime that schedules and survives a crashed run.

## User Stories

| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|
| TASK-001 | Bounded autonomous run with a hard turn cap (E11-S1) | Backlog | Must Have |
| TASK-002 | Per-task PLAN→DELEGATE→ASSESS→CODIFY lifecycle (E11-S2) | Backlog | Must Have |
| TASK-003 | Per-task dependency-summary handoff (E11-S3) | Backlog | Must Have |
| TASK-004 | State spine as a typed, tenant-scoped contract (E11-S4) | Backlog | Must Have |
| TASK-005 | Configurable dark-factory model routing (provider + model tiering) (E11-S5) | Backlog | Must Have |
| TASK-006 | Orchestrator preflight, context hygiene, and scaffolding gate (E11-S6) | Backlog | Should Have / Could Have (durable memory) |

## Acceptance Criteria (Epic Level)

- [ ] Runaway is impossible on two independent axes: the orchestrator enforces a turn/iteration cap
      on dispatch cycles (default 60, distinct from per-agent caps) **in addition to** the cascading
      cost cap — either cap halts the run to a HITL gate, so a cheap-but-looping run that never trips
      budget still cannot run away.
- [ ] Every halt is deterministically resumable: a task is never left partially committed — CODIFY is
      non-skippable (dependency summary written + state spine committed before Done), so any crash or
      cap-halt resumes from the last completed stage on the persisted RLS state, never from scratch.
- [ ] Tenant isolation holds across the whole runtime: the state spine, dependency summaries, and
      investigator outputs are all tenant-scoped DB rows with row-level security (OQ-06) — a
      tenant-A principal can read zero tenant-B state, summaries, or investigator results.
- [ ] Model routing never silently invokes an unapproved model: routing resolves
      `{role|tier|complexity}→{provider,model}` per environment, uses only confirmed Claude ids on
      the Claude tier, halts the task on a routing miss with no valid provider, and re-runs any
      quality-sensitive local-model output against the Claude tier before phase-gate sign-off.

## Dependencies

- **Blocked by:** EPIC-006 (the run-mode + retry + HITL-gate contracts this loop wraps); EPIC-005
  (the typed brief PLAN reads); EPIC-002 (project record the state spine scopes to); Weave Platform
  `PLAT-SETTINGS-1` (turn caps, routing overrides, tenancy cascade), `PLAT-BILLING-1` (per-provider
  metering), `PLAT-NOTIFY-1` (run-halted / routing-degraded events); runtime resolution OQ-02; tenant
  isolation OQ-06.
- **Blocks:** EPIC-004 (Ready lane + task tree derive from the state spine `ready` resolver +
  `blocked_by` edges); EPIC-003 (tasks-in-flight + forecast read the spine); EPIC-012 (phase-gate
  ceremony evaluates the `phase-complete` query).

## Technical Notes

- **Partition with Epic 6:** Epic 6 owns run modes (E6-S2), typed-result + four-class retry (E6-S3),
  and HITL gates / replan / no-self-approval (E6-S4); Epic 11 references these and owns the wrapping
  loop mechanics.
- State-spine schema (FR-044): `{ project_iri, phase, epics:[{id,title,status}],
  tasks:[{id,epic,title,status,blocked_by:[]}] }` with `backlog → in_progress → review → done`;
  persisted as a per-tenant DB table with RLS; committed after every task (the resumability
  contract); exposes a `ready` DAG-frontier resolver and a `phase-complete` query.
- Model routing spans three backends (Ollama / Bedrock / Anthropic API); Bedrock use is minimised for
  cost; heavy planning → Claude tier, simpler work → Ollama where capable (`_dev-environment.md` §3).
- S6 splits across phases: preflight, scaffolding gate, self-verification, and isolated investigators
  are Phase 2 (P1); durable memory + structured elicitation are Phase 3 (P2 / FR-058). Investigators
  return a pointer + short summary (not raw source) and cannot spawn sub-investigators (OQ-11).

---
*Generated by Weave Architect agent.*
