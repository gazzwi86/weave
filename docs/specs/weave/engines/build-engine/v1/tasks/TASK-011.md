---
type: Task
title: "Task: TASK-011 — Role Guard (FR-060): Per-Project Roles Enforced at the API Boundary"
description: "FastAPI dependency enforcing project admin/editor roles with the company/domain
  admin-owner overlay read from the PLAT-IDENTITY-1 JWT roles claim (workspace level dropped);
  company-wide read; every denial is 403 + PLAT-AUDIT-1. Gates every PM mutation shipped in
  later v1 tasks."
tags: [build-engine, arch, task, v1]
status: Backlog
priority: Must Have
entity: build-engine
epic: EPIC-002
milestone: v1.0
created: 2026-07-08
blocked_by: [TASK-010]
unlocks: [TASK-014, TASK-017, TASK-020]
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

# Task: TASK-011 — Role Guard (FR-060): Per-Project Roles Enforced at the API Boundary

## Story

**Epic:** [EPIC-002 — Project Registry & Settings](../../../build-engine.md#epic-002)
**Status:** Backlog · **Priority:** Must Have

**As a** company (tenant) member
**I want** project edits restricted to project admins/editors (with company/domain admin-owner
override) while everyone in the company can read
**So that** projects are governed without blocking visibility

> **FRs covered:** FR-060 (role model — defined at M1, enforced here). The role semantics are
> fixed by the E2-S4 AC in the engine spec: **admin** = project settings, contributors,
> external bindings, backlog; **editor** = author specs/backlog, run generation; **all company
> (tenant) users read any project**; **company/domain admin/owner edits any project**.
> **Role source (pinned):** the overlay and grants come from the **PLAT-IDENTITY-1 JWT `roles`
> claim** (tenant + project/domain-scoped grants — contracts.md §PLAT-IDENTITY-1, the single
> contracted source for mutation gates), full record readable at `GET /api/principals/{iri}`;
> effective precedence via `PLAT-SETTINGS-1`. There is **no workspace-role claim** (workspace
> dropped 2026-07-08) and the guard invents no bespoke role lookup.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN a project admin calls a settings/contributors/bindings mutation, THE SYSTEM SHALL allow it | `should allow settings mutation to project admin` |
| AC-2 | WHEN a project editor calls a settings or contributors mutation, THE SYSTEM SHALL return 403 AND write a PLAT-AUDIT-1 denial entry (principal, project, action) | `should deny settings mutation to editor and allow to admin` |
| AC-3 | WHEN a project editor calls a spec/backlog/generation action, THE SYSTEM SHALL allow it | `should allow backlog authoring to editor` |
| AC-4 | WHEN a principal whose JWT `roles` claim carries a tenant admin/owner grant — or a domain admin/owner grant covering the project's domain — calls any project mutation with no contributor row, THE SYSTEM SHALL allow it (overlay from the claim; PLAT-SETTINGS-1 precedence) | `should allow any project mutation to company or domain admin` |
| AC-5 | WHEN any company (tenant) member calls a project read with no contributor row, THE SYSTEM SHALL allow it | `should allow project read to any company member` |
| AC-6 | WHEN a denial occurs and the audit emit fails, THE SYSTEM SHALL still return 403 (the denial never depends on audit availability) | `should return 403 even when audit emit fails` |

## Implementation

### Pseudocode

```
def require_project_role(action: Action):            # FastAPI dependency factory
    async def guard(ctx = Depends(request_context), project_id: UUID):
        # overlay: PLAT-IDENTITY-1 JWT `roles` claim — tenant + project/domain-scoped grants
        # (contracts.md §PLAT-IDENTITY-1; no workspace-role claim exists)
        if has_admin_grant(ctx.roles_claim,           # tenant admin/owner, OR domain
                           domain=project.domain_iri):  # admin/owner covering this project
            return                                    # precedence via PLAT-SETTINGS-1
        role = await repo.contributors.get_role(ctx.tenant_id, project_id, ctx.principal_iri)
        if role_allows(role, action):                 # table: admin ⊇ editor actions
            return
        emit_audit_denial(ctx, project_id, action)    # best-effort; never raises to caller
        raise HTTPException(403)
    return guard

ROLE_ACTIONS = {
  "admin":  {SETTINGS, CONTRIBUTORS, BINDINGS, BACKLOG, SPECS, GENERATE, PROMPT},
  "editor": {BACKLOG, SPECS, GENERATE, PROMPT},
}
# reads carry no guard beyond existing tenancy/auth middleware (AC-5)
```

### API Contracts

No new endpoint — a dependency consumed by every PM mutation route (TASK-014/007/012/013/014).
Consumes: JWT `principal_iri` + `roles` claims (`PLAT-IDENTITY-1` — the `roles` claim is the
contracted role/scope source; `GET /api/principals/{iri}` for the full record if ever needed);
`project_contributors` via TASK-010 repo; `PLAT-AUDIT-1` emitter (M1
`audit` module). Denial audit event shape follows the existing emitter's
`{actor_principal_iri, engine: "build", event_type: "authz_denied", target_iri, diff_summary}`.

### Diagram References

| Diagram | File | Section | Summary |
|---|---|---|---|
| Architecture delta | `../../tech-spec/v1-delta.md` | §2 diagram | Role Guard sits between PM API routes and repo_layer |
| Contract | `../../../../contracts.md` | §PLAT-IDENTITY-1 | `principal_iri` + `roles` claims from JWT (tenant + project/domain grants); no separate resolve call, no bespoke role lookup |

### Design Decisions

| Decision | Reference | Impact |
|---|---|---|
| Enforcement at the API boundary, not in queries | FR-060 / E2-S4 AC | One dependency, uniform 403 semantics; RLS still owns tenancy underneath |
| Admin overlay resolved from the JWT `roles` claim, not the contributor table | contracts.md §PLAT-IDENTITY-1 / `v1-delta.md` §4 note | No row needed for company/domain admins; contributor table stays project-scoped; the claim is the single contracted source |
| Denial audit is best-effort, denial itself is unconditional | AC-6 | Opposite of HITL fail-closed: a 403 must not become a 500 on audit outage; the *denial* is the safe state |
| Action sets as one constants table | pseudocode | Adding a role/action later is a one-line change; no scattered `if role ==` checks |

## Test Requirements

### Unit Tests (minimum 4)

- `should allow settings mutation to project admin`
- `should allow backlog authoring to editor`
- `should deny contributors mutation to editor` (variant of AC-2 on second action class)
- `should return 403 even when audit emit fails` (audit stub raising)

### Integration Tests (minimum 3)

- `should deny settings mutation to editor and allow to admin` (real routes, seeded roles;
  asserts the PLAT-AUDIT-1 stub received the denial entry — Law B backend assertion)
- `should allow any project mutation to company or domain admin` (JWT fixtures: tenant-admin
  grant; domain-admin grant covering the project's domain; domain-admin grant for a DIFFERENT
  domain must be denied)
- `should allow project read to any company member` (no contributor row)

### E2E Tests

Deferred to the first UI task that mounts a guarded mutation (TASK-015 asserts the 403 path
end-to-end through the browser). This task has no UI surface.

### AC-to-Test Mapping

| AC | Type | Test |
|---|---|---|
| AC-1 | Unit | `should allow settings mutation to project admin` |
| AC-2 | Integration | `should deny settings mutation to editor and allow to admin` |
| AC-3 | Unit | `should allow backlog authoring to editor` |
| AC-4 | Integration | `should allow any project mutation to company or domain admin` |
| AC-5 | Integration | `should allow project read to any company member` |
| AC-6 | Unit | `should return 403 even when audit emit fails` |

## Dependencies

- **blocked_by:** [TASK-010] (contributor repo methods)
- **unlocks:** [TASK-014, TASK-017, TASK-020] (TASK-021 consumes the guard transitively via
  TASK-019)
- **External prerequisites:** M1 auth middleware surfacing JWT `principal_iri` (live) — this
  task extends it to parse the PLAT-IDENTITY-1 `roles` claim (Platform mints the claim; contract
  live per PLAT-IDENTITY-1); M1 audit emitter module (live)

## Cost Estimate

- **Complexity:** M
- **Estimated tokens:** ~12k input, ~6k output
- **Estimated cost:** ~$0.40 (claude-sonnet-5 implementation tier)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (dependency; consumed contracts cited)
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
- [ ] `403` and `PLAT-AUDIT-1` greppable in the same handler path (invariants.md verify-by)
- [ ] Docstrings on public APIs
- [ ] Conventional commit(s); PR references this task and EPIC-002

## Implementation Hints

- The M1 `rbac.py` module exists — extend it rather than adding a parallel authz module;
  the guard should live beside the existing permission helpers.
- Do not cache role lookups across requests in v1 — a removed contributor must lose access on
  the next request; one indexed PK lookup per mutation is inside the p95 budgets.
- The audit emitter already has the best-effort/never-raise wrapper pattern (see the recent
  metric-emit change on main) — reuse it for the denial emit.
- Guard *factories* per action class, not per route — routes declare
  `Depends(require_project_role(SETTINGS))`; resist per-route bespoke checks.

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
