# Progress: BE-V1-TASK-014 — PM Surface API Core: Projects Grid, Settings, Contributors (FR-006/007/008/009/060)

`build-engine` EPIC-002. Coordinator-authored from the engineer receipts (engineer capped twice;
coordinator committed the contributors-router tail and drove the 2 integration-bug fixes). Written
before QA so preflight passes ([[process_qa-preflight-vs-parallel-lanes]]).

## Outcome

Impl complete + committed. Docker integration 4/4 pass; full unit lane 801 pass, 0 regressions.
QA full checklist pending (this summary unblocks preflight).

## What shipped

- **Projects grid** `GET /api/projects` — keyset-paginated (`projects/grid.py`), AC-1 derivation
  substitutions per **ADR-014**; owner lookup via `pm/contributors.py::OWNER_LATERAL_SQL` (repo-layer
  only, no raw SQL in the router). (First cut missed the `GET ""` route → 405; fixed `591bdfd`.)
- **Project settings** `GET`+`PATCH /api/projects/{id}/settings` — `routers/project_settings.py` +
  `schemas/project_settings.py` (didn't exist → 404; wired `c86d993`).
- **Contributors** `routers/project_contributors.py` + `schemas/contributors.py`.
- **Create-shell** with governance-cascade resolution at project create (`891e9ec`).
- **Migration 0019** `projects.archived_at` (ALTER ADD COLUMN — existing projects RLS untouched).

## Decisions / guards

- **Every PM MUTATION route gated `Depends(require_project_role(...))`** (contributors + settings
  routers confirmed); reads carry tenancy middleware only (any company member reads any project).
- **Money on the wire is `float`** (billing.py / ADR-013 precedent).
- **ADR-014** — grid derivation substitutions for AC-1 (engineer-authored).

## Known limit (phase-gate ratification — NOT a defect)

- **Project-scope settings WRITE → 503**: a project-scoped setting override can't resolve because
  `projects` has no `domain_id` and `settings/scope.py` won't parse a project IRI (the
  [[project_projects-domain-id-gap]] / ADR-013 gap). Documented, not patched — the fix is the shared
  `projects.domain_id` migration + grammar extension that also closes ADR-012 + XT-BE013-1. Fail-safe.

## Gates (coordinator-run)

- Docker integration `test_pm_surface_api.py -m "integration and docker"`: **4/4 pass**.
- Full unit lane `-m "not docker"`: **801 pass, 0 fail**. ruff/mypy/bandit reported clean by engineer
  (QA to re-confirm + coverage + AC walkthrough).

## Commits

- `66d0c32` test · `891e9ec` feat (create-shell/cascade) · `3c869ac` ADR-014 · `c41f57c` feat
  (contributors) · `c86d993` fix (settings route) · `591bdfd` fix (grid route)

## Dependencies unlocked

- **TASK-015** (Registry Grid + Project Settings UI — consumes these endpoints), **TASK-016**,
  **TASK-019**.
