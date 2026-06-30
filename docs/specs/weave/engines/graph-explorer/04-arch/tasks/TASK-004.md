---
type: Task Brief
title: "Task: TASK-004 — Server-Side Layout Persistence"
description: "Persist node drag positions server-side to Aurora per (tenant, workspace, graphId);
  restore on Explorer load; reset on demand. FR-008, net-new Aurora schema from TASK-001."
tags: [graph-explorer, 04-arch, task, m1, aurora, layout]
status: Backlog
priority: Must Have
entity: graph-explorer
epic: EPIC-001
milestone: M1
created: 2026-07-01
blocked_by: [TASK-001, TASK-002]
unlocks: []
adr_refs: []
timestamp: 2026-07-01T00:00:00Z
source: hand-authored
confirmed_by: none
confirmed_on: null
last_verified_sha: e6499f88873d7157bed76c3632ce25e2f5fb6d4b
expires_on: 2026-12-28
owner: gazzwi86
coverage: n/a
---

# Task: TASK-004 — Server-Side Layout Persistence

> **Risk flag (FR-008, SS-GE-3):** The `explorer_layout_positions` Aurora schema is net-new (no
> prototype server-side layout existed). TASK-001 designs and approves the schema before this task
> starts; any schema ambiguity must be raised with the Architect before writing a line of code.

## Story

