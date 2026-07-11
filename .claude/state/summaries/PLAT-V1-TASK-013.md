# Progress: PLAT-V1-TASK-013 — Refine widget (EPIC-001, 4th task)

`weave-platform` EPIC-001. **PARALLEL LANE C** worktree `../weave-PLAT-V1-EPIC-001`, branch `feature/PLAT-V1-EPIC-001`
(sequential after 010/011/012). Full-stack. Built across overflow + continuations. Coordinator-authored from receipt,
pre-QA. HEAD `42542a0`, not pushed. 6 ACs all Pass per engineer.

## What shipped
- **Backend refine** (`dashboard/refine.py`, `routers/dashboard_refine.py`): reuses `dashboard/generate.py` pipeline
  VERBATIM (budget gate/metering/audit — NO second cost path, ADR-012). Refinement-history capped at 10 (oldest dropped).
  Model-free restore (swaps stored spec, re-fetches via CE client, no LLM, not a new history step). Ownership: unknown
  widget→404, non-owner/tenant_default→403 (`_owned_user_widget` via `human_principal_iri()`).
- **Frontend refine-bar** (`components/dashboard/refine-bar.tsx` + `history-menu.tsx`): reuses `useWidgetStream()` (same
  SSE grammar as generate) + `stream-status.tsx`'s `ERROR_COPY` table (single source). Unpinned widget = no network call.

## MOUNTED (grep-proven chain — real, reachable)
`nav-items.ts` "Home"→`/dashboard` → `app/dashboard/page.tsx` `<PromptBarContainer>` → `<PromptBar>` → `<StreamStatus>` →
`<RefineBar widgetId onRefined>` (renders in `DoneStreamBody` after a successful generate). Cmd+K guard + `turbopack.root`
intact, no `--webpack`.

## Per-AC (engineer-reported — QA re-verify)
AC-1 reuse-generate-pipeline (no dup) ✓ · AC-2 history cap 10 ✓ · AC-3 failure-preserves-prior-state ✓ · AC-4
model-free restore ✓ · AC-5 refine-bar mounted+reachable+E2E ✓ · AC-6 404/403 ownership ✓. +unsatisfiable→clean decline.

## E2E — RAN REAL
`refine-widget.spec.ts` ran twice vs real served app (1 passed, generate/refine/history/restore page.route-mocked, no LLM).
Reuses change-viz.spec.ts login+mock pattern.

## ⚠️ REUSABLE FINDING (logged PROJ-003) — integration tests SILENTLY DESELECTED
`pyproject.toml` addopts deselects `integration`/`e2e`-marked tests by default even with an explicit file path. Correct
invocation (matches CI ci.yml:53) = `pytest -m "integration and docker and not stack" <path>`. Engineer found the 7 refine
integration tests had NEVER run in prior passes → then found + fixed 2 test-file bugs (owner_principal_iri wrong format →
every refine test 403'd; restore assertion). Production code was correct; only test files touched (`6f1da32`).

## Gates
mypy 0/249 · ruff 0 · ruff format clean · bandit 0 High · tsc 0 · lint 0 (165 pre-existing warns) · 1009 unit + 7
integration + 1 E2E green. **Coverage NOT re-measured** (honored no-`--cov` rule; recommend phase-gate CI confirm ≥80%).

## Commits (feature/PLAT-V1-EPIC-001, not pushed): 53b7acc (WIP backend+hook+refine-bar) · 6f1da32 (test fixes) · 42542a0 (E2E). HEAD 42542a0.

## Epic status
EPIC-001 has TASK-014 remaining + XT-PLAT010-2 (dashboard E2E) close-blocker + milestone-"v1" undefined gate → stays OPEN.
