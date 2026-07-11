# Progress: BE-V1-TASK-020 — Decision Log (FR-027): Searchable Read-Only View over PLAT-AUDIT-1 (EPIC-007)

`build-engine` EPIC-007. Worktree `../weave-BE-V1-EPIC-007`, branch `feature/BE-V1-EPIC-007` (off green main). Full-stack
read-only view. Built across overflow + continuation (1st engineer 218k → committed query view + endpoint; continuation
did frontend screen + E2E). Coordinator-authored pre-QA. HEAD `8097f7e`, not pushed, tree clean, docker torn down.

## What shipped (9 ACs, all Done per engineer)
- **Backend** `routers/decisions.py` — `GET` only over PLAT-AUDIT-1 (read-only; grep-proven no Build-side audit write/copy).
  Tenant-scoped (JWT principal.tenant_id only, RLS via tenant_connection set_config). Cursor pagination, kind filter
  (decision/task_update/system/all), server-side search (no client hiding), human/agent actor label from IRI.
- **Frontend** `app/build/projects/[id]/decisions/page.tsx` + `DecisionLogPanel` + `use-decision-log.ts` hook + BFF proxy
  (zod-validated → forwardToBackend). Deep-link `?record=` chases pages. Empty state. Per-row kind chip.

## MOUNTED (grep-proven reachable)
`/build` registry → `project-card.tsx` link → `settings/page.tsx` "Decision log" link → `decisions/page.tsx` →
`DecisionLogPanel` → `use-decision-log.ts` → `/api/build/projects/[id]/decisions` (BFF) → `routers/decisions.py`.

## Per-AC (engineer-reported — QA re-verify; 9 ACs)
AC-1 searchable/paginated (backend integration `test_should_return_searchable_paginated_decisions_from_audit` + hook) ·
AC-2 kind filter (integration + hook) · AC-3 deep-link ?record= chases pages (hook `chaseDecisionPages`) · AC-4 read-only
no-mutation-UI + no Build audit table (component test + migrations-dir grep) · AC-5 empty state · AC-6 cursor pagination
(`test_should_paginate_decisions_with_cursor`) · AC-7 per-row kind chip · AC-8 filter/search re-queries server (integration
+ hook) · AC-9 human/agent actor label. All PASS per engineer.

## ⚠️ E2E BLOCKED — pre-existing RBAC/seed bug (NOT BE-020's code) → PROJ-009
`tests/e2e/decision-log.spec.ts` written + typechecks + committed, but CANNOT run green: the shared login/setup flow
(admin saves source-control config) returns **403 Forbidden**. Reproduced on the task's own stack AND a brand-new
freshly-migrated+seeded stack (`weave-be020e2e`), on the UNMODIFIED `project-settings.spec.ts` too → confirmed NOT
stack-pollution, a genuine pre-existing RBAC/seed-drift bug in shared infra. **Blocks the Build E2E suite broadly** (BE-017,
BE-019 E2Es will likely hit the same). Out of scope for TASK-020 to fix (touches shared RBAC/seed). QA to adjudicate:
E2E-met-by-inference (backend integration hits real PG + asserts audit rows; component/hook tests prove the UI) + log the
RBAC bug as a separate high-priority ticket, OR block. Precedent: PLAT-012/CE-002 E2E-couldn't-run → met-by-inference when
backend integration proves real state.

## Gates
tsc 0 · lint 0 (pre-existing unrelated warns) · mypy 0 · full pre-commit suite passed on final commit · coverage
met-by-inference under docker. Backend integration ran real (docker marker, isolated ports, torn down).

## Commits (feature/BE-V1-EPIC-007, not pushed): 43d403d (schema WIP) · 8720139 (endpoint) · 68bed21 (screen mounted) · 8097f7e (E2E spec, HEAD).

## QA PASS (2026-07-11, a3e648c, retry 0) — BE-V1-TASK-020 CLOSES → EPIC-007 COMPLETE
Adversarial QA, all 9 ACs self-run (not self-report). **Read-only PASS** (GET only; diff-grep shows zero touch to audit
emitter/INSERT; no Build audit copy). **Tenant isolation PASS** (DecisionQuery.tenant_id from JWT only; tenant_connection
SET LOCAL app.tenant_id + SQL WHERE tenant_id=$1). Mount chain grep-proven. Backend integration 4/4 (real docker, torn down),
backend unit 10/10 (incl QA edge), frontend 11/11. ruff 0, mypy 0, tsc clean, eslint 0-err/2-warn (fn-length: panel 65,
hook 56 — Law E warn, non-blocking). **E2E-met-by-inference ACCEPTED** — QA independently verified the 403 is pre-existing
shared infra (PROJ-009), NOT a BE-020 regression: diff-stat vs rbac.py/contributors.py/mock_oidc/source_control.py/projects.py/
project-settings.spec.ts is EMPTY; traced mechanism = create_project never inserts a contributor row for the creator + mock-oidc
admin@weave.local lacks a project-scoped grant → creator 403s on PUT /source-control regardless of spec. Backend integration
proves real audit-row state instead. Edge test `6c8eb1b` (classify_kind empty/near-miss → system). retry=0.

## EPIC-007 CLOSE — auto-merge eligible (no migration, non-risky)
BE-020 sole task → epic COMPLETE. Reconcile onto green main (new files, read-only — likely clean), push, PR, cavecrew review
+ CI → auto-merge if green + Blocker/Major-free. WARN carried: 2 fn-length lint (follow-up split), Lighthouse/axe not re-run
(design spot-check before run-book gate).