**Epic:** [EPIC-001](../../../graph-explorer.md#epic-001--whole-company-canvas-force-mode--m1)
**Status:** Backlog
**Priority:** Must Have

**As a** viewer or enterprise architect
**I want** my node drag positions to be saved automatically on the server and restored when I reopen
the Explorer
**So that** my layout is durable across browser sessions and consistent with what my colleagues see
in the same workspace.

Covers: FR-008 from [graph-explorer.md §2.1](../../../graph-explorer.md#21-functional-requirements).

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|----|------------------|--------------|
| AC-1 | WHEN a viewer drags a node and releases it, THE SYSTEM SHALL persist `(position_x, position_y)` to the `explorer_layout_positions` Aurora table scoped to `(tenant_id, workspace_id, graph_id, node_iri)` using a parameterised UPSERT via SQLAlchemy async; the UPSERT SHALL update `position_x`, `position_y`, and `updated_at` on conflict. | `test_drag_persists_position_to_aurora_upsert` |
| AC-2 | WHEN a layout save fails (SQLAlchemyError or network error), THE SYSTEM SHALL hold the position in memory and retry with exponential backoff (delays: 2 s / 4 s / 8 s, max 3 retries); if all retries are exhausted, THE SYSTEM SHALL surface a non-blocking toast notification; the position SHALL NOT be silently dropped. | `test_failed_save_retries_exponential_and_shows_toast` |
| AC-3 | WHEN the Explorer loads for a viewer (same tenant + workspace + graph), THE SYSTEM SHALL fetch saved positions from `explorer_layout_positions` and pass them to the Cytoscape canvas before the fcose layout runs; nodes with saved positions SHALL be placed at those coordinates; nodes without saved positions SHALL receive fcose-computed positions. | `test_saved_positions_applied_before_fcose_on_load` |
| AC-4 | WHEN a viewer clicks "Reset layout", THE SYSTEM SHALL delete all rows in `explorer_layout_positions` for `(tenant_id, workspace_id, graph_id)` using a parameterised DELETE, then re-run the fcose layout from scratch. | `test_reset_layout_clears_aurora_rows_and_reruns_fcose` |
| AC-5 | WHEN positions are loaded on Explorer open, THE SYSTEM SHALL apply them to the Cytoscape canvas before the layout initialises; restored coordinates SHALL match the persisted `(position_x, position_y)` values to within ±0.5 canvas units (floating-point drift tolerance). | `test_restored_positions_within_tolerance` |
| AC-6 | WHEN a layout save, fetch, or delete is requested with a `tenant_id` that does not match the authenticated Cognito JWT's tenant claim, THE SYSTEM SHALL return HTTP 403 with `{"error": "forbidden"}` and write nothing to Aurora. | `test_layout_rejects_mismatched_tenant_id` |
| AC-7 | WHEN any layout read (GET) is issued under a tenant-A JWT, THE SYSTEM SHALL return zero rows belonging to tenant-B; the Aurora row-level-security policy `(tenant_id = current_setting('app.current_tenant_id')::uuid)` SHALL be active and enforced at the database layer independent of application-layer checks. | `test_cross_tenant_layout_isolation_rls` |

## Implementation

### Pseudocode

```
# Backend: FastAPI layout-persistence routes (Python 3.12, SQLAlchemy async)

# ── POST /api/layout/positions ──────────────────────────────────────────────

async def save_node_position(
    request: LayoutSaveRequest,   # graph_id, node_iri, position_x, position_y
    jwt: str = Depends(get_jwt),  # FastAPI dependency; raises 401 if missing
    db: AsyncSession = Depends(get_db_session),
):
  # Input gates (before any DB interaction)
  if not jwt:
    raise HTTPException(401, {"error": "unauthorised"})
  claims = cognito.verify(jwt)           # raises 401 if expired / wrong issuer / wrong pool
  if not claims.get("tenant_id"):
    raise HTTPException(401, {"error": "unauthorised"})
  if not claims.get("workspace_id"):
    raise HTTPException(422, {"error": "missing_workspace_id"})
  if not request.graph_id:
    raise HTTPException(422, {"error": "missing_field", "field": "graph_id"})
  if not is_absolute_iri(request.node_iri):
    raise HTTPException(422, {"error": "invalid_iri", "field": "node_iri"})
  if not isinstance(request.position_x, (int, float)):
    raise HTTPException(422, {"error": "invalid_position", "field": "position_x"})
  if not isinstance(request.position_y, (int, float)):
    raise HTTPException(422, {"error": "invalid_position", "field": "position_y"})

  async with db.begin():
    # Set RLS context on this connection before any query
    await db.execute(
      text("SET LOCAL app.current_tenant_id = :tid"),
      {"tid": str(claims["tenant_id"])}
    )
    # Parameterised UPSERT — no string concatenation into SQL
    await db.execute(
      text("""
        INSERT INTO explorer_layout_positions
          (tenant_id, workspace_id, graph_id, node_iri, position_x, position_y, updated_at)
        VALUES (:tid, :wid, :gid, :niri, :px, :py, now())
        ON CONFLICT (tenant_id, workspace_id, graph_id, node_iri)
        DO UPDATE SET
          position_x = EXCLUDED.position_x,
          position_y = EXCLUDED.position_y,
          updated_at = now()
      """),
      {
        "tid":  claims["tenant_id"],
        "wid":  claims["workspace_id"],
        "gid":  request.graph_id,
        "niri": request.node_iri,
        "px":   request.position_x,
        "py":   request.position_y,
      }
    )
  # On SQLAlchemyError: raise HTTPException(503, {"error": "store_unavailable"})
  return Response(status_code=204)


# ── GET /api/layout/positions?graph_id={graph_id} ───────────────────────────

async def get_layout_positions(
    graph_id: str,
    jwt: str = Depends(get_jwt),
    db: AsyncSession = Depends(get_db_session),
):
  if not jwt:
    raise HTTPException(401, {"error": "unauthorised"})
  claims = cognito.verify(jwt)
  if not graph_id:
    raise HTTPException(422, {"error": "missing_field", "field": "graph_id"})

  async with db.begin():
    await db.execute(
      text("SET LOCAL app.current_tenant_id = :tid"),
      {"tid": str(claims["tenant_id"])}
    )
    result = await db.execute(
      text("""
        SELECT node_iri, position_x, position_y, locked
        FROM explorer_layout_positions
        WHERE tenant_id = :tid
          AND workspace_id = :wid
          AND graph_id = :gid
      """),
      {
        "tid": claims["tenant_id"],
        "wid": claims["workspace_id"],
        "gid": graph_id,
      }
    )
  return {"positions": result.mappings().all()}


# ── DELETE /api/layout/positions?graph_id={graph_id} ────────────────────────

async def reset_layout(
    graph_id: str,
    jwt: str = Depends(get_jwt),
    db: AsyncSession = Depends(get_db_session),
):
  if not jwt:
    raise HTTPException(401, {"error": "unauthorised"})
  claims = cognito.verify(jwt)
  if not graph_id:
    raise HTTPException(422, {"error": "missing_field", "field": "graph_id"})

  async with db.begin():
    await db.execute(
      text("SET LOCAL app.current_tenant_id = :tid"),
      {"tid": str(claims["tenant_id"])}
    )
    await db.execute(
      text("""
        DELETE FROM explorer_layout_positions
        WHERE tenant_id = :tid
          AND workspace_id = :wid
          AND graph_id = :gid
      """),
      {
        "tid": claims["tenant_id"],
        "wid": claims["workspace_id"],
        "gid": graph_id,
      }
    )
  return Response(status_code=204)


# ── Client-side: optimistic drag + retry ────────────────────────────────────

async function onNodeDragEnd(nodeIri: string, pos: {x: number, y: number},
                              jwt: string, graphId: string, config: Config):
  updateInMemoryPosition(nodeIri, pos)   # optimistic hold; no wait for server
  await retryWithBackoff(
    fn=() => fetch("POST /api/layout/positions", {
      node_iri: nodeIri, graph_id: graphId,
      position_x: pos.x, position_y: pos.y,
    }),
    delays: [2_000, 4_000, 8_000],       # ms; config-tunable
  ).catch(() => showToast("Layout save failed — changes may not persist"))
  # Never silently dropped; always shows toast on exhaustion
```

### API Contracts

**`POST /api/layout/positions`**

Request body:

```json
{
  "graph_id":   "string — graph identifier, non-empty (required)",
  "node_iri":   "string — fully-qualified IRI of the node (required)",
  "position_x": "number — canvas X coordinate, float (required)",
  "position_y": "number — canvas Y coordinate, float (required)"
}
```

Response `204`: No content — position saved.

**`GET /api/layout/positions?graph_id={graph_id}`**

Response `200`:

```json
{
  "positions": [
    {
      "node_iri":   "https://example.org/entity/cust-onboarding",
      "position_x": 120.5,
      "position_y": -40.1,
      "locked":     false
    }
  ]
}
```

**`DELETE /api/layout/positions?graph_id={graph_id}`**

Response `204`: No content — layout cleared.

Error responses (all three endpoints):

| Status | Condition | Body |
|--------|-----------|------|
| 401 | Missing or invalid JWT | `{"error": "unauthorised"}` + `Www-Authenticate: Bearer` |
| 403 | `tenant_id` in request body does not match JWT claim | `{"error": "forbidden"}` |
| 422 | Missing or invalid field | `{"error": "<code>", "field": "<name>"}` |
| 503 | Aurora unavailable | `{"error": "store_unavailable"}` |

### Diagram References

| Diagram | File | Relevant Section | Summary |
|---------|------|------------------|---------|
| Sequence | `../tech-spec/business-process.md` | `#layout-persist-flow` | Pending — to be added to tech-spec before implementation starts |
| State | `../tech-spec/business-process.md` | `#layout-load-state` | Pending — to be added to tech-spec before implementation starts |
| Data Model | `../tech-spec/data-model.md` | `#explorer-layout-positions` | Pending — approved schema delivered by TASK-001; data-model doc must be updated before this task starts |

### Design Decisions

| Decision | Reference | Impact on This Task |
|----------|-----------|---------------------|
| Server-side layout persistence per (tenant, workspace, graphId) — not localStorage (D2, FR-008) | [graph-explorer.md §2.5](../../../graph-explorer.md#25-key-design-decisions) | Every read/write must be scoped by all three keys; no per-browser storage path |
| Aurora schema: `explorer_layout_positions` with RLS policy `tenant_id = current_setting('app.current_tenant_id')::uuid` | TASK-001 deliverable (AC-4) | `SET LOCAL app.current_tenant_id` must be called inside every `async with db.begin()` block before any query; failing to do so bypasses RLS |
| Aurora PostgreSQL Serverless v2 + SQLAlchemy async + asyncpg driver (confirmed stack) | [CLAUDE.md](../../../../../CLAUDE.md) | Use `asyncpg` dialect; parameterised queries only via `text()` + named params (no string concatenation) |
| Failed layout save → optimistic hold + retry + non-blocking toast; never silently dropped (FR-008) | [graph-explorer.md §2.1](../../../graph-explorer.md#21-functional-requirements) | Client retry logic: 3 attempts with [2 s, 4 s, 8 s] delays; toast on exhaustion; all tunable |
| `locked` field reserved for M2 Saved Views; default `false` at insert; not writable via this task's API | [graph-explorer.md §1.1](../../../graph-explorer.md#scope) | This task's POST endpoint does not accept a `locked` field; DB default handles it |
| Secrets in AWS Secrets Manager only | [CLAUDE.md](../../../../../CLAUDE.md) | Aurora connection string fetched from Secrets Manager at startup; never in `.env` or source |

## Test Requirements

### Unit Tests (minimum 5)

- `should return 401 when JWT is absent on POST /api/layout/positions`
- `should return 422 when node_iri is not a valid absolute IRI on POST /api/layout/positions`
- `should execute a parameterised UPSERT with correct tenant_id, workspace_id, graph_id, node_iri`
- `should return 403 when the tenant_id in the request does not match the JWT tenant claim`
- `should return 204 with no body on successful DELETE /api/layout/positions`

### Integration Tests (minimum 3)

- `should persist a node position via POST and retrieve it unchanged via GET (float precision
  within ±0.5 canvas units)`
- `should return zero positions via GET for tenant-A session when all rows belong to tenant-B (RLS
  enforcement — set app.current_tenant_id to tenant-A UUID in test fixture)`
- `should retry the save call 3 times with 2/4/8 s delays and show toast notification when all
  retries fail`

### E2E Tests (minimum 1)

- `should drag a node, reload the Explorer, and confirm the node appears at the dragged position
  (Playwright, Aurora backed by test database fixture)`

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|----|-----------|-----------|
| AC-1 | Integration | `should persist a node position via POST and retrieve it unchanged via GET` |
| AC-2 | Integration | `should retry the save call 3 times with 2/4/8 s delays and show toast notification` |
| AC-3 | E2E | `should drag a node, reload the Explorer, and confirm the node appears at the dragged position` |
| AC-4 | Unit | `should return 204 with no body on successful DELETE /api/layout/positions` |
| AC-5 | Integration | `should persist a node position via POST and retrieve it unchanged via GET` (tolerance assertion) |
| AC-6 | Unit | `should return 403 when the tenant_id in the request does not match the JWT tenant claim` |
| AC-7 | Integration | `should return zero positions via GET for tenant-A session when all rows belong to tenant-B` |

## Dependencies

- **blocked_by:** [TASK-001 (Aurora schema approval required before writing any DB code),
  TASK-002 (canvas drag events must exist for client-side integration)]
- **unlocks:** []
- **External:** "Aurora PostgreSQL test database fixture available in CI; Cognito test JWT with
  `tenant_id` and `workspace_id` claims"

## Cost Estimate

- **Complexity:** M (3 FastAPI endpoints, Aurora UPSERT + RLS, client retry logic)
- **Estimated tokens:** ~10k input, ~7k output
- **Estimated cost:** ~$1.00 (claude-opus-4-8 at time of writing)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (all 3 endpoints with error tables)
- [ ] Diagram references included — Pending: tech-spec and data-model doc to be written; known
  blocker (Architect creates before implementation)
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined (blocked_by and unlocks)
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing
- [ ] Coverage ≥ 80% for changed code
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] JSDoc / docstrings on public APIs
- [ ] Conventional commit(s) created
- [ ] No implementation beyond the task brief's AC and pseudocode (YAGNI)
- [ ] PR references this task and EPIC-001

## Implementation Hints

- `SET LOCAL app.current_tenant_id = :tid` is connection-scoped (not transaction-scoped); it must
  be called inside `async with db.begin()` on the same connection as the subsequent query.
  SQLAlchemy async connection pools reuse connections across requests, so never assume a previous
  `SET LOCAL` persists.
- Use `ON CONFLICT DO UPDATE` (not `INSERT OR IGNORE`) so that the latest drag position always
  wins. Duplicate-drag calls with the same IRI must update, not silently skip.
- The `locked` column is set by the DB default (`FALSE`) at INSERT time; this task's POST endpoint
  must not accept or process a `locked` field — reject it with 422 if present to avoid confusion
  with the M2 Saved Views feature.
- To test RLS in isolation without E2E: set `SET LOCAL app.current_tenant_id = '{tenant_b_uuid}'`
  in a test transaction before a SELECT and assert the result set is empty; then test without the
  SET LOCAL to confirm tenant-A rows are returned correctly.
- The client retry `delays: [2_000, 4_000, 8_000]` values must come from the `config` object (not
  literal constants in the component) to satisfy the "tunable" requirement.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*
