---
description: "Run the PDAC implementation loop: Architect curates context, Engineer implements via TDD, QA validates."
argument-hint: "[TASK-NNN|scaffold|status]"
---

# /implement

Run the PDAC implementation loop: Architect curates context -> Engineer implements via TDD -> QA validates.

## Description

This is the core implementation command. It orchestrates the Architect -> Engineer -> QA loop for each task in the current phase, following the PDAC cycle between HITL gates.

**PDAC within each phase:**
- **Plan:** Tech Architect curates context for the next task
- **Delegate:** Engineer implements via TDD in a Weave loop
- **Assess:** QA validates against DoD, extends tests
- **Codify:** Update progress, move to next task

## Instructions

When the user runs `/implement`, execute the following steps in order. You are the orchestrator — you invoke the subagents and manage state.

### Step 1: Read State and Determine Next Action

1. Run `${CLAUDE_PLUGIN_ROOT}/scripts/progress.sh kanban` to display current state
2. Run `${CLAUDE_PLUGIN_ROOT}/scripts/progress.sh ready` to get next task whose dependencies are satisfied
3. Read `.claude/specs/<entity>/03-roadmap/roadmap.md` to understand current phase and gates
4. If no tasks exist, tell the user to run `/architect` first

### Step 2: Check Scaffolding (First Run Only)

If no `package.json` exists in the project root, this is the first run:

**2a. Dependency Check (before anything else):**

Invoke the `dependency-check` skill to verify all required system dependencies and credentials are available. This checks: node, npm, git, npx, and any phase-specific tools (gh, docker, aws, terraform). Also checks credentials are set as environment variables (never asks for secret values). Stops if critical dependencies are missing.

**2b. Spec Review (before scaffolding):**

Invoke the `/spec-review` skill to review all specs in detail before proceeding. This ensures the specs are complete, consistent, and ready to implement against. The review covers:
- Brief, PRD, Roadmap — completeness and consistency
- Tech Spec sections — all required diagrams present, API contracts match data model, testing strategy covers all epics
- Task briefs — DoR satisfied, test requirements present, no gaps
- Standards — linting rules, git workflow, code style all defined

Present the review summary to the user. If critical gaps found, STOP and ask the user to address them via `/architect` before proceeding.

**2c. Scaffolding:**

1. Read `.claude/specs/<entity>/04-arch/tech-spec/architecture.md` for tech stack
2. Read `.claude/specs/<entity>/04-arch/tech-spec/testing-strategy.md` for test config
3. Read `docs/standards/linting.md` for ESLint config
4. Invoke the **engineer** subagent with this prompt:

```
You are the Weave Engineer in SCAFFOLDING mode. Set up the project:

1. Create Next.js app (npx create-next-app@latest --typescript --eslint --app)
2. Install: vitest @testing-library/react playwright eslint-plugin-sonarjs
3. Configure ESLint with SonarJS rules per docs/standards/linting.md
4. Configure Vitest per .claude/specs/<entity>/04-arch/tech-spec/testing-strategy.md
5. Configure Playwright
6. ESSENTIAL: Install husky + lint-staged for git hooks:
   - Pre-commit hook: run eslint --fix + vitest run --changed
   - Pre-push hook: run full test suite (vitest run)
   - This prevents ANY agent from committing code that fails lint or tests
7. Create a smoke test that verifies the app renders
8. Commit each step separately with conventional commits

When done, verify: npm run dev works, npm test passes, npm run lint passes,
git hooks are active (test by making a deliberate lint error and attempting commit).
```

5. **Enforced HITL gate after scaffolding.** Ask user via AskUserQuestion:
   - "Scaffolding complete. Verify your environment" with options:
   - **Approve** — environment works, proceed to tasks
   - **Amend** — something needs fixing (describe)
   - **Reject** — start scaffolding over

### Step 2d: Check for Unextracted Prototypes

If `prototype/` exists and contains projects, check whether any have a `DECISIONS.md` but haven't been extracted (no extraction markers in specs):

Suggest: "Prototype projects found that may have unextracted artefacts. Run `/architect` to extract and generate/update specs first. Or continue with current specs."

Options via AskUserQuestion: **Extract first (recommended)** / **Continue with current specs**

### Step 3: PDAC Loop (Per Task)

Get ready tasks from `${CLAUDE_PLUGIN_ROOT}/scripts/progress.sh ready` (tasks whose dependencies are all satisfied).
If result is "NONE", go to Step 4 (Phase Gate).
If multiple ready tasks are returned, auto-batch them using `/batch` to run in parallel worktrees. No human approval needed for batching.

For the task:

#### PLAN

1. Read the task brief: `.claude/specs/<entity>/04-arch/tasks/{TASK_ID}.md`
1a. Read progress summaries for all `blocked_by` tasks from `.claude/state/summaries/` — these provide context about decisions, nuances, and edge cases from prior work
2. Verify the DoR checklist at the bottom of the brief — all items should be checked
3. If DoR not satisfied, report which items are missing and stop

