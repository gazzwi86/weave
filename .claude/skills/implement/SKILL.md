---
name: implement
description: "Orchestrate the PDAC implementation cycle: Architect curates context, Engineer implements via TDD, QA validates, with review and phase gates throughout. Invoked when the user runs /implement."
---

# Implementation Loop

Orchestrate the PDAC implementation cycle: Architect curates context, Engineer implements via TDD, QA validates, with review gates and phase gates throughout.

## Trigger

- User runs `/implement`
- Arguments: none (continue from current task), `TASK-{NNN}` (specific task), `scaffold` (scaffolding only), `status` (shortcut for `/status`)

## Instructions

### Step 1: Read State and Determine Next Action

0. **Resume from disk (on entry — do NOT assume a clean start).** A previous loop may have been
   killed mid-phase. Reconstruct in-flight state from the durable checkpoint rather than starting
   over:
   - Read the committed `.claude/state/progress.json` — this is the checkpoint of record
     (task/epic/phase status, `retry_count`, `blocked_by`).
   - Read the most recent `.claude/state/summaries/*.md` (per-task summaries plus `latest.md` /
     `PHASE-*.md`) to recover the decisions and context from completed and in-flight work.
   - Treat any task still marked `in_progress` as the resume point and re-enter the PDAC loop at
     that task instead of pulling a fresh `backlog` item.
1. Run `bash .claude/scripts/progress.sh kanban` to display current state
2. Run `bash .claude/scripts/progress.sh ready` to get next task whose dependencies are satisfied
3. Read `docs/specs/weave/engines/<entity>.md` to understand current phase and gates
4. If no tasks exist, tell the user to run `/architect` first

### Step 1.5: Spec Review Gate (per target entity — NOT only at first-repo scaffolding)

