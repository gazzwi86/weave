---
description: Display a kanban-style progress dashboard showing current project status.
---

# /status

Display a kanban-style progress dashboard showing current project status.

**Backed by skill:** `${CLAUDE_PLUGIN_ROOT}/skills/status/SKILL.md`

## Description

Reads `.claude/state/progress.json` and renders a kanban board of tasks, the approval status of
each spec artifact, a per-entity spec-health map plus OKF bundle conformance check, and the
suggested next action based on current project state.

## Instructions

Invoke the `status` skill. See `${CLAUDE_PLUGIN_ROOT}/skills/status/SKILL.md` for full logic.

## Arguments

- No arguments: display full status dashboard

## Examples

```
/status
```
