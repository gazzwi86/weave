---
type: Decision
title: "ADR-004: TASK-004 layout-persistence backend follows the codebase's asyncpg + active-workspace conventions, not the brief's SQLAlchemy/JWT-claim assumptions"
description: "TASK-004's pseudocode assumes SQLAlchemy async + a workspace_id JWT claim, neither of which exist anywhere in this codebase. Engineering decision: implement with raw asyncpg (the sole DB-access style used by every existing router) and resolve workspace_id via the same optional-param + active-session fallback that sparql.py/search.py already established, rather than introducing a new ORM or a JWT claim no token issuer emits."
tags: [decision, adr, graph-explorer, layout-persistence, aurora, m1]
status: Accepted
timestamp: 2026-07-05T00:00:00Z
resource: docs/specs/weave/engines/graph-explorer/decisions/ADR-004-layout-persistence-backend-conventions.md
source: hand-authored
confirmed_by: none
confirmed_on: null
last_verified_sha: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: graph-explorer
---

# ADR-004: TASK-004 layout-persistence backend conventions

**Scope:** [Graph Explorer](../../graph-explorer.md) TASK-004 (Server-Side Layout Persistence)
backend implementation only.

## Status

**Accepted — Engineer decision during TASK-004 implementation.** No open trade-off requiring
human sign-off: every divergence below resolves in favour of an already-established, already-tested
codebase convention over the brief's generic pseudocode assumption, the same reasoning TASK-001's
own ADR-001 sign-off already applied to this table's `tenant_id UUID` divergence.

## Context and decisions

1. **asyncpg, not SQLAlchemy.** The brief's pseudocode writes `AsyncSession = Depends(get_db_session)`
   and `text("...")` named-params (a SQLAlchemy-async shape). No router in
   `packages/backend/src/weave_backend` uses SQLAlchemy anywhere — `db/pool.py`'s own docstring
   states this is a deliberate choice ("no ORM/Alembic exists yet... promote SQLAlchemy + Alembic
   [only when] a future task needs schema-diffing/rollback machinery"). Every existing router
   (`sparql.py`, `search.py`, `billing.py`, `identity.py`) uses `asyncpg.Connection` with positional
   `$1`/`$2` parameters. Introducing SQLAlchemy for one route would add a second, parallel DB-access
   framework the rest of the codebase doesn't use — the opposite of "common-stack first." **Decision:
   implement with `asyncpg`, positional parameters (still fully parameterised — no string
   concatenation, satisfying `security.md` regardless of which parameter-binding syntax is used).**

2. **`workspace_id` has no JWT claim — reuse the active-workspace fallback, and the same
   membership check.** The brief's pseudocode reads `claims.get("workspace_id")` and 422s if
   absent. The real `Principal` model (`auth/dependencies.py`) carries `sub` / `tenant_id` /
   `principal_iri` only — no token issuer in this codebase ever emits a `workspace_id` claim.
   `sparql.py`'s `_resolve_named_graph` and `search.py`'s `_authorize_search` already solve exactly
   this: `workspace_id` is an **optional** request parameter that falls back to
   `tenancy.sessions.get_active_workspace(tenant_id, sub)` (the caller's Redis-backed
   active-workspace pointer) when omitted, **and** — because a client-suppliable `workspace_id` is
   an IDOR surface the moment it's trusted without a check — both call `tenancy.workspaces.get_workspace`
   (404 if the id doesn't exist for this tenant) then `rbac.enforce_workspace_role` (403 if the
   caller has no active membership row) before ever touching the workspace's data, on a real
   `db.pool.tenant_connection` (the connection `workspaces`/`workspace_members`'s own RLS policy —
   keyed on `app.tenant_id` — actually requires). **Decision: `layout.py` reuses this exact
   pattern in full**, via its own `_authorize_workspace` helper — `workspace_id: str | None`
   accepted on all three routes (body field for POST, query param for GET/DELETE), falling back to
   `get_active_workspace`, then authorized via `_authorize_workspace` (`404 workspace_not_found` /
   `403 forbidden`, translated to this router's flat-body convention); `422 missing_workspace_id`
   if neither the request nor the active-session fallback resolves an id at all.
   *(QA-FAIL correction, 2026-07-06: the first implementation reused only the fallback half of
   this pattern and dropped the membership check entirely — a real cross-workspace IDOR, since
   `workspace_id` is client-suppliable. `_authorize_workspace` closes that gap; this ADR originally
   claimed the pattern was already mirrored in full, which was inaccurate until this fix.)*

3. **A dedicated `_layout_connection` helper, not the shared `tenant_connection`.** Per TASK-001's
   already-human-approved schema divergence (ADR-001 Status: "Schema (AC-4/AC-5): approved as-is...
   including its UUID + hard-error-if-`app.current_tenant_id`-unset divergence from
   `0001_tenancy.sql`'s TEXT + missing_ok pattern"), `explorer_layout_positions`'s RLS policy reads
   `current_setting('app.current_tenant_id')::uuid` — a different config key and a stricter
   (non-`missing_ok`) read than every other table's `app.tenant_id`. Reusing `db.pool.tenant_connection`
   (which sets `app.tenant_id`) would silently fail this table's RLS. **Decision: `layout.py` defines
   its own `_layout_connection(tenant_id)` async context manager**, structurally identical to
   `tenant_connection` (acquire from the shared `get_app_pool()`, open a transaction, `set_config`
   before any query) but targeting `app.current_tenant_id`, and it casts/validates `tenant_id` as a
   UUID string before use (a non-UUID `tenant_id`, e.g. a test's human-readable slug, must fail
   loudly with `503 store_unavailable`, not silently corrupt or bypass RLS) — the accepted trade-off
   TASK-001 already signed off on. Corollary (see decision 2's QA-FAIL correction):
   `_authorize_workspace`'s `get_workspace`/`enforce_workspace_role` calls run on a **real**
   `tenant_connection`, never `_layout_connection` — `workspaces`/`workspace_members`'s RLS policy
   is keyed on `app.tenant_id`, so authorizing on a connection that only ever set
   `app.current_tenant_id` would leave `app.tenant_id` unset and RLS would silently return zero
   rows for every workspace, turning every real caller into a false `404`.

## Consequences

**Positive:** zero new dependencies, zero divergent DB-access style beyond the one already
human-accepted for this table; every other router's mocking/testing pattern (dependency override +
`AsyncMock`/fake `asyncpg.Connection`) applies unchanged to `layout.py`'s unit tests.

**Negative:** any GE tenant whose `tenant_id` isn't a real UUID (e.g. a legacy/mock tenant minted as
a human-readable slug) cannot use layout persistence until the platform-wide `tenant_id` typing is
reconciled — this is TASK-001's already-accepted trade-off, not a new one introduced here; flagged
again for visibility since it now has a concrete failure mode (`503` on a non-UUID tenant).

## Alternatives considered

- **Add SQLAlchemy just for this route** — rejected: contradicts Law A (common-stack first) and
  `db/pool.py`'s own documented reasoning for staying ORM-free until a real schema-diffing need
  exists; TASK-004 is not that need.
- **Require the frontend to pass `workspace_id` explicitly on every layout call** — rejected: no
  existing Explorer UI has workspace-switcher state (same gap `search.py`'s docstring notes for the
  Cmd-K palette); forcing it here would mean building UI this task's AC never asks for.
- **Relax the layout table's RLS to the platform's `app.tenant_id` + `missing_ok` + TEXT type** —
  rejected: overrides a decision the human already explicitly accepted at TASK-001 sign-off; not
  this task's call to revisit.
