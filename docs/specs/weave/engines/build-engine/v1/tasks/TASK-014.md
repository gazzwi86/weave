---
type: Task
title: "Task: TASK-014 — PM Surface API Core: Projects Grid, Settings, Contributors (FR-006/007/008/009/060)"
description: "The Lambda PM Surface API's core routes: paginated project grid with filter +
  name search, cascade-validated settings PATCH (model tier, caps), contributors CRUD behind
  the Role Guard, and create-time governance resolution (no ungoverned window)."
tags: [build-engine, arch, task, v1]
status: Backlog
priority: Must Have
entity: build-engine
epic: EPIC-002
milestone: v1.0
created: 2026-07-08
blocked_by: [TASK-011]
unlocks: [TASK-015, TASK-016, TASK-019]
adr_refs: []
source: hand-authored
confirmed_by: "none"
confirmed_on: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/build-engine/v1/tasks/TASK-014.md
---

# Task: TASK-014 — PM Surface API Core: Projects Grid, Settings, Contributors

## Story

**Epic:** [EPIC-002 — Project Registry & Settings](../../../build-engine.md#epic-002)
**Status:** Backlog · **Priority:** Must Have

**As a** product owner or delivery manager
**I want** a queryable project registry with governed, role-guarded settings and contributors
**So that** concurrent projects are browsable and every governance change is authorised and
cascade-consistent

> **FRs covered:** FR-006 (grid data), FR-007 (create-time cascade resolution — the M1
> minimal bootstrap gains the "no ungoverned window" guarantee), FR-008 (cap config side;
> breach runtime is TASK-013), FR-009 (model-tier gating), FR-060 (contributors API),
> **FR-066 (direct project creation — `POST /api/projects`, name + description only, no
> request behind it; see `ADR-009`)**. FR-011: settings responses show secret *names/references*
> only — never values.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN `GET /api/projects` is called with status/lifecycle-phase/owner filters and/or a name search, THE SYSTEM SHALL return a paginated grid payload (**derived** lifecycle phase — distinct from FR-044's execution phase —, budget summary, owner, demo status per card) matching the filters — lifecycle phase is computed from spec/task/deploy state (`Speccing`/`Building`/`Live monitoring`) with `archived_at` layered on top; there is no stored lifecycle-phase column | `should filter and search projects grid` |
| AC-2 | WHEN a project is created — **either from an approved request (FR-007) or directly via `POST /api/projects` (FR-066)** — THE SYSTEM SHALL pin the newest published CE version (`CE-VERSION-1`) AND resolve governance through the Company→Domain→Project cascade (tighter-wins) at create time, through the same shared code path regardless of entry point — there is no window where the project exists ungoverned or unpinned, on either path | `should resolve governance cascade at project create` |
| AC-7 | WHEN `POST /api/projects` is called with name + description, THE SYSTEM SHALL create a project shell (no spec, no tasks, no repo bound) with the CE pin and governance cascade resolved per AC-2, and return it in the `Speccing` **lifecycle phase** (distinct from FR-044's execution phase — derived, not stored) | `should create project shell via direct create` |
| AC-3 | WHEN `PATCH /api/projects/{id}/settings` sets a cap looser than a parent level, THE SYSTEM SHALL reject it with the binding parent level named (tighter-wins; loosening needs parent approval per PLAT-SETTINGS-1) | `should reject cap looser than parent cascade level` |
| AC-4 | WHEN a model tier is set on a project, THE SYSTEM SHALL default from domain policy (PLAT-SETTINGS-1 cascade) and accept only defined tiers (standard/fast/premium/experimental) | `should default model tier from domain policy` |
| AC-5 | WHEN contributors are mutated, THE SYSTEM SHALL require the SETTINGS/CONTRIBUTORS guard (project admin or company/domain admin-owner) and persist via the TASK-010 repo | `should mutate contributors behind role guard` |
| AC-6 | WHEN any settings response includes secret configuration, THE SYSTEM SHALL return the Secrets Manager reference name only — never a value, in any code path including errors | `should never return secret values in settings responses` |

## Implementation

### Pseudocode

```
GET /api/projects:
    q = repo.projects.grid_query(tenant, filters, search, page)   # one indexed query
    return [ProjectCard(phase, budget_summary, owner, demo_status, ...) for row in q]

shared _create_project_shell(name, description=None, ...):   # one function, two callers — AC-2/AC-7
    pinned = ce_client.current_version()                          # existing M1 pin
    effective = settings.resolve_cascade_all(ctx, PROJECT_GOVERNANCE_KEYS)   # AC-2
    repo.projects.create(name, description, pinned, effective_snapshot=effective)
    # create is atomic with resolution — no ungoverned window, either caller

POST project create (from an approved request, extends M1 lifecycle_api create path):
    _create_project_shell(name=request.title, ...)

POST /api/projects (FR-066, direct create, AC-7):
    _create_project_shell(name=body.name, description=body.description)
    # no request/sign-off; phase resolves to Speccing (derived, not stored — TASK-014 AC-1)

PATCH /api/projects/{id}/settings (Depends(require_project_role(SETTINGS))):
    for key, value in patch:
        parent = settings.resolve_cascade(key, ctx, up_to="domain")   # Company→Domain→Project
        if is_looser(value, parent): raise 422 CapLooserThanParent(level=parent.level)  # AC-3
    repo.projects.update_settings(...)

contributors routes: thin CRUD over repo.contributors, guarded (AC-5)
```

### API Contracts

From `v1-delta.md` §3: `GET /api/projects` ≤ 300 ms · `POST /api/projects` ≤ 500 ms (FR-066) ·
`PATCH /api/projects/{id}/settings` ≤ 500 ms ·
`GET/PUT/DELETE /api/projects/{id}/contributors[/{principal}]` ≤ 400 ms. Errors:
400 (bad filter / missing name), 403 (guard), 404, 422 (cascade violation, named binding level), 500.
Consumes `PLAT-SETTINGS-1` cascade-resolution API; `CE-VERSION-1` at create (existing M1 path,
shared by both create routes).

### Diagram References

| Diagram | File | Section | Summary |
|---|---|---|---|
| Architecture delta | `../../tech-spec/v1-delta.md` | §2 diagram | PM Surface API → Role Guard → repo_layer |
| Data model | `../../tech-spec/data-model.md` | §Projects Table | Existing columns the grid reads (phase, demo, write-back fields) |
| Contract | `../../../../contracts.md` | §PLAT-SETTINGS-1 | Cascade semantics: tighter-wins, parent approval to loosen |

### Design Decisions

| Decision | Reference | Impact |
|---|---|---|
| Grid is one indexed query, no N+1 per card | AC-1 / p95 ≤ 300 ms | Budget summary comes from a denormalised read or single join — engineer must not call TASK-013 costs per card |
| Cascade validated at write time AND resolved at read time | AC-3 | Double protection: invalid configs can't persist; effective value always computed fresh |
| One shared create function behind two routes (request-approval, direct) | AC-2/AC-7 / B10 | CE-pin + governance resolution can't drift between the two create paths — there is exactly one place "no ungoverned, unpinned window" is implemented |
| Lifecycle phase computed at read time, never stored | AC-1 / B10 | Distinct from FR-044's execution phase; no lifecycle-phase state machine to keep in sync with reality — the grid always reflects actual spec/task/deploy state |
| Model tiers are a fixed enum in v1 | FR-009 | No custom tiers; domain policy supplies the default only |
| Secret values structurally unreachable | FR-011 / AC-6 | Settings rows store reference names; there is no code path that fetches values in the PM API |

## Test Requirements

### Unit Tests (minimum 4)

- `should filter and search projects grid`
- `should reject cap looser than parent cascade level`
- `should default model tier from domain policy`
- `should never return secret values in settings responses` (response-shape assertion incl. error paths)

### Integration Tests (minimum 3)

- `should resolve governance cascade at project create` (create → immediate settings read shows effective values)
- `should create project shell via direct create` (`POST /api/projects`, name + description only → 201, `Speccing` lifecycle phase, CE-pinned, governance resolved)
- `should mutate contributors behind role guard` (editor 403 + audit; admin 200 — Law B backend assertion)
- `should paginate grid at 100 projects within p95` (seeded fixture)

### E2E Tests

Deferred to TASK-015 (the Registry UI E2E exercises these routes end-to-end).

### AC-to-Test Mapping

| AC | Type | Test |
|---|---|---|
| AC-1 | Unit | `should filter and search projects grid` |
| AC-2 | Integration | `should resolve governance cascade at project create` |
| AC-7 | Integration | `should create project shell via direct create` |
| AC-3 | Unit | `should reject cap looser than parent cascade level` |
| AC-4 | Unit | `should default model tier from domain policy` |
| AC-5 | Integration | `should mutate contributors behind role guard` |
| AC-6 | Unit | `should never return secret values in settings responses` |

## Dependencies

- **blocked_by:** [TASK-011] (Role Guard; TASK-010 transitively)
- **unlocks:** [TASK-015, TASK-016, TASK-019]
- **External prerequisites:** PLAT-SETTINGS-1 cascade-resolution API (live); M1 project
  create path in lifecycle_api (live)

## Cost Estimate

- **Complexity:** L
- **Estimated tokens:** ~16k input, ~8k output
- **Estimated cost:** ~$0.60 (claude-sonnet-5 implementation tier)

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
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] Guard `Depends` greppable on every mutation route (invariants.md verify-by)
- [ ] p95 targets met against seeded fixtures
- [ ] Docstrings on public APIs
- [ ] Conventional commit(s); PR references this task and EPIC-002

## Implementation Hints

- Extend the M1 `projects` module + `lifecycle_api` create path — do not create a second
  projects service; the v1 routes join the existing router family.
- `resolve_cascade_all` batches keys in one settings call; do not resolve per key per request.
- Demo status on the card comes from the existing `demo_output_location_ref` /
  `write_back_complete` fields — no new state.
- Grid pagination: keyset (created_at, id), not OFFSET — the 100-project budget is the test
  floor, not the ceiling.
- Visual/behavioral reference: `docs/design/mocks/mock-v5-delta.html`, screen 10 (Registry
  grid + "New project" modal) — shows the name+description-only modal shape and the phase
  chips as rendered (derived labels, not a picker).

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
