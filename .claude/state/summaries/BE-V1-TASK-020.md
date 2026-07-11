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

## Epic status — EPIC-007 = BE-020 sole task → CLOSES on QA-pass
No migration → auto-merge eligible IF QA passes + E2E adjudication accepts met-by-inference. Restack onto green main at close.