#### DELEGATE

4. Update progress: run `${CLAUDE_PLUGIN_ROOT}/scripts/progress.sh update {TASK_ID} in_progress`
5. Create a feature branch: `git checkout -b feature/{TASK_ID}`
6. Invoke the **engineer** subagent with `isolation: "worktree"` and this prompt:

```
You are the Weave Engineer. Implement this task via strict TDD.

TASK BRIEF:
{paste the full content of the task brief file here}

STANDARDS:
- Read docs/standards/code-style.md for naming and structure
- Read docs/standards/testing-ts.md or testing-py.md (match the task stack) for test patterns
- Read docs/standards/linting.md for complexity thresholds

WORKFLOW:
1. Write ALL failing tests first (from Test Requirements section)
2. Run /code-review on the test code. Address valid issues. Use discretion — skip untenable feedback.
3. Commit: test: add failing tests for {TASK_ID}
4. Implement minimal code to pass tests
5. Run /code-review on the implementation. Address valid issues. Use discretion.
6. Commit: feat: {description}
7. Refactor while keeping tests green
8. Run /code-review on refactored code. Address valid issues.
9. Commit: refactor: {description} (if needed)
10. Run /simplify on all changed files. Remove dead code, unused imports, update docs.
11. Commit: chore: simplify {description} (if changes made)
12. Run lint, verify zero errors
13. Verify coverage >= 80%
14. Check every item on the DoD checklist
15. Write progress summary to .claude/state/summaries/{TASK_ID}.md (decisions, nuances, edge cases)

IMPORTANT: Pre-commit hooks (husky + lint-staged) will block commits that fail
lint or unit tests. Fix these before attempting to commit.

Do NOT read spec files other than the task brief. It is self-contained.
```

7. If the Engineer's worktree has changes, they will be on the worktree branch

#### ASSESS

8. Invoke the **quality-assurance** subagent with `isolation: "worktree"` and this prompt:

```
You are the Weave QA agent. Validate this implementation.

TASK BRIEF:
{paste the full content of the task brief file here}

VALIDATION:
1. Run all tests — verify they pass
2. Check coverage >= 80%
3. Run lint — verify zero errors
4. Check cyclomatic complexity <= 10, cognitive <= 15
5. Verify JSDoc on all public functions
6. Check each acceptance criterion is met with a passing test
7. Check diagram references were followed
8. Check design decisions were followed
9. PO review: does this deliver user value per the user story?
10. Identify edge cases not covered — write additional tests

Produce a QA report. If ALL checks pass, output:
QA_RESULT: PASS

If ANY check fails, output:
QA_RESULT: FAIL
Then produce a structured failure report per the template.
```

9. Read QA result:
   - **PASS**: Merge the worktree branch into the feature branch. Continue to CODIFY.
   - **FAIL**: Feed the failure report back to the Engineer agent as context. Re-run DELEGATE with the failure report appended. Limit to 3 QA cycles per task — if still failing after 3, pause and ask the human via AskUserQuestion.

#### CODIFY

10. Update progress: `${CLAUDE_PLUGIN_ROOT}/scripts/progress.sh update {TASK_ID} done`
11. Create a PR for the feature branch:
    ```
    gh pr create --title "feat: {TASK_ID} - {task title}" --body "Closes {TASK_ID} (Epic: {EPIC_ID})..."
    ```
    (If `gh` not available, tell the user to create the PR manually)

12. **PR Review Gate**: Run `/code-review` on the PR. Review any issues raised. Address valid feedback with discretion — some items may be untenable given task constraints. Commit fixes if needed.

13. Check phase status: `${CLAUDE_PLUGIN_ROOT}/scripts/progress.sh phase-check`
14. If phase INCOMPLETE: loop back to Step 3 with next task
15. If phase COMPLETE: proceed to Step 4

### Step 4: Phase Gate

When `phase-check` returns COMPLETE:

1. **Security Review**: Run `/security-review` across all code changed in this phase. Address any valid security issues. Use discretion — some findings may be false positives or untenable. Commit fixes before proceeding.

2. Display the phase gate checklist (from `.claude/specs/<entity>/03-roadmap/roadmap.md` or the phase-gate template)
3. Run `${CLAUDE_PLUGIN_ROOT}/scripts/progress.sh kanban` to show final state
4. Ask user via AskUserQuestion:
   - **Approve** — phase complete, proceed to next phase
   - **Amend** — specific items need addressing
   - **Reject** — significant rework needed
5. If approved, update phase in progress.json
6. **Re-run dependency check** for the next phase (new phase may need additional tools or credentials)
7. Loop back to Step 3 for next phase's tasks

## Arguments

- No arguments: Continue from current task in current phase
- `TASK-{NNN}`: Run a specific task (skip to that task in the loop)
- `scaffold`: Run scaffolding step only
- `status`: Show kanban board (shortcut for /status)

## Examples

```
/implement
/implement TASK-001
/implement scaffold
```
