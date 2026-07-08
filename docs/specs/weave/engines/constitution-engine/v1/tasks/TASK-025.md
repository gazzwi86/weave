---
type: Task Brief
title: "Task: TASK-025 — Explorer Persistence Service: Saved Views + Comments (Aurora)"
description: "Alembic migrations for explorer_saved_views + explorer_comments (RLS); FastAPI
  routers for views CRUD (with layout snapshot under graph_id='view:'||view_id), share via
  PLAT-NOTIFY-1, and comments CRUD."
tags: [graph-explorer, arch, task, v1]
status: Backlog
priority: Must Have
entity: constitution-engine
epic: EPIC-019
milestone: v1
created: 2026-07-08
blocked_by: []
unlocks: [TASK-026]
adr_refs: [ADR-017-layout-persistence-backend-conventions, ADR-019-edit-attribution-principal-iri]
timestamp: 2026-07-08T00:00:00Z
source: hand-authored
confirmed_by: none
owner: gazzwi86
coverage: n/a
---

# Task: TASK-025 — Explorer Persistence Service: Views + Comments

## Story

**Epic:** [EPIC-019](../../../constitution-engine.md#epic-019--saved-views--layout--m2) (backend;
plus E6-S1/S2 server side of [EPIC-018](../../../constitution-engine.md#epic-018--async-share--comments--m2))
**Status:** Backlog · **Priority:** Must Have

**As a** workshop facilitator
**I want** views and comments persisted server-side, tenant-scoped, with view
layouts that reproduce exactly for colleagues
**So that** my team shares one lens on the model instead of screenshots.

Covers server side of FR-023, FR-024, FR-028, FR-029, FR-030
([constitution-engine.md §6.1](../../../constitution-engine.md#61-functional-requirements)).
Extends the M1 Layout Persistence Service (same FastAPI container — m2-delta-explorer.md §3); DDL is
normative in [m2-delta-explorer.md §2](../../tech-spec/m2-delta-explorer.md).

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|----|------------------|--------------|
| AC-1 | WHEN the migration runs, THE SYSTEM SHALL create `explorer_saved_views` and `explorer_comments` exactly per m2-delta-explorer.md §2 — including `UNIQUE (tenant_id, name)` as a DB constraint and the fail-closed RLS policy on both tables (tenant-scoped — workspace level removed per PLAT-SETTINGS-1). | `test_migration_matches_normative_ddl`, `test_rls_policy_on_both_tables` |
| AC-2 | WHEN `POST /api/views` saves a view, THE SYSTEM SHALL persist the definition (FilterState + overlays + domain focus + viewport, JSONB) AND snapshot current node positions into `explorer_layout_positions` under `graph_id = 'view:' || view_id` in the same transaction. | `test_view_save_snapshots_layout_same_txn` |
| AC-3 | IF a view name collides in the tenant, THEN THE SYSTEM SHALL return `409` with the existing view id (the client prompts overwrite/rename — FR-028); overwrite = idempotent replace of definition + snapshot. | `test_name_collision_409_and_overwrite` |
| AC-4 | WHEN `GET /api/views` lists, THE SYSTEM SHALL return all the tenant's views; WHEN `DELETE /api/views/{id}` is called THE SYSTEM SHALL allow the creator to delete their own view and a tenant admin (admin-tier role from the JWT `roles` claim — PLAT-IDENTITY-1, resolved through PLAT-SETTINGS-1) to delete any, deleting the view's `view:*` layout rows in the same transaction; any other caller SHALL receive `403`. | `test_delete_creator_own_admin_any_else_403`, `test_view_delete_removes_snapshot_rows` |
| AC-5 | WHEN `POST /api/views/{id}/share` is called, THE SYSTEM SHALL publish a PLAT-NOTIFY-1 event to the named recipients, excluding any recipient without graph access (no cross-user leak); the response SHALL name excluded count without naming excluded identities. | `test_share_publishes_and_excludes_ineligible` |
| AC-6 | WHEN `POST /api/comments` persists a comment (target node IRI or view id), THE SYSTEM SHALL stamp `author` from the JWT `principal_iri` claim server-side (ADR-019 pattern) and reject a client-supplied author. | `test_comment_author_from_claim_spoof_rejected` |
| AC-7 | WHEN `PATCH /api/views/{id}/pin` toggles featured status, THE SYSTEM SHALL enforce the pin limit (default 5, tunable): exceeding it returns `409` prompting an unpin; only tenant admins may pin. | `test_pin_limit_409_admin_only` |
| AC-8 | WHEN any read/write runs under a tenant-A JWT, THE SYSTEM SHALL return/affect zero tenant-B rows across views, comments, and `view:*` layout rows; addressing a tenant-B view id SHALL yield `404`. | `test_cross_tenant_views_comments_isolation` |
| AC-9 | WHEN `POST /api/views` runs with a 10k-node snapshot, THE SYSTEM SHALL complete within 800 ms p95 — **measure first** (m2-delta-explorer.md §4 flag): if the bulk UPSERT cannot meet it, raise to the architect before tuning past one batching pass. | `test_view_save_p95_under_800ms_10k` |

## Implementation

### Pseudocode

```
# FastAPI, same container as M1 layout service. EVERY handler:
#   async with session.begin():
#       await session.execute(text("SET LOCAL app.current_tenant_id = :t"), {...})
#       ... DML ...
# (ADR-017 conventions — GUC inside txn, asyncpg, parameterised only.)

POST /api/views (body: { name, definition }):
  claims = validate_jwt(req)                       # tenant, principal_iri, roles
  txn:
    set_local_tenant(claims.tenant_id)
    existing = SELECT view_id FROM explorer_saved_views WHERE name  # RLS scopes to tenant
    if existing and not body.overwrite: return 409 { existing_view_id }      # AC-3
    view_id = upsert view row (created_by = claims.principal_iri)
    DELETE FROM explorer_layout_positions WHERE graph_id = 'view:'||view_id  # replace snapshot
    INSERT INTO explorer_layout_positions
      SELECT tenant, 'view:'||view_id, node_iri, x, y, locked=true, now()
      FROM current canvas positions (body.positions — client sends drag-state)  # AC-2 same txn
      # (M1 table's residual workspace_id column: fill per the M1-transition shim until the
      #  workspace-drop refactor lands — spec key is (tenant_id, graph_id))
  return 201 { view_id }

DELETE /api/views/{id}:
  txn: set_local; row = SELECT … (404 if none — RLS makes tenant-B invisible)   # AC-8
       allowed = row.created_by == claims.principal_iri
                 OR is_tenant_admin(claims)        # roles claim (PLAT-IDENTITY-1) resolved via
                                                   # PLAT-SETTINGS-1 cascade, stubbed in tests
       if !allowed: return 403                                                   # AC-4
       DELETE view row; DELETE layout rows 'view:'||id                           # same txn

POST /api/views/{id}/share (body: { recipients }):
  eligible = [r for r in recipients if has_graph_access(r, claims.tenant_id)]    # AC-5
  publish_plat_notify({ type: "explorer.view-shared", view_id, actor: claims.principal_iri,
                        recipients: eligible })
  return 202 { notified: len(eligible), excluded: len(recipients) - len(eligible) }

POST /api/comments (body: { target_kind, target_ref, body }):
  if "author" in body: return 400                   # AC-6 spoof guard (ADR-019 pattern)
  txn: set_local; INSERT (author = claims.principal_iri)

PATCH /api/views/{id}/pin:
  if !is_tenant_admin(claims): return 403
  txn: if pinning and COUNT(pinned)= config.pin_limit: return 409               # AC-7
       UPDATE pinned
```

### API Contracts

New endpoints (Explorer-owned — not inter-engine contracts; tenant-scoped):

| Endpoint | Success | Errors | p95 |
|---|---|---|---|
| `POST /api/views` | `201 {view_id}` | 400 no name · 401 · 409 collision · 422 bad definition | ≤ 800 ms incl. 10k snapshot |
| `GET /api/views` | `200 [{view_id,name,created_by,pinned,updated_at}]` | 401 | ≤ 300 ms |
| `DELETE /api/views/{id}` | `204` | 401 · 403 not owner/admin · 404 | ≤ 300 ms |
| `POST /api/views/{id}/share` | `202 {notified,excluded}` | 401 · 404 | ≤ 300 ms |
| `PATCH /api/views/{id}/pin` | `200` | 401 · 403 · 404 · 409 limit | ≤ 300 ms |
| `GET /api/comments?target_kind&target_ref` | `200 [...]` | 400 · 401 | ≤ 300 ms |
| `POST /api/comments` | `201 {comment_id}` | 400 spoofed author/empty body · 401 · 422 | ≤ 300 ms |

PLAT-NOTIFY-1: publish-only, open notification-type taxonomy
([contracts.md §PLAT-NOTIFY-1](../../../../contracts.md)) — event type
`explorer.view-shared`; stubbed in all tests (Law F).

### Diagram References

| Diagram | File | Section | Summary |
|---------|------|---------|---------|
| Component delta | `../../tech-spec/m2-delta-explorer.md` | §6 | Persistence Service edges (Aurora, PLAT-NOTIFY-1) |
| ERD (M1) | `../../tech-spec/data-model-explorer.md` | Entity Relationship Diagram | Layout table the snapshot reuses |
| DDL (M2) | `../../tech-spec/m2-delta-explorer.md` | §2 | Normative table definitions this task migrates |

### Design Decisions

| Decision | Reference | Impact |
|----------|-----------|--------|
| View layout = snapshot into layout table under `view:{id}`; no second store | m2-delta-explorer.md §2 | Snapshot + view row are one transaction; `locked=true` on snapshot rows |
| Name uniqueness = DB constraint | m2-delta-explorer.md §2 | 409 comes from the constraint/pre-check, not app-only logic |
| Author/creator stamped from `principal_iri`, spoof-rejected | ADR-019 | Same guard pattern as TASK-023's proxy |
| Admin = tenant admin-tier role: JWT `roles` claim (PLAT-IDENTITY-1) resolved through the PLAT-SETTINGS-1 cascade | FR-029 | Resolution stubbed; never trust a client-sent role |
| RLS + SET LOCAL per ADR-017 conventions | ADR-017-layout-persistence-backend-conventions | Handlers copy the M1 layout-service session pattern exactly |

## Test Requirements

### Unit (minimum 4)

- `should reject client-supplied author with 400`
- `should return 409 with existing view id on name collision`
- `should mark snapshot rows locked=true under view: graph id`
- `should compute excluded recipient count without leaking identities`

### Integration (minimum 5, against local Postgres — Law F)

- `should create both tables with RLS and unique constraint (migration test)`
- `should save view + snapshot atomically and roll both back on failure`
- `should let creator delete own, admin delete any, others 403`
- `should return zero tenant-B rows and 404 for tenant-B view id (two-tenant seed)`
- `should enforce pin limit with 409`

### E2E (minimum 1, Playwright + service)

- `should save a view, share it, and see the PLAT-NOTIFY-1 stub receive the event`

### AC-to-Test Mapping

| AC | Type | Test |
|----|------|------|
| AC-1 | Integration | migration test |
| AC-2 | Integration | atomic save/rollback test |
| AC-3 | Unit + Integration | collision tests |
| AC-4 | Integration | delete-authorisation + snapshot-rows tests |
| AC-5 | Unit + E2E | exclusion + share E2E |
| AC-6 | Unit | author spoof test |
| AC-7 | Integration | pin-limit test |
| AC-8 | Integration | two-tenant isolation test |
| AC-9 | Perf trace | `test_view_save_p95_under_800ms_10k` (measure-first note) |

## Dependencies

- **blocked_by:** none within M2 (backend-only; M1 layout service + Aurora exist)
- **unlocks:** TASK-026 (all UI for these endpoints)
- **External:** PLAT-NOTIFY-1 publish stub; PLAT-SETTINGS-1 role-resolution stub; local
  Postgres fixture with two-tenant seed (extends the M1 RLS fixture).

## Cost Estimate

- **Complexity:** L (migrations + 7 endpoints + authz matrix + atomicity)
- **Estimated tokens:** ~16k input, ~10k output (claude-sonnet-5)
- **Estimated cost:** ~$0.55

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (all endpoints, all error codes, p95 each — Arch Law 2)
- [x] Diagram references included
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing (incl. two-tenant isolation — release-gate feeder)
- [ ] Coverage ≥ 80%; mutation ≥ 60%
- [ ] Lint passes; complexity within thresholds
- [ ] Migration is a single Alembic upgrade step; downgrade drops cleanly
- [ ] p95 measurements recorded in the PR (AC-9 measure-first)
- [ ] Conventional commit(s); PR references this task and EPIC-019
- [ ] No implementation beyond AC + pseudocode (no view versioning, no comment threads — YAGNI)

## Implementation Hints

- Copy the M1 layout-service session/GUC helper verbatim (ADR-017) — do not reinvent the
  transaction wrapper; the RLS fail-closed property depends on it.
- Snapshot INSERT: client sends current positions in the save body (the canvas has them);
  do NOT read them back from the layout table — the user may have unsaved drag state.
- Bulk snapshot at 10k rows: use one `INSERT … VALUES` batch (or `COPY` if needed after
  measuring) — `# ponytail: single multi-VALUES insert; COPY if p95 misses`.
- `has_graph_access(recipient)`: tenant membership + graph access via PLAT-SETTINGS-1
  resolution — same stub surface as `is_tenant_admin`; one helper, two call sites.
- 404-not-403 for cross-tenant ids: RLS already makes tenant-B rows invisible, so the natural
  "no row found" 404 is correct — do not add an existence probe.

---

*Generated by Weave Architect (arch-task-brief). Self-contained — engineer reads only this file.*
