---
type: Task
title: "Task: TASK-001 — v1 Data Layer: Four PM Tables + generation_runs Columns + Repo Methods"
description: "Migrations and repo-layer methods for project_contributors, external_bindings,
  cost_events, project_prompts (all RLS + base-filter), plus generation_runs.trigger and
  log_location_ref column adds. Foundation task for every v1 surface."
tags: [build-engine, arch, task, v1]
status: Backlog
priority: Must Have
entity: build-engine
epic: EPIC-002
milestone: v1.0
created: 2026-07-08
blocked_by: []
unlocks: [TASK-002, TASK-003, TASK-009, TASK-013]
adr_refs: [ADR-008]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/build-engine/v1/tasks/TASK-001.md
---

# Task: TASK-001 — v1 Data Layer: Four PM Tables + generation_runs Columns + Repo Methods

## Story

**Epic:** [EPIC-002 — Project Registry & Settings](../../../build-engine.md#epic-002)
**Status:** Backlog · **Priority:** Must Have

**As a** v1 PM-surface engineer
**I want** the four v1 tables, the two `generation_runs` column adds, and typed repo-layer
methods, all tenant-isolated exactly like every existing Build table
**So that** every downstream v1 task builds on a data layer whose isolation is already proven

> **FRs covered:** data prerequisites for FR-060 (contributors), FR-010 (bindings), FR-065
> (prompts), ADR-008 (cost_events), FR-019 Console tab (`log_location_ref`). Exact DDL is
> pinned in [`v1-delta.md`](../../tech-spec/v1-delta.md) §4 — implement it verbatim.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN the v1 migrations are applied, THE SYSTEM SHALL create `project_contributors`, `external_bindings`, `cost_events`, `project_prompts` with ROW LEVEL SECURITY enabled and the tenant policy attached | `should enable row level security on all four v1 tables` |
| AC-2 | WHEN a tenant-B session queries any new table through the repo layer, THE SYSTEM SHALL return zero tenant-A rows | `should return zero tenant-B rows for every new v1 table` |
| AC-3 | WHEN `generation_runs` is migrated, THE SYSTEM SHALL default existing rows to `trigger = 'request'` and leave `log_location_ref` NULL | `should default existing runs to trigger request` |
| AC-4 | WHEN a contributor row is inserted with a role outside `admin`/`editor`, THE SYSTEM SHALL reject it at the DB constraint | `should reject invalid contributor role` |
| AC-5 | WHEN a duplicate binding `(tenant, project, system, space_ref)` is inserted, THE SYSTEM SHALL reject it via the unique constraint | `should reject duplicate external binding` |
| AC-6 | WHEN any service code touches a v1 table, THE SYSTEM SHALL route through repo-layer methods only (base filter applied); no raw SQL outside the repo module | `should access v1 tables only via repo layer` (grep-style test per M1 pattern) |

## Implementation

### Pseudocode

```
migration 00NN_v1_pm_tables.sql:
  CREATE TABLE project_contributors / external_bindings / cost_events / project_prompts
      exactly per v1-delta.md §4 (PKs, CHECKs, UNIQUEs, index idx_cost_events_rollup)
  ALTER TABLE generation_runs ADD trigger ... DEFAULT 'request', ADD log_location_ref TEXT
  for each new table: ENABLE ROW LEVEL SECURITY + tenant policy (copy pattern from
      0013_gate_results.sql / 0015_generation_runs.sql)

repo layer (one module per table family, mirroring generation/store.py):
  contributors: get_all(project), upsert(principal, role), delete(principal)
  bindings:     get_all(project), put(system, connector_ref, space_ref), delete(binding_id)
  cost_events:  insert(event), rollup(project_iri) -> totals + by_task rows
  prompts:      insert(prompt), set_run_id(prompt_id, run_id), get_recent(project)
  all methods take (conn, *, tenant_id, ...) — base-filter arg is not optional
```

### API Contracts

None — data layer only. Consumers land in TASK-002/003/005; endpoint shapes are pinned in
`v1-delta.md` §3.

### Diagram References

| Diagram | File | Section | Summary |
|---|---|---|---|
| Architecture delta | `../../tech-spec/v1-delta.md` | §2 diagram | repo_layer is the single Aurora choke point for all new components |
| Data model | `../../tech-spec/v1-delta.md` | §4 | Exact DDL for the four tables + column adds |
| M1 isolation | `../../tech-spec/data-model.md` | §Cross-Tenant Isolation Invariant | The release-gate test pattern to extend |

### Design Decisions

| Decision | Reference | Impact |
|---|---|---|
| cost_events is an event table, not run columns | [ADR-008](../../decisions/ADR-008.md) | Attribution survives multi-agent retries and non-run work (`run_id`/`task_id` nullable) |
| Readers have no contributor row | `v1-delta.md` §4 note | Read access = company (tenant) membership; do NOT model a `reader` role value |
| Whole-key uniqueness on bindings | `v1-delta.md` §4 | `(tenant, project, system, space_ref)` — a project may bind two Jira boards, never the same one twice |
| RLS + repo-layer base filter (both) | M1 D3 | Defence-in-depth; single-layer tenancy is a rejected alternative |

## Test Requirements

### Unit Tests (minimum 3)

- `should reject invalid contributor role`
- `should reject duplicate external binding`
- `should compute rollup totals and by_task rows from seeded cost events`

### Integration Tests (minimum 3)

- `should enable row level security on all four v1 tables` (Aurora testcontainer, catalog query)
- `should return zero tenant-B rows for every new v1 table` (two-tenant fixture)
- `should default existing runs to trigger request` (migrate a pre-seeded runs row)

### E2E Tests

N/A — no UI surface. `should access v1 tables only via repo layer` runs as a static/grep test
per the M1 no-raw-query pattern (ADR-001 mitigation 3).

### AC-to-Test Mapping

| AC | Type | Test |
|---|---|---|
| AC-1 | Integration | `should enable row level security on all four v1 tables` |
| AC-2 | Integration | `should return zero tenant-B rows for every new v1 table` |
| AC-3 | Integration | `should default existing runs to trigger request` |
| AC-4 | Unit | `should reject invalid contributor role` |
| AC-5 | Unit | `should reject duplicate external binding` |
| AC-6 | Static | `should access v1 tables only via repo layer` |

## Dependencies

- **blocked_by:** [] — first v1 task
- **unlocks:** [TASK-002, TASK-003, TASK-009, TASK-013]
- **External prerequisites:** none (migration pipeline + testcontainer fixtures exist from M1)

## Cost Estimate

- **Complexity:** M
- **Estimated tokens:** ~12k input, ~6k output
- **Estimated cost:** ~$0.40 (claude-sonnet-5 implementation tier)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (N/A — data layer; consumers cited)
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
- [ ] `ENABLE ROW LEVEL SECURITY` greppable on all four tables (invariants.md verify-by)
- [ ] Docstrings on public APIs
- [ ] Conventional commit(s); PR references this task and EPIC-002

## Implementation Hints

- Copy the RLS policy + migration idiom from `packages/backend/migrations/0013_gate_results.sql`
  — do not invent a new policy shape.
- Repo methods follow `generation/store.py` (frozen dataclass row types, `asyncpg`,
  keyword-only `tenant_id`). Keep one module per table family; no ORM additions.
- `rollup()` is one SQL aggregate over `idx_cost_events_rollup` — no in-Python summing.
- The two-tenant fixture already exists (data-model.md §Isolation release-gate test); extend
  its table list rather than writing a new fixture.

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
