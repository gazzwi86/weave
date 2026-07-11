# Progress: BE-V1-TASK-019 — Project Dashboard (FR-013): Per-Tile Isolated Status View (EPIC-003)

`build-engine` EPIC-003. Worktree `../weave-BE-V1-EPIC-003`, branch `feature/BE-V1-EPIC-003` (off green main). Full-stack.
Built across orientation-burn + 216k-overflow (17-file WIP recovered/committed by a fresh continuation) + migration renumber.
Coordinator-authored pre-QA. HEAD `d7dfff6`, not pushed, tree clean, docker torn down.

## What shipped (6 ACs — brief has 6, counted)
- **Backend** `build/dashboard.py` + `routers/dashboard.py` + `schemas/dashboard.py`: SIX independent per-tile endpoints
  (`GET /dashboard/{tile}`) behind one dispatcher — no aggregate endpoint (isolation by construction). Tiles: demo readiness,
  budget, forecast, tasks-in-flight, blockers, git ribbon, self-improvement.
- **Frontend** `app/build/projects/[id]/page.tsx` → `ProjectDashboard`; `use-tile.ts` (one hook/tile, independent
  fetch+loading+error state, no shared cache); `tile.tsx` `TileBoundary` (React class error boundary per tile).
- **Migration `0065_generation_runs_clock_timestamp.sql`** (renumbered from a mis-numbered 0033 — repo was at 0064):
  `created_at DEFAULT clock_timestamp()` not `now()` (now() = txn-start → rows in one txn tie → ORDER BY created_at DESC LIMIT 1
  nondeterministic → AC-3 "never false green" silently violable). Real bug, root-caused in SQL.

## Per-AC (engineer-reported — QA re-verify; 6 ACs)
AC-1 six tiles each own endpoint (13 unit + E2E) · AC-2 **per-tile isolation** core (frontend unit "keeps others alive when
one errors" + E2E "5 alive when one endpoint stubbed 503") · AC-3 demo tile retains prior URL + honest failure never
false-green (backend integration, real PG) · AC-4 budget/forecast estimated label+cascade+forecast inputs (frontend unit) ·
AC-5 git ribbon from recorded generation_runs, no live SCM (backend+frontend unit) · AC-6 self-improvement card read-only,
hidden when feed absent (frontend unit). 6/6 per engineer.

## ⚠️ QA FOCUS — migration + isolation
- **Migration 0065**: schema tier → EPIC-003 will be a HELD PR at close. QA verify it applies as LAST migration (sorts after
  0064), clock_timestamp fix takes effect, AC-3 stays green. No RLS needed (alters existing table default).
- **Per-tile isolation (core AC-2)**: re-verify one tile erroring/loading does NOT blank siblings — error boundary + independent
  fetch, proven by the stub-one-503 E2E.
- Tenant-scoping on all 6 endpoints (JWT principal only).

## E2E — RAN GREEN vs served app (did NOT hit PROJ-009)
`project-dashboard.spec.ts` 2/2 passed against the real trio (backend+frontend+mock-oidc, real admin@weave.local login + project
create + nav). Isolation scenario (stub /dashboard/budget 503 → Budget shows error, 5 tiles alive) green. **Note:** BE-019's E2E
login worked — PROJ-009's 403 is specific to the source-control-config step (which this task doesn't exercise), NOT general login.

## Real bugs found+fixed (via real test runs)
(1) generation_runs.created_at now()→clock_timestamp() (migration 0065). (2) use-tile.ts URL-encode project id. (3) 2 test-only
E2E spec bugs (unescaped IRI in URL compare, colliding getByRole name) + Turbopack first-hard-nav-404 → in-app click.

## Gates
tsc 0 · eslint 0-err (154+ pre-existing warns elsewhere) · ruff 0 · mypy 0 · coverage backend dashboard modules 98%
(build/dashboard 98%, routers 95%, schemas 100%). Backend integration ran real (docker, isolated ports, torn down).

## Commits (feature/BE-V1-EPIC-003, not pushed): e6683d6 (endpoints) · 7f67469 (UI) · 7c8f73f (clock_timestamp) · 2b22893 (url-encode+E2E fixes) · d7dfff6 (migration renumber 0033→0065, HEAD).

## QA PASS (2026-07-11, a39369a, retry 0) — BE-V1-TASK-019 CLOSES
Adversarial QA, all 6 ACs self-run. **Per-tile isolation CONFIRMED both layers** (6 independent handlers, no aggregate query;
6× independent useTile + per-tile TileBoundary; E2E stub-503 positively asserts 5 siblings still visible). **Migration 0065
correct** (sorts after 0064; **tautology-checked** — reverted default to now() live → new tie test FAILED 5/5, restored →
passed). **Caught a real gap:** the shipped AC-3 test used 2 autocommit inserts (own txns) → never exercised the now() tie →
would pass with OR without the fix; QA added `test_demo_tile_breaks_same_transaction_tie_via_clock_timestamp` (one explicit
txn, tautology-verified) `9d33577`. Tenant-scoping JWT-only all 6 endpoints (RLS + explicit filter). Backend integration 3/3,
unit 13/13, frontend 5/5. ruff 0, mypy 0/270, tsc 0, eslint 0. AC-6 note: SelfImprovementCard is props-only (perma-hidden
until Platform BE-SELFIMPROVE-1 exists) — spec-compliant "degrades to hidden", not a gap. retry=0.
**Deferred (WARN):** Lighthouse/axe/ui_verify not run this pass (scoped out) — run `ui_verify.sh --full` on /build dashboard
route before EPIC-003 close.

## Epic status — EPIC-003 NOT closed
TASK-019 done; **TASK-021 (Direct Project Prompt, FR-065) remains** (unlocked by this task, same branch). EPIC-003 closes after
BE-021. At close → HELD PR (migration 0065 = schema tier) + run ui_verify --full on the dashboard route. Restack onto green main then.
