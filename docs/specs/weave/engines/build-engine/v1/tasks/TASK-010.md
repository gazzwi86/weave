---
type: Task
title: "Task: TASK-010 — Project Dashboard (FR-013): Per-Tile Isolated Status View"
description: "Dashboard page with demo-readiness, budget, forecast, tasks-in-flight, blockers,
  and git-ribbon tiles — each tile fetches its own endpoint and fails locally; the demo tile
  never shows a false green; cost tiles render ADR-008 labelled estimates."
tags: [build-engine, arch, task, v1, ui]
status: Backlog
priority: Must Have
entity: build-engine
epic: EPIC-003
milestone: v1.0
created: 2026-07-08
blocked_by: [TASK-004, TASK-005]
unlocks: [TASK-012]
adr_refs: [ADR-008]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/build-engine/v1/tasks/TASK-010.md
---

# Task: TASK-010 — Project Dashboard (FR-013): Per-Tile Isolated Status View

## Story

**Epic:** [EPIC-003 — Project Dashboard](../../../build-engine.md#epic-003)
**Status:** Backlog · **Priority:** Must Have

**As a** product owner
**I want** one at-a-glance project status page whose tiles fail independently
**So that** a single upstream outage degrades one tile, never the whole picture

> **FRs covered:** FR-013. Quick actions (FR-014/E3-S2) are post-v1 — do NOT add action
> buttons beyond "Open Kanban" navigation. The prompt box on this page is TASK-012.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN the dashboard loads, THE SYSTEM SHALL render six tiles (demo-readiness, budget, forecast, tasks-in-flight, blockers, git ribbon), each fetched from its own `GET /api/projects/{id}/dashboard/{tile}` endpoint | `should render six tiles from per-tile endpoints` |
| AC-2 | WHEN any tile's source errors, THE SYSTEM SHALL render that tile in a localized error state while every other tile renders normally — one outage never blanks the page | `should render tile error state and keep page alive when one tile source fails` |
| AC-3 | WHEN the demo URL cannot be captured (deploy failed), THE SYSTEM SHALL retain the prior demo URL and surface the failure — the demo-readiness tile never shows a false green | `should retain prior demo url and surface error when deploy fails` |
| AC-4 | WHEN budget/forecast tiles render, THE SYSTEM SHALL show TASK-004's labelled estimates, the binding cascade level, and the forecast inputs — never an unexplained number | `should render budget forecast with estimated label and inputs` |
| AC-5 | WHEN the git ribbon renders, THE SYSTEM SHALL show recent commits from `generation_runs` rows (branch, sha, time) linking to the project's external repo — no live SCM call on page load | `should render git ribbon from recorded runs` |
| AC-6 | WHEN a Weave-product self-improvement proposal is relevant, THE SYSTEM SHALL surface it as a read-only card linking to the Platform surface — Build does not own the proposal lifecycle; absent feed ⇒ card hidden, not errored | `should show read-only self-improvement card when feed present` |

## Implementation

### Pseudocode

```
GET /api/projects/{id}/dashboard/{tile}:      # one route, tile param enum — six handlers
    demo:     projects demo fields (demo_output_location_ref, last deploy status + prior URL)
    budget:   TASK-004 rollup total + binding cap + level
    forecast: TASK-004 forecast + inputs
    tasks:    spine counts by lane (reuse TASK-008 lane mapping)
    blockers: tasks held (missing handoff / NOT READY / HITL pending) with reasons
    ribbon:   last N generation_runs (branch, commit_sha, created_at, repo_url join)

UI /build/projects/[id]:
    six <Tile> islands, independent useQuery each; error -> <TileError retry/>   # AC-2
    DemoTile: current URL or prior URL + failure banner                          # AC-3
    BudgetTile/ForecastTile: "estimated" chip + "capped at {level}" + inputs popover  # AC-4
    SelfImprovementCard: renders only when platform feed returns items           # AC-6
    "Open Kanban" is a nav link, not a quick-action framework                    # non-goal
```

### API Contracts

`GET /api/projects/{id}/dashboard/{tile}` p95 ≤ 400 ms per tile (v1-delta §3); unknown tile
⇒ 400. Tile payloads are per-handler typed models — no aggregate mega-endpoint (aggregation
would recouple tile failure modes). Consumes TASK-004 costs internals, spine reads, projects
fields; self-improvement card reads the Platform feed by contract (`BE-SELFIMPROVE-1`
consumer note) and treats absence as empty.

### Diagram References

| Diagram | File | Section | Summary |
|---|---|---|---|
| Architecture delta | `../../tech-spec/v1-delta.md` | §2 diagram | Dashboard tiles → per-tile API → repo_layer/Cost Reader |
| Surface honesty | `../../tech-spec/v1-delta.md` | §5 | The three honesty rules this page owns (tile isolation, no false green, estimated labels) |
| M1 demo fields | `../../tech-spec/data-model.md` | §Projects Demo and Write-Back Fields | Demo tile's source columns |

### Design Decisions

| Decision | Reference | Impact |
|---|---|---|
| Per-tile endpoints, no aggregate | FR-013 AC / AC-2 | Failure isolation is structural, not try/catch theatre; caching per tile |
| Git ribbon reads recorded runs, never live SCM | AC-5 / OQ-07 disposition | Page load can't hang on GitHub; the recorded rows are already the source of truth for what Weave pushed |
| Prior-demo-URL retention is server-side state | AC-3 | The tile is honest even on first render after a failed deploy — not a client cache trick |
| Self-improvement card is read-only + link-out | B5 / EPIC-003 AC | Build never owns the proposal lifecycle; zero proposal mutations in this codebase |

## Test Requirements

### Unit Tests (minimum 4)

- `should render tile error state and keep page alive when one tile source fails`
- `should render budget forecast with estimated label and inputs`
- `should render git ribbon from recorded runs`
- `should show read-only self-improvement card when feed present` (and hidden when absent)

### Integration Tests (minimum 2)

- `should retain prior demo url and surface error when deploy fails` (seeded failed deploy
  after a successful one — Law B: server state asserted)
- `should return four hundred on unknown tile`

### E2E Tests (Playwright, minimum 2)

- `should render six tiles from per-tile endpoints` (full page against seeded project)
- `should keep five tiles alive when one endpoint is stubbed down` (network-intercept one
  tile; DOM asserts the other five rendered)

### AC-to-Test Mapping

| AC | Type | Test |
|---|---|---|
| AC-1 | E2E | `should render six tiles from per-tile endpoints` |
| AC-2 | Unit + E2E | tile error unit / stubbed-down E2E |
| AC-3 | Integration | `should retain prior demo url and surface error when deploy fails` |
| AC-4 | Unit | `should render budget forecast with estimated label and inputs` |
| AC-5 | Unit | `should render git ribbon from recorded runs` |
| AC-6 | Unit | `should show read-only self-improvement card when feed present` |

## Dependencies

- **blocked_by:** [TASK-004, TASK-005]
- **unlocks:** [TASK-012] (the prompt box mounts on this page)
- **External prerequisites:** M1 demo/deploy fields (live); Platform self-improvement feed
  (optional — card degrades to hidden)

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
- [x] Design decisions noted (ADR-008)
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing (incl. stubbed-down tile E2E)
- [ ] Coverage ≥ 80% changed code; delta mutation ≥ 70%
- [ ] Lighthouse: Performance ≥ 90, Accessibility ≥ 95, Best-practices ≥ 90 on the dashboard route
- [ ] `ui_verify` passes; design tokens only
- [ ] Tile-isolation test greppable (invariants.md verify-by)
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] Docstrings/JSDoc on public APIs/components
- [ ] Conventional commit(s); PR references this task and EPIC-003

## Implementation Hints

- The deploy service already retains `demo_output_location_ref`; AC-3 needs a
  last-deploy-status field or derives it from the latest run's deploy gate result — check
  `deploy/service.py` before adding state; the failure info likely already exists.
- Blockers tile reasons come from existing hold states (missing handoff, NOT READY, HITL
  pending) — string-match none of them; use the status enums the spine already stores.
- Below-fold tiles lazy-load (v1-delta §6); demo + budget render first (the two tiles humans
  check most).
- `repo_url` join for ribbon links: the projects row already stores it (M1 ScmDriver) — no
  SCM API involvement anywhere in this task.

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
