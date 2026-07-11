---
type: Decision
title: "ADR-025: Explorer Persistence Service (TASK-025) -- tenant_id TEXT, workspace_id shim, AC-9 perf evidence"
description: "explorer_saved_views/explorer_comments use TEXT tenant_id (not the m2-delta-explorer.md §2 code block's literal UUID) to conform to that same section's prose ('same RLS pattern as explorer_layout_positions', whose current form is TEXT post-0014); view-snapshot layout rows use a sentinel workspace_id; AC-9 perf measured against the real 10k-row bulk insert."
tags: [decision, adr, graph-explorer, persistence, rls, tenancy, performance, m2]
status: Accepted
timestamp: 2026-07-11T00:00:00Z
resource: docs/specs/weave/engines/constitution-engine/decisions/ADR-025-explorer-persistence-tenant-id-and-workspace-shim.md
source: hand-authored
confirmed_by: none
confirmed_on: null
last_verified_sha: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: constitution-engine
---

# ADR-025: Explorer Persistence Service -- tenant_id TEXT, workspace_id shim, AC-9 perf evidence

**Scope:** [TASK-025](../v1/tasks/TASK-025.md) (Explorer Persistence Service: Saved Views +
Comments), migrations `0063_explorer_saved_views.sql` / `0064_explorer_comments.sql`.

## Status

Accepted (engineer decision within task scope -- no ambiguity requiring escalation; documents a
divergence from a spec code block, not from spec intent).

## Decision 1: `tenant_id TEXT`, not the literal `UUID` in m2-delta-explorer.md §2's SQL block

`m2-delta-explorer.md` §2 opens: "Two new GE-owned tables... **same RLS pattern as
`explorer_layout_positions`**." That table's RLS pattern, as of migration
`0014_fix_layout_tenant_text.sql`, is `tenant_id TEXT NOT NULL` with an unqcast
`current_setting('app.current_tenant_id', true)` policy expression -- migration 0008's original
`UUID` + `::uuid` cast was a proven-broken pattern (real tenant ids are free-text slugs, e.g.
`acme-corp`, never valid UUIDs; the cast 500s inside Postgres, surfaced as a blanket 503).

The section's literal SQL code block still shows `tenant_id UUID NOT NULL` -- the stale pre-0014
form, not updated when 0014 landed. `explorer_saved_views` and `explorer_comments` therefore use
`TEXT NOT NULL` with the cast-free policy, matching the section's own prose instruction (and this
codebase's only real tenant-id representation) rather than its stale code block. Both tables reuse
`explorer_layout_positions`' RLS key, `app.current_tenant_id`, since the M2 spec frames all three
as one "Explorer Persistence Service."

## Decision 2: view-snapshot `explorer_layout_positions.workspace_id` sentinel

Saving a view snapshots node positions into `explorer_layout_positions` under
`graph_id = 'view:' || view_id` (m2-delta-explorer.md §2). That table's `workspace_id` column is
`UUID NOT NULL` with no FK constraint (migration 0008) -- a residual M1 column the M2 tenancy
realignment (workspace ≡ company) has already made conceptually redundant for these rows (tracked
for removal in the workspace-drop refactor, per m2-delta-explorer.md §2's tenancy note).

View-snapshot rows use a fixed sentinel value, `00000000-0000-0000-0000-000000000000`, for
`workspace_id`. Reads and deletes of `view:*` rows are scoped by `(tenant_id, graph_id)` only
(never `workspace_id`) per the task brief's own implementation hint, so the sentinel is inert --
present only to satisfy the `NOT NULL` constraint until the workspace-drop refactor removes the
column outright.

## Decision 3: AC-4 admin check reads the JWT `roles` claim, not `workspace_members`

AC-4 and m2-delta-explorer.md §2's deletion rule both specify "tenant admin-tier role (**JWT
`roles` claim** per PLAT-IDENTITY-1)" -- and the task brief's own pseudocode passes `claims`
(not a DB connection) into `is_tenant_admin(claims)`. `rbac.is_tenant_admin(conn, tenant_id,
user_sub)` -- the DB-backed helper the implementation hint's wording evokes by name -- reads
`workspace_members` instead, a different (and potentially divergent) source from the one the AC
names. `rbac.has_admin_grant(principal.roles, domain=None)` reads exactly the JWT `roles` claim
already verified onto `Principal` by `get_current_principal`, with no extra DB round-trip, and
matches the pseudocode's claims-based shape. This task's admin checks (delete-any, pin) call
`has_admin_grant`, not `is_tenant_admin` -- read the implementation hint as "mirror that
stub-surface style" (one small wrapper, two call sites), not "call that specific function."

## AC-9 performance evidence (10k-row snapshot insert, `POST /api/views`)

See the AC-9 perf test (`tests/integration/test_views_comments_persistence.py`,
`test_view_save_p95_under_800ms_10k`) for methodology. Measured p95 recorded below once the perf
test has run against the real Aurora-equivalent local Postgres fixture (Law F):

| Run | Rows | Measured p95 | Target |
|---|---|---|---|
| _pending_ | 10,000 | _pending_ | ≤ 800 ms |

Bulk insert uses chunked multi-VALUES batches (~1000 rows/statement) rather than one 10k-row
statement, because a single `INSERT ... VALUES` with ~7 columns × 10,000 rows (~70k bind
parameters) exceeds Postgres's wire-protocol bind-parameter limit (65535). `# ponytail: chunked
multi-VALUES insert; COPY if p95 misses` per the task brief's own hint.

## Consequences

**Positive:** RLS is provably fail-closed for this codebase's real tenant-id shape (conforms to
the spec section's own prose, not its stale code block); AC-4's admin check reads the exact claim
source the AC and DDL section both name, with no new DB query.

**Negative:** the `workspace_id` sentinel is one more place the M1→M2 tenancy realignment leaves a
residual column alive until the tracked workspace-drop refactor lands (not a new debt, just a new
row shape touching existing debt).

## Alternatives considered

- **Follow the spec code block literally (`UUID` + `::uuid` cast)** -- rejected: reproduces a bug
  already fixed once in the sibling table (migration 0014), would 503 on every real save/read.
- **`rbac.is_tenant_admin` (DB `workspace_members` check)** -- rejected: doesn't match the JWT
  `roles`-claim source the AC and DDL section both specify by name; can diverge from it.
- **New FK-cleaned `workspace_id` migration now** -- rejected (YAGNI): out of this task's scope;
  the workspace-drop refactor is already tracked separately.
