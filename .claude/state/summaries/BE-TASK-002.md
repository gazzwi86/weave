# BE-TASK-002 — Task-Brief Schema & Architect Agent Generation (FR-018)

**Epic:** BE-EPIC-005 · **Branch:** `feature/BE-EPIC-005` · **Status:** implemented, QA in progress
**Commits:** `02a93c6` test · `ffc66b1` feat
**Coverage:** 90% on new modules · **Tests:** 22 (17 unit + 5 docker integration)

> Authored by the coordinator from the lane's completion receipt. Under ADV-004 parallel-lane
> discipline, lane subagents never write `.claude/state/**`; the coordinator owns state, so this
> CODIFY summary is written here rather than by the engineer lane.

## What was built

`task_briefs` schema + persistence + an architect-generation path that produces a validated task
brief from a project/spec input, tier-routed through the existing model router.

- `briefs/schema.py` — `TaskBrief`, `EarsAC`, `DepChain`, `CostEstimate` Pydantic v2 models (100%).
- `briefs/ce_read_client.py` — reads CE-READ-1 ontology types to ground the brief (64% unit; DB/net
  paths covered by docker integration).
- `briefs/architect.py` — generation orchestration via `ai.router.route()` tiering (100%).
- `briefs/store.py` — Aurora persistence, RLS-scoped (77% unit; remainder docker-covered).
- `routers/briefs.py`, `schemas/briefs.py` — API surface + request/response schemas.
- `migrations/0010_task_briefs.sql` — RLS-enabled `task_briefs` table.
- `__init__.py` — router wiring (alpha-order imports, shutdown hook).

## Decisions & deviations (engineer-reported, coordinator-recorded)

1. **PK/tenancy shape — TEXT `tenant_id` + `task_id` PK, no surrogate UUID.** The tech-spec literal
   was `UUID task_brief_id` / `UUID tenant_id`; the engineer matched the codebase's **established
   `projects` table convention** (TEXT tenant_id) instead, for consistency with existing RLS. QA is
   verifying this preserves tenant isolation.
2. **`ai.router.route()` reused instead of the brief's "Anthropic Agent SDK".** The Agent SDK named
   in the brief hints does not exist in this codebase; the engineer reused the existing tier-routing
   mechanism to avoid a phantom dependency. Preserves the tier-routed-generation AC intent.
3. **Deterministic `task_id = uuid5(project_iri + task_description)`** — idempotent brief identity so
   re-generation for the same input does not fork a new row.

Both deviations recorded in code comments (same-class precedent already established elsewhere — no
new ADR).

## Migration collision (coordinator merge-time)

`0010_task_briefs.sql` shares number **0010** with BE-TASK-010's `0010_project_repo.sql` (separate
lane). Independent DDL — whichever epic merges second gets its migration renumbered to `0011`.

## Context for downstream tasks

- Task briefs are consumed by the dark-factory run (BE-TASK-006) and the `/architect` generation path.
- `task_briefs` is RLS-scoped on TEXT `tenant_id` — cross-tenant reads must return zero rows (QA gate).
- Router registered in `__init__.py`; expect a merge with sibling BE lanes' router registrations.

## Environment note (not a code issue)

Worktree's `packages/frontend/node_modules` was missing, failing the shared `make lint` target on an
unrelated `eslint-plugin-storybook` resolution. Fixed with `npm ci` (lockfile-driven, no config
change). Not specific to this task — a fresh-worktree setup gap.
