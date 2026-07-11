# Progress: CE-V1-TASK-025 — Explorer Persistence: Saved Views + Comments (EPIC-019, sole task → closes epic)

`constitution-engine` EPIC-019. Worktree `../weave-CE-V1-EPIC-019`, branch `feature/CE-V1-EPIC-019` (off green main
6c030c4). Backend slice (UI = TASK-026/EPIC-018, next consumer). Built across overflow + 2 continuations (commit-first
recovery — STEP-0 committed the prior engineer's intact-but-uncommitted work). Coordinator-authored pre-QA. HEAD `e133925`,
not pushed, tree clean, containers torn down.

## What shipped (9 ACs, all Done per engineer)
- **Migration 0063 `explorer_saved_views`** + **0064 `explorer_comments`** — both `tenant_id TEXT` (ADR-025 decision 1:
  deliberate divergence from spec's UUID, matches already-fixed `0014_fix_layout_tenant_text.sql`), `ENABLE`+`FORCE` RLS +
  `tenant_isolation` policy on `current_setting('app.current_tenant_id', true)`, `GRANT SELECT,INSERT,UPDATE,DELETE TO
  weave_app`. 0063: `UNIQUE(tenant_id,name)`. 0064: `CHECK target_kind IN ('node','view')` + index `(tenant_id,target_kind,
  target_ref)`. **No sequence/USAGE grant needed** — both use `gen_random_uuid()` defaults (no SERIAL). Verified live vs real PG.
- `explorer/persistence.py` — shared `explorer_connection` (RLS GUC helper) + `has_graph_access`.
- `routers/views.py` — `POST/GET /api/views`, `DELETE /api/views/{id}`, `POST /api/views/{id}/share`, `PATCH /api/views/{id}/pin`.
- `routers/comments.py` — `POST/GET /api/comments`. **Both routers were built-but-unwired until `e133925`** registered them
  in `__init__.py` (were unreachable — good catch on the finish pass).

## Per-AC (engineer-reported — QA re-verify; 9 ACs counted exactly)
- AC-1 migration DDL + fail-closed RLS ✓ (`test_migration_creates_tables_with_rls_and_unique_constraint` checks
  relrowsecurity/relforcerowsecurity + policy on both + UNIQUE).
- AC-2 `POST /api/views` saves definition + snapshot ATOMICALLY ✓ (happy path 2 snapshot rows + forced mid-txn failure via
  dup node_iri proves view row rolls back too).
- AC-3 name collision → 409 w/ existing id, `overwrite` replaces ✓ (integration + unit).
- AC-4 creator/admin delete, else 403, snapshot rows cascade ✓.
- AC-5 share → PLAT-NOTIFY-1, excludes ineligible, count-only no identity leak ✓ (`{"notified":1,"excluded":1}`, only
  eligible recipient's notifications row exists). E2E slot = service-level (share UI = TASK-026, not yet built; documented
  deviation like test_workspace_switch_e2e.py).
- AC-6 comment author stamped server-side from JWT, spoof → 400 ✓.
- AC-7 pin limit 5, admin-only ✓ (non-admin 403 real JWT, 5 succeed, 6th 409).
- AC-8 cross-tenant isolation across views/comments/layout, 404 on foreign id ✓.
- AC-9 10k-node save ≤800ms p95, measure-first ✓ — **measured 126.4ms**, recorded in ADR-025 (no COPY escalation needed).

## ⚠️ QA FOCUS — migration/schema + multi-tenancy (HELD-tier risk)
Two NEW migrations 0063/0064 + RLS across 3 surfaces (views, comments, snapshot rows). QA must re-verify: cross-tenant
isolation is real (A can't read/delete/pin B's views or comments; foreign id → 404 not 403-leak); RLS is fail-CLOSED
(no GUC → no rows, not all rows); atomic snapshot rollback; author/pin spoof rejection server-side; the `explorer_connection`
GUC helper sets `app.current_tenant_id` from JWT only (never client). ADR-025 tenant_id TEXT divergence sound (matches 0014).

## Gates
mypy 0/262 · ruff 0 · bandit 0 High · coverage touched modules ≥80% (persistence.py 43% unit-only — real-DB body +
has_graph_access exercised by integration suite; schemas 100%, routers 93-98%). 16 unit (10 views + 6 comments) + 9
integration (real docker, marker-scoped, isolated ports, torn down). Full backend unit 1043/1043.

## Commits (feature/CE-V1-EPIC-019, not pushed): bb61979 (WIP STEP-0) · e133925 (comments router + wiring + integration + ADR perf, HEAD).

## Epic status — EPIC-019 CLOSES on QA-pass → HELD PR (migrations 0063/0064 = schema tier)
TASK-025 is EPIC-019's sole task; all 3 stories (E7-S1 save / E7-S2 shared library / E7-S3 pinned) covered. On QA PASS:
restack onto green main (likely clean — no shared write-path/shacl overlap; own new tables), push, open PR, drive green +
review-clean, then **HOLD for human merge** (migration/schema). TASK-026 (UI, EPIC-018) is the next consumer, now unblocked.

## QA PASS (2026-07-11, a11fe44, retry 0) — CE-V1-TASK-025 CLOSES → EPIC-019 COMPLETE
Adversarial QA, all 9 ACs verified from source + re-run (not self-report). **Tenant-isolation verdict: NO Blocker, RLS
fail-CLOSED, no leak.** `test_cross_tenant_views_comments_isolation` proves zero tenant-B rows visible across BOTH new tables
+ snapshot rows under tenant-A GUC; foreign view_id → 404 (RLS makes row invisible → natural no-row, router SELECTs
`WHERE tenant_id=$1 AND view_id=$2` BEFORE any authz branch → 404 before 403, no existence-probe leak). **QA added the
missing fail-closed edge test `c8e3f12`** (`test_rls_fails_closed_with_no_tenant_guc_set`): saves rows for a real tenant, opens
`untenanted_connection()` (same non-superuser weave_app role, NO GUC) → asserts `SELECT WHERE tenant_id=$1` returns ZERO rows
not all — the no-GUC property the original tests never covered; passes vs real PG. Both 0063/0064 carry ENABLE+FORCE RLS +
tenant_isolation policy on `current_setting('app.current_tenant_id', true)` (migration test asserts relrowsecurity +
relforcerowsecurity both true). `explorer_connection(principal.tenant_id)` — tenant_id from verified JWT `claims["tenant_id"]`
only; schemas allow extra fields but NO router reads a client tenant → no spoof path. **ADR-025 tenant_id TEXT divergence
sound** — identical to the battle-tested `0014_fix_layout_tenant_text.sql` (real tenant ids are slugs like `acme-corp`, UUID
cast would 503); same RLS key/pattern, isolation strength unchanged. AC-2 atomic snapshot rollback, AC-6 author-spoof→400,
AC-7 pin admin-only+limit-5→409 all PASS. AC-9 perf 126.4ms@10k (≤800ms), chunked 1000-row multi-VALUES (avoids 65535
bind-param ceiling). Gates: ruff 0, mypy 0/475, 1043 unit, 10 integration (real docker, torn down). 0 warnings. retry=0.

## EPIC-019 CLOSE → HELD PR (migrations 0063/0064 = schema tier)
CE-025 sole task → EPIC-019 COMPLETE. Branch (HEAD c8e3f12) already on current main 6c030c4 (unmoved since EPIC-010) → NO
restack needed. Push + PR + review + CI green, then HOLD for human merge (schema). NOTE: if EPIC-009 #59 merges first, main
moves → EPIC-019 needs a restack before its own merge (no table collision: 0062 vs 0063/0064).
