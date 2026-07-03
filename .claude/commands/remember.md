---
description: Save a fact to project or user memory.
argument-hint: "<fact>"
---

# /remember

Save a fact to project or user memory.

**Backed by skill:** `${CLAUDE_PLUGIN_ROOT}/skills/project-memory/SKILL.md`

## Description

Invokes the `project-memory` skill, which classifies the fact and routes it: repo/team/initiative
facts go to the committed `.claude/memory/` layer, personal preferences go to user-level memory
instead.

## Instructions

Invoke the `project-memory` skill with the supplied fact. See
`${CLAUDE_PLUGIN_ROOT}/skills/project-memory/SKILL.md` for full logic.

## Arguments

- `<fact>`: the fact to remember (required)

## Examples

```
/remember We decided to use ULIDs instead of UUIDs for loop IDs
```
