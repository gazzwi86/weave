---
type: Task
title: "Task: TASK-011 — Decision Log (FR-027): Searchable Read-Only View over PLAT-AUDIT-1"
description: "Searchable, paginated table of agent decisions and ADRs as a filtered proxy over
  PLAT-AUDIT-1 — never a copy, never fabricated, honest 'audit unavailable' state; brief-linked
  decisions resolve to their records."
tags: [build-engine, arch, task, v1, ui]
status: Backlog
priority: Must Have
entity: build-engine
epic: EPIC-007
milestone: v1.0
created: 2026-07-08
blocked_by: [TASK-002]
unlocks: []
adr_refs: []
source: hand-authored
confirmed_by: "none"
confirmed_on: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/build-engine/v1/tasks/TASK-011.md
---

# Task: TASK-011 — Decision Log (FR-027): Searchable Read-Only View over PLAT-AUDIT-1

## Story

**Epic:** [EPIC-007 — Decision Log](../../../build-engine.md#epic-007)
**Status:** Backlog · **Priority:** Must Have

**As a** technical architect
**I want** a searchable log of every agent decision and ADR for a project
**So that** "why did the agent do that" has a queryable answer with an audit-grade source

> **FRs covered:** FR-027. Export (FR-028) is post-v1 — no export affordance. The log is a
> **view/filter over PLAT-AUDIT-1** (contract: engines keep no independent signed stores).

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN `GET /api/projects/{id}/decisions?search=` is called, THE SYSTEM SHALL return a paginated, filtered PLAT-AUDIT-1 read (engine=build, project target, decision/ADR event types) with search over event summaries | `should return searchable paginated decisions from audit` |
| AC-2 | WHEN PLAT-AUDIT-1 is unreachable, THE SYSTEM SHALL show "audit unavailable" — never fabricated entries, never a blank screen | `should show audit unavailable when PLAT-AUDIT-1 unreachable` |
| AC-3 | WHEN an ADR is linked from a task brief, THE SYSTEM SHALL resolve the link to the corresponding audit record in the log (deep-linkable row) | `should resolve brief adr link to decision log row` |
| AC-4 | WHEN the log renders, THE SYSTEM SHALL be read-only — no mutation affordance exists anywhere on the surface, and Build persists no copy of audit rows | `should render read-only log with no build-side audit rows` |
| AC-5 | WHEN search matches zero records, THE SYSTEM SHALL show an empty-state with the active query shown and a clear action — never a blank table | `should show empty state when search matches nothing` |
| AC-6 | WHEN the first page renders, THE SYSTEM SHALL do so ≤ 1 s (v1-delta §6 budget) with cursor pagination — no full-log fetch | `should paginate decisions with cursor` |

## Implementation

### Pseudocode

```
GET /api/projects/{id}/decisions?search=&cursor=:
    return audit_client.query(                       # shared proxy client (see TASK-009 hint)
        engine="build", target_iri=project_iri,
        event_types=DECISION_EVENT_TYPES,            # decision, adr, gate verdicts — one
        search=search, cursor=cursor, limit=50)      #   constants list, not ad-hoc strings
    on AuditUnreachable -> 503 {error: "audit_unavailable"}      # AC-2

UI /build/projects/[id]/decisions:
    <SearchInput urlState/> <DecisionTable rows/> <CursorPager/>
    row: ts · actor principal · event type · summary · target link
    deep link: /decisions?record={seq} scrolls to + highlights the row     # AC-3
    503 -> <AuditUnavailable/>; zero rows -> <EmptyState query/>           # AC-2/AC-5
```

### API Contracts

`GET /api/projects/{id}/decisions?search=&cursor=` p95 ≤ 800 ms (v1-delta §3; audit-bound).
Errors: 400 (bad cursor), 403, 503 (`audit_unavailable`), 500. Consumes the PLAT-AUDIT-1
read/query surface (event shape
`{seq, ts, actor_principal_iri, engine, event_type, target_iri, diff_summary, signature}`).
Search is server-side over `diff_summary`/`event_type` via the audit query API — Build adds
no search index.

### Diagram References

| Diagram | File | Section | Summary |
|---|---|---|---|
| Architecture delta | `../../tech-spec/v1-delta.md` | §2 diagram | Decision Log → PLAT-AUDIT-1 read view |
| Contract | `../../../../contracts.md` | §PLAT-AUDIT-1 | Single system of record; views/filters only; event shape |

### Design Decisions

| Decision | Reference | Impact |
|---|---|---|
| Proxy, never a copy | PLAT-AUDIT-1 contract | Build stores zero audit rows; tamper-evidence stays platform-owned |
| Decision event types are one constants list | AC-1 | Adding an event type to the log is a one-line change, greppable |
| Deep-linkable rows by audit `seq` | AC-3 | Brief ADR links and TASK-009's Audit tab share the resolution scheme |
| Cursor pagination against the audit API | AC-6 | Append-only log ⇒ seq-cursor is stable; OFFSET over an audit log is unbounded |

## Test Requirements

### Unit Tests (minimum 3)

- `should show empty state when search matches nothing`
- `should render read-only log with no build-side audit rows` (component + grep-style check:
  no audit table in Build migrations)
- `should resolve brief adr link to decision log row`

### Integration Tests (minimum 3)

- `should return searchable paginated decisions from audit` (audit stub with seeded events)
- `should show audit unavailable when PLAT-AUDIT-1 unreachable` (stub down; 503 body asserted)
- `should paginate decisions with cursor` (two-page fixture)

### E2E Tests (Playwright, minimum 1)

- `should search decisions and open a deep linked record` (search → row → deep link
  round-trip against the audit stub)

### AC-to-Test Mapping

| AC | Type | Test |
|---|---|---|
| AC-1 | Integration | `should return searchable paginated decisions from audit` |
| AC-2 | Integration | `should show audit unavailable when PLAT-AUDIT-1 unreachable` |
| AC-3 | Unit + E2E | `should resolve brief adr link to decision log row` / deep-link E2E |
| AC-4 | Unit | `should render read-only log with no build-side audit rows` |
| AC-5 | Unit | `should show empty state when search matches nothing` |
| AC-6 | Integration | `should paginate decisions with cursor` |

## Dependencies

- **blocked_by:** [TASK-002] (router family; reads are company-open)
- **unlocks:** []
- **External prerequisites:** PLAT-AUDIT-1 query/read API (live, M1); audit-proxy client
  shared with TASK-009's Audit tab (whichever lands first owns the module)

## Cost Estimate

- **Complexity:** M
- **Estimated tokens:** ~14k input, ~7k output
- **Estimated cost:** ~$0.50 (claude-sonnet-5 implementation tier)

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
- [ ] All specified tests passing
- [ ] Coverage ≥ 80% changed code; delta mutation ≥ 70%
- [ ] Lighthouse: Performance ≥ 90, Accessibility ≥ 95, Best-practices ≥ 90 on the decisions route
- [ ] `ui_verify` passes; design tokens only
- [ ] `audit unavailable` greppable (invariants.md verify-by, shared with TASK-009)
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] Docstrings/JSDoc on public APIs/components
- [ ] Conventional commit(s); PR references this task and EPIC-007

## Implementation Hints

- Check the Platform audit module for an existing query client before writing one — the M1
  `audit/` package already emits; a read client may exist for the health check (ADR-002 made
  it a local DB probe — that decision is being superseded by Platform, verify current state).
- If the audit query API lacks server-side search at implementation time, filter on
  `event_type` + paginate server-side and search client-side within the page — and log a
  coordinator flag; do NOT build a Build-side index (contract violation).
- The table is the design system's data-table component with virtualised rows; the ≤ 1 s
  budget is on first page render, not total log size.

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
