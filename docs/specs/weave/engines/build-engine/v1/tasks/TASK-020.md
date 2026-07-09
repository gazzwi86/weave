---
type: Task
title: "Task: TASK-020 — Decision Log (FR-027): Searchable Read-Only View over PLAT-AUDIT-1"
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
resource: docs/specs/weave/engines/build-engine/v1/tasks/TASK-020.md
---

# Task: TASK-020 — Decision Log (FR-027): Searchable Read-Only View over PLAT-AUDIT-1

## Story

**Epic:** [EPIC-007 — Decision Log](../../../build-engine.md#epic-007)
**Status:** Backlog · **Priority:** Must Have

**As a** technical architect
**I want** a searchable log of every agent decision and ADR for a project
**So that** "why did the agent do that" has a queryable answer with an audit-grade source

> **FRs covered:** FR-027 — **widened scope (user ruling 2026-07-09):** the log includes
> task-update events, not decisions/ADRs only; every row carries a category/kind chip
> (`Decision` / `Task update` / `System`); filter chips are server-side; actor is labelled
> human/agent from the principal IRI. Export (FR-028) is post-v1 — no export affordance. The log
> is a **view/filter over PLAT-AUDIT-1** (contract: engines keep no independent signed stores).

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN `GET /api/projects/{id}/decisions?search=&kind=` is called, THE SYSTEM SHALL return a paginated, filtered PLAT-AUDIT-1 read (engine=build, project target) with search over event summaries — event types are **widened beyond decision/ADR to include task-update events**; `kind` narrows the query to a server-side `event_type` prefix set | `should return searchable paginated decisions from audit` |
| AC-2 | WHEN PLAT-AUDIT-1 is unreachable, THE SYSTEM SHALL show "audit unavailable" — never fabricated entries, never a blank screen | `should show audit unavailable when PLAT-AUDIT-1 unreachable` |
| AC-3 | WHEN an ADR is linked from a task brief, THE SYSTEM SHALL resolve the link to the corresponding audit record in the log (deep-linkable row) | `should resolve brief adr link to decision log row` |
| AC-4 | WHEN the log renders, THE SYSTEM SHALL be read-only — no mutation affordance exists anywhere on the surface, and Build persists no copy of audit rows | `should render read-only log with no build-side audit rows` |
| AC-5 | WHEN search matches zero records, THE SYSTEM SHALL show an empty-state with the active query shown and a clear action — never a blank table | `should show empty state when search matches nothing` |
| AC-6 | WHEN the first page renders, THE SYSTEM SHALL do so ≤ 1 s (v1-delta §6 budget) with cursor pagination — no full-log fetch | `should paginate decisions with cursor` |
| AC-7 | WHEN a row is rendered, THE SYSTEM SHALL show a category/kind chip (`Decision` / `Task update` / `System`) alongside the event-type code, derived from a namespace→kind map over `event_type`'s prefix — no new field on the PLAT-AUDIT-1 event shape | `should render decision log category chip from event_type namespace map` |
| AC-8 | WHEN a filter chip (`All`/`Decisions`/`Task updates`/`System`) is selected, THE SYSTEM SHALL re-query the server with the corresponding `kind` param (an `event_type` prefix set) — filtering is never client-side row-hiding of an already-fetched page, which would silently break cursor pagination. Default view on load is `Decisions` | `should re-query server on filter chip change rather than hiding rows client-side` |
| AC-9 | WHEN the actor column is rendered, THE SYSTEM SHALL label it human or agent by parsing `actor_principal_iri` (a `:user:` segment ⇒ human; anything else ⇒ agent/service — the PLAT-IDENTITY-1 IRI shape already encodes this) — never a per-row principal lookup, never a stored/guessed field on the audit row | `should render actor as human or agent from actor_principal_iri prefix` |

## Implementation

### Pseudocode

```
# namespace -> kind: one constants map, extends the old DECISION_EVENT_TYPES list (AC-7/AC-8)
EVENT_KIND_MAP = {
    "hitl.*": "Decision", "ontology.*": "Decision", "spec.*": "Decision", "budget.*": "Decision",
    "task.*": "Task update",
    "tenant.*": "System", "repo.*": "System",
}
KIND_FILTER_TO_PREFIXES = {  # AC-8: chip -> event_type prefix set, drives the server query
    "all": None, "decision": [...], "task_update": ["task.*"], "system": [...],
}

GET /api/projects/{id}/decisions?search=&cursor=&kind=decision:      # default kind=decision, AC-8
    prefixes = KIND_FILTER_TO_PREFIXES[kind]
    return audit_client.query(                       # shared proxy client (see TASK-018 hint)
        engine="build", target_iri=project_iri,
        event_type_prefixes=prefixes,                # widened beyond decision/adr — AC-1
        search=search, cursor=cursor, limit=50)
    on AuditUnreachable -> 503 {error: "audit_unavailable"}      # AC-2

UI /build/projects/[id]/decisions:
    <FilterChips value={kind} onChange={refetch}/>              # AC-8: server refetch, no DOM hiding
    <SearchInput urlState/> <DecisionTable rows/> <CursorPager/>
    row: ts · actor (human|agent from actor_principal_iri prefix, AC-9) · kind chip (EVENT_KIND_MAP, AC-7)
       · event type · summary · target link
    deep link: /decisions?record={seq} scrolls to + highlights the row     # AC-3
    503 -> <AuditUnavailable/>; zero rows -> <EmptyState query/>           # AC-2/AC-5
```

### API Contracts

`GET /api/projects/{id}/decisions?search=&cursor=&kind=` p95 ≤ 800 ms (v1-delta §3;
audit-bound). Errors: 400 (bad cursor/kind), 403, 503 (`audit_unavailable`), 500. Consumes the
PLAT-AUDIT-1 read/query surface (event shape
`{seq, ts, actor_principal_iri, engine, event_type, target_iri, diff_summary, signature}` —
**unchanged, no new field**). Search is server-side over `diff_summary`/`event_type` via the
audit query API — Build adds no search index. `kind` is resolved to an `event_type` prefix set
server-side (`EVENT_KIND_MAP`/`KIND_FILTER_TO_PREFIXES`) — never a client-side filter over an
already-fetched page. Actor human/agent label is computed client-side from
`actor_principal_iri`'s `:user:` segment — zero extra requests.

### Diagram References

| Diagram | File | Section | Summary |
|---|---|---|---|
| Architecture delta | `../../tech-spec/v1-delta.md` | §2 diagram | Decision Log → PLAT-AUDIT-1 read view |
| Contract | `../../../../contracts.md` | §PLAT-AUDIT-1 | Single system of record; views/filters only; event shape |

### Design Decisions

| Decision | Reference | Impact |
|---|---|---|
| Proxy, never a copy | PLAT-AUDIT-1 contract | Build stores zero audit rows; tamper-evidence stays platform-owned |
| Event types resolved from one namespace→kind map (`EVENT_KIND_MAP`) | AC-1/AC-7/AC-8 | Adding an event type or a kind is a one-line map change, greppable; the row chip and the filter chip key off the same map, so they can never disagree |
| Kind filter is a server-side query param, never client-side row-hiding | AC-8 | A hidden row must never silently break the cursor-pagination count — filtering and paging share one query |
| Actor human/agent from `actor_principal_iri` prefix, not a lookup | AC-9 | Zero extra requests per row; the PLAT-IDENTITY-1 IRI shape (`:user:` vs. agent/service) is already the source of truth, so there is nothing to keep in sync |
| Deep-linkable rows by audit `seq` | AC-3 | Brief ADR links and TASK-018's Audit tab share the resolution scheme |
| Cursor pagination against the audit API | AC-6 | Append-only log ⇒ seq-cursor is stable; OFFSET over an audit log is unbounded |

## Test Requirements

### Unit Tests (minimum 3)

- `should show empty state when search matches nothing`
- `should render read-only log with no build-side audit rows` (component + grep-style check:
  no audit table in Build migrations)
- `should resolve brief adr link to decision log row`
- `should render decision log category chip from event_type namespace map`
- `should render actor as human or agent from actor_principal_iri prefix`

### Integration Tests (minimum 3)

- `should return searchable paginated decisions from audit` (audit stub with seeded events)
- `should show audit unavailable when PLAT-AUDIT-1 unreachable` (stub down; 503 body asserted)
- `should paginate decisions with cursor` (two-page fixture)
- `should re-query server on filter chip change rather than hiding rows client-side` (assert
  a new request fires with the `kind` param, and pagination count reflects the filtered total)

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
| AC-7 | Unit | `should render decision log category chip from event_type namespace map` |
| AC-8 | Integration | `should re-query server on filter chip change rather than hiding rows client-side` |
| AC-9 | Unit | `should render actor as human or agent from actor_principal_iri prefix` |

## Dependencies

- **blocked_by:** [TASK-011] (router family; reads are company-open)
- **unlocks:** []
- **External prerequisites:** PLAT-AUDIT-1 query/read API (live, M1); audit-proxy client
  shared with TASK-018's Audit tab (whichever lands first owns the module)

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
- [ ] `audit unavailable` greppable (invariants.md verify-by, shared with TASK-018)
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
- Visual/behavioral reference: `docs/design/mocks/mock-v5-delta.html`, screen 14 (Decision
  Log) — shows the "Kind" column chip and filter-chip row. Build the filter chips as
  **server-side query params** per AC-8; the mock's own `filterDecisionLog()` toggles
  `row.style.display` on already-rendered rows, which is fine for a static reference page but
  is explicitly NOT the pattern to implement (it would break cursor pagination against the
  real, paginated PLAT-AUDIT-1 API).

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
