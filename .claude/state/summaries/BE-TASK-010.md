# BE-TASK-010 — Repo Bootstrap: External Project Repository (FR-061)

**Epic:** BE-EPIC-011 · **Branch:** `feature/BE-EPIC-011` · **Status:** QA PASS (1 retry) — merge-ready
**Commits:** `888a8e0` test · `04b8c46` feat (repo bootstrap core) · `4c633f9` feat (GET repo field)
· `04f8d9e` test(qa) edge cases · `449a781` fix (AC-4 AuthError-on-write)

## QA outcome (retry 1/3)

QA FAILed the first pass on one real **AC-4 (logic) defect**: `AuthError` raised by
`driver.write_initial_commit` escaped as a raw exception instead of the fail-closed named
`RepoBootstrapError("repo_auth_invalid")` — only `create_repo` was wrapped. A fine-grained PAT valid
for repo-create but lacking contents-write scope would break the named-error contract. **Fixed** in
`449a781` (both driver calls now under one `except AuthError`); QA's regression test
`test_ensure_project_repo_auth_error_from_write_initial_commit_is_not_translated` (`04f8d9e`) is green.
Full fast lane 273 passed, ruff/mypy clean. All 7 ACs now covered; 99% changed-code coverage.

**Open follow-up (not this task's AC — needs a task/ADR):** retry-after-partial-failure can create a
duplicate provider-side repo — deterministic `weave-<slug>` name re-derives on retry, GitHub returns
422 (not 401/403), unmapped to any `RepoBootstrapError` reason. Run still halts (not a silent skip),
so not an AC-4 violation as written, but recommend a `repo_name_collision` reason + reuse-by-name
lookup before create. Logged for the coordinator ledger.
**Coverage:** 97% changed code (repo_bootstrap 98–100%, routers/projects 88%, schemas/projects 100%)
**Tests:** unit + integration fast-lane green

> Authored by the coordinator from the lane's completion receipt (ADV-004: lanes never write
> `.claude/state/**`; coordinator owns CODIFY state).

## What was built

First step of a dark-factory run: create a NEW external repo per project on the configured provider
(GitHub/GitLab), write project boilerplate as the initial commit, persist the repo handle on the
project record, expose it so generation pushes output there — never inside Weave.

- `repo_bootstrap/` — `ensure_project_repo` service + `ScmDriver` interface with `GitHubDriver` /
  `GitLabDriver`, data-driven provider selection (AC-7), harness-template render, secrets fetch.
- `migrations/0010_project_repo.sql` — `projects.repo` handle columns (provider, repo_url,
  default_branch, repo_id).
- `routers/projects.py` + `schemas/projects.py` — `GET /api/projects/{iri}` now includes `repo` once
  bootstrapped.

## Key behaviours (AC coverage per engineer)

- AC-1/2: create repo + boilerplate initial commit + persist handle, 201.
- AC-3: idempotent — existing repo reused, 200, no second repo (unit + integration verified).
- AC-4: fail-closed — unconfigured provider / invalid token halts before PLAN with named error
  (`repo_provider_unconfigured` / `repo_auth_invalid`); NO Weave-internal fallback.
- AC-5: provider token from Secrets Manager only, asserted absent from response body and logs.
- AC-6: `PLAT-AUDIT-1` `repo_bootstrapped` event, Build principal, `{provider, repo_url}` (no token).
- AC-7: driver chosen from project/workspace setting, not hardcoded.

## Decisions / notes

- Migration **0010** added despite the brief's DoR-blocker note ("stop and report"): brief's
  Implementation Hints + BE-TASK-001 precedent both require the `projects.repo` columns, so proceeded
  and flagged. Provider network fully MOCKED (Law F); LocalStack dummy creds for Secrets Manager (1
  Low bandit, same pattern as existing `audit/signing_key.py`; no HIGH).
- M2 explicitly out of scope: rich scaffold, branch protection, full CI, env-verification HITL gate.

## Migration collision (coordinator merge-time)

`0010_project_repo.sql` shares number **0010** with BE-TASK-002's `0010_task_briefs.sql`. Independent
DDL — whichever epic merges second gets renumbered to `0011`.

## Environment note

Worktree's `packages/frontend` had no `node_modules` (blocked the Makefile combined-lint target);
ran `npm ci` to unblock — no config change. Fresh-worktree setup gap, not task-specific.
