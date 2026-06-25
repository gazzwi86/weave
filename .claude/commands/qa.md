---
description: Run a standalone quality assurance check on implemented code against the specs.
argument-hint: "[TASK-NNN|--full]"
---

# /qa

Run a standalone quality assurance check on implemented code.

## Description

Invokes the QA agent to validate the current implementation against specs. Can be run on a specific task or across all completed tasks. Useful for manual QA checks outside the implementation loop.

## Instructions

When the user runs `/qa`:

1. Read `.claude/state/progress.json` for completed tasks
2. Identify what to validate:
   - If task ID provided: validate that specific task
   - If no argument: validate all tasks in "done" status that haven't been QA'd
3. Launch the QA agent for each task
4. Display pass/fail reports

## Arguments

- No arguments: QA all completed tasks
- `TASK-{NNN}`: QA a specific task
- `--full`: Full QA including edge case extension

## Examples

```
/qa
/qa TASK-001
/qa --full
```
