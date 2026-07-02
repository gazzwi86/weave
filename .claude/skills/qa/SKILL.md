---
name: qa
description: Validate implementation against task briefs, acceptance criteria, Definition of Done, and design decisions, extending tests for edge cases and producing structured pass/fail reports. Invoked by /implement during the ASSESS phase, or standalone via /qa.
---

# Quality Assurance

Validate implementation against task briefs, acceptance criteria, Definition of Done, and design decisions. Extend tests for edge cases. Produce structured pass/fail reports.

## Trigger

- Called by `/implement` during the ASSESS phase of each task
- Can be invoked standalone: `/qa`
- Arguments: none (QA all completed tasks), `TASK-{NNN}` (specific task), `--full` (full QA including edge case extension)

## Instructions

### Step 0: Preflight — Progress Summary Check

Before any other validation, read `.claude/state/summaries/TASK-{NNN}.md`. Verify:
1. The file exists
2. "Assumptions Made" section has content (even if "None — brief was fully specified")
3. "Decisions Made" section has content

If the summary is absent or either section contains only template placeholders, return `QA_RESULT: FAIL` immediately with reason: "Progress summary incomplete — Engineer must document decisions and assumptions before QA."

### Step 1: Determine Scope

1. Read `.claude/state/progress.json` for task statuses
2. If a task ID is provided as argument, validate that specific task
3. If no argument, validate all tasks in "done" status that have not been QA'd

### Step 2: Announce Review Plan

Before reviewing, tell the user what will be checked:

```
QA Review for {TASK_ID}. I will validate these categories (3a–3l), then extend edge cases:
  Always:        3a Acceptance criteria · 3b Coverage (>=80%) · 3c Code quality · 3d Design
                 decisions · 3e Diagram compliance · 3f PO review · 3g Git hygiene · 3k Mutation
  Conditional:   3h Performance (page) · 3i Accessibility (UI) · 3j API performance (API) ·
                 3l UI Verification (UI — deterministic ui_verify gate; supersedes 3h/3i for UI)
Then: Step 4 edge-case extension.
```

### Step 3: Validation Checklist (Per Task)

For each task being validated, read the task brief from `docs/specs/weave/engines/<entity>/<milestone>/tasks/{TASK_ID}.md` and check ALL of the following. Present findings one category at a time -- after each category, note pass/fail before moving to the next.

Apply the shared review rubric in [`docs/standards/code-review.md`](../../../docs/standards/code-review.md) throughout: its severity taxonomy (blocker/major/minor/nit), comment discipline (>80% confidence, `file:line` citations, no duplication of linter/type-checker output, nit cap), and the new-user→feature flow check are the same standard the CI review bot uses. The categories below are the harness's DoD-specific instantiation of that rubric — the CI bot and `/qa` must not diverge.

#### 3a. Acceptance Criteria Met
- Read the task brief's AC table
- For each AC, verify:
  - The behaviour works as specified
  - A test exists that validates this AC
  - The test passes

#### 3b. Test Coverage
- Run `npm run test:coverage`
- Verify coverage >= 80% for changed files
- Verify all test types required by the task brief exist:
  - Unit test count meets minimum
  - Integration test count meets minimum (if specified)
  - E2E test count meets minimum (if specified)
- Check AC-to-test mapping: every AC has at least one test

#### 3c. Code Quality
- Run `npm run lint`
- Verify zero lint errors
- Check cyclomatic complexity <= 10 per function
- Check cognitive complexity <= 15 per function
- Check function length <= 50 lines
- Verify JSDoc on all public functions/components

#### 3d. Design Decision Compliance
- Read the design decisions referenced in the task brief
- Verify implementation follows them
- Flag any deviations

#### 3e. Diagram Compliance
- Read the diagram references in the task brief (sequence, state, ERD)
- Verify implementation matches the specified flows and data structures

#### 3f. PO Review
- Re-read the user story
- Ask: "Does this implementation deliver what the user actually needs?"
- Check for anything that works technically but misses the intent

#### 3g. Git Hygiene
- Verify commits follow conventional format
- Verify each commit is a logical unit
- Verify PR description references epic and task

#### 3h. Performance (page-affecting stories only)

**Smart detection:** Only run if the task brief mentions page, component, UI, or frontend.
- Run Lighthouse audit (performance + best practices scores)
- Check scores against targets in `docs/specs/weave/engines/<entity>/tech-spec/testing-strategy.md`
- Check bundle size if applicable

#### 3i. Accessibility (UI-affecting stories only)

**Smart detection:** Only run if the task brief mentions UI, component, page, or user interaction.
- Run Lighthouse accessibility audit
- Check WCAG 2.1 AA compliance (axe-core if available)
- Verify keyboard navigation for interactive elements
- Check colour contrast ratios

#### 3j. API Performance (API-affecting stories only)

**Smart detection:** Only run if the task brief mentions API endpoint, route handler, or backend service.
- Measure response times against targets in `docs/specs/weave/engines/<entity>/tech-spec/testing-strategy.md`
- Basic load test if applicable (10 concurrent requests)

#### 3k. Mutation Testing (changed files)

Run mutation testing scoped to files changed in this task:

```bash
# Python (if .py files changed)
CHANGED_PY=$(git diff --name-only HEAD | grep '\.py$')
if [ -n "$CHANGED_PY" ]; then
  uv run mutmut run --paths-to-mutate="$CHANGED_PY" &
  MUTMUT_PID=$!
  sleep 90 && kill $MUTMUT_PID 2>/dev/null &
  wait $MUTMUT_PID 2>/dev/null
  uv run mutmut results
fi

# TypeScript (if .ts/.tsx files changed)
CHANGED_TS=$(git diff --name-only HEAD | grep -E '\.(ts|tsx)$')
if [ -n "$CHANGED_TS" ]; then
  npx stryker run --incremental --reporters clear-text,json 2>/dev/null
fi
```

