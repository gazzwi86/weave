---
type: Task
title: "Task: TASK-001 — Standards Catalogue: Company/Project Standards + Effective-Set Resolution (E2-S7)"
description: "Implement the company standards catalogue (FR-063) and project-level overrides
  (FR-064) per ADR-007 (workspace level dropped — catalogue is company-scoped):
  standards_documents table, CRUD API, policy_iri validation via CE-READ-1, effective-set
  resolution consumed by E8-S1 prompt assembly. Owns the whole m2-delta §4 migration
  (standards_documents + projects SDK columns)."
tags: [build-engine, arch, task, v1]
status: Backlog
priority: Must Have
entity: build-engine
epic: EPIC-002
milestone: v1
created: 2026-07-08
blocked_by: []
unlocks: [TASK-003, TASK-005]
adr_refs: [ADR-007]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
expires_on: 2027-01-08
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/build-engine/v1/tasks/TASK-001.md
---

# Task: TASK-001 — Standards Catalogue: Company/Project Standards + Effective-Set Resolution (E2-S7)

## Story

**Epic:** [EPIC-002 — Project Registry & Settings](../../../build-engine.md#epic-002)
**Status:** Backlog · **Priority:** Must Have

**As a** company (tenant) admin
**I want** company-level coding/architecture/stack standards with project-level overrides
**So that** every generated project follows our standards, not Weave's demo defaults — and I can
answer "which standard applied to this build" with one lookup

> **FRs covered:** FR-063 (company standards — workspace level dropped 2026-07-08, catalogue
> re-homes to company scope per ADR-007 amendment), FR-064 (project overrides, tighter-wins).
> API-only in M2 — the authoring UI is v1.0 (E2). Brand/voice stays CE-BRAND-1 (TASK-002), NOT
> here. This task **owns the single m2-delta §4 Alembic migration**, including the `projects`
> SDK bookkeeping columns TASK-005 consumes.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN a standard is created via `PUT /api/standards/{scope}/{key}`, THE SYSTEM SHALL resolve its `policy_iri` via CE-READ-1 and reject with 422 `{"error":"policy_not_found"}` if the Policy entity does not resolve | `should reject standard with unresolvable policy_iri` |
| AC-2 | WHEN CE-READ-1 is unreachable at authoring time, THE SYSTEM SHALL reject with 503 `{"error":"ce_unavailable"}` — a standard is never persisted with an unvalidated policy link | `should return 503 when CE unreachable at authoring` |
| AC-3 | WHEN the effective set is requested for a project, THE SYSTEM SHALL return all `active` company-scope documents overlaid by same-`standard_key` `active` project-scope documents (project wins whole-key; draft/retired rows never appear) | `should overlay project standard over company standard by key` |
| AC-4 | WHEN generation (E8-S1) runs for a project whose company catalogue is empty, THE SYSTEM SHALL proceed with the M1 demo-default stack and write a `standards_missing` warning to the run log — absence degrades, never halts | `should degrade to demo-default stack with warning when catalogue empty` |
| AC-5 | WHEN generation runs with a non-empty effective set, THE SYSTEM SHALL inject the effective set into the E8-S1 generation context and key stack selection off `stack_pins` where present | `should drive stack selection from stack_pins` |
| AC-6 | WHEN a tenant-B principal reads standards, THE SYSTEM SHALL return zero tenant-A rows (RLS + repo-layer base filter) | `should return zero tenant-A standards under tenant-B context` |
| AC-7 | WHEN `scope='project'` is written without a `project_id`, or `scope='company'` with one, THE SYSTEM SHALL reject with 422 naming the violated constraint | `should reject scope/project_id mismatch` |

## Implementation

### Pseudocode

```
function put_standard(jwt, scope, key, body):
  claims = cognito.verify(jwt)                              # → 401
  validate scope in ('company','project')                   # → 422
  validate (scope=='project') == (body.project_id != null)  # → 422 (AC-7)
  entity = ce_client.get_entity(body.policy_iri)            # CE-READ-1
  if ce_unreachable: return 503 {"error":"ce_unavailable"}  # AC-2
  if entity is None or entity.kind != 'Policy':
      return 422 {"error":"policy_not_found"}               # AC-1
  row = repo.standards.upsert(tenant=claims.tenant_id,
                              scope, project_id=body.project_id, standard_key=key,
                              title, body_md, stack_pins, policy_iri,
                              status=body.status or 'draft', created_by=claims.principal_iri)
  emit_audit("standard_upserted", target=row.standard_id)
  return 200 row

function effective_set(tenant, project_id):
  company = repo.standards.list(tenant, scope='company', status='active')
  project = repo.standards.list(tenant, scope='project',
                                project_id=project_id, status='active')
  merged = {s.standard_key: s for s in company}
  merged.update({s.standard_key: s for s in project})   # project wins whole-key (ADR-007 §3)
  return sorted(merged.values(), by=standard_key)

# E8-S1 prompt assembly hook (extends M1 generation context builder):
function build_generation_context(project):
  std = effective_set(project.tenant, project.id)
  if not std:
      run_log.warn("standards_missing — using demo-default stack")   # AC-4
      return m1_default_context(project)
  ctx.standards_section = render(std)          # body_md as reasoning context
  ctx.stack = resolve_stack([s.stack_pins for s in std if s.stack_pins])  # AC-5
  return ctx
```

### API Contracts

**`PUT /api/standards/{scope}/{key}`** — p95 ≤ 800 ms (m2-delta §7)

Request: `{project_id?, title, body_md, stack_pins?, policy_iri, status?}`
Response `200`: the persisted row. Errors:

| Status | Condition |
|---|---|
| 401 | Missing/invalid JWT |
| 403 | Principal lacks company-admin role (PLAT-IDENTITY-1 `roles` claim; project scope: project admin) |
| 404 | Project not found (scope='project') |
| 422 | scope/project_id mismatch, bad status, `policy_not_found` |
| 503 | CE-READ-1 unreachable (`ce_unavailable`) |
| 500 | Unexpected |

**`GET /api/standards?scope=&project_id=`** — p95 ≤ 300 ms. `200` list; 401/403/500.

**`GET /api/standards/effective?project_id=`** — p95 ≤ 300 ms. `200` merged list (AC-3);
401/403/404/500.

### Diagram References

| Diagram | File | Section | Summary |
|---|---|---|---|
| Component | `../../tech-spec/m2-delta.md` | §2 diagram | Standards Service (Lambda tier) → Aurora + ce_client |
| Data model | `../../tech-spec/m2-delta.md` | §4 | `standards_documents` DDL + effective-set index |

### Design Decisions

| Decision | Reference | Impact |
|---|---|---|
| Aurora rows, not graph/repo files | [ADR-007](../../decisions/ADR-007.md) | One table + repo methods; prose never mirrored to RDF |
| Whole-key override, no prose merge | [ADR-007](../../decisions/ADR-007.md) §3 | `effective_set` is a dict overlay — do not implement section merging |
| policy_iri validated at authoring only | [ADR-007](../../decisions/ADR-007.md) §2 | Generation uses stored IRI as-is; no CE round-trip per run |
| Absence degrades to demo-default | m2-delta §2 / FR-063 | Missing catalogue is a warning, never a halt |
| Config via PLAT-SETTINGS-1, not env | m2-delta §9 | No new env vars in this task |

## Test Requirements

### Unit Tests (minimum 5)

- `should overlay project standard over company standard by key`
- `should exclude draft and retired rows from effective set`
- `should reject scope/project_id mismatch`
- `should degrade to demo-default stack with warning when catalogue empty`
- `should drive stack selection from stack_pins`

### Integration Tests (minimum 3)

- `should reject standard with unresolvable policy_iri` (CE stub returns 404)
- `should return 503 when CE unreachable at authoring` (CE stub down)
- `should return zero tenant-A standards under tenant-B context` (two-tenant fixture)

### E2E Tests

N/A — API-only in M2 (UI is v1.0); integration covers the surface.

### AC-to-Test Mapping

| AC | Type | Test |
|---|---|---|
| AC-1 | Integration | `should reject standard with unresolvable policy_iri` |
| AC-2 | Integration | `should return 503 when CE unreachable at authoring` |
| AC-3 | Unit | `should overlay project standard over company standard by key` |
| AC-4 | Unit | `should degrade to demo-default stack with warning when catalogue empty` |
| AC-5 | Unit | `should drive stack selection from stack_pins` |
| AC-6 | Integration | `should return zero tenant-A standards under tenant-B context` |
| AC-7 | Unit | `should reject scope/project_id mismatch` |

## Dependencies

- **blocked_by:** []
- **unlocks:** [TASK-003] (both touch the E8-S1 generation-context builder; this task lands
  first), [TASK-005] (this task's migration carries the `projects.last_sdk_version_iri` +
  `sdk_generation_count` columns TASK-005 reads/writes)
- **External prerequisites:** CE-READ-1 entity lookup available (stubbed in tests). This task
  **owns the single m2-delta §4 Alembic migration** — `standards_documents` AND the two
  `projects` column adds; TASK-005 must not create a second migration for those columns

## Cost Estimate

- **Complexity:** M
- **Estimated tokens:** ~14k input, ~6k output
- **Estimated cost:** ~$0.45 (claude-sonnet-5 implementation tier; verify pricing in MEMORY.md)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (status codes + p95)
- [x] Diagram references included
- [x] Design decisions noted (ADR-007)
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing
- [ ] Coverage ≥ 80% changed code; delta mutation ≥ 70%
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] `standards_documents` migration has `ENABLE ROW LEVEL SECURITY` + fail-closed policy
      (invariants.md M2)
- [ ] Docstrings on public APIs
- [ ] Conventional commit(s); PR references this task and EPIC-002

## Implementation Hints

- Reuse the M1 repo-layer base-filter pattern verbatim (D3) — copy the RLS policy from an
  existing migration, do not hand-roll a new predicate.
- `effective_set` is pure given two lists — keep it a free function for trivial unit testing;
  the repo call sites feed it.
- `stack_pins` conflict across keys (two docs pinning different frontends): last-by-sorted-key
  wins is NOT acceptable — raise a named `StandardsConflictError` to the run log and fall back
  to demo-default for the conflicting axis; record it as a finding.
- `ce_client.get_entity` already distinguishes 404 vs transport error in M1 — map the former to
  422 and the latter to 503; do not collapse them.
- Company-admin authz: resolve from the PLAT-IDENTITY-1 JWT `roles` claim (tenant-scoped grant),
  same pattern as the M1 role check used by project settings; no new role logic, no
  workspace-role claim (workspace level dropped).

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