The repo has multiple engines/specs implemented across many `/implement` runs. Spec review is
therefore scoped to the **entity currently being implemented** and runs **once per entity**
(re-running only if that entity's specs changed) — it is no longer tied to the one-time scaffolding
step, which would review only the first engine ever built.

1. Resolve the target entity from `.claude/state/progress.json` `phase` (e.g.
   `constitution-engine/phase-1` → entity `constitution-engine`).
2. Decide whether to review. Run `/spec-review <entity>` if EITHER:
   - `.claude/state/spec-reviews/<entity>.md` does not exist (this entity was never reviewed), OR
   - any spec file for the entity (under `docs/specs/.../<entity>/...`) has a newer mtime than that
     file (the specs changed since the last review).
   Otherwise the entity's specs are already reviewed and unchanged — skip (no redundant review).
3. The review **blocks**: if `/spec-review <entity>` reports critical gaps, STOP and tell the user
   to fix them via `/architect` before implementing. On a clean review, write/update
   `.claude/state/spec-reviews/<entity>.md` (the review summary + date) — this both records the
   pass and serves as the change-detection marker for next time.

### Step 2: Check Scaffolding (First Run Only)

If no `package.json` or `pyproject.toml` exists in the project root, this is the first run:

**2a. Dependency Check (before anything else):**

Invoke the `dependency-check` skill to verify all required system dependencies and credentials are available.
Checks: node, npm, git, npx, python, uv, and any phase-specific tools.
Also checks credentials are set as environment variables (never asks for secret values).
Stops if critical dependencies are missing.

**2b. Spec Review:** already handled by Step 1.5 for the target entity (which on the first run runs
before this scaffolding step). Do not re-invoke `/spec-review` here.

**2c. Scaffolding:**

Ask via AskUserQuestion which project type to scaffold:

- **Python/FastAPI** — backend API service
- **TypeScript/Next.js** — frontend + API routes
- **Both (monorepo)** — backend in `packages/api/`, frontend in `packages/web/`

Then proceed per project type:

---

**Python/FastAPI scaffold:**

1. Read `docs/specs/weave/engines/<entity>/04-arch/tech-spec/architecture.md` for tech stack
2. Read `docs/specs/weave/engines/<entity>/04-arch/tech-spec/testing-strategy.md` for test config
3. Read `.claude/spec-templates/standards/python/linting.md` for ruff config
4. Reference `docs/standards/patterns/api/fastapi-router.md` for router patterns
5. Invoke the **engineer** subagent to scaffold:
   - `uv init` in the target directory
   - `uv add fastapi pydantic uvicorn[standard]`
   - `uv add --dev pytest pytest-asyncio httpx ruff mypy`
   - Configure `ruff` per `.claude/spec-templates/standards/python/linting.md`
   - Configure `pytest` with `asyncio_mode = "auto"` in `pyproject.toml`
   - Configure `mypy` with `strict = true`
   - Create a `/health` route returning `{ "status": "ok", "timestamp": ..., "version": ... }`
   - Generate `.github/workflows/ci.yml` with stages: lint (ruff), typecheck (mypy), unit tests (pytest), build
   - Install husky pre-commit hook equivalent: `pre-commit` framework with ruff + mypy + pytest hooks
   - Create a smoke test verifying the health endpoint returns 200
   - Commit each step separately with conventional commits
   - Verify: `uv run uvicorn main:app` starts, `uv run pytest` passes, `uv run ruff check .` passes

---

**TypeScript/Next.js 15 scaffold:**

1. Read `docs/specs/weave/engines/<entity>/04-arch/tech-spec/architecture.md` for tech stack
2. Read `docs/specs/weave/engines/<entity>/04-arch/tech-spec/testing-strategy.md` for test config
3. Read `.claude/spec-templates/standards/ts/linting.md` for ESLint config
4. Reference `docs/standards/patterns/api/nextjs-route-handler.md` for route handler patterns
5. Invoke the **engineer** subagent to scaffold:
   - `npx create-next-app@latest --typescript --eslint --app`
   - Install: `vitest @testing-library/react playwright eslint-plugin-sonarjs @stryker-mutator/core @stryker-mutator/vitest-runner tsc-files jscpd license-checker`
   - Install `pino` for structured JSON logging
   - Configure ESLint with SonarJS rules per `.claude/spec-templates/standards/ts/linting.md`
   - Configure Vitest per `docs/specs/weave/engines/<entity>/04-arch/tech-spec/testing-strategy.md`
   - Configure Playwright
   - Install husky + lint-staged for git hooks:
     - Pre-commit hook: `eslint --fix` + `tsc-files --noEmit` + `vitest run --changed`
     - Pre-push hook: full test suite (`vitest run`) + `npm audit --audit-level=high`
   - Create an `/api/health` route returning `{ status: 'ok', timestamp, version }`
   - Generate `.github/workflows/ci.yml` with stages: lint, typecheck, unit tests, build. If the spec includes
     deployment requirements, add CD stages targeting AWS (default). The CI pipeline must run on every push and PR.
   - Create a smoke test that verifies the app renders
   - Commit each step separately with conventional commits
   - Verify: `npm run dev` works, `npm test` passes, `npm run lint` passes, git hooks are active

---

**Both (monorepo):** Run Python/FastAPI scaffold in `packages/api/` then TypeScript/Next.js scaffold in
`packages/web/`. Create a root `package.json` with workspaces and a root `Makefile` with `make dev`,
`make test`, `make lint` targets covering both packages.

---

6. **Enforced HITL gate after scaffolding.** Ask user via AskUserQuestion:
   - **Approve** — environment works, proceed to tasks
   - **Amend** — something needs fixing (describe)
   - **Reject** — start scaffolding over

### Step 3: PDAC Loop (Per Task)

Set goal before the first task:

> `/goal all tasks in the current phase are done and committed to their feature branches, or stop after 60 turns`

Get the next task ID from `bash .claude/scripts/progress.sh ready`. If result is `NONE`, go to Step 4 (Phase Gate).

#### PLAN

1. Read the task brief: `docs/specs/weave/engines/<entity>/04-arch/tasks/{TASK_ID}.md`
2. Read dependency summaries: for each task in `blocked_by`, read `.claude/state/summaries/{DEP_TASK_ID}.md` to
   understand what was already built
3. Verify the DoR checklist at the bottom of the brief — all items should be checked
4. If DoR not satisfied, report which items are missing and stop

#### DELEGATE

5. Update progress: `bash .claude/scripts/progress.sh update {TASK_ID} in_progress`
6. Check out the **shared epic branch** `feature/{EPIC_ID}` (where `{EPIC_ID}` is this task's
   `epic`): `git checkout feature/{EPIC_ID} 2>/dev/null || git checkout -b feature/{EPIC_ID}`.
   Every task in the same epic commits onto this one branch so the epic assembles into a single
   coherent feature and opens a single PR at epic close.
7. Invoke the **engineer** subagent with the full task brief content. **Tasks within an epic run
   SEQUENTIALLY on the shared `feature/{EPIC_ID}` branch — do NOT use worktree isolation for
   grouped-epic tasks**, because a branch cannot be checked out in two worktrees at once. The
   engineer runs in place on the shared branch, one task at a time, committing as it goes.

**Engineer workflow (strict TDD):**

1. Write ALL failing tests first (from Test Requirements section)
2. Run `/code-review` on the test code. Address valid issues with discretion.
3. **AST / type check (before running the test suite):** verify the changed files type-check.
   - Python: `uv run mypy --check-untyped-defs <changed .py files>` — must pass (zero errors)
   - TypeScript: `npx tsc --noEmit` — must pass
   - If either fails, fix the type errors before proceeding to the test suite.
4. Commit: `test: add failing tests for {TASK_ID}`
5. Implement minimal code to pass tests
6. Run `/code-review` on the implementation. Address valid issues with discretion.
7. Commit: `feat: {description}`
8. Refactor while keeping tests green
9. Run `/code-review` on refactored code. Address valid issues.
10. Commit: `refactor: {description}` (if needed)
11. Run `/simplify` on all changed files. Remove dead code, unused imports, redundant variables.
    Commit separately: `chore: simplify {description}` (if changes made)
12. **Security scan (before lint):**
    - Python files changed: `uv run bandit -r $(git diff --name-only HEAD | grep '\.py$') 2>/dev/null || true` —
      report findings, block on HIGH severity.
    - TypeScript files changed: `eslint-plugin-security` rules are already in the ESLint config, so the existing
      `npm run lint` (next step) covers it — no extra command.
    - If no Python files changed and no TypeScript files changed, skip.
13. Run lint, verify zero errors
14. Verify coverage >= 80%
15. Check every item on the DoD checklist

Pre-commit hooks will block commits that fail lint or unit tests.

The Engineer does NOT read spec files other than the task brief. It is self-contained.

#### ASSESS

8. Invoke the **quality-assurance** subagent with the full task brief content, validating the work
   in place on the shared `feature/{EPIC_ID}` branch. **No separate worktree for grouped-epic
   tasks** — the same branch-cannot-live-in-two-worktrees constraint applies, and QA also commits
   edge-case tests that must land on the shared branch.
9. QA validates: tests pass, coverage >= 80%, lint clean, complexity thresholds (cyclomatic ≤ 10, cognitive ≤ 15,
   fn ≤ 50 lines), JSDoc/docstrings, ACs met (EARS notation checked), diagram compliance, design decision
   compliance, PO review, edge case extension
10. Read QA result:
    - **PASS**: The work (and any QA edge-case tests) is already committed on the shared
      `feature/{EPIC_ID}` branch — there is no worktree to merge. Continue to CODIFY.
    - **FAIL**: Classify the failure before retrying. Prompt the classifier with exactly:

      > "Read the QA failure report. Classify the root cause as exactly one of: logic, dependency, interface,
      > spec-ambiguity. Output only the class name."

      Then act on the returned class:

      | Class | Meaning | Action | Max retries |
      |---|---|---|---|
      | `logic` | Bug in implementation | Feed the failure report back to the Engineer and re-run DELEGATE | 3 |
      | `dependency` | Missing package / tool / config | Resolve the dependency once, then re-run DELEGATE | 1 |
      | `interface` | Hallucinated method / API | Re-read the referenced spec section, then re-run DELEGATE | 1 |
      | `spec-ambiguity` | Task brief underspecified | Escalate to `/architect` — do not retry | 0 |

      Track `retry_count` per task across DELEGATE re-runs. When a class reaches its retry cap (or on
      `spec-ambiguity`), stop and ask the human via AskUserQuestion.

      Emit the [result block](#output) for the ASSESS outcome: `status: ok` on PASS; `status: fail` with the
      classified `failure_class` on a retryable failure; `status: blocked` on `spec-ambiguity` or once a retry cap
      is exhausted.

#### CODIFY

11. Write a progress summary to `.claude/state/summaries/{TASK_ID}.md` documenting: decisions made, nuances
    discovered, edge cases found, and context the next task needs. This is a blocking requirement — do not mark
    the task as done until the summary exists.
12. Update progress: `bash .claude/scripts/progress.sh update {TASK_ID} done`. Also persist `retry_count`
    (the number of DELEGATE retries this task consumed in ASSESS) into the task's entry in
    `.claude/state/progress.json`.
13. **Epic-close gate** — open a PR only when the epic is fully assembled, not per task:
    `bash .claude/scripts/progress.sh epic-check {EPIC_ID}`.

    - **INCOMPLETE** — the epic still has tasks remaining. Do NOT open a PR yet. Emit the
      [result block](#output) (`status: ok`, `artifact_path` = the task brief path,
      `failure_class: null`) and loop back to PLAN with the next task in the epic.
    - **COMPLETE** — this was the epic's last task, and `epic-check` has set the epic's `status`
      to `done`. Open ONE PR for the whole epic — continue with the steps below.

14. **Cross-screen integration check (UI-affecting epics only).** If the epic delivers UI
    (screens / pages / components), run the integration check on the **assembled** epic branch.
    Serve the assembled app first, then point the gate at it — the script fetches `--target`:

    ```
    # start the app on the epic branch (e.g. `npm run dev` / preview build) and wait until it serves
    .claude/scripts/ui_verify.sh --full --target http://localhost:<port>
    ```

    Verifying that the *whole assembled feature* links up (cross-screen navigation, reachability,
    a11y) is the actual fix for "screens don't link up" — not merely a larger diff. A **non-zero
    exit BLOCKS the epic PR**: stop and report the failure instead of opening the PR.

15. Open ONE PR for the assembled epic branch:

    ```
    gh pr create --title "feat: {EPIC_ID} - {epic title}" \
      --body "Closes epic {EPIC_ID}. Tasks: {TASK_IDs in this epic}..."
    ```

    (If `gh` not available, tell the user to create the PR manually)

16. **PR Review Gate**: Run `/code-review` on the PR. Review any issues raised. Address valid feedback with
    discretion. Commit fixes if needed.
17. Emit the [result block](#output) for the completed epic: `status: ok`, `artifact_path` set to the task brief
    path (`docs/specs/weave/engines/<entity>/04-arch/tasks/{TASK_ID}.md`), `failure_class: null`.
18. Check phase status: `bash .claude/scripts/progress.sh phase-check`
19. If phase INCOMPLETE: loop back to PLAN with next task
20. If phase COMPLETE: proceed to Step 4

### Step 4: Phase Gate

When `phase-check` returns COMPLETE:

1. **Security Review**: Run `/security-review` across all code changed in this phase. Address valid security
   issues with discretion. Commit fixes before proceeding.

2. **Mutation Testing**: Run mutation tests against all source files changed in this phase.
   - TypeScript: `npx stryker run --mutate 'src/**/*.ts' --reporters clear-text,json`
   - Python: `uv run mutmut run`
   Report the mutation score. Threshold: >= 70%. If below threshold, identify surviving mutant clusters and
   include them in the phase gate report for human review.

3. **Documentation Generation**: Generate or update project documentation:
   - `README.md` — project overview, prerequisites, installation, getting started, available scripts,
     environment variables, tech stack, project structure
   - `docs/api.md` — API endpoint documentation (routes, methods, request/response shapes) derived from
     the codebase
   - `docs/architecture.md` — high-level as-built architecture overview (not the spec)
   - Any markdown written under `docs/` MUST carry OKF frontmatter (`type` plus title,
     description, tags, timestamp) or it breaks `/okf-validate`. Use e.g.
     `type: API Reference` for `docs/api.md` and `type: Architecture Overview` for
     `docs/architecture.md`. `README.md` at repo root is outside the bundle and is exempt.
   - Update any existing docs that are now stale
   - Commit: `docs: generate project documentation`

4. Display the phase gate checklist (from `docs/specs/weave/engines/<entity>.md` or the
   `.claude/spec-templates/phase-gate.md` template)

5. Run `bash .claude/scripts/progress.sh kanban` to show final state

6. Ask user via AskUserQuestion:
   - **Approve** — phase complete, proceed to next phase
   - **Amend** — specific items need addressing
   - **Reject** — significant rework needed

7. If approved, update phase in `.claude/state/progress.json`

8. **Re-run dependency check** for the next phase (may need additional tools or credentials)

9. Loop back to Step 3 for next phase's tasks

### State Management

- Progress tracking via `bash .claude/scripts/progress.sh` (kanban, ready, update, phase-check)
- Task states: `backlog` → `in_progress` → `done`
- Phase state tracked in `.claude/state/progress.json`
- Shared epic branch: `feature/{EPIC_ID}` — every task in an epic commits onto it sequentially;
  one PR per epic, opened only at epic close (`epic-check` COMPLETE)
- Grouped-epic tasks run sequentially in place on the shared epic branch — no per-task worktree
  for Engineer or QA (a branch cannot live in two worktrees at once)
- Task briefs: `docs/specs/weave/engines/<entity>/04-arch/tasks/{TASK_ID}.md`
- Dependency summaries: `.claude/state/summaries/{TASK_ID}.md`

## Output

Every run of this skill ends with a fenced `result` block that the orchestrator parses deterministically. The
orchestrator reads the **last** such block in the output.

```result
status: ok | fail | blocked
artifact_path: <path or null>
failure_class: logic | dependency | interface | spec-ambiguity | null
```

- `status: ok` — task (or scaffold) completed and merged. `artifact_path` is the task brief path;
  `failure_class: null`.
- `status: fail` — a retryable QA failure. `artifact_path: null`; `failure_class` is the classified root cause.
- `status: blocked` — `spec-ambiguity`, retry-cap exhaustion, or a CRITICAL security finding. `artifact_path: null`;
  `failure_class` set accordingly.

Example (success):

```result
status: ok
artifact_path: docs/specs/weave/engines/<entity>/04-arch/tasks/TASK-001.md
failure_class: null
```

Example (blocked):

```result
status: blocked
artifact_path: null
failure_class: spec-ambiguity
```

## Evaluation Criteria

When testing this skill, verify:

- **Correct orchestration sequence**: PDAC cycle executes in order (Plan, Delegate, Assess, Codify) for each task
- **Spec review on first run**: Spec review runs before scaffolding and blocks on critical gaps
- **Scaffolding project type gate**: User is asked which project type before scaffolding proceeds
- **Scaffolding HITL gate**: User must approve scaffolding before tasks begin
- **TDD enforced**: Tests are written before implementation code; commits follow test-first order
- **Code review before every commit**: `/code-review` runs before each commit in the Engineer workflow
- **QA cycle with retry**: Failed QA is classified (logic | dependency | interface | spec-ambiguity) and retried
  per the class retry cap (logic 3, dependency 1, interface 1, spec-ambiguity 0); cap exhaustion escalates to the human
- **One PR per epic**: a PR is opened only when `epic-check` reports the epic COMPLETE, not per task
- **Cross-screen integration check**: UI-affecting epics run `ui_verify.sh --full` on the assembled
  epic branch before the PR; a non-zero exit blocks the PR
- **PR review after PR creation**: `/code-review` runs on every created PR
- **Security review at phase gate**: `/security-review` runs when all tasks in a phase are done
- **Phase gate HITL**: User must Approve/Amend/Reject at every phase boundary
- **State management works**: `progress.json` accurately reflects task and phase states throughout the loop
- **DoR check blocks**: Tasks with unsatisfied DoR are not started
- **Shared epic branch**: tasks in an epic commit sequentially onto `feature/{EPIC_ID}`; one PR per epic
- **Sequential on shared branch**: grouped-epic tasks run in place on the shared epic branch (no
  per-task worktree for Engineer or QA — a branch cannot live in two worktrees)
- **No spec leakage**: Engineer only reads the task brief, not other spec files
- **Correct paths**: All script and spec paths use Weave conventions (`.claude/scripts/`, `docs/specs/`)
