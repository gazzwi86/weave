---
description: Manage rapid, exploratory prototypes using the vibe code approach.
argument-hint: "[new <name>|continue <name>|list]"
---

# /prototype

Manage rapid prototypes using the vibe code approach.

**Backed by skill:** `${CLAUDE_PLUGIN_ROOT}/skills/prototype/SKILL.md`

## Description

Invokes the Prototyper agent for rapid, exploratory prototyping. Each prototype project lives in `prototype/{name}/` as an independent, runnable project. Multiple competing approaches are encouraged. Prototypes are disposable — the value is in the E2E tests, patterns, and decisions extracted into the main spec.

## Instructions

Invoke the `prototype` skill. See `${CLAUDE_PLUGIN_ROOT}/skills/prototype/SKILL.md` for full logic.

Every invocation presents options via AskUserQuestion — no silent defaults.

## Arguments

- No arguments: presents full menu (new / continue / list / extract)
- `new {name}`: start a new prototype project
- `continue {name}`: continue an existing prototype project
- `list`: show all prototype projects with status

## Examples

```
/prototype
/prototype new frontend-nextjs
/prototype continue api
/prototype list
```
