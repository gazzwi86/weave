---
type: Task
title: "Task: TASK-017 — Kanban Board, Task Tree & Filters (FR-015/016/017)"
description: "Six-lane board over the state spine with retry chips from the E6-S3 taxonomy,
  a dependency task-tree view with flagged orphans, board filters with honest empty states,
  and a visible state legend (never colour alone). Board + tree endpoints included."
tags: [build-engine, arch, task, v1, ui]
status: Backlog
priority: Must Have
entity: build-engine
epic: EPIC-004
milestone: v1.0
created: 2026-07-08
blocked_by: [TASK-011]
unlocks: []
adr_refs: []
source: hand-authored
confirmed_by: "none"
confirmed_on: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/build-engine/v1/tasks/TASK-017.md
---

# Task: TASK-017 — Kanban Board, Task Tree & Filters (FR-015/016/017)

## Story

**Epic:** [EPIC-004 — Kanban & Task Management](../../../build-engine.md#epic-004)
**Status:** Backlog · **Priority:** Must Have

**As a** delivery manager
**I want** dark-factory work visible on a six-lane board and a dependency tree, filterable,
with agent state always legible
**So that** I can see what is flowing, what is blocked, and what failed — without reading logs

> **FRs covered:** FR-015 (board + retry chips), FR-016 (task tree + orphan flagging), FR-017
> (filters + empty state). Reads the M1 state spine (`build_tasks`, FR-044) and the E6-S3
> typed-result/retry taxonomy — display only, no new run state.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN the board loads, THE SYSTEM SHALL render six lanes (Backlog→Ready→In Progress→Review→QA→Done) from the state spine, ≤ 1 s with 50 tasks, lane filter switch ≤ 100 ms | `should render six lanes within budget` |
| AC-2 | WHEN a task failed, THE SYSTEM SHALL show its retry chip with the E6-S3 failure class and per-class ceiling state (e.g. "syntax 2/3"); a ceiling-hit task shows its HITL-escalated state — a task is never silently RUNNING after an agent crash | `should show failure class and retry ceiling on card` |
| AC-3 | WHEN the task tree renders and a `blocked_by` predecessor is missing, THE SYSTEM SHALL render that node flagged ("missing dependency") rather than dropping it | `should flag missing blocked_by predecessor instead of dropping node` |
| AC-4 | WHEN a board filter (All/In flight/Blocked/Self-improvement-flagged/This phase) resolves to zero tasks, THE SYSTEM SHALL show an empty-state message and reset to "All" — never a blank board | `should show empty state and reset to All when filter matches zero tasks` |
| AC-5 | WHEN an invalid/unknown filter value arrives (e.g. stale URL), THE SYSTEM SHALL treat it as the empty-state case (AC-4), not render a broken board | `should treat invalid filter as empty state` |
| AC-6 | WHEN agent-state colour-coding is used, THE SYSTEM SHALL display a visible legend on both the board and the tree — state is never conveyed by colour alone | `should display state legend alongside colour coding` |

## Implementation

### Pseudocode

```
GET /api/projects/{id}/board:
    tasks = repo.build_tasks.for_project(tenant, project)      # one query, spine statuses
    lanes = group_by(tasks, LANE_OF_STATUS)                    # fixed six-lane mapping
    chips = latest_typed_result per failed task (failure_class, attempts, ceiling)
    return {lanes, legend: STATE_LEGEND}

GET /api/projects/{id}/task-tree:
    tasks = same query + blocked_by edges
    nodes = [...]; for dep in blocked_by not in tasks: node.flags += missing_dependency  # AC-3
    return {nodes, edges, legend: STATE_LEGEND}

UI /build/projects/[id]/board:
    <FilterBar filters=FIVE_FILTERS urlState/>                 # unknown value -> AC-5 path
    <Board lanes/> cards: status colour + text label + RetryChip
    zero visible -> <EmptyState resetTo="All"/>                # AC-4
    <Legend/> pinned on board AND tree                         # AC-6
    tree view: existing SPA graph/tree primitive if the design system has one; else
    a simple layered DAG list — NOT a new graph-rendering dependency
```

### API Contracts

`GET /api/projects/{id}/board` p95 ≤ 500 ms · `GET /api/projects/{id}/task-tree` p95 ≤ 500 ms
(v1-delta §3; render budgets are the NFR: board ≤ 1 s @ 50 tasks, filter switch ≤ 100 ms).
Reads state spine + `gate_results`/typed-result rows — no mutation routes (board is a view;
tasks move lanes only via the orchestrator).

### Diagram References

| Diagram | File | Section | Summary |
|---|---|---|---|
| Architecture delta | `../../tech-spec/v1-delta.md` | §2 diagram | Kanban → PM Surface API → repo_layer |
| Data model | `../../tech-spec/data-model.md` | §Specs Tasks Tables / §State Spine | The rows and statuses the lanes map from |
| Retry taxonomy | `../../../build-engine.md` | §EPIC-006 AC | Four failure classes + per-class ceiling semantics |

### Design Decisions

| Decision | Reference | Impact |
|---|---|---|
| Board is read-only in v1 (no drag between lanes) | FR-015 scope | Lane position derives from spine status; a human dragging a card would lie about run state — moves happen via HITL/replan actions, not the board |
| Lane mapping is one constants table | AC-1 | Status→lane is greppable and test-pinned; no scattered mapping logic |
| Filter state in URL | AC-5 | Shareable views; invalid params exercise the empty-state path deterministically |
| No new graph-rendering dependency for the tree | Law A / pseudocode | Design-system primitive or layered list; GE's canvas is post-v1 and out of scope by ruling |

## Test Requirements

### Unit Tests (minimum 4)

- `should render six lanes within budget` (component test; budget assertion in E2E)
- `should show failure class and retry ceiling on card`
- `should treat invalid filter as empty state`
- `should display state legend alongside colour coding` (a11y assertion: text labels present)

### Integration Tests (minimum 2)

- `should flag missing blocked_by predecessor instead of dropping node` (seeded spine with a
  dangling edge)
- `should group spine statuses into six lanes` (endpoint against seeded 50-task fixture)

### E2E Tests (Playwright, minimum 2 — Law B)

- `should show empty state and reset to All when filter matches zero tasks` (real board,
  filter to zero; DOM asserted)
- `should render board within one second at fifty tasks` (seeded fixture; performance
  assertion + lane switch ≤ 100 ms)

### AC-to-Test Mapping

| AC | Type | Test |
|---|---|---|
| AC-1 | Integration + E2E | `should group spine statuses into six lanes` / `should render board within one second at fifty tasks` |
| AC-2 | Unit | `should show failure class and retry ceiling on card` |
| AC-3 | Integration | `should flag missing blocked_by predecessor instead of dropping node` |
| AC-4 | E2E | `should show empty state and reset to All when filter matches zero tasks` |
| AC-5 | Unit | `should treat invalid filter as empty state` |
| AC-6 | Unit | `should display state legend alongside colour coding` |

## Dependencies

- **blocked_by:** [TASK-011] (guard family on the router; board reads are company-open but
  ride the same router registration)
- **unlocks:** [] (TASK-018's Task Detail opens from board cards — soft link, not blocking)
- **External prerequisites:** M1 state spine + typed-result rows (live); design-system
  tree/list primitives

## Cost Estimate

- **Complexity:** L
- **Estimated tokens:** ~18k input, ~10k output
- **Estimated cost:** ~$0.70 (claude-sonnet-5 implementation tier)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined
- [x] Diagram references included
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing (incl. Playwright performance assertions)
- [ ] Coverage ≥ 80% changed code; delta mutation ≥ 70%
- [ ] Lighthouse: Performance ≥ 90, Accessibility ≥ 95, Best-practices ≥ 90 on the board route
- [ ] `ui_verify` passes; design tokens only
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] Legend test greppable (invariants.md verify-by)
- [ ] Docstrings/JSDoc on exported components
- [ ] Conventional commit(s); PR references this task and EPIC-004

## Implementation Hints

- The five filters are fixed (FR-017) — "Self-improvement-flagged" filters on the existing
  flag field from the spine rows; if the field is absent in v1 data it matches zero tasks and
  the empty state carries it (do not hide the filter).
- Retry chip data comes from the latest typed result per task (`failure_class`, attempt count)
  joined against the per-class ceiling from settings — one query, no per-card fetch.
- WCAG 1.4.1 is the reason for AC-6 — the legend and per-card text labels are the compliance
  mechanism; the a11y unit test should assert label text, not colour values.
- Poll/refresh: reuse the existing run-status pub/sub → SSE channel the M1 Studio uses for
  live updates rather than adding websockets or a poller.
- FR-017's "This phase" filter is the **execution** phase (FR-044 state-spine axis) — unrelated
  to the Registry's derived **lifecycle** phase (Speccing/Building/Live monitoring, FR-006/B10);
  same word, two different things, do not conflate the filter with the Registry chip.
- Visual/behavioral reference: `docs/design/mocks/mock-v5-delta.html`, screen 11 (Kanban Board)
  — confirms the task-tree renders as a static layered list/DAG, no new graph-rendering
  dependency, aligned with this task's existing design decision.

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