**Gate rule:** mutation score < 70% on changed files → WARN (not FAIL — timeout or runner absent is treated as a
warning, not a block). Report the surviving mutant count.

#### 3l. UI Verification (UI-affecting stories only) — DETERMINISTIC GATE

**Smart detection:** run only if the task touches a screen/component/page. For UI-affecting tasks
this is the AUTHORITATIVE gate and supersedes the soft Lighthouse/axe checks in 3h/3i.

Re-execute the deterministic UI gate — do not self-report a pass:

```bash
# Per-task QA: deterministic checks only (no run-book — a human signs that at the epic/phase gate).
.claude/scripts/ui_verify.sh --full --target <served-url-for-this-screen>
```

`ui_verify.sh` runs structure + links-up + axe (browser-free), Playwright functional click-through,
8-state visual diff, Lighthouse (100 bar), and an advisory vision check. It **fails closed**: a
missing Playwright/Lighthouse toolchain is a FAIL, not a skip.

**Gate rule:** `ui_verify.sh` exit ≠ 0 → `QA_RESULT: FAIL` (hard, not WARN).

**Run-book:** scaffold a human run-book from `.claude/spec-templates/ui-runbook.md` (fill the steps
and expected states from the ACs and the nav path) and reference it in the task summary. Do NOT sign
`vouched-by:` yourself — a human signs it when reviewing the assembled epic at the phase gate
(`phase-gate` Step 3b re-runs `ui_verify` **with** `--runbook` and blocks Approve if unsigned). A
screen no human has vouched for is not done.

### Step 4: Edge Case Extension

After validation, identify edge cases NOT covered by existing tests:
- Boundary values (empty arrays, zero, null, max values)
- Error conditions (network failure, invalid input, timeout)
- Race conditions (if applicable)
- State transitions not covered by happy path

Write additional tests for discovered edge cases. Commit: `test: add edge case tests for TASK-{NNN}`

### Step 5: Report

#### Pass Report Format
```
# QA Report: TASK-{NNN}

## Status: PASS

## Summary
All acceptance criteria met. {count} tests passing. Coverage: {%}.
Edge cases added: {count} additional tests.

## Checklist
- [x] All AC met
- [x] Test coverage >= 80%
- [x] Lint passes
- [x] Complexity within thresholds
- [x] Design decisions followed
- [x] Diagram compliance verified
- [x] PO review: delivers user value
- [x] Git hygiene verified
```

If ALL checks pass, output: `QA_RESULT: PASS`

#### Failure Report Format
```
# QA Failure Report: TASK-{NNN}

## Status: FAIL

## Failures

### 1. {Category}: {What failed}
- **Expected:** {What should happen}
- **Actual:** {What actually happens}
- **Location:** {File path and line number}
- **AC Reference:** {Which acceptance criterion}
- **Suggested Fix:** {How to resolve}

## Test Gaps Identified
- {Edge case 1 that needs a test}

## Summary
{1-2 sentences on overall assessment}
Failures: {count} | Warnings: {count} | Edge cases added: {count}
```

If ANY check fails, output: `QA_RESULT: FAIL`

#### Result Block (mandatory terminal output)

End every QA run with a fenced `result` block as the final output. This is what `/implement` parses during ASSESS;
the orchestrator reads the **last** such block:

```result
status: ok | fail | blocked
artifact_path: <task brief path or null>
failure_class: logic | dependency | interface | spec-ambiguity | null
```

- PASS → `status: ok`, `artifact_path` = the task brief path
  (`docs/specs/weave/engines/<entity>/<milestone>/tasks/{TASK_ID}.md`), `failure_class: null`
- FAIL → `status: fail`, `artifact_path: null`, `failure_class` = best-guess root cause
  (`logic | dependency | interface | spec-ambiguity`)
- A blocker that must stop the loop (e.g. a CRITICAL security finding) → `status: blocked`, `artifact_path: null`

The `QA_RESULT:` line is retained for backward compatibility; the `result` block is authoritative.

### Boundaries

- Do NOT modify implementation code (only add tests)
- Do NOT make architectural decisions
- Do NOT skip any validation category
- Do NOT pass a task that has failing tests
- Do NOT pass a task that does not meet coverage thresholds

## Evaluation Criteria

When testing this skill, verify:

- **Catches real issues**: Identifies actual bugs, test gaps, and standards violations rather than false positives
- **Report format correct**: Pass and fail reports follow the structured templates with all required fields
- **Edge cases identified**: Additional tests cover boundary values, error conditions, and untested state transitions
- **All validation categories checked**: None of the always-on categories (3a AC, 3b coverage, 3c quality, 3d design decisions, 3e diagrams, 3f PO review, 3g git hygiene, 3k mutation) are skipped; conditional categories (3h/3i/3j/3l) run when the task matches
- **UI gate enforced**: for UI-affecting tasks, `ui_verify.sh` is re-executed and a non-zero exit fails the task (never self-reported, never WARN)
- **Incremental presentation**: Findings are presented one category at a time, not as a monolithic dump
- **AC-to-test mapping verified**: Every acceptance criterion has a corresponding passing test
- **Coverage threshold enforced**: Tasks below 80% coverage are failed
- **Complexity thresholds enforced**: Functions exceeding cyclomatic (10) or cognitive (15) limits are flagged
- **PO review perspective**: Report assesses whether the implementation delivers actual user value, not just technical correctness
- **Failure reports are actionable**: Each failure includes location, expected/actual, and a suggested fix
- **QA_RESULT line present**: Output includes exactly `QA_RESULT: PASS` or `QA_RESULT: FAIL` for machine parsing
